import type { EnabledLayer } from '../config'
import type {
  AircraftApiAircraft,
  AircraftApiResponse,
} from '../aircraft/contracts'
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
  headingCardinal?: string
  speedKph?: number
  rangeKm: number
  originCountry?: string
}

export type AircraftMotionState = 'live' | 'interpolated' | 'estimated' | 'stale'
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

const AIRCRAFT_DEFAULT_TRANSITION_MS = 10_000
const AIRCRAFT_ENTRY_EXIT_FADE_MS = 2_500
const AIRCRAFT_STALE_AFTER_MS = 20_000
const AIRCRAFT_STALE_FADE_MS = 10_000
const AIRCRAFT_DEAD_RECKON_MAX_MS = 10_000
const SATELLITE_STALE_OPACITY = 0.7
const EARTH_RADIUS_METERS = 6_371_000
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
  aircraftSnapshot,
  aircraftPreviousSnapshot,
  aircraftTransitionStartedAtMs,
  satelliteCatalog,
}: {
  observer: ObserverState
  timeMs: number
  enabledLayers: Readonly<Record<EnabledLayer, boolean>>
  likelyVisibleOnly: boolean
  sunAltitudeDeg: number
  aircraftSnapshot: AircraftApiResponse | null
  aircraftPreviousSnapshot: AircraftApiResponse | null
  aircraftTransitionStartedAtMs: number | null
  satelliteCatalog: TleApiResponse | null
}): ResolveMovingSkyObjectsResult {
  return {
    aircraft: resolveAircraftMotionObjects({
      snapshot: aircraftSnapshot,
      previousSnapshot: aircraftPreviousSnapshot,
      transitionStartedAtMs: aircraftTransitionStartedAtMs,
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
  snapshot,
  previousSnapshot,
  transitionStartedAtMs,
  timeMs,
  observer,
  enabledLayers,
}: {
  snapshot: AircraftApiResponse | null
  previousSnapshot?: AircraftApiResponse | null
  transitionStartedAtMs?: number | null
  timeMs?: number
  observer?: Pick<ObserverState, 'lat' | 'lon' | 'altMeters'>
  enabledLayers: Readonly<Record<EnabledLayer, boolean>>
}): ResolvedMovingObject[] {
  if (!enabledLayers.aircraft || !snapshot) {
    return []
  }

  return resolveAircraftRenderState({
    snapshot,
    previousSnapshot: previousSnapshot ?? null,
    transitionStartedAtMs: transitionStartedAtMs ?? null,
    timeMs,
    observer,
  })
    .filter(({ aircraft }) => aircraft.elevationDeg >= MIN_AIRCRAFT_ELEVATION_DEG)
    .map(({ aircraft, motionOpacity, motionState }) => ({
      confidence: motionOpacity,
      motionState,
      object: buildAircraftObject({
        aircraft,
        motionOpacity,
        motionState,
      }),
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

function buildAircraftObject({
  aircraft,
  motionOpacity,
  motionState,
}: {
  aircraft: AircraftApiAircraft
  motionOpacity: number
  motionState: AircraftMotionState
}) {
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
        headingCardinal: getCardinalHeading(aircraft.headingDeg),
        speedKph,
        rangeKm: aircraft.rangeKm,
        originCountry: aircraft.originCountry,
      } satisfies AircraftDetailMetadata,
      ...(typeof motionOpacity === 'number'
        ? ({
            motionOpacity: Number(motionOpacity.toFixed(2)),
          } satisfies AircraftMotionMetadata)
        : {}),
      ...(motionState !== 'live'
        ? ({
            motionState,
          } satisfies AircraftMotionMetadata)
        : {}),
    },
  } satisfies SkyObject
}

function resolveAircraftRenderState({
  snapshot,
  previousSnapshot,
  transitionStartedAtMs,
  timeMs,
  observer,
}: {
  snapshot: AircraftApiResponse
  previousSnapshot: AircraftApiResponse | null
  transitionStartedAtMs: number | null
  timeMs?: number
  observer?: Pick<ObserverState, 'lat' | 'lon' | 'altMeters'>
}) {
  if (
    typeof timeMs !== 'number' ||
    !Number.isFinite(timeMs) ||
    transitionStartedAtMs === null ||
    !observer
  ) {
    return snapshot.aircraft.map((aircraft) => ({
      aircraft,
      motionOpacity: 1,
      motionState: 'live' as const,
    }))
  }

  const currentById = new Map(snapshot.aircraft.map((aircraft) => [aircraft.id, aircraft]))
  const previousById = new Map(
    previousSnapshot?.aircraft.map((aircraft) => [aircraft.id, aircraft]) ?? [],
  )
  const currentFetchedAtMs = Date.parse(snapshot.fetchedAt)
  const previousFetchedAtMs =
    previousSnapshot === null ? Number.NaN : Date.parse(previousSnapshot.fetchedAt)
  const transitionDurationMs =
    Number.isFinite(previousFetchedAtMs) && currentFetchedAtMs > previousFetchedAtMs
      ? clampNumber(
          currentFetchedAtMs - previousFetchedAtMs,
          1_000,
          AIRCRAFT_DEFAULT_TRANSITION_MS,
        )
      : AIRCRAFT_DEFAULT_TRANSITION_MS
  const transitionElapsedMs = Math.max(0, timeMs - transitionStartedAtMs)
  const snapshotConfidence = getStaleVisibilityFactor({
    fetchedAtMs: currentFetchedAtMs,
    timeMs,
  })

  return [...new Set([...previousById.keys(), ...currentById.keys()])]
    .map((id) => {
      const currentAircraft = currentById.get(id)
      const previousAircraft = previousById.get(id)

      if (currentAircraft && previousAircraft) {
        const progress = clamp01(transitionElapsedMs / transitionDurationMs)

        return {
          aircraft: interpolateAircraft(previousAircraft, currentAircraft, progress),
          motionOpacity: snapshotConfidence,
          motionState:
            snapshotConfidence < 1
              ? ('stale' as const)
              : progress < 1
                ? ('interpolated' as const)
                : ('live' as const),
        }
      }

      if (currentAircraft) {
        const entryOpacity = clamp01(transitionElapsedMs / AIRCRAFT_ENTRY_EXIT_FADE_MS)
        const deadReckoned = deadReckonAircraft({
          aircraft: currentAircraft,
          observer,
          timeMs,
          fetchedAtMs: currentFetchedAtMs,
        })
        const motionOpacity = entryOpacity * snapshotConfidence

        return {
          aircraft: deadReckoned.aircraft,
          motionOpacity,
          motionState:
            snapshotConfidence < 1
              ? ('stale' as const)
              : deadReckoned.didDeadReckon
                ? ('estimated' as const)
                : ('live' as const),
        }
      }

      if (!previousAircraft) {
        return null
      }

      const fadeOpacity = 1 - clamp01(transitionElapsedMs / AIRCRAFT_ENTRY_EXIT_FADE_MS)

      if (fadeOpacity <= 0) {
        return null
      }

      return {
        aircraft: previousAircraft,
        motionOpacity: fadeOpacity,
        motionState: 'stale' as const,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .filter((entry) => entry.motionOpacity > 0)
}

function interpolateAircraft(
  previousAircraft: AircraftApiAircraft,
  currentAircraft: AircraftApiAircraft,
  progress: number,
): AircraftApiAircraft {
  const geoAltitudeM = interpolateOptionalNumber(
    previousAircraft.geoAltitudeM,
    currentAircraft.geoAltitudeM,
    progress,
  )
  const baroAltitudeM = interpolateOptionalNumber(
    previousAircraft.baroAltitudeM,
    currentAircraft.baroAltitudeM,
    progress,
  )
  const velocityMps = interpolateOptionalNumber(
    previousAircraft.velocityMps,
    currentAircraft.velocityMps,
    progress,
  )
  const verticalRateMps = interpolateOptionalNumber(
    previousAircraft.verticalRateMps,
    currentAircraft.verticalRateMps,
    progress,
  )
  const headingDeg =
    typeof previousAircraft.headingDeg === 'number' &&
    typeof currentAircraft.headingDeg === 'number'
      ? roundAngle(
          interpolateAngle(previousAircraft.headingDeg, currentAircraft.headingDeg, progress),
        )
      : currentAircraft.headingDeg ?? previousAircraft.headingDeg

  return {
    ...currentAircraft,
    lat: roundCoordinate(interpolateNumber(previousAircraft.lat, currentAircraft.lat, progress)),
    lon: roundCoordinate(interpolateLongitude(previousAircraft.lon, currentAircraft.lon, progress)),
    ...(typeof geoAltitudeM === 'number' ? { geoAltitudeM } : {}),
    ...(typeof baroAltitudeM === 'number' ? { baroAltitudeM } : {}),
    ...(typeof velocityMps === 'number' ? { velocityMps } : {}),
    ...(typeof headingDeg === 'number' ? { headingDeg } : {}),
    ...(typeof verticalRateMps === 'number' ? { verticalRateMps } : {}),
    azimuthDeg: roundAngle(
      interpolateAngle(previousAircraft.azimuthDeg, currentAircraft.azimuthDeg, progress),
    ),
    elevationDeg: roundAngle(
      interpolateNumber(previousAircraft.elevationDeg, currentAircraft.elevationDeg, progress),
    ),
    rangeKm: roundRange(
      interpolateNumber(previousAircraft.rangeKm, currentAircraft.rangeKm, progress),
    ),
  }
}

function deadReckonAircraft({
  aircraft,
  observer,
  timeMs,
  fetchedAtMs,
}: {
  aircraft: AircraftApiAircraft
  observer: Pick<ObserverState, 'lat' | 'lon' | 'altMeters'>
  timeMs: number
  fetchedAtMs: number
}) {
  const elapsedMs = Math.max(0, timeMs - fetchedAtMs)
  const boundedElapsedMs = Math.min(elapsedMs, AIRCRAFT_DEAD_RECKON_MAX_MS)

  if (
    boundedElapsedMs <= 0 ||
    typeof aircraft.velocityMps !== 'number' ||
    typeof aircraft.headingDeg !== 'number'
  ) {
    return {
      aircraft,
      didDeadReckon: false,
    }
  }

  const predictedPosition = projectPosition({
    lat: aircraft.lat,
    lon: aircraft.lon,
    headingDeg: aircraft.headingDeg,
    distanceMeters: aircraft.velocityMps * (boundedElapsedMs / 1_000),
  })
  const altitudeMeters = Math.max(
    0,
    (aircraft.geoAltitudeM ?? aircraft.baroAltitudeM ?? 0) +
      (aircraft.verticalRateMps ?? 0) * (boundedElapsedMs / 1_000),
  )
  const relativePose = getRelativePose({
    aircraftLat: predictedPosition.lat,
    aircraftLon: predictedPosition.lon,
    altitudeMeters,
    observer,
  })

  return {
    aircraft: {
      ...aircraft,
      lat: roundCoordinate(predictedPosition.lat),
      lon: roundCoordinate(predictedPosition.lon),
      ...(typeof aircraft.geoAltitudeM === 'number'
        ? { geoAltitudeM: Math.round(altitudeMeters) }
        : {}),
      ...(typeof aircraft.baroAltitudeM === 'number'
        ? { baroAltitudeM: Math.round(altitudeMeters) }
        : {}),
      azimuthDeg: roundAngle(relativePose.azimuthDeg),
      elevationDeg: roundAngle(relativePose.elevationDeg),
      rangeKm: roundRange(relativePose.rangeKm),
    },
    didDeadReckon: true,
  }
}

function getStaleVisibilityFactor({
  fetchedAtMs,
  timeMs,
}: {
  fetchedAtMs: number
  timeMs: number
}) {
  const ageMs = Math.max(0, timeMs - fetchedAtMs)

  if (ageMs <= AIRCRAFT_STALE_AFTER_MS) {
    return 1
  }

  return 1 - clamp01((ageMs - AIRCRAFT_STALE_AFTER_MS) / AIRCRAFT_STALE_FADE_MS)
}

function getRelativePose({
  aircraftLat,
  aircraftLon,
  altitudeMeters,
  observer,
}: {
  aircraftLat: number
  aircraftLon: number
  altitudeMeters: number
  observer: Pick<ObserverState, 'lat' | 'lon' | 'altMeters'>
}) {
  const surfaceDistanceMeters = getSurfaceDistanceMeters(
    { lat: observer.lat, lon: observer.lon },
    { lat: aircraftLat, lon: aircraftLon },
  )
  const altitudeDeltaMeters = altitudeMeters - observer.altMeters

  return {
    azimuthDeg: getBearingDeg(observer, { lat: aircraftLat, lon: aircraftLon }),
    elevationDeg: radiansToDegrees(Math.atan2(altitudeDeltaMeters, surfaceDistanceMeters)),
    rangeKm: Math.sqrt(surfaceDistanceMeters ** 2 + altitudeDeltaMeters ** 2) / 1_000,
  }
}

function projectPosition({
  lat,
  lon,
  headingDeg,
  distanceMeters,
}: {
  lat: number
  lon: number
  headingDeg: number
  distanceMeters: number
}) {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS
  const headingRad = degreesToRadians(headingDeg)
  const latRad = degreesToRadians(lat)
  const lonRad = degreesToRadians(lon)
  const nextLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(headingRad),
  )
  const nextLonRad =
    lonRad +
    Math.atan2(
      Math.sin(headingRad) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(nextLatRad),
    )

  return {
    lat: radiansToDegrees(nextLatRad),
    lon: normalizeLongitude(radiansToDegrees(nextLonRad)),
  }
}

function getAircraftImportance(rangeKm: number, elevationDeg: number) {
  const rangeScore = Math.max(0, 36 - Math.min(rangeKm, 180) / 5)
  const elevationScore = Math.max(0, elevationDeg / 2)

  return Number((52 + rangeScore + elevationScore).toFixed(2))
}

function getCardinalHeading(headingDeg?: number) {
  if (typeof headingDeg !== 'number') {
    return undefined
  }

  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const index = Math.round(normalizeDegrees(headingDeg) / 45) % directions.length

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

  if (!propagation.position) {
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

function clamp01(value: number) {
  return clampNumber(value, 0, 1)
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function interpolateNumber(start: number, end: number, progress: number) {
  return start + (end - start) * progress
}

function interpolateOptionalNumber(
  start: number | undefined,
  end: number | undefined,
  progress: number,
) {
  if (typeof start === 'number' && typeof end === 'number') {
    return roundCoordinate(interpolateNumber(start, end, progress))
  }

  return end ?? start
}

function interpolateAngle(start: number, end: number, progress: number) {
  const delta = ((end - start + 540) % 360) - 180
  return normalizeDegrees(start + delta * progress)
}

function interpolateLongitude(start: number, end: number, progress: number) {
  const delta = ((end - start + 540) % 360) - 180
  return normalizeLongitude(start + delta * progress)
}

function getSurfaceDistanceMeters(
  left: Pick<ObserverState, 'lat' | 'lon'>,
  right: Pick<AircraftApiAircraft, 'lat' | 'lon'>,
) {
  const lat1 = degreesToRadians(left.lat)
  const lat2 = degreesToRadians(right.lat)
  const deltaLat = degreesToRadians(right.lat - left.lat)
  const deltaLon = degreesToRadians(right.lon - left.lon)
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getBearingDeg(
  left: Pick<ObserverState, 'lat' | 'lon'>,
  right: Pick<AircraftApiAircraft, 'lat' | 'lon'>,
) {
  const lat1 = degreesToRadians(left.lat)
  const lat2 = degreesToRadians(right.lat)
  const deltaLon = degreesToRadians(right.lon - left.lon)
  const y = Math.sin(deltaLon) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon)

  return normalizeDegrees(radiansToDegrees(Math.atan2(y, x)))
}

function roundCoordinate(value: number) {
  return Number(value.toFixed(4))
}

function roundAngle(value: number) {
  return Number(value.toFixed(2))
}

function roundRange(value: number) {
  return Number(value.toFixed(1))
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI
}

function normalizeDegrees(value: number) {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function normalizeLongitude(value: number) {
  if (value < -180) {
    return value + 360
  }

  if (value > 180) {
    return value - 360
  }

  return value
}
