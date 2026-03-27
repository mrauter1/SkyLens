import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from '../../app/api/aircraft/route'
import {
  fetchAircraftSnapshot,
  getAircraftAvailabilityMessage,
  normalizeAircraftObjects,
} from '../../lib/aircraft/client'
import type { AircraftApiResponse } from '../../lib/aircraft/contracts'
import { getAircraftApiResponse, resetAircraftCacheForTests } from '../../lib/aircraft/opensky'

const ENABLED_LAYERS = {
  aircraft: true,
  satellites: true,
  planets: true,
  stars: true,
  constellations: true,
} as const

const openskyFixture = readFixture('sample_dense.json')

describe('aircraft layer', () => {
  beforeEach(() => {
    resetAircraftCacheForTests()
    delete process.env.OPENSKY_CLIENT_ID
    delete process.env.OPENSKY_CLIENT_SECRET
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns 400 for invalid /api/aircraft requests', async () => {
    const response = await GET(new Request('http://localhost/api/aircraft?lat=200&lon=0'))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toBe('Invalid aircraft query.')
  })

  it('returns normalized observer-relative aircraft data for valid requests', async () => {
    vi.stubGlobal('fetch', createAnonymousFetch())

    const response = await GET(
      new Request('http://localhost/api/aircraft?lat=37.7749&lon=-122.4194&radiusKm=250'),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.availability).toBe('available')
    expect(payload.observer).toEqual({
      lat: 37.7749,
      lon: -122.4194,
      altMeters: 0,
    })
    expect(payload.aircraft).toHaveLength(2)
    expect(payload.aircraft[0]).toMatchObject({
      id: 'icao24-d4e5f6',
      originCountry: 'Canada',
      headingDeg: 210,
      rangeKm: expect.any(Number),
      azimuthDeg: expect.any(Number),
      elevationDeg: expect.any(Number),
    })
    expect(payload.aircraft[0].rangeKm).toBeLessThan(payload.aircraft[1].rangeKm)
  })

  it('reuses the 10-second cache for equivalent rounded location buckets while recomputing observer-relative angles', async () => {
    const fetchMock = createAnonymousFetch()
    const initialNow = new Date('2026-03-26T00:00:00.000Z')

    const first = await getAircraftApiResponse(
      {
        lat: 37.74,
        lon: -122.44,
        altMeters: 0,
        radiusKm: 250,
        limit: 50,
      },
      fetchMock,
      initialNow,
    )
    const second = await getAircraftApiResponse(
      {
        lat: 37.72,
        lon: -122.42,
        altMeters: 1000,
        radiusKm: 250,
        limit: 50,
      },
      fetchMock,
      new Date(initialNow.getTime() + 5_000),
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second.fetchedAt).toBe(first.fetchedAt)
    expect(second.aircraft[0].elevationDeg).not.toBe(first.aircraft[0].elevationDeg)
  })

  it('expands the upstream bbox to cover the full rounded bucket footprint', async () => {
    const targetAircraft = buildOpenSkyResponse({
      icao24: 'abc123',
      lat: 2.293,
      lon: 0,
      geoAltitudeM: 10668,
      baroAltitudeM: 10620,
      callsign: 'EDGE123',
    })
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const lamin = Number(url.searchParams.get('lamin'))
      const lamax = Number(url.searchParams.get('lamax'))
      const lomin = Number(url.searchParams.get('lomin'))
      const lomax = Number(url.searchParams.get('lomax'))
      const targetLat = Number(targetAircraft.states[0][6])
      const targetLon = Number(targetAircraft.states[0][5])
      const includesTarget =
        targetLat >= lamin &&
        targetLat <= lamax &&
        targetLon >= lomin &&
        targetLon <= lomax

      return new Response(
        JSON.stringify(
          includesTarget
            ? targetAircraft
            : {
                time: targetAircraft.time,
                states: [],
              },
        ),
        { status: 200 },
      )
    }) as typeof fetch

    const payload = await getAircraftApiResponse(
      {
        lat: 0.049,
        lon: 0,
        altMeters: 0,
        radiusKm: 250,
        limit: 50,
      },
      fetchMock,
      new Date('2026-03-26T00:00:00.000Z'),
    )

    expect(payload.aircraft).toHaveLength(1)
    expect(payload.aircraft[0]).toMatchObject({
      id: 'icao24-abc123',
      callsign: 'EDGE123',
    })
  })

  it('splits wrapped longitude queries near +180 without sending inverted intervals', async () => {
    const fetchMock = createAntimeridianFetch({
      icao24: 'wrape1',
      lat: 0.02,
      lon: -179.8,
      callsign: 'WRAP180',
    })

    const payload = await getAircraftApiResponse(
      {
        lat: 0,
        lon: 179.96,
        altMeters: 0,
        radiusKm: 250,
        limit: 50,
      },
      fetchMock,
      new Date('2026-03-26T00:00:00.000Z'),
    )

    expect(payload.aircraft).toHaveLength(1)
    expect(payload.aircraft[0]).toMatchObject({
      id: 'icao24-wrape1',
      callsign: 'WRAP180',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('splits wrapped longitude queries near -180 without sending inverted intervals', async () => {
    const fetchMock = createAntimeridianFetch({
      icao24: 'wrapw1',
      lat: -0.02,
      lon: 179.8,
      callsign: 'WRAP-180',
    })

    const payload = await getAircraftApiResponse(
      {
        lat: 0,
        lon: -179.96,
        altMeters: 0,
        radiusKm: 250,
        limit: 50,
      },
      fetchMock,
      new Date('2026-03-26T00:00:00.000Z'),
    )

    expect(payload.aircraft).toHaveLength(1)
    expect(payload.aircraft[0]).toMatchObject({
      id: 'icao24-wrapw1',
      callsign: 'WRAP-180',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('degrades gracefully to empty aircraft data when upstream access fails', async () => {
    const payload = await getAircraftApiResponse(
      {
        lat: 37.7749,
        lon: -122.4194,
        altMeters: 0,
        radiusKm: 250,
        limit: 50,
      },
      vi.fn(async () => new Response('upstream unavailable', { status: 503 })) as typeof fetch,
      new Date('2026-03-26T00:00:00.000Z'),
    )

    expect(payload).toMatchObject({
      availability: 'degraded',
      aircraft: [],
      observer: {
        lat: 37.7749,
        lon: -122.4194,
        altMeters: 0,
      },
    })
  })

  it('fetches and validates the client aircraft contract', async () => {
    const payload = await fetchAircraftSnapshot(
      {
        lat: 37.7749,
        lon: -122.4194,
        altMeters: 0,
      },
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            fetchedAt: '2026-03-26T00:00:00.000Z',
            observer: {
              lat: 37.7749,
              lon: -122.4194,
              altMeters: 0,
            },
            availability: 'available',
            aircraft: [
              {
                id: 'icao24-d4e5f6',
                originCountry: 'Canada',
                lat: 37.81,
                lon: -122.25,
                geoAltitudeM: 5100,
                baroAltitudeM: 5000,
                velocityMps: 200,
                headingDeg: 210,
                verticalRateMps: -3,
                azimuthDeg: 75.12,
                elevationDeg: 9.33,
                rangeKm: 15.2,
              },
            ],
          }),
        ),
      ) as typeof fetch,
    )

    expect(payload.aircraft[0]).toMatchObject({
      id: 'icao24-d4e5f6',
      headingDeg: 210,
      rangeKm: 15.2,
    })
  })

  it('uses authenticated OpenSky access when credentials are present', async () => {
    process.env.OPENSKY_CLIENT_ID = 'client-id'
    process.env.OPENSKY_CLIENT_SECRET = 'client-secret'

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.startsWith('https://auth.opensky-network.org/')) {
        expect(init?.method).toBe('POST')
        expect(String(init?.body)).toContain('grant_type=client_credentials')
        return new Response(
          JSON.stringify({
            access_token: 'token-1',
            expires_in: 1800,
          }),
          { status: 200 },
        )
      }

      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer token-1',
      })

      return new Response(openskyFixture, { status: 200 })
    }) as typeof fetch

    const payload = await getAircraftApiResponse(
      {
        lat: 37.7749,
        lon: -122.4194,
        altMeters: 0,
        radiusKm: 250,
        limit: 50,
      },
      fetchMock,
      new Date('2026-03-26T00:00:00.000Z'),
    )

    expect(payload.availability).toBe('available')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('openid-connect/token'),
      expect.objectContaining({
        method: 'POST',
      }),
    )
  })

  it('refreshes the token once when authenticated OpenSky access returns 401', async () => {
    process.env.OPENSKY_CLIENT_ID = 'client-id'
    process.env.OPENSKY_CLIENT_SECRET = 'client-secret'

    let stateRequestCount = 0
    let tokenRequestCount = 0

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.startsWith('https://auth.opensky-network.org/')) {
        tokenRequestCount += 1

        return new Response(
          JSON.stringify({
            access_token: `token-${tokenRequestCount}`,
            expires_in: 1800,
          }),
          { status: 200 },
        )
      }

      stateRequestCount += 1

      if (stateRequestCount === 1) {
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer token-1',
        })
        return new Response('unauthorized', { status: 401 })
      }

      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer token-2',
      })

      return new Response(openskyFixture, { status: 200 })
    }) as typeof fetch

    const payload = await getAircraftApiResponse(
      {
        lat: 37.7749,
        lon: -122.4194,
        altMeters: 0,
        radiusKm: 250,
        limit: 50,
      },
      fetchMock,
      new Date('2026-03-26T00:00:00.000Z'),
    )

    expect(payload.availability).toBe('available')
    expect(tokenRequestCount).toBe(2)
    expect(stateRequestCount).toBe(2)
  })

  it('falls back to anonymous OpenSky access when authenticated fetch fails', async () => {
    process.env.OPENSKY_CLIENT_ID = 'client-id'
    process.env.OPENSKY_CLIENT_SECRET = 'client-secret'

    let authenticatedStateRequestCount = 0
    let anonymousStateRequestCount = 0

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.startsWith('https://auth.opensky-network.org/')) {
        return new Response(
          JSON.stringify({
            access_token: 'token-1',
            expires_in: 1800,
          }),
          { status: 200 },
        )
      }

      if (init?.headers) {
        authenticatedStateRequestCount += 1
        expect(init.headers).toMatchObject({
          Authorization: 'Bearer token-1',
        })

        return new Response('authenticated upstream unavailable', { status: 503 })
      }

      anonymousStateRequestCount += 1

      return new Response(openskyFixture, { status: 200 })
    }) as typeof fetch

    const payload = await getAircraftApiResponse(
      {
        lat: 37.7749,
        lon: -122.4194,
        altMeters: 0,
        radiusKm: 250,
        limit: 50,
      },
      fetchMock,
      new Date('2026-03-26T00:00:00.000Z'),
    )

    expect(payload.availability).toBe('available')
    expect(payload.aircraft).toHaveLength(2)
    expect(authenticatedStateRequestCount).toBe(1)
    expect(anonymousStateRequestCount).toBe(1)
  })

  it('normalizes aircraft detail-card fields and Unknown flight fallback', () => {
    const objects = normalizeAircraftObjects({
      snapshot: {
        fetchedAt: '2026-03-26T00:00:00.000Z',
        observer: {
          lat: 37.7749,
          lon: -122.4194,
          altMeters: 0,
        },
        availability: 'available',
        aircraft: [
          {
            id: 'icao24-d4e5f6',
            originCountry: 'Canada',
            lat: 37.81,
            lon: -122.25,
            geoAltitudeM: 10668,
            velocityMps: 240,
            headingDeg: 132,
            verticalRateMps: 0,
            azimuthDeg: 54.2,
            elevationDeg: 18.4,
            rangeKm: 31.8,
          },
        ],
      },
      enabledLayers: ENABLED_LAYERS,
    })

    expect(objects[0]).toMatchObject({
      id: 'icao24-d4e5f6',
      type: 'aircraft',
      label: 'Unknown flight',
      metadata: {
        detail: {
          typeLabel: 'Aircraft',
          altitudeFeet: 35000,
          altitudeMeters: 10668,
          headingCardinal: 'SE',
          speedKph: 864,
          rangeKm: 31.8,
          originCountry: 'Canada',
        },
      },
    })
    expect(getAircraftAvailabilityMessage('degraded')).toBe(
      'Live aircraft temporarily unavailable',
    )
  })

  it('interpolates aircraft motion between retained snapshots during the transition window', () => {
    const previousSnapshot = createAircraftResponse('2026-03-26T00:00:00.000Z', [
      {
        id: 'icao24-midpt1',
        callsign: 'MIDPT1',
        lat: 37.7,
        lon: -122.5,
        geoAltitudeM: 4000,
        velocityMps: 200,
        headingDeg: 20,
        azimuthDeg: 10,
        elevationDeg: 20,
        rangeKm: 30,
      },
    ])
    const currentSnapshot = createAircraftResponse('2026-03-26T00:00:10.000Z', [
      {
        id: 'icao24-midpt1',
        callsign: 'MIDPT1',
        lat: 37.9,
        lon: -122.3,
        geoAltitudeM: 6000,
        velocityMps: 240,
        headingDeg: 40,
        azimuthDeg: 20,
        elevationDeg: 40,
        rangeKm: 10,
      },
    ])

    const objects = normalizeAircraftObjects({
      snapshot: currentSnapshot,
      previousSnapshot,
      transitionStartedAtMs: Date.parse('2026-03-26T00:00:20.000Z'),
      timeMs: Date.parse('2026-03-26T00:00:25.000Z'),
      observer: currentSnapshot.observer,
      enabledLayers: ENABLED_LAYERS,
    })

    expect(objects).toHaveLength(1)
    expect(objects[0]).toMatchObject({
      id: 'icao24-midpt1',
      azimuthDeg: 15,
      elevationDeg: 30,
      rangeKm: 20,
      metadata: {
        motionState: 'interpolated',
      },
    })
  })

  it('applies bounded dead reckoning when only one fresh sample is available', () => {
    const snapshot = createAircraftResponse('2026-03-26T00:00:00.000Z', [
      {
        id: 'icao24-est001',
        callsign: 'EST001',
        lat: 0.009,
        lon: 0,
        geoAltitudeM: 1000,
        velocityMps: 250,
        headingDeg: 0,
        verticalRateMps: 0,
        azimuthDeg: 0,
        elevationDeg: 45,
        rangeKm: 1.4,
      },
    ], {
      lat: 0,
      lon: 0,
      altMeters: 0,
    })

    const objects = normalizeAircraftObjects({
      snapshot,
      transitionStartedAtMs: Date.parse('2026-03-26T00:00:00.000Z'),
      timeMs: Date.parse('2026-03-26T00:00:04.000Z'),
      observer: snapshot.observer,
      enabledLayers: ENABLED_LAYERS,
    })

    expect(objects).toHaveLength(1)
    expect(objects[0].metadata).toMatchObject({
      motionState: 'estimated',
    })
    expect(objects[0].azimuthDeg).toBeCloseTo(0, 1)
    expect(objects[0].rangeKm ?? 0).toBeGreaterThan(2)
    expect(objects[0].elevationDeg).toBeLessThan(35)
  })

  it('suppresses aircraft once stale data ages beyond the bounded fallback window', () => {
    const snapshot = createAircraftResponse('2026-03-26T00:00:00.000Z', [
      {
        id: 'icao24-stale1',
        callsign: 'STALE1',
        lat: 0.009,
        lon: 0,
        geoAltitudeM: 1000,
        velocityMps: 250,
        headingDeg: 0,
        azimuthDeg: 0,
        elevationDeg: 45,
        rangeKm: 1.4,
      },
    ], {
      lat: 0,
      lon: 0,
      altMeters: 0,
    })

    const objects = normalizeAircraftObjects({
      snapshot,
      transitionStartedAtMs: Date.parse('2026-03-26T00:00:00.000Z'),
      timeMs: Date.parse('2026-03-26T00:00:31.000Z'),
      observer: snapshot.observer,
      enabledLayers: ENABLED_LAYERS,
    })

    expect(objects).toEqual([])
  })

  it('downgrades stale aircraft before suppressing them completely', () => {
    const snapshot = createAircraftResponse('2026-03-26T00:00:00.000Z', [
      {
        id: 'icao24-stale2',
        callsign: 'STALE2',
        lat: 0.009,
        lon: 0,
        geoAltitudeM: 1000,
        velocityMps: 250,
        headingDeg: 0,
        azimuthDeg: 0,
        elevationDeg: 45,
        rangeKm: 1.4,
      },
    ], {
      lat: 0,
      lon: 0,
      altMeters: 0,
    })

    const objects = normalizeAircraftObjects({
      snapshot,
      transitionStartedAtMs: Date.parse('2026-03-26T00:00:00.000Z'),
      timeMs: Date.parse('2026-03-26T00:00:25.000Z'),
      observer: snapshot.observer,
      enabledLayers: ENABLED_LAYERS,
    })

    expect(objects).toHaveLength(1)
    expect(objects[0].metadata).toMatchObject({
      motionState: 'stale',
      motionOpacity: expect.any(Number),
    })
    expect(Number(objects[0].metadata.motionOpacity)).toBeLessThan(1)
  })

  it('keeps fresh current-only aircraft live during entry fade when motion fields are absent', () => {
    const snapshot = createAircraftResponse('2026-03-26T00:00:10.000Z', [
      {
        id: 'icao24-fresh1',
        callsign: 'FRESH1',
        lat: 37.81,
        lon: -122.25,
        geoAltitudeM: 5100,
        azimuthDeg: 18,
        elevationDeg: 28,
        rangeKm: 15.2,
      },
    ])

    const objects = normalizeAircraftObjects({
      snapshot,
      transitionStartedAtMs: Date.parse('2026-03-26T00:00:10.000Z'),
      timeMs: Date.parse('2026-03-26T00:00:11.000Z'),
      observer: snapshot.observer,
      enabledLayers: ENABLED_LAYERS,
    })

    expect(objects).toHaveLength(1)
    expect(objects[0].metadata).toMatchObject({
      motionOpacity: expect.any(Number),
    })
    expect(objects[0].metadata).not.toHaveProperty('motionState')
  })

  it('keeps departing aircraft briefly visible while they fade out of the snapshot set', () => {
    const previousSnapshot = createAircraftResponse('2026-03-26T00:00:00.000Z', [
      {
        id: 'icao24-exit01',
        callsign: 'EXIT01',
        lat: 37.81,
        lon: -122.25,
        geoAltitudeM: 5100,
        velocityMps: 200,
        headingDeg: 210,
        azimuthDeg: 18,
        elevationDeg: 28,
        rangeKm: 15.2,
      },
    ])
    const currentSnapshot = createAircraftResponse('2026-03-26T00:00:10.000Z', [])

    const objects = normalizeAircraftObjects({
      snapshot: currentSnapshot,
      previousSnapshot,
      transitionStartedAtMs: Date.parse('2026-03-26T00:00:10.000Z'),
      timeMs: Date.parse('2026-03-26T00:00:11.000Z'),
      observer: currentSnapshot.observer,
      enabledLayers: ENABLED_LAYERS,
    })

    expect(objects).toHaveLength(1)
    expect(objects[0].metadata).toMatchObject({
      motionState: 'stale',
      motionOpacity: expect.any(Number),
    })
  })
})

function readFixture(fileName: string) {
  return readFileSync(join(process.cwd(), 'tests/fixtures/opensky', fileName), 'utf8')
}

function createAnonymousFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).startsWith('https://auth.opensky-network.org/')) {
      throw new Error('anonymous path should not request tokens')
    }

    return new Response(openskyFixture, { status: 200 })
  }) as typeof fetch
}

function buildOpenSkyResponse({
  icao24,
  lat,
  lon,
  geoAltitudeM,
  baroAltitudeM,
  callsign,
}: {
  icao24: string
  lat: number
  lon: number
  geoAltitudeM: number
  baroAltitudeM: number
  callsign?: string
}) {
  return {
    time: 1774634400,
    states: [
      [
        icao24,
        callsign ?? null,
        'United States',
        1774634398,
        1774634399,
        lon,
        lat,
        baroAltitudeM,
        false,
        240,
        132,
        0,
        null,
        geoAltitudeM,
        null,
        false,
        0,
        4,
      ],
    ],
  }
}

function createAircraftResponse(
  fetchedAt: string,
  aircraft: AircraftApiResponse['aircraft'],
  observer = {
    lat: 37.7749,
    lon: -122.4194,
    altMeters: 0,
  },
) {
  return {
    fetchedAt,
    observer,
    availability: 'available' as const,
    aircraft,
  }
}

function createAntimeridianFetch({
  icao24,
  lat,
  lon,
  callsign,
}: {
  icao24: string
  lat: number
  lon: number
  callsign: string
}) {
  const targetAircraft = buildOpenSkyResponse({
    icao24,
    lat,
    lon,
    geoAltitudeM: 10668,
    baroAltitudeM: 10620,
    callsign,
  })

  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    const lamin = Number(url.searchParams.get('lamin'))
    const lamax = Number(url.searchParams.get('lamax'))
    const lomin = Number(url.searchParams.get('lomin'))
    const lomax = Number(url.searchParams.get('lomax'))

    expect(lomin).toBeLessThanOrEqual(lomax)

    const includesTarget =
      lat >= lamin &&
      lat <= lamax &&
      lon >= lomin &&
      lon <= lomax

    return new Response(
      JSON.stringify(
        includesTarget
          ? targetAircraft
          : {
              time: targetAircraft.time,
              states: [],
            },
      ),
      { status: 200 },
    )
  }) as typeof fetch
}
