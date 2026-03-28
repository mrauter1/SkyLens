import type { EnabledLayer } from '../config'
import { DEFAULT_AIRCRAFT_RADIUS_KM } from '../config'
import type { ObserverState, SkyObject } from '../viewer/contracts'
import {
  resolveAircraftMotionObjects,
  type AircraftDetailMetadata,
  type AircraftMotionMetadata,
} from '../viewer/motion'
import {
  AIRCRAFT_DEGRADED_MESSAGE,
  DEFAULT_AIRCRAFT_LIMIT,
  type AircraftApiResponse,
  type AircraftAvailability,
} from './contracts'
import type { AircraftMotionState, AircraftTracker } from './tracker'
import { fetchOpenSkyAircraft } from './opensky-browser'

export type { AircraftDetailMetadata, AircraftMotionMetadata, AircraftMotionState }
export { AircraftFetchError, type AircraftFetchErrorCode } from './opensky-browser'

export async function fetchAircraftSnapshot(
  observer: {
    lat: number
    lon: number
    altMeters: number
  },
  fetchImpl: typeof fetch = fetch,
): Promise<AircraftApiResponse> {
  return fetchOpenSkyAircraft(
    {
      lat: observer.lat,
      lon: observer.lon,
      altMeters: observer.altMeters,
      radiusKm: DEFAULT_AIRCRAFT_RADIUS_KM,
      limit: DEFAULT_AIRCRAFT_LIMIT,
    },
    fetchImpl,
  )
}

export function normalizeAircraftObjects({
  tracker,
  timeMs,
  observer,
  enabledLayers,
}: {
  tracker: AircraftTracker | null
  timeMs?: number
  observer?: Pick<ObserverState, 'lat' | 'lon' | 'altMeters'>
  enabledLayers: Readonly<Record<EnabledLayer, boolean>>
}): SkyObject[] {
  return resolveAircraftMotionObjects({
    tracker,
    timeMs,
    observer,
    enabledLayers,
  }).map(({ object }) => object)
}

export function getAircraftAvailabilityMessage(availability: AircraftAvailability) {
  return availability === 'degraded' ? AIRCRAFT_DEGRADED_MESSAGE : null
}
