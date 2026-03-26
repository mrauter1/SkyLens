import {
  degreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  gstime,
  propagate,
  radiansToDegrees,
  twoline2satrec,
  type SatRec,
} from '../vendor/satellite'

import type { EnabledLayer } from '../config'
import type { ObserverState, SkyObject } from '../viewer/contracts'
import type { TleApiResponse, TleSatellite } from './contracts'
import { TleApiResponseSchema } from './contracts'

export interface SatelliteDetailMetadata {
  typeLabel: 'Satellite'
  noradId: number
  elevationDeg: number
  azimuthDeg: number
  rangeKm?: number
  isIss: boolean
}

const SATELLITE_VISIBILITY_MIN_ELEVATION_DEG = 10
const SATELLITE_LIKELY_VISIBLE_SUN_ALTITUDE_DEG = -4
const satrecCache = new Map<string, SatRec>()

export async function fetchSatelliteCatalog(
  fetchImpl: typeof fetch = fetch,
): Promise<TleApiResponse> {
  const response = await fetchImpl('/api/tle', {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('Satellite catalog unavailable.')
  }

  return TleApiResponseSchema.parse(await response.json())
}

export function normalizeSatelliteObjects({
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
}) {
  if (!enabledLayers.satellites || !catalog) {
    return []
  }

  if (likelyVisibleOnly && sunAltitudeDeg > SATELLITE_LIKELY_VISIBLE_SUN_ALTITUDE_DEG) {
    return []
  }

  const date = new Date(timeMs)

  return catalog.satellites
    .map((satellite) => normalizeSatelliteObject(satellite, observer, date))
    .filter((object): object is SkyObject => object !== null)
    .sort((left, right) => right.importance - left.importance)
}

function normalizeSatelliteObject(
  satellite: TleSatellite,
  observer: ObserverState,
  date: Date,
): SkyObject | null {
  const satrec = getSatrec(satellite)
  const propagation = propagate(satrec, date)

  if (!propagation.position) {
    return null
  }

  const gmst = gstime(date)
  const positionEcf = eciToEcf(propagation.position, gmst)
  const lookAngles = ecfToLookAngles(
    {
      longitude: degreesToRadians(observer.lon),
      latitude: degreesToRadians(observer.lat),
      height: observer.altMeters / 1000,
    },
    positionEcf,
  )
  const azimuthDeg = normalizeDegrees(radiansToDegrees(lookAngles.azimuth))
  const elevationDeg = radiansToDegrees(lookAngles.elevation)
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
      detail: {
        typeLabel: 'Satellite',
        noradId: satellite.noradId,
        elevationDeg: roundedElevationDeg,
        azimuthDeg: roundedAzimuthDeg,
        rangeKm: roundedRangeKm,
        isIss: satellite.isIss,
      } satisfies SatelliteDetailMetadata,
    },
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

function normalizeDegrees(value: number) {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function roundAngle(value: number) {
  return Number(value.toFixed(2))
}
