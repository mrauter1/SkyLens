import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockHorizon = vi.fn()
const mockConstellation = vi.fn()

vi.mock('astronomy-engine', () => ({
  Observer: class MockObserver {
    constructor(
      readonly _lat: number,
      readonly _lon: number,
      readonly _altMeters: number,
    ) {}
  },
  Horizon: (...args: unknown[]) => mockHorizon(...args),
  Constellation: (...args: unknown[]) => mockConstellation(...args),
}))

vi.mock('../../public/data/stars_200.json', () => ({
  default: [
    {
      id: 'bright-star',
      name: 'Bright',
      raDeg: 0,
      decDeg: 0,
      magnitude: 2,
    },
    {
      id: 'dim-star',
      name: 'Dim',
      raDeg: 15,
      decDeg: 10,
      magnitude: 7,
    },
    {
      id: 'below-horizon-star',
      name: 'Below',
      raDeg: 30,
      decDeg: -10,
      magnitude: 1,
    },
  ],
}))

describe('star scope pipeline', () => {
  beforeEach(() => {
    vi.resetModules()
    mockHorizon.mockReset()
    mockConstellation.mockReset()
    mockConstellation.mockReturnValue({ name: 'Mock Constellation' })
  })

  it('keeps likely-visible daylight suppression ahead of scope filtering', async () => {
    const { normalizeVisibleStars } = await import('../../lib/astronomy/stars')

    const stars = normalizeVisibleStars({
      observer: {
        lat: 40,
        lon: -73,
        altMeters: 10,
        timestampMs: Date.UTC(2026, 2, 20, 3, 0, 0),
        source: 'demo',
      },
      timeMs: Date.UTC(2026, 2, 20, 3, 0, 0),
      enabledLayers: {
        aircraft: true,
        satellites: true,
        planets: true,
        stars: true,
        constellations: true,
      },
      likelyVisibleOnly: true,
      sunAltitudeDeg: 12,
      scopeModeEnabled: true,
      scopeOptics: {
        apertureMm: 400,
        magnificationX: 400,
        transparencyPct: 100,
      },
    })

    expect(stars).toEqual([])
    expect(mockHorizon).not.toHaveBeenCalled()
  })

  it('keeps scope render metadata absent when scope mode is off', async () => {
    mockHorizon
      .mockReturnValueOnce({ altitude: 25, azimuth: 10 })
      .mockReturnValueOnce({ altitude: 25, azimuth: 20 })
      .mockReturnValueOnce({ altitude: -5, azimuth: 30 })

    const { normalizeVisibleStars } = await import('../../lib/astronomy/stars')

    const stars = normalizeVisibleStars({
      observer: {
        lat: 40,
        lon: -73,
        altMeters: 10,
        timestampMs: Date.UTC(2026, 2, 20, 3, 0, 0),
        source: 'demo',
      },
      timeMs: Date.UTC(2026, 2, 20, 3, 0, 0),
      enabledLayers: {
        aircraft: true,
        satellites: true,
        planets: true,
        stars: true,
        constellations: true,
      },
      likelyVisibleOnly: false,
      sunAltitudeDeg: -20,
      scopeModeEnabled: false,
      scopeOptics: {
        apertureMm: 100,
        magnificationX: 40,
        transparencyPct: 80,
      },
    })

    expect(mockHorizon).toHaveBeenCalledTimes(3)
    expect(stars.map((entry) => entry.id)).toEqual(['bright-star', 'dim-star'])
    expect(stars.every((entry) => entry.object.metadata.scopeRender === undefined)).toBe(true)
  })

  it('filters dim stars only after horizon gating and attaches scope render metadata to passing stars', async () => {
    mockHorizon
      .mockReturnValueOnce({ altitude: 25, azimuth: 10 })
      .mockReturnValueOnce({ altitude: 25, azimuth: 20 })
      .mockReturnValueOnce({ altitude: -5, azimuth: 30 })

    const { normalizeVisibleStars } = await import('../../lib/astronomy/stars')

    const stars = normalizeVisibleStars({
      observer: {
        lat: 40,
        lon: -73,
        altMeters: 10,
        timestampMs: Date.UTC(2026, 2, 20, 3, 0, 0),
        source: 'demo',
      },
      timeMs: Date.UTC(2026, 2, 20, 3, 0, 0),
      enabledLayers: {
        aircraft: true,
        satellites: true,
        planets: true,
        stars: true,
        constellations: true,
      },
      likelyVisibleOnly: false,
      sunAltitudeDeg: -20,
      scopeModeEnabled: true,
      scopeOptics: {
        apertureMm: 100,
        magnificationX: 40,
        transparencyPct: 80,
      },
    })

    expect(mockHorizon).toHaveBeenCalledTimes(3)
    expect(stars.map((entry) => entry.id)).toEqual(['bright-star'])
    expect(stars[0]?.object.metadata.scopeRender).toMatchObject({
      displayIntensity: expect.any(Number),
      corePx: expect.any(Number),
      haloPx: expect.any(Number),
    })
  })
})
