import type { EnabledLayer } from '../config'
import type { SkyObject } from '../viewer/contracts'
import {
  AIRCRAFT_DEGRADED_MESSAGE,
  type AircraftApiResponse,
  AircraftApiResponseSchema,
  type AircraftAvailability,
} from './contracts'

export interface AircraftDetailMetadata {
  typeLabel: 'Aircraft'
  altitudeFeet: number
  altitudeMeters: number
  headingCardinal?: string
  speedKph?: number
  rangeKm: number
  originCountry?: string
}

const DEFAULT_AIRCRAFT_LIMIT = 50
const MIN_AIRCRAFT_ELEVATION_DEG = 2

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
  enabledLayers,
}: {
  snapshot: AircraftApiResponse | null
  enabledLayers: Readonly<Record<EnabledLayer, boolean>>
}) {
  if (!enabledLayers.aircraft || !snapshot) {
    return []
  }

  return snapshot.aircraft
    .filter((aircraft) => aircraft.elevationDeg >= MIN_AIRCRAFT_ELEVATION_DEG)
    .map((aircraft) => {
      const altitudeMeters = Math.round(aircraft.geoAltitudeM ?? aircraft.baroAltitudeM ?? 0)
      const altitudeFeet = Math.round(altitudeMeters * 3.28084)
      const speedKph =
        typeof aircraft.velocityMps === 'number'
          ? Math.round(aircraft.velocityMps * 3.6)
          : undefined

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
        },
      } satisfies SkyObject
    })
    .sort((left, right) => right.importance - left.importance)
}

export function getAircraftAvailabilityMessage(availability: AircraftAvailability) {
  return availability === 'degraded' ? AIRCRAFT_DEGRADED_MESSAGE : null
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

function normalizeDegrees(value: number) {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}
