import { describe, expect, it, vi } from 'vitest'

import { fetchAircraftSnapshot } from '../../lib/aircraft/client'
import { AircraftFetchError, fetchOpenSkyAircraft } from '../../lib/aircraft/opensky-browser'

describe('aircraft browser client', () => {
  it('fetches anonymous aircraft data directly from OpenSky and maps the requested indices', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))

      expect(url.origin).toBe('https://opensky-network.org')
      expect(url.pathname).toBe('/api/states/all')
      expect(url.searchParams.has('time')).toBe(false)
      expect(init?.cache).toBe('no-store')

      return new Response(
        JSON.stringify({
          time: 1774634400,
          states: [
            [
              'd4e5f6',
              'ACA902  ',
              'Canada',
              1774634398,
              1774634399,
              -122.25,
              37.81,
              5000.2,
              false,
              200.38,
              210.04,
              -3.41,
              null,
              5100.8,
              null,
              false,
              1,
              5,
            ],
          ],
        }),
        { status: 200 },
      )
    }) as typeof fetch

    const payload = await fetchAircraftSnapshot(
      {
        lat: 37.7749,
        lon: -122.4194,
        altMeters: 0,
      },
      fetchMock,
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(payload).toMatchObject({
      fetchedAt: expect.any(String),
      snapshotTimeS: 1774634400,
      observer: {
        lat: 37.7749,
        lon: -122.4194,
        altMeters: 0,
      },
      availability: 'available',
      aircraft: [
        {
          id: 'icao24-d4e5f6',
          callsign: 'ACA902',
          originCountry: 'Canada',
          lat: 37.81,
          lon: -122.25,
          geoAltitudeM: 5101,
          baroAltitudeM: 5000,
          velocityMps: 200.4,
          trackDeg: 210,
          verticalRateMps: -3.4,
          timePositionS: 1774634398,
          lastContactS: 1774634399,
          onGround: false,
          positionSource: 1,
          category: 5,
          azimuthDeg: expect.any(Number),
          elevationDeg: expect.any(Number),
          rangeKm: expect.any(Number),
        },
      ],
    })
  })

  it('splits antimeridian requests, merges responses, and dedupes by aircraft id', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const lomin = Number(url.searchParams.get('lomin'))
      const lomax = Number(url.searchParams.get('lomax'))

      if (lomin > lomax) {
        throw new Error('inverted antimeridian range')
      }

      const eastSide = lomin < 0

      return new Response(
        JSON.stringify({
          time: 1774634400,
          states: eastSide
            ? [
                [
                  'wrape1',
                  'WRAP180 ',
                  'Japan',
                  1774634390,
                  1774634392,
                  -179.8,
                  0.02,
                  6000,
                  false,
                  210,
                  100,
                  0,
                  null,
                  6200,
                  null,
                  false,
                  0,
                  1,
                ],
              ]
            : [
                [
                  'wrape1',
                  'WRAP180 ',
                  'Japan',
                  1774634394,
                  1774634398,
                  -179.8,
                  0.02,
                  6100,
                  false,
                  215,
                  105,
                  0,
                  null,
                  6300,
                  null,
                  false,
                  0,
                  1,
                ],
                [
                  'wrape2',
                  'WRAP181 ',
                  'Japan',
                  1774634395,
                  1774634399,
                  179.7,
                  0.03,
                  6100,
                  false,
                  220,
                  110,
                  0,
                  null,
                  6400,
                  null,
                  false,
                  0,
                  1,
                ],
              ],
        }),
        { status: 200 },
      )
    }) as typeof fetch

    const payload = await fetchOpenSkyAircraft(
      {
        lat: 0,
        lon: 179.96,
        altMeters: 0,
        radiusKm: 180,
        limit: 10,
      },
      fetchMock,
      new Date('2026-03-26T00:00:00.000Z'),
    )

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(payload.aircraft).toHaveLength(2)
    expect(payload.aircraft.find((aircraft) => aircraft.id === 'icao24-wrape1')).toMatchObject({
      trackDeg: 105,
      lastContactS: 1774634398,
    })
  })

  it('filters, sorts by range then id, and applies the display limit', async () => {
    const payload = await fetchOpenSkyAircraft(
      {
        lat: 37.7749,
        lon: -122.4194,
        altMeters: 0,
        radiusKm: 180,
        limit: 1,
      },
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            time: 1774634400,
            states: [
              [
                'clos01',
                'CLOSE01 ',
                'United States',
                1774634398,
                1774634399,
                -122.41,
                37.79,
                4000,
                false,
                180,
                180,
                0,
                null,
                4200,
                null,
                false,
                0,
                1,
              ],
              [
                'far001',
                'FAR001  ',
                'United States',
                1774634398,
                1774634399,
                -121.4,
                38.5,
                6000,
                false,
                180,
                180,
                0,
                null,
                6200,
                null,
                false,
                0,
                1,
              ],
              [
                'grnd01',
                'GROUND1 ',
                'United States',
                1774634398,
                1774634399,
                -122.4194,
                37.7849,
                0,
                false,
                0,
                0,
                0,
                null,
                0,
                null,
                false,
                0,
                1,
              ],
            ],
          }),
          { status: 200 },
        ),
      ) as typeof fetch,
    )

    expect(payload.aircraft).toHaveLength(1)
    expect(payload.aircraft[0]).toMatchObject({
      id: 'icao24-clos01',
      callsign: 'CLOSE01',
    })
  })

  it('drops rows missing id, lat lon, or both altitude fields before sorting', async () => {
    const payload = await fetchOpenSkyAircraft(
      {
        lat: 37.7749,
        lon: -122.4194,
        altMeters: 0,
        radiusKm: 180,
        limit: 10,
      },
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            time: 1774634400,
            states: [
              [
                'vald1a',
                'VALD1A ',
                'United States',
                1774634398,
                1774634399,
                -122.4,
                37.8,
                3000,
                false,
                180,
                180,
                0,
                null,
                3200,
                null,
                false,
                0,
                1,
              ],
              [
                '      ',
                'NOID   ',
                'United States',
                1774634398,
                1774634399,
                -122.39,
                37.81,
                3000,
                false,
                180,
                180,
                0,
                null,
                3200,
                null,
                false,
                0,
                1,
              ],
              [
                'missla',
                'MISSLA ',
                'United States',
                1774634398,
                1774634399,
                -122.38,
                null,
                3000,
                false,
                180,
                180,
                0,
                null,
                3200,
                null,
                false,
                0,
                1,
              ],
              [
                'misslo',
                'MISSLO ',
                'United States',
                1774634398,
                1774634399,
                null,
                37.82,
                3000,
                false,
                180,
                180,
                0,
                null,
                3200,
                null,
                false,
                0,
                1,
              ],
              [
                'noalt1',
                'NOALT1 ',
                'United States',
                1774634398,
                1774634399,
                -122.37,
                37.83,
                null,
                false,
                180,
                180,
                0,
                null,
                null,
                null,
                false,
                0,
                1,
              ],
            ],
          }),
          { status: 200 },
        ),
      ) as typeof fetch,
    )

    expect(payload.aircraft).toHaveLength(1)
    expect(payload.aircraft[0]).toMatchObject({
      id: 'icao24-vald1a',
      callsign: 'VALD1A',
    })
  })

  it('throws a typed network failure instead of returning a degraded empty snapshot', async () => {
    await expect(
      fetchOpenSkyAircraft(
        {
          lat: 37.7749,
          lon: -122.4194,
          altMeters: 0,
          radiusKm: 180,
          limit: 10,
        },
        vi.fn(async () => {
          throw new TypeError('fetch failed')
        }) as typeof fetch,
      ),
    ).rejects.toMatchObject({
      name: 'AircraftFetchError',
      code: 'network',
    } satisfies Partial<AircraftFetchError>)
  })

  it('throws a typed rate-limit failure for upstream 429 responses', async () => {
    await expect(
      fetchOpenSkyAircraft(
        {
          lat: 37.7749,
          lon: -122.4194,
          altMeters: 0,
          radiusKm: 180,
          limit: 10,
        },
        vi.fn(async () => new Response('rate limited', { status: 429 })) as typeof fetch,
      ),
    ).rejects.toMatchObject({
      name: 'AircraftFetchError',
      code: 'rate_limited',
      status: 429,
    } satisfies Partial<AircraftFetchError>)
  })
})
