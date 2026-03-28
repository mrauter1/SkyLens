import { z } from 'zod'

import { MIN_AIRCRAFT_ELEVATION_DEG } from '../config'
import {
  AircraftApiResponseSchema,
  type AircraftApiAircraft,
  type AircraftApiResponse,
  type AircraftQuery,
} from './contracts'

const OPENSKY_STATES_URL = 'https://opensky-network.org/api/states/all'
const EARTH_RADIUS_METERS = 6_371_000

type OpenSkyLongitudeRange = {
  lomin: number
  lomax: number
}

type OpenSkyStatesResponse = {
  time: number
  states: unknown[][]
}

type NormalizedOpenSkyState = Omit<AircraftApiAircraft, 'azimuthDeg' | 'elevationDeg' | 'rangeKm'> & {
  icao24: string
}

const OpenSkyStatesResponseSchema = z.object({
  time: z.number().int().nonnegative(),
  states: z.array(z.array(z.unknown())).nullable().transform((value) => value ?? []),
})

export type AircraftFetchErrorCode = 'network' | 'rate_limited' | 'upstream' | 'invalid_payload'

export class AircraftFetchError extends Error {
  readonly code: AircraftFetchErrorCode
  readonly status?: number

  constructor(
    code: AircraftFetchErrorCode,
    message: string,
    options?: {
      status?: number
      cause?: unknown
    },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined)
    this.name = 'AircraftFetchError'
    this.code = code
    this.status = options?.status
  }
}

export async function fetchOpenSkyAircraft(
  query: AircraftQuery,
  fetchImpl: typeof fetch = fetch,
  now = new Date(),
): Promise<AircraftApiResponse> {
  const responses = await Promise.all(
    buildOpenSkyStatesUrls(query.lat, query.lon, query.radiusKm).map((url) =>
      fetchOpenSkyStates(url, fetchImpl),
    ),
  )

  const snapshotTimeS = Math.max(...responses.map((response) => response.time))
  const aircraft = dedupeOpenSkyStates(responses)
    .map((state) => normalizeAircraftForObserver(state, query))
    .filter((value): value is AircraftApiAircraft => value !== null)
    .sort((left, right) => left.rangeKm - right.rangeKm || left.id.localeCompare(right.id))
    .slice(0, query.limit)

  return AircraftApiResponseSchema.parse({
    fetchedAt: now.toISOString(),
    snapshotTimeS,
    observer: {
      lat: query.lat,
      lon: query.lon,
      altMeters: query.altMeters,
    },
    availability: 'available',
    aircraft,
  })
}

async function fetchOpenSkyStates(url: URL, fetchImpl: typeof fetch): Promise<OpenSkyStatesResponse> {
  let response: Response

  try {
    response = await fetchImpl(url, {
      cache: 'no-store',
    })
  } catch (cause) {
    throw new AircraftFetchError('network', 'OpenSky aircraft request failed.', { cause })
  }

  if (!response.ok) {
    throw new AircraftFetchError(
      response.status === 429 ? 'rate_limited' : 'upstream',
      response.status === 429
        ? 'OpenSky aircraft request was rate limited.'
        : 'OpenSky aircraft request failed.',
      {
        status: response.status,
      },
    )
  }

  let payload: unknown

  try {
    payload = await response.json()
  } catch (cause) {
    throw new AircraftFetchError('invalid_payload', 'OpenSky aircraft payload was invalid.', {
      cause,
    })
  }

  try {
    const parsed = OpenSkyStatesResponseSchema.parse(payload)

    return {
      time: parsed.time,
      states: parsed.states,
    }
  } catch (cause) {
    throw new AircraftFetchError('invalid_payload', 'OpenSky aircraft payload was invalid.', {
      cause,
    })
  }
}

function dedupeOpenSkyStates(responses: OpenSkyStatesResponse[]) {
  const dedupedStates = new Map<string, { score: number; state: NormalizedOpenSkyState }>()

  for (const response of responses) {
    for (const rawState of response.states) {
      const state = normalizeOpenSkyState(rawState)

      if (!state) {
        continue
      }

      const score = (state.timePositionS ?? -1) * 1_000_000 + (state.lastContactS ?? -1)
      const existing = dedupedStates.get(state.icao24)

      if (!existing || score >= existing.score) {
        dedupedStates.set(state.icao24, {
          score,
          state,
        })
      }
    }
  }

  return [...dedupedStates.values()].map((entry) => entry.state)
}

function normalizeOpenSkyState(rawState: unknown[]) {
  const icao24 = normalizeRequiredText(rawState[0])
  const lon = asFiniteNumber(rawState[5])
  const lat = asFiniteNumber(rawState[6])
  const baroAltitudeM = asFiniteNumber(rawState[7])
  const velocityMps = asFiniteNumber(rawState[9])
  const trackDeg = asFiniteNumber(rawState[10])
  const verticalRateMps = asFiniteNumber(rawState[11])
  const geoAltitudeM = asFiniteNumber(rawState[13])
  const effectiveAltitudeM = geoAltitudeM ?? baroAltitudeM

  if (!icao24 || lon === undefined || lat === undefined || effectiveAltitudeM === undefined) {
    return null
  }

  return {
    icao24,
    id: `icao24-${icao24}`,
    ...(normalizeOptionalText(rawState[1]) ? { callsign: normalizeOptionalText(rawState[1]) } : {}),
    ...(normalizeOptionalText(rawState[2])
      ? { originCountry: normalizeOptionalText(rawState[2]) }
      : {}),
    lat: roundCoordinate(lat),
    lon: roundCoordinate(lon),
    ...(geoAltitudeM !== undefined ? { geoAltitudeM: Math.round(geoAltitudeM) } : {}),
    ...(baroAltitudeM !== undefined ? { baroAltitudeM: Math.round(baroAltitudeM) } : {}),
    ...(velocityMps !== undefined && velocityMps >= 0
      ? { velocityMps: roundDecimal(velocityMps, 1) }
      : {}),
    ...(trackDeg !== undefined ? { trackDeg: normalizeDegrees(roundDecimal(trackDeg, 1)) } : {}),
    ...(verticalRateMps !== undefined ? { verticalRateMps: roundDecimal(verticalRateMps, 1) } : {}),
    ...(asOptionalInt(rawState[3]) !== undefined ? { timePositionS: asOptionalInt(rawState[3]) } : {}),
    ...(asOptionalInt(rawState[4]) !== undefined ? { lastContactS: asOptionalInt(rawState[4]) } : {}),
    ...(typeof rawState[8] === 'boolean' ? { onGround: rawState[8] } : {}),
    ...(asOptionalInt(rawState[16]) !== undefined
      ? { positionSource: asOptionalInt(rawState[16]) }
      : {}),
    ...(asOptionalInt(rawState[17]) !== undefined ? { category: asOptionalInt(rawState[17]) } : {}),
  } satisfies NormalizedOpenSkyState
}

function normalizeAircraftForObserver(
  state: NormalizedOpenSkyState,
  observer: AircraftQuery,
): AircraftApiAircraft | null {
  const altitudeM = state.geoAltitudeM ?? state.baroAltitudeM

  if (typeof altitudeM !== 'number') {
    return null
  }

  const surfaceDistanceMeters = getSurfaceDistanceMeters(
    { lat: observer.lat, lon: observer.lon },
    state,
  )
  const altitudeDeltaMeters = altitudeM - observer.altMeters
  const rangeKm = Math.sqrt(surfaceDistanceMeters ** 2 + altitudeDeltaMeters ** 2) / 1000

  if (rangeKm > observer.radiusKm) {
    return null
  }

  const elevationDeg = radiansToDegrees(Math.atan2(altitudeDeltaMeters, surfaceDistanceMeters))

  if (elevationDeg < MIN_AIRCRAFT_ELEVATION_DEG) {
    return null
  }

  return {
    ...state,
    azimuthDeg: roundAngle(getBearingDeg(observer, state)),
    elevationDeg: roundAngle(elevationDeg),
    rangeKm: roundRange(rangeKm),
  }
}

function buildOpenSkyStatesUrls(lat: number, lon: number, radiusKm: number) {
  const latDeltaDeg = radiusKm / 111.32
  const lonDeltaDeg = radiusKm / (111.32 * Math.max(Math.cos(degreesToRadians(lat)), 0.01))
  const lamin = clampLat(lat - latDeltaDeg)
  const lamax = clampLat(lat + latDeltaDeg)

  return buildOpenSkyLongitudeRanges(lon, lonDeltaDeg).map((range) => {
    const url = new URL(OPENSKY_STATES_URL)

    url.searchParams.set('lamin', lamin.toFixed(4))
    url.searchParams.set('lamax', lamax.toFixed(4))
    url.searchParams.set('lomin', range.lomin.toFixed(4))
    url.searchParams.set('lomax', range.lomax.toFixed(4))

    return url
  })
}

function buildOpenSkyLongitudeRanges(lon: number, lonDeltaDeg: number): OpenSkyLongitudeRange[] {
  if (lonDeltaDeg >= 180) {
    return [{ lomin: -180, lomax: 180 }]
  }

  const minLon = lon - lonDeltaDeg
  const maxLon = lon + lonDeltaDeg

  if (minLon < -180) {
    return [
      { lomin: clampLon(minLon), lomax: 180 },
      { lomin: -180, lomax: clampLon(maxLon) },
    ]
  }

  if (maxLon > 180) {
    return [
      { lomin: clampLon(minLon), lomax: 180 },
      { lomin: -180, lomax: clampLon(maxLon) },
    ]
  }

  return [{ lomin: clampLon(minLon), lomax: clampLon(maxLon) }]
}

function getSurfaceDistanceMeters(
  left: Pick<AircraftQuery, 'lat' | 'lon'>,
  right: Pick<NormalizedOpenSkyState, 'lat' | 'lon'>,
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
  left: Pick<AircraftQuery, 'lat' | 'lon'>,
  right: Pick<NormalizedOpenSkyState, 'lat' | 'lon'>,
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

function normalizeRequiredText(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return normalized || null
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()
  return normalized || undefined
}

function asFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asOptionalInt(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined
}

function clampLat(value: number) {
  return Math.min(90, Math.max(-90, value))
}

function clampLon(value: number) {
  if (value < -180) {
    return value + 360
  }

  if (value > 180) {
    return value - 360
  }

  return value
}

function roundCoordinate(value: number) {
  return roundDecimal(value, 4)
}

function roundAngle(value: number) {
  return roundDecimal(value, 2)
}

function roundRange(value: number) {
  return roundDecimal(value, 1)
}

function roundDecimal(value: number, digits: number) {
  return Number(value.toFixed(digits))
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
