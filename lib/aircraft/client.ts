import type { EnabledLayer } from '../config'
import type { ObserverState, SkyObject } from '../viewer/contracts'
import {
  resolveAircraftMotionObjects,
  type AircraftDetailMetadata,
  type AircraftMotionMetadata,
  type AircraftMotionState,
} from '../viewer/motion'
import {
  AIRCRAFT_DEGRADED_MESSAGE,
  type AircraftApiResponse,
  AircraftApiResponseSchema,
  type AircraftAvailability,
} from './contracts'

export type { AircraftDetailMetadata, AircraftMotionMetadata, AircraftMotionState }

const DEFAULT_AIRCRAFT_LIMIT = 50

export async function fetchAircraftSnapshot(
  observer: {
    lat: number
    lon: number
    altMeters: number
  },
  fetchImpl: typeof fetch = fetch,
): Promise<AircraftApiResponse> {
  const params = new URLSearchParams({
    lat: observer.lat.toString(),
    lon: observer.lon.toString(),
    altMeters: observer.altMeters.toString(),
    radiusKm: '250',
    limit: String(DEFAULT_AIRCRAFT_LIMIT),
  })
  const response = await fetchImpl(`/api/aircraft?${params.toString()}`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('Aircraft snapshot unavailable.')
  }

  return AircraftApiResponseSchema.parse(await response.json())
}

export function normalizeAircraftObjects({
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
}): SkyObject[] {
  return resolveAircraftMotionObjects({
    snapshot,
    previousSnapshot,
    transitionStartedAtMs,
    timeMs,
    observer,
    enabledLayers,
  }).map(({ object }) => object)
}

export function getAircraftAvailabilityMessage(availability: AircraftAvailability) {
  return availability === 'degraded' ? AIRCRAFT_DEGRADED_MESSAGE : null
}
