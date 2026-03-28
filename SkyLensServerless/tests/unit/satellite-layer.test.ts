import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import {
  fetchSatelliteCatalog,
  normalizeSatelliteObjects,
} from '../../lib/satellites/client'
import { getTleApiResponse, resetTleCacheForTests } from '../../lib/satellites/tle'
import {
  createCameraQuaternion,
  projectWorldPointToScreen,
} from '../../lib/projection/camera'
import type { CameraPose, ObserverState } from '../../lib/viewer/contracts'
import sfEveningObserver from '../fixtures/observer/sf_evening.json'

const ENABLED_LAYERS = {
  aircraft: true,
  satellites: true,
  planets: true,
  stars: true,
  constellations: true,
} as const

const VIEWPORT = {
  width: 390,
  height: 844,
}

const stationsFixture = readFixture('stations.txt')
const brightestFixture = readFixture('brightest.txt')

describe('satellite layer', () => {
  beforeEach(() => {
    resetTleCacheForTests()
    delete process.env.NEXT_PUBLIC_SKYLENS_TLE_PROXY_URL_TEMPLATE
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SKYLENS_TLE_PROXY_URL_TEMPLATE
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns the normalized deduplicated TLE payload in-process', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      new Response(getFixtureBody(resolveUpstreamUrl(String(input))), { status: 200 }),
    )

    const payload = await getTleApiResponse(fetchMock as unknown as typeof fetch)

    expect(payload.stale).toBeUndefined()
    expect(Date.parse(payload.expiresAt) - Date.parse(payload.fetchedAt)).toBe(
      6 * 60 * 60 * 1000,
    )
    expect(payload.satellites).toHaveLength(6)
    expect(payload.satellites.map((satellite: { noradId: number }) => satellite.noradId)).toEqual([
      694,
      733,
      877,
      25544,
      36086,
      48274,
    ])
    expect(
      payload.satellites.find((satellite: { noradId: number }) => satellite.noradId === 25544),
    ).toEqual({
      id: '25544',
      name: 'ISS (ZARYA)',
      noradId: 25544,
      groups: ['iss', 'stations'],
      tle1: expect.stringContaining('25544U'),
      tle2: expect.stringContaining('25544 '),
      isIss: true,
    })
  })

  it('requests each TLE group through the browser-safe proxy template', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      new Response(getFixtureBody(resolveUpstreamUrl(String(input))), { status: 200 }),
    )

    await getTleApiResponse(
      fetchMock as unknown as typeof fetch,
      new Date('2026-03-26T00:00:00.000Z'),
    )

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      'https://corsproxy.io/?https%3A%2F%2Fcelestrak.org%2FNORAD%2Felements%2Fgp.php%3FCATNR%3D25544%26FORMAT%3Dtle',
    )
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      'GROUP%3Dstations%26FORMAT%3Dtle',
    )
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain(
      'GROUP%3Dvisual%26FORMAT%3Dtle',
    )
  })

  it('uses an explicitly configured single relay template for every TLE group', async () => {
    process.env.NEXT_PUBLIC_SKYLENS_TLE_PROXY_URL_TEMPLATE =
      'https://single-relay.example/proxy?target={url}'

    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      new Response(getFixtureBody(resolveUpstreamUrl(String(input))), { status: 200 }),
    )

    await getTleApiResponse(fetchMock as unknown as typeof fetch)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      expect.stringContaining(
        'https://single-relay.example/proxy?target=https%3A%2F%2Fcelestrak.org%2FNORAD%2Felements%2Fgp.php%3FCATNR%3D25544%26FORMAT%3Dtle',
      ),
      expect.stringContaining('GROUP%3Dstations%26FORMAT%3Dtle'),
      expect.stringContaining('GROUP%3Dvisual%26FORMAT%3Dtle'),
    ])
  })

  it('retries each TLE group with the next relay template after a primary relay failure', async () => {
    process.env.NEXT_PUBLIC_SKYLENS_TLE_PROXY_URL_TEMPLATE =
      'https://primary-relay.example/proxy?target={url}, https://secondary-relay.example/proxy?target={url}'

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const requestUrl = String(input)

      if (requestUrl.includes('primary-relay.example')) {
        return new Response('primary unavailable', { status: 502 })
      }

      return new Response(getFixtureBody(resolveUpstreamUrl(requestUrl)), { status: 200 })
    })

    const payload = await getTleApiResponse(fetchMock as unknown as typeof fetch)

    expect(payload.satellites).toHaveLength(6)
    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(
      fetchMock.mock.calls
        .map(([input]) => String(input))
        .filter((url) => url.includes('primary-relay.example')),
    ).toHaveLength(3)
    expect(
      fetchMock.mock.calls
        .map(([input]) => String(input))
        .filter((url) => url.includes('secondary-relay.example')),
    ).toHaveLength(3)
  })

  it('serves stale cache data for 24 hours after refresh failures', async () => {
    const initialNow = new Date('2026-03-26T00:00:00.000Z')
    const fresh = await getTleApiResponse(createSuccessFetch(), initialNow)
    const stale = await getTleApiResponse(
      vi.fn(async () => {
        throw new Error('upstream down')
      }) as unknown as typeof fetch,
      new Date(initialNow.getTime() + 7 * 60 * 60 * 1000),
    )

    expect(stale.stale).toBe(true)
    expect(stale.fetchedAt).toBe(fresh.fetchedAt)
    expect(stale.expiresAt).toBe(fresh.expiresAt)
    expect(stale.satellites).toEqual(fresh.satellites)
  })

  it('serves stale cache data when all configured relays fail and emits structured diagnostics', async () => {
    process.env.NEXT_PUBLIC_SKYLENS_TLE_PROXY_URL_TEMPLATE =
      'https://primary-relay.example/proxy?target={url}, https://secondary-relay.example/proxy?target={url}'

    const initialNow = new Date('2026-03-26T00:00:00.000Z')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const fresh = await getTleApiResponse(createSuccessFetch(), initialNow)
    const stale = await getTleApiResponse(
      vi.fn(async () => new Response('relay down', { status: 503 })) as unknown as typeof fetch,
      new Date(initialNow.getTime() + 7 * 60 * 60 * 1000),
    )

    expect(stale.stale).toBe(true)
    expect(stale.satellites).toEqual(fresh.satellites)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'TLE refresh failed; serving stale cache.',
      expect.objectContaining({
        groupId: expect.any(String),
        attempts: expect.arrayContaining([
          expect.objectContaining({
            groupId: expect.any(String),
            relayIndex: 0,
            relayPath: expect.stringContaining('/proxy?target='),
            status: 503,
          }),
          expect.objectContaining({
            groupId: expect.any(String),
            relayIndex: 1,
            relayPath: expect.stringContaining('/proxy?target='),
            status: 503,
          }),
        ]),
      }),
    )
  })

  it('stops serving stale data after the stale window expires', async () => {
    const initialNow = new Date('2026-03-26T00:00:00.000Z')

    await getTleApiResponse(createSuccessFetch(), initialNow)

    await expect(
      getTleApiResponse(
        vi.fn(async () => {
          throw new Error('upstream down')
        }) as unknown as typeof fetch,
        new Date(initialNow.getTime() + 31 * 60 * 60 * 1000),
      ),
    ).rejects.toThrow('TLE data unavailable.')
  })

  it('throws the public TLE error with structured relay context when no cache is available', async () => {
    process.env.NEXT_PUBLIC_SKYLENS_TLE_PROXY_URL_TEMPLATE =
      'https://primary-relay.example/proxy?target={url}, https://secondary-relay.example/proxy?target={url}'

    await expect(
      getTleApiResponse(
        vi.fn(async () => new Response('relay down', { status: 503 })) as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({
      message: 'TLE data unavailable.',
      cause: expect.objectContaining({
        name: 'TleGroupFetchError',
        groupId: expect.any(String),
        attempts: expect.arrayContaining([
          expect.objectContaining({
            groupId: expect.any(String),
            relayIndex: 0,
            relayPath: expect.stringContaining('/proxy?target='),
            status: 503,
          }),
          expect.objectContaining({
            groupId: expect.any(String),
            relayIndex: 1,
            relayPath: expect.stringContaining('/proxy?target='),
            status: 503,
          }),
        ]),
      }),
    })
  })

  it('fails fast when a configured relay template omits the upstream placeholder', async () => {
    process.env.NEXT_PUBLIC_SKYLENS_TLE_PROXY_URL_TEMPLATE = 'https://relay.example/proxy'

    const fetchMock = vi.fn()

    await expect(
      getTleApiResponse(fetchMock as unknown as typeof fetch),
    ).rejects.toMatchObject({
      message: 'TLE data unavailable.',
      cause: expect.objectContaining({
        message: 'TLE proxy template at relay index 0 must include {url}.',
      }),
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches and validates the client satellite catalog contract', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      new Response(getFixtureBody(resolveUpstreamUrl(String(input))), { status: 200 }),
    )

    const payload = await fetchSatelliteCatalog(fetchMock as unknown as typeof fetch)

    expect(
      payload.satellites.find((satellite) => satellite.noradId === 25544),
    ).toMatchObject({
      id: '25544',
      noradId: 25544,
      name: 'ISS (ZARYA)',
    })
  })

  it('projects the ISS from deterministic fixtures and preserves the detail metadata contract', () => {
    const observer: ObserverState = {
      lat: 35.6762,
      lon: 139.6503,
      altMeters: 40,
      accuracyMeters: 1,
      timestampMs: Date.UTC(2026, 2, 26, 4, 10, 0),
      source: 'demo',
    }
    const objects = normalizeSatelliteObjects({
      catalog: {
        fetchedAt: '2026-03-26T00:00:00.000Z',
        expiresAt: '2026-03-26T06:00:00.000Z',
        satellites: [buildFixtureSatellite(stationsFixture, 'stations', 0)],
      },
      observer,
      timeMs: observer.timestampMs,
      enabledLayers: ENABLED_LAYERS,
      likelyVisibleOnly: false,
      sunAltitudeDeg: -12,
    })
    const iss = objects[0]
    const projection = projectWorldPointToScreen(
      createPose(iss.azimuthDeg, iss.elevationDeg),
      iss,
      VIEWPORT,
    )

    expect(iss).toMatchObject({
      id: '25544',
      label: 'ISS (ZARYA)',
      type: 'satellite',
      azimuthDeg: 46.68,
      elevationDeg: 37.67,
      rangeKm: 667.2,
      metadata: {
        isIss: true,
        detail: {
          typeLabel: 'Satellite',
          noradId: 25544,
          azimuthDeg: 46.68,
          elevationDeg: 37.67,
          rangeKm: 667.2,
          isIss: true,
        },
      },
    })
    expect(projection.inViewport).toBe(true)
    expect(projection.x).toBeCloseTo(VIEWPORT.width / 2, 5)
    expect(projection.y).toBeCloseTo(VIEWPORT.height / 2, 5)
  })

  it('projects a non-ISS sample satellite and applies likely-visible-only gating', () => {
    const observer: ObserverState = {
      lat: 35.6762,
      lon: 139.6503,
      altMeters: 40,
      accuracyMeters: 1,
      timestampMs: Date.UTC(2026, 2, 26, 10, 50, 0),
      source: 'demo',
    }
    const catalog = {
      fetchedAt: '2026-03-26T00:00:00.000Z',
      expiresAt: '2026-03-26T06:00:00.000Z',
      satellites: [buildFixtureSatellite(brightestFixture, 'brightest', 0)],
    }
    const visibleObjects = normalizeSatelliteObjects({
      catalog,
      observer,
      timeMs: observer.timestampMs,
      enabledLayers: ENABLED_LAYERS,
      likelyVisibleOnly: false,
      sunAltitudeDeg: -12,
    })
    const hiddenObjects = normalizeSatelliteObjects({
      catalog,
      observer,
      timeMs: observer.timestampMs,
      enabledLayers: ENABLED_LAYERS,
      likelyVisibleOnly: true,
      sunAltitudeDeg: -2,
    })

    expect(visibleObjects[0]).toMatchObject({
      id: '694',
      label: 'ATLAS CENTAUR 2',
      metadata: {
        isIss: false,
        detail: {
          noradId: 694,
          azimuthDeg: 125,
          elevationDeg: 14.46,
          rangeKm: 2876.6,
          isIss: false,
        },
      },
    })
    expect(hiddenObjects).toEqual([])
  })

  it('hides satellites below the minimum elevation threshold', () => {
    const objects = normalizeSatelliteObjects({
      catalog: {
        fetchedAt: '2026-03-26T00:00:00.000Z',
        expiresAt: '2026-03-26T06:00:00.000Z',
        satellites: [buildFixtureSatellite(stationsFixture, 'stations', 0)],
      },
      observer: sfEveningObserver as ObserverState,
      timeMs: (sfEveningObserver as ObserverState).timestampMs,
      enabledLayers: ENABLED_LAYERS,
      likelyVisibleOnly: false,
      sunAltitudeDeg: -12,
    })

    expect(objects).toEqual([])
  })
})

function readFixture(fileName: string) {
  return readFileSync(join(process.cwd(), 'tests/fixtures/tle', fileName), 'utf8').trim()
}

function createSuccessFetch() {
  return vi.fn(async (input: RequestInfo | URL) =>
    new Response(getFixtureBody(resolveUpstreamUrl(String(input))), { status: 200 }),
  ) as unknown as typeof fetch
}

function resolveUpstreamUrl(input: string) {
  const marker = 'https%3A%2F%2Fcelestrak.org%2F'

  if (!input.includes(marker)) {
    return input
  }

  return decodeURIComponent(input.slice(input.indexOf(marker)))
}

function getFixtureBody(url: string) {
  if (url.includes('CATNR=25544')) {
    return stationsFixture.split(/\r?\n/).slice(0, 3).join('\n')
  }

  if (url.includes('GROUP=stations')) {
    return stationsFixture
  }

  if (url.includes('GROUP=visual')) {
    return brightestFixture
  }

  throw new Error(`Unexpected URL: ${url}`)
}

function buildFixtureSatellite(
  fixture: string,
  group: 'stations' | 'brightest',
  index: number,
) {
  const lines = fixture.split(/\r?\n/)
  const offset = index * 3
  const tle1 = lines[offset + 1]
  const noradId = Number.parseInt(tle1.trim().split(/\s+/)[1], 10)

  return {
    id: String(noradId),
    name: lines[offset].trim(),
    noradId,
    groups: [group],
    tle1: lines[offset + 1].trim(),
    tle2: lines[offset + 2].trim(),
    isIss: noradId === 25544,
  }
}

function createPose(yawDeg: number, pitchDeg: number): CameraPose {
  return {
    yawDeg,
    pitchDeg,
    rollDeg: 0,
    quaternion: createCameraQuaternion(yawDeg, pitchDeg, 0),
    alignmentHealth: 'good',
    mode: 'sensor',
  }
}
