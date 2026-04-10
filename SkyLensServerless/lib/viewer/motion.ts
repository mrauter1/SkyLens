import type { EnabledLayer } from '../config'
import type {
  AircraftMotionState,
  AircraftTracker,
  ResolvedTrackedAircraft,
} from '../aircraft/tracker'
import type { ObserverState, SkyObject } from './contracts'
import type { TleApiResponse, TleSatellite } from '../satellites/contracts'
import {
  degreesToRadians as satelliteDegreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  gstime,
  propagate,
  radiansToDegrees as satelliteRadiansToDegrees,
  twoline2satrec,
  type SatRec,
} from '../vendor/satellite'

export interface AircraftDetailMetadata {
  typeLabel: 'Aircraft'
  altitudeFeet: number
  altitudeMeters: number
  trackCardinal?: string
  speedKph?: number
  rangeKm: number
  originCountry?: string
}

export type MovingObjectMotionState = AircraftMotionState | 'propagated'

export interface MovingObjectMotionMetadata {
  motionOpacity?: number
  motionState?: MovingObjectMotionState
}

export type AircraftMotionMetadata = MovingObjectMotionMetadata

export interface SatelliteDetailMetadata {
  typeLabel: 'Satellite'
  noradId: number
  elevationDeg: number
  azimuthDeg: number
  rangeKm?: number
  isIss: boolean
}

export interface ResolvedMovingObject<TObject extends SkyObject = SkyObject> {
  confidence: number
  motionState: MovingObjectMotionState
  object: TObject
}

export interface ResolveMovingSkyObjectsResult {
  aircraft: SkyObject[]
  satellites: SkyObject[]
}

const SATELLITE_STALE_OPACITY = 0.7
const MIN_AIRCRAFT_ELEVATION_DEG = 2
const SATELLITE_VISIBILITY_MIN_ELEVATION_DEG = 10
const SATELLITE_LIKELY_VISIBLE_SUN_ALTITUDE_DEG = -4
const satrecCache = new Map<string, SatRec>()

export function resolveMovingSkyObjects({
  observer,
  timeMs,
  enabledLayers,
  likelyVisibleOnly,
  sunAltitudeDeg,
  aircraftTracker,
  satelliteCatalog,
}: {
  observer: ObserverState
  timeMs: number
  enabledLayers: Readonly<Record<EnabledLayer, boolean>>
  likelyVisibleOnly: boolean
  sunAltitudeDeg: number
  aircraftTracker: AircraftTracker | null
  satelliteCatalog: TleApiResponse | null
}): ResolveMovingSkyObjectsResult {
  return {
    aircraft: resolveAircraftMotionObjects({
      tracker: aircraftTracker,
      timeMs,
      observer,
      enabledLayers,
    }).map(({ object }) => object),
    satellites: resolveSatelliteMotionObjects({
      catalog: satelliteCatalog,
      observer,
      timeMs,
      enabledLayers,
      likelyVisibleOnly,
      sunAltitudeDeg,
    }).map(({ object }) => object),
  }
}

export function resolveAircraftMotionObjects({
  tracker,
  timeMs,
  observer,
  enabledLayers,
}: {
  tracker: AircraftTracker | null
  timeMs?: number
  observer?: Pick<ObserverState, 'lat' | 'lon' | 'altMeters'>
  enabledLayers: Readonly<Record<EnabledLayer, boolean>>
}): ResolvedMovingObject[] {
  if (
    !enabledLayers.aircraft ||
    !tracker ||
    !observer ||
    typeof timeMs !== 'number' ||
    !Number.isFinite(timeMs)
  ) {
    return []
  }

  return tracker
    .resolve({
      observer,
      nowMs: timeMs,
    })
    .filter((aircraft) => aircraft.elevationDeg >= MIN_AIRCRAFT_ELEVATION_DEG)
    .map((aircraft) => ({
      confidence: aircraft.motionOpacity,
      motionState: aircraft.motionState,
      object: buildAircraftObject(aircraft),
    }))
    .sort((left, right) => right.object.importance - left.object.importance)
}

export function resolveSatelliteMotionObjects({
  catalog,
  observer,
  timeMs,
  enabledLayers,
  likelyVisibleOnly,
  sunAltitudeDeg,
}: {
  catalog: TleApiResponse | null
  observer: ObserverState
  timeMs: number
  enabledLayers: Readonly<Record<EnabledLayer, boolean>>
  likelyVisibleOnly: boolean
  sunAltitudeDeg: number
}): ResolvedMovingObject[] {
  if (!enabledLayers.satellites || !catalog) {
    return []
  }

  if (likelyVisibleOnly && sunAltitudeDeg > SATELLITE_LIKELY_VISIBLE_SUN_ALTITUDE_DEG) {
    return []
  }

  const date = new Date(timeMs)

  return catalog.satellites
    .map((satellite) =>
      resolveSatelliteMotionObject(satellite, observer, date, catalog.stale === true),
    )
    .filter((entry): entry is ResolvedMovingObject => entry !== null)
    .sort((left, right) => right.object.importance - left.object.importance)
}

function buildAircraftObject(aircraft: ResolvedTrackedAircraft) {
  const altitudeMeters = Math.round(aircraft.geoAltitudeM ?? aircraft.baroAltitudeM ?? 0)
  const altitudeFeet = Math.round(altitudeMeters * 3.28084)
  const speedKph =
    typeof aircraft.velocityMps === 'number' ? Math.round(aircraft.velocityMps * 3.6) : undefined

  return {
    id: aircraft.id,
    type: 'aircraft',
    label: aircraft.callsign ?? 'Unknown flight',
    sublabel: 'Aircraft',
    azimuthDeg: aircraft.azimuthDeg,
    elevationDeg: aircraft.elevationDeg,
    rangeKm: aircraft.rangeKm,
    importance: getAircraftImportance(aircraft.rangeKm, aircraft.elevationDeg),
    metadata: {
      detail: {
        typeLabel: 'Aircraft',
        altitudeFeet,
        altitudeMeters,
        trackCardinal: getCardinalTrack(aircraft.trackDeg),
        speedKph,
        rangeKm: aircraft.rangeKm,
        originCountry: aircraft.originCountry,
      } satisfies AircraftDetailMetadata,
      ...({
        motionOpacity: Number(aircraft.motionOpacity.toFixed(2)),
      } satisfies AircraftMotionMetadata),
      ...(aircraft.motionState !== 'live'
        ? ({
            motionState: aircraft.motionState,
          } satisfies AircraftMotionMetadata)
        : {}),
    },
  } satisfies SkyObject
}

function getAircraftImportance(rangeKm: number, elevationDeg: number) {
  const rangeScore = Math.max(0, 36 - Math.min(rangeKm, 180) / 5)
  const elevationScore = Math.max(0, elevationDeg / 2)

  return Number((52 + rangeScore + elevationScore).toFixed(2))
}

function getCardinalTrack(trackDeg?: number) {
  if (typeof trackDeg !== 'number') {
    return undefined
  }

  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const index = Math.round(normalizeDegrees(trackDeg) / 45) % directions.length

  return directions[index]
}

function resolveSatelliteMotionObject(
  satellite: TleSatellite,
  observer: ObserverState,
  date: Date,
  isCatalogStale: boolean,
): ResolvedMovingObject | null {
  const satrec = getSatrec(satellite)
  const propagation = propagate(satrec, date)

  if (!propagation || !propagation.position) {
    return null
  }

  const gmst = gstime(date)
  const positionEcf = eciToEcf(propagation.position, gmst)
  const lookAngles = ecfToLookAngles(
    {
      longitude: satelliteDegreesToRadians(observer.lon),
      latitude: satelliteDegreesToRadians(observer.lat),
      height: observer.altMeters / 1000,
    },
    positionEcf,
  )
  const azimuthDeg = normalizeDegrees(satelliteRadiansToDegrees(lookAngles.azimuth))
  const elevationDeg = satelliteRadiansToDegrees(lookAngles.elevation)
  const rangeKm = lookAngles.rangeSat

  if (
    !Number.isFinite(azimuthDeg) ||
    !Number.isFinite(elevationDeg) ||
    elevationDeg < SATELLITE_VISIBILITY_MIN_ELEVATION_DEG
  ) {
    return null
  }

  const roundedElevationDeg = roundAngle(elevationDeg)
  const roundedAzimuthDeg = roundAngle(azimuthDeg)
  const roundedRangeKm =
    Number.isFinite(rangeKm) && rangeKm > 0 ? Number(rangeKm.toFixed(1)) : undefined

  return {
    confidence: isCatalogStale ? SATELLITE_STALE_OPACITY : 1,
    motionState: isCatalogStale ? 'stale' : 'propagated',
    object: {
      id: satellite.id,
      type: 'satellite',
      label: satellite.name,
      sublabel: 'Satellite',
      azimuthDeg: roundedAzimuthDeg,
      elevationDeg: roundedElevationDeg,
      rangeKm: roundedRangeKm,
      importance: satellite.isIss ? 88 : 58,
      metadata: {
        isIss: satellite.isIss,
        groups: satellite.groups,
        ...(isCatalogStale
          ? ({
              motionOpacity: SATELLITE_STALE_OPACITY,
              motionState: 'stale',
            } satisfies MovingObjectMotionMetadata)
          : {}),
        detail: {
          typeLabel: 'Satellite',
          noradId: satellite.noradId,
          elevationDeg: roundedElevationDeg,
          azimuthDeg: roundedAzimuthDeg,
          rangeKm: roundedRangeKm,
          isIss: satellite.isIss,
        } satisfies SatelliteDetailMetadata,
      },
    } satisfies SkyObject,
  }
}

function getSatrec(satellite: TleSatellite) {
  const cacheKey = `${satellite.tle1}\n${satellite.tle2}`
  const cached = satrecCache.get(cacheKey)

  if (cached) {
    return cached
  }

  const satrec = twoline2satrec(satellite.tle1, satellite.tle2)
  satrecCache.set(cacheKey, satrec)

  return satrec
}

function roundAngle(value: number) {
  return Number(value.toFixed(2))
}

function normalizeDegrees(value: number) {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}
