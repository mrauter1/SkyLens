import { z } from 'zod'

import { createMemoryCache, type CacheEntry } from '../cache'
import type { CacheHealth } from '../health/contracts'
import {
  type AircraftApiAircraft,
  type AircraftApiResponse,
  type AircraftQuery,
  AircraftApiResponseSchema,
  AircraftAvailabilitySchema,
} from './contracts'

const AIRCRAFT_CACHE_TTL_MS = 10_000
const EARTH_RADIUS_METERS = 6_371_000
const LOCATION_BUCKET_DECIMALS = 1
const LOCATION_BUCKET_STEP_DEG = 0.1
const LOCATION_BUCKET_HALF_STEP_DEG = LOCATION_BUCKET_STEP_DEG / 2
const MIN_AIRCRAFT_ELEVATION_DEG = 2
const TOKEN_REFRESH_MARGIN_MS = 30_000
const OPENSKY_STATES_URL = 'https://opensky-network.org/api/states/all'
const OPENSKY_TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token'

type CachedOpenSkyState = {
  icao24: string
  callsign?: string
  originCountry?: string
  lat: number
  lon: number
  geoAltitudeM?: number
  baroAltitudeM?: number
  velocityMps?: number
  headingDeg?: number
  verticalRateMps?: number
}

type OpenSkyTokenCache = {
  accessToken: string
  expiresAtMs: number
}

type OpenSkyLongitudeRange = {
  lomin: number
  lomax: number
}

const aircraftCache = createMemoryCache<{ states: CachedOpenSkyState[] }>()

let tokenCache: OpenSkyTokenCache | null = null
let latestAircraftCacheEntry: CacheEntry<{ states: CachedOpenSkyState[] }> | null = null

const OpenSkyTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive().optional(),
})

const OpenSkyStateVectorSchema = z
  .tuple([
    z.string().regex(/^[0-9a-z]{6}$/i),
    z.string().nullable(),
    z.string().nullable(),
    z.number().int().nullable(),
    z.number().int().nullable(),
    z.number().nullable(),
    z.number().nullable(),
    z.number().nullable(),
    z.boolean().nullable(),
    z.number().nullable(),
    z.number().nullable(),
    z.number().nullable(),
    z.array(z.number().int()).nullable(),
    z.number().nullable(),
    z.string().nullable(),
    z.boolean().nullable(),
    z.number().int().nullable(),
  ])
  .rest(z.number().int().nullable())

const OpenSkyStatesResponseSchema = z.object({
  time: z.number().int(),
  states: z.array(OpenSkyStateVectorSchema).nullable().transform((value) => value ?? []),
})

export async function getAircraftApiResponse(
  query: AircraftQuery,
  fetchImpl: typeof fetch = fetch,
  now = new Date(),
): Promise<AircraftApiResponse> {
  const bucket = createLocationBucket(query)
  const cacheKey = getAircraftCacheKey(bucket.lat, bucket.lon, query.radiusKm)
  const cachedEntry = aircraftCache.get(cacheKey)

  if (cachedEntry && Date.parse(cachedEntry.expiresAt) > now.getTime()) {
    return buildAircraftApiResponse(query, cachedEntry.value.states, cachedEntry.fetchedAt)
  }

  try {
    const states = await fetchOpenSkyStates(bucket.lat, bucket.lon, query.radiusKm, fetchImpl, now)
    const entry = createFreshEntry(states, now)

    aircraftCache.set(cacheKey, entry)
    latestAircraftCacheEntry = entry

    return buildAircraftApiResponse(query, states, entry.fetchedAt)
  } catch {
    return AircraftApiResponseSchema.parse({
      fetchedAt: now.toISOString(),
      observer: {
        lat: query.lat,
        lon: query.lon,
        altMeters: query.altMeters,
      },
      availability: AircraftAvailabilitySchema.enum.degraded,
      aircraft: [],
    })
  }
}

export function resetAircraftCacheForTests() {
  aircraftCache.clear()
  tokenCache = null
  latestAircraftCacheEntry = null
}

export function getAircraftCacheHealth(now = new Date()): CacheHealth {
  if (!latestAircraftCacheEntry) {
    return {
      status: 'empty',
    }
  }

  if (Date.parse(latestAircraftCacheEntry.expiresAt) > now.getTime()) {
    return {
      status: 'fresh',
      fetchedAt: latestAircraftCacheEntry.fetchedAt,
      expiresAt: latestAircraftCacheEntry.expiresAt,
    }
  }

  return {
    status: 'expired',
    fetchedAt: latestAircraftCacheEntry.fetchedAt,
    expiresAt: latestAircraftCacheEntry.expiresAt,
  }
}

export function getAircraftCacheKey(lat: number, lon: number, radiusKm: number) {
  return `aircraft:${lat.toFixed(1)}:${lon.toFixed(1)}:${radiusKm.toFixed(1)}`
}

function buildAircraftApiResponse(
  query: AircraftQuery,
  states: CachedOpenSkyState[],
  fetchedAt: string,
) {
  const aircraft = states
    .map((state) => normalizeAircraftForObserver(state, query))
    .filter((value): value is AircraftApiAircraft => value !== null)
    .sort((left, right) => left.rangeKm - right.rangeKm || left.id.localeCompare(right.id))
    .slice(0, query.limit)

  return AircraftApiResponseSchema.parse({
    fetchedAt,
    observer: {
      lat: query.lat,
      lon: query.lon,
      altMeters: query.altMeters,
    },
    availability: AircraftAvailabilitySchema.enum.available,
    aircraft,
  })
}

async function fetchOpenSkyStates(
  bucketLat: number,
  bucketLon: number,
  radiusKm: number,
  fetchImpl: typeof fetch,
  now: Date,
) {
  const urls = buildOpenSkyStatesUrls(bucketLat, bucketLon, radiusKm)
  const credentials = getOpenSkyCredentials()

  if (credentials) {
    try {
      return mergeOpenSkyStates(
        await Promise.all(
          urls.map((url) => fetchAuthenticatedOpenSkyStates(url, credentials, fetchImpl, now)),
        ),
      )
    } catch {
      return mergeOpenSkyStates(
        await Promise.all(urls.map((url) => fetchAnonymousOpenSkyStates(url, fetchImpl))),
      )
    }
  }

  return mergeOpenSkyStates(
    await Promise.all(urls.map((url) => fetchAnonymousOpenSkyStates(url, fetchImpl))),
  )
}

async function fetchAuthenticatedOpenSkyStates(
  url: URL,
  credentials: { clientId: string; clientSecret: string },
  fetchImpl: typeof fetch,
  now: Date,
) {
  let accessToken = await getAccessToken(credentials, fetchImpl, now)

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchImpl(url, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (response.ok) {
      return parseOpenSkyStatesResponse(await response.json())
    }

    if (response.status !== 401 || attempt === 1) {
      throw new Error('authenticated-opensky-request-failed')
    }

    tokenCache = null
    accessToken = await getAccessToken(credentials, fetchImpl, now)
  }

  throw new Error('authenticated-opensky-request-failed')
}

async function fetchAnonymousOpenSkyStates(url: URL, fetchImpl: typeof fetch) {
  const response = await fetchImpl(url, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('anonymous-opensky-request-failed')
  }

  return parseOpenSkyStatesResponse(await response.json())
}

async function getAccessToken(
  credentials: { clientId: string; clientSecret: string },
  fetchImpl: typeof fetch,
  now: Date,
) {
  if (tokenCache && tokenCache.expiresAtMs - TOKEN_REFRESH_MARGIN_MS > now.getTime()) {
    return tokenCache.accessToken
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
  })

  const response = await fetchImpl(OPENSKY_TOKEN_URL, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!response.ok) {
    throw new Error('opensky-token-request-failed')
  }

  const payload = OpenSkyTokenResponseSchema.parse(await response.json())
  const expiresAtMs = now.getTime() + (payload.expires_in ?? 1800) * 1000

  tokenCache = {
    accessToken: payload.access_token,
    expiresAtMs,
  }

  return payload.access_token
}

function parseOpenSkyStatesResponse(payload: unknown): CachedOpenSkyState[] {
  const parsed = OpenSkyStatesResponseSchema.parse(payload)

  return parsed.states
    .map((state) => normalizeOpenSkyState(state))
    .filter((value): value is CachedOpenSkyState => value !== null)
}

function normalizeOpenSkyState(
  state: z.infer<typeof OpenSkyStateVectorSchema>,
): CachedOpenSkyState | null {
  const icao24 = state[0].trim().toLowerCase()
  const lon = state[5]
  const lat = state[6]
  const baroAltitudeM = state[7]
  const velocityMps = state[9]
  const headingDeg = state[10]
  const verticalRateMps = state[11]
  const geoAltitudeM = state[13]
  const effectiveAltitudeM = geoAltitudeM ?? baroAltitudeM

  if (
    !icao24 ||
    typeof lon !== 'number' ||
    typeof lat !== 'number' ||
    typeof effectiveAltitudeM !== 'number'
  ) {
    return null
  }

  const callsign = normalizeOptionalText(state[1])
  const originCountry = normalizeOptionalText(state[2])

  return {
    icao24,
    callsign,
    originCountry,
    lat,
    lon,
    geoAltitudeM: typeof geoAltitudeM === 'number' ? Math.round(geoAltitudeM) : undefined,
    baroAltitudeM:
      typeof baroAltitudeM === 'number' ? Math.round(baroAltitudeM) : undefined,
    velocityMps:
      typeof velocityMps === 'number' && velocityMps >= 0
        ? Number(velocityMps.toFixed(1))
        : undefined,
    headingDeg:
      typeof headingDeg === 'number'
        ? normalizeDegrees(Number(headingDeg.toFixed(1)))
        : undefined,
    verticalRateMps:
      typeof verticalRateMps === 'number'
        ? Number(verticalRateMps.toFixed(1))
        : undefined,
  } satisfies CachedOpenSkyState
}

function normalizeAircraftForObserver(
  state: CachedOpenSkyState,
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

  const elevationDeg = radiansToDegrees(
    Math.atan2(altitudeDeltaMeters, surfaceDistanceMeters),
  )

  if (elevationDeg < MIN_AIRCRAFT_ELEVATION_DEG) {
    return null
  }

  return {
    id: `icao24-${state.icao24}`,
    ...(state.callsign ? { callsign: state.callsign } : {}),
    ...(state.originCountry ? { originCountry: state.originCountry } : {}),
    lat: roundCoordinate(state.lat),
    lon: roundCoordinate(state.lon),
    ...(typeof state.geoAltitudeM === 'number' ? { geoAltitudeM: state.geoAltitudeM } : {}),
    ...(typeof state.baroAltitudeM === 'number'
      ? { baroAltitudeM: state.baroAltitudeM }
      : {}),
    ...(typeof state.velocityMps === 'number' ? { velocityMps: state.velocityMps } : {}),
    ...(typeof state.headingDeg === 'number' ? { headingDeg: state.headingDeg } : {}),
    ...(typeof state.verticalRateMps === 'number'
      ? { verticalRateMps: state.verticalRateMps }
      : {}),
    azimuthDeg: roundAngle(getBearingDeg(observer, state)),
    elevationDeg: roundAngle(elevationDeg),
    rangeKm: roundRange(rangeKm),
  }
}

function buildOpenSkyStatesUrls(lat: number, lon: number, radiusKm: number) {
  const latDeltaDeg = radiusKm / 111.32 + LOCATION_BUCKET_HALF_STEP_DEG
  const lonDeltaDeg =
    radiusKm / (111.32 * Math.max(Math.cos(degreesToRadians(lat)), 0.01)) +
    LOCATION_BUCKET_HALF_STEP_DEG
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

function createLocationBucket(query: AircraftQuery) {
  return {
    lat: roundToBucket(query.lat),
    lon: roundToBucket(query.lon),
  }
}

function createFreshEntry(
  states: CachedOpenSkyState[],
  now: Date,
): CacheEntry<{ states: CachedOpenSkyState[] }> {
  return {
    value: {
      states,
    },
    fetchedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + AIRCRAFT_CACHE_TTL_MS).toISOString(),
  }
}

function getOpenSkyCredentials() {
  const clientId = process.env.OPENSKY_CLIENT_ID?.trim()
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET?.trim()

  if (!clientId || !clientSecret) {
    return null
  }

  return { clientId, clientSecret }
}

function mergeOpenSkyStates(groups: CachedOpenSkyState[][]) {
  const dedupedStates = new Map<string, CachedOpenSkyState>()

  for (const group of groups) {
    for (const state of group) {
      dedupedStates.set(state.icao24, state)
    }
  }

  return [...dedupedStates.values()]
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

function normalizeOptionalText(value: string | null) {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function getSurfaceDistanceMeters(
  left: Pick<AircraftQuery, 'lat' | 'lon'>,
  right: Pick<CachedOpenSkyState, 'lat' | 'lon'>,
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
  right: Pick<CachedOpenSkyState, 'lat' | 'lon'>,
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

function roundToBucket(value: number) {
  return Number(value.toFixed(LOCATION_BUCKET_DECIMALS))
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
