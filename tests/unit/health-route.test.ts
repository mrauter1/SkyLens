import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET } from '../../app/api/health/route'
import { getAircraftApiResponse, resetAircraftCacheForTests } from '../../lib/aircraft/opensky'
import { getTleApiResponse, resetTleCacheForTests } from '../../lib/satellites/tle'

describe('/api/health', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reports empty caches before any live fetches occur', async () => {
    resetAircraftCacheForTests()
    resetTleCacheForTests()

    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      app: {
        status: 'ok',
      },
      aircraftCache: {
        status: 'empty',
      },
      tleCache: {
        status: 'empty',
      },
    })
  })

  it('surfaces fresh aircraft and TLE cache metadata after successful fetches', async () => {
    resetAircraftCacheForTests()
    resetTleCacheForTests()

    const now = new Date('2026-03-26T00:00:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(now)

    await getAircraftApiResponse(
      {
        lat: 37.7749,
        lon: -122.4194,
        altMeters: 0,
        radiusKm: 250,
        limit: 50,
      },
      createAircraftFetch(),
      now,
    )
    await getTleApiResponse(createTleFetch(), now)

    const response = await GET()
    const payload = await response.json()

    expect(payload.app.status).toBe('ok')
    expect(payload.aircraftCache).toMatchObject({
      status: 'fresh',
      fetchedAt: now.toISOString(),
    })
    expect(payload.tleCache).toMatchObject({
      status: 'fresh',
      fetchedAt: now.toISOString(),
      expiresAt: '2026-03-26T06:00:00.000Z',
    })
  })

  it('marks the TLE cache as stale after refresh expiry but before stale-window expiry', async () => {
    resetTleCacheForTests()

    const now = new Date('2026-03-26T00:00:00.000Z')
    await getTleApiResponse(createTleFetch(), now)
    const staleNow = new Date('2026-03-26T07:00:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(staleNow)

    const response = await GET()
    const payload = await response.json()

    expect(payload.tleCache.status).toBe('stale')
    expect(payload.tleCache.expiresAt).toBe('2026-03-26T06:00:00.000Z')
  })
})

function createAircraftFetch() {
  return (async () =>
    new Response(
      JSON.stringify({
        time: 1774634400,
        states: [
          [
            'a1b2c3',
            'UAL123  ',
            'United States',
            1774634398,
            1774634399,
            -122.1,
            37.98,
            10620,
            false,
            240,
            132,
            0,
            null,
            10668,
            null,
            false,
            0,
            4,
          ],
        ],
      }),
      { status: 200 },
    )) as typeof fetch
}

function createTleFetch() {
  return (async (input: RequestInfo | URL) => {
    const url = String(input)

    if (url.includes('CATNR=25544')) {
      return new Response(
        [
          'ISS (ZARYA)',
          '1 25544U 98067A   26084.84151545  .00012012  00000+0  22938-3 0  9995',
          '2 25544  51.6341 352.5134 0006235 232.7336 127.3084 15.48540672558833',
          '',
        ].join('\n'),
        { status: 200 },
      )
    }

    if (url.includes('GROUP=stations')) {
      return new Response(
        [
          'ISS (ZARYA)',
          '1 25544U 98067A   26084.84151545  .00012012  00000+0  22938-3 0  9995',
          '2 25544  51.6341 352.5134 0006235 232.7336 127.3084 15.48540672558833',
          'POISK',
          '1 36086U 09060A   26084.84151545  .00012012  00000+0  22938-3 0  9993',
          '2 36086  51.6341 352.5134 0006235 232.7336 127.3084 15.48540672558612',
          '',
        ].join('\n'),
        { status: 200 },
      )
    }

    return new Response(
      [
        'ATLAS CENTAUR 2',
        '1 00694U 63047A   26084.73439463  .00002076  00000+0  23941-3 0  9994',
        '2 00694  30.3558 105.9693 0547415 221.7002 134.0605 14.12128189133898',
        '',
      ].join('\n'),
      { status: 200 },
    )
  }) as typeof fetch
}
