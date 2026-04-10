import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewerRouteState } from '../../lib/permissions/coordinator'
import * as projectionCamera from '../../lib/projection/camera'
import { resetScopeCatalogSessionCacheForTests } from '../../lib/scope/catalog'

vi.setConfig({ testTimeout: 20_000 })

const {
  mockRouterReplace,
  mockSettingsSheetProps,
  mockRequestStartupObserverState,
  mockStartObserverTracking,
  mockSubscribeToOrientationPose,
  mockFetchAircraftSnapshot,
  mockGetAircraftAvailabilityMessage,
  mockNormalizeCelestialObjects,
  mockNormalizeVisibleStars,
  mockBuildVisibleConstellations,
  mockFetchSatelliteCatalog,
  mockResolveAircraftMotionObjects,
  mockResolveSatelliteMotionObjects,
  mockAircraftTrackerGetTrail,
  mockCreateAircraftTracker,
} = vi.hoisted(() => ({
  mockRouterReplace: vi.fn(),
  mockSettingsSheetProps: vi.fn(),
  mockRequestStartupObserverState: vi.fn(),
  mockStartObserverTracking: vi.fn(),
  mockSubscribeToOrientationPose: vi.fn(),
  mockFetchAircraftSnapshot: vi.fn(),
  mockGetAircraftAvailabilityMessage: vi.fn(),
  mockNormalizeCelestialObjects: vi.fn(),
  mockNormalizeVisibleStars: vi.fn(),
  mockBuildVisibleConstellations: vi.fn(),
  mockFetchSatelliteCatalog: vi.fn(),
  mockResolveAircraftMotionObjects: vi.fn(),
  mockResolveSatelliteMotionObjects: vi.fn(),
  mockAircraftTrackerGetTrail: vi.fn(),
  mockCreateAircraftTracker: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
  }),
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    React.createElement('a', { href, ...props }, children),
}))

vi.mock('../../components/settings/settings-sheet', () => ({
  SettingsSheet: (props: unknown) => {
    mockSettingsSheetProps(props)

    return React.createElement('div', { 'data-testid': 'settings-sheet' })
  },
}))

vi.mock('../../lib/sensors/location', async () => {
  const actual = await vi.importActual<typeof import('../../lib/sensors/location')>(
    '../../lib/sensors/location',
  )

  return {
    ...actual,
    requestStartupObserverState: mockRequestStartupObserverState,
    startObserverTracking: mockStartObserverTracking,
  }
})

vi.mock('../../lib/sensors/orientation', async () => {
  const actual = await vi.importActual<typeof import('../../lib/sensors/orientation')>(
    '../../lib/sensors/orientation',
  )

  return {
    ...actual,
    subscribeToOrientationPose: mockSubscribeToOrientationPose,
  }
})

vi.mock('../../lib/astronomy/celestial', () => ({
  isCelestialDaylightLabelSuppressed: (object: { metadata?: Record<string, unknown> }) =>
    object.metadata?.daylightLabelSuppressed === true,
  normalizeCelestialObjects: mockNormalizeCelestialObjects,
}))

vi.mock('../../lib/astronomy/stars', () => ({
  loadStarCatalog: () => [],
  normalizeVisibleStars: mockNormalizeVisibleStars,
}))

vi.mock('../../lib/astronomy/constellations', () => ({
  buildVisibleConstellations: mockBuildVisibleConstellations,
}))

vi.mock('../../lib/aircraft/client', () => ({
  fetchAircraftSnapshot: mockFetchAircraftSnapshot,
  getAircraftAvailabilityMessage: mockGetAircraftAvailabilityMessage,
}))

vi.mock('../../lib/aircraft/tracker', () => ({
  createAircraftTracker: mockCreateAircraftTracker,
}))

vi.mock('../../lib/satellites/client', () => ({
  fetchSatelliteCatalog: mockFetchSatelliteCatalog,
}))

vi.mock('../../lib/viewer/motion', async () => {
  const actual = await vi.importActual<typeof import('../../lib/viewer/motion')>(
    '../../lib/viewer/motion',
  )

  return {
    ...actual,
    resolveAircraftMotionObjects: mockResolveAircraftMotionObjects,
    resolveSatelliteMotionObjects: mockResolveSatelliteMotionObjects,
  }
})

import { ViewerShell } from '../../components/viewer/viewer-shell'
import {
  VIEWER_SETTINGS_STORAGE_KEY,
  readViewerSettings,
} from '../../lib/viewer/settings'

const LIVE_OBSERVER_FIXTURE = {
  lat: 37.7749,
  lon: -122.4194,
  altMeters: 15,
  accuracyMeters: 5,
  timestampMs: Date.UTC(2026, 2, 26, 0, 45, 6),
  source: 'live' as const,
}

const SENSOR_CONTROLLER = {
  stop: vi.fn(),
  recenter: vi.fn(),
}

const TRACKER = {
  stop: vi.fn(),
}

const originalMatchMedia = window.matchMedia
const originalFetch = global.fetch
const originalSetTimeout = window.setTimeout
const originalClearTimeout = window.clearTimeout
const originalSetInterval = window.setInterval
const originalClearInterval = window.clearInterval

describe('ViewerShell celestial behavior', () => {
  let container: HTMLDivElement
  let root: Root

  beforeAll(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true

    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn(async () => undefined),
    })

    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
      configurable: true,
      writable: true,
      value: null,
    })

    Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 1),
    })
    Object.defineProperty(HTMLVideoElement.prototype, 'cancelVideoFrameCallback', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    })
  })

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    mockRouterReplace.mockReset()
    mockSettingsSheetProps.mockReset()
    mockRequestStartupObserverState.mockReset()
    mockStartObserverTracking.mockReset()
    mockSubscribeToOrientationPose.mockReset()
    mockFetchAircraftSnapshot.mockReset()
    mockGetAircraftAvailabilityMessage.mockReset()
    mockNormalizeCelestialObjects.mockReset()
    mockNormalizeVisibleStars.mockReset()
    mockBuildVisibleConstellations.mockReset()
    mockFetchSatelliteCatalog.mockReset()
    mockResolveAircraftMotionObjects.mockReset()
    mockResolveSatelliteMotionObjects.mockReset()
    mockAircraftTrackerGetTrail.mockReset()
    mockCreateAircraftTracker.mockReset()
    SENSOR_CONTROLLER.stop.mockReset()
    SENSOR_CONTROLLER.recenter.mockReset()
    TRACKER.stop.mockReset()

    mockRequestStartupObserverState.mockResolvedValue(LIVE_OBSERVER_FIXTURE)
    mockStartObserverTracking.mockReturnValue(TRACKER)
    mockSubscribeToOrientationPose.mockReturnValue(SENSOR_CONTROLLER)
    mockFetchAircraftSnapshot.mockResolvedValue({
      fetchedAt: '2026-03-26T00:00:00.000Z',
      observer: {
        lat: LIVE_OBSERVER_FIXTURE.lat,
        lon: LIVE_OBSERVER_FIXTURE.lon,
        altMeters: LIVE_OBSERVER_FIXTURE.altMeters,
      },
      availability: 'available',
      aircraft: [],
    })
    mockGetAircraftAvailabilityMessage.mockReturnValue(null)
    mockNormalizeVisibleStars.mockReturnValue([])
    mockBuildVisibleConstellations.mockReturnValue({
      objects: [],
      lineSegments: [],
    })
    mockFetchSatelliteCatalog.mockResolvedValue({
      fetchedAt: '2026-03-26T00:00:00.000Z',
      expiresAt: '2026-03-26T06:00:00.000Z',
      satellites: [],
    })
    mockResolveAircraftMotionObjects.mockReturnValue([])
    mockResolveSatelliteMotionObjects.mockReturnValue([])
    mockAircraftTrackerGetTrail.mockReturnValue([])
    mockCreateAircraftTracker.mockImplementation(() => ({
      ingest: vi.fn(),
      resolve: vi.fn(() => []),
      getTrail: mockAircraftTrackerGetTrail,
      prune: vi.fn(),
      reset: vi.fn(),
    }))
    global.fetch = vi.fn(async () => new Response(null, { status: 404 })) as typeof fetch
    window.localStorage.clear()
    resetScopeCatalogSessionCacheForTests()
    stubCanvasContext()
  })

  afterEach(async () => {
    vi.useRealTimers()
    global.fetch = originalFetch
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    })
    Object.defineProperty(window, 'setTimeout', {
      configurable: true,
      writable: true,
      value: originalSetTimeout,
    })
    Object.defineProperty(window, 'clearTimeout', {
      configurable: true,
      writable: true,
      value: originalClearTimeout,
    })
    Object.defineProperty(window, 'setInterval', {
      configurable: true,
      writable: true,
      value: originalSetInterval,
    })
    Object.defineProperty(window, 'clearInterval', {
      configurable: true,
      writable: true,
      value: originalClearInterval,
    })

  await act(async () => {
    root.unmount()
  })
  container.remove()
  window.localStorage.clear()
  resetScopeCatalogSessionCacheForTests()
  })

  it(
    'shows the bottom dock from the centered celestial object metadata',
    async () => {
      mockNormalizeCelestialObjects.mockReturnValue({
        sunAltitudeDeg: -12,
        objects: [
          {
            id: 'sun',
            type: 'sun',
            label: 'Sun',
            azimuthDeg: 0,
            elevationDeg: 16,
            importance: 90,
            metadata: {
              detail: {
                typeLabel: 'Sun',
                elevationDeg: 16,
                azimuthDeg: 0,
              },
            },
          },
        ],
      })

      await renderViewer({
        entry: 'demo',
        location: 'granted',
        camera: 'denied',
        orientation: 'denied',
      })

      expect(container.textContent).toContain('Viewer snapshot')
      expect(container.textContent).toContain('Sun')
    expect(container.textContent).toContain('Type')
    expect(container.textContent).toContain('Elevation')
    expect(container.textContent).toContain('Azimuth')
    },
    20_000,
  )

  it('shows the fallback hint when nothing qualifies for center-lock', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [],
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    expect(container.textContent).toContain('Viewer snapshot')
    expect(container.textContent).toContain('Move until an object snaps here.')
    expect(container.textContent).toContain('Target North marker')
  })

  it(
    'keeps non-bright scope center-lock winners and lens markers aligned with normal-view classes',
    async () => {
      const originalFetch = global.fetch
      global.fetch = vi.fn().mockRejectedValue(new Error('scope unavailable')) as typeof fetch

      try {
        mockNormalizeCelestialObjects.mockReturnValue({
          sunAltitudeDeg: -12,
          objects: [
        {
          id: 'star-sirius',
          type: 'star',
          label: 'Sirius',
          azimuthDeg: 2,
          elevationDeg: 16,
          magnitude: -1.46,
          importance: 74,
          metadata: {
            detail: {
              typeLabel: 'Star',
              magnitude: -1.46,
              elevationDeg: 16,
            },
          },
        },
      ],
    })
    mockResolveAircraftMotionObjects.mockReturnValue([
      {
        object: {
          id: 'flight-1',
          type: 'aircraft',
          label: 'UAL123',
          azimuthDeg: 0,
          elevationDeg: 16,
          rangeKm: 12.5,
          importance: 92,
          metadata: {
            detail: {
              typeLabel: 'Aircraft',
              altitudeFeet: 32000,
              altitudeMeters: 9754,
              rangeKm: 12.5,
            },
          },
        },
      },
    ])

        await renderViewer({
          entry: 'demo',
          location: 'granted',
          camera: 'denied',
          orientation: 'denied',
        }, {
          openDesktopViewerPanel: false,
        })

        const centerLockChip = () =>
          container.querySelector('[data-testid="center-lock-chip"]') as HTMLElement | null
        const getWideMarkerVisual = (objectId: string) =>
          container.querySelector(
            `[data-testid="sky-object-marker"][data-object-id="${objectId}"] > span:last-child`,
          ) as HTMLSpanElement | null
        const getScopeMarkerVisual = (objectId: string) =>
          container.querySelector(
            `[data-testid="scope-bright-object-marker"][data-object-id="${objectId}"] > span`,
          ) as HTMLSpanElement | null

        expect(centerLockChip()?.textContent).toContain('UAL123')
        expect(getWideMarkerVisual('flight-1')?.className).toContain('border-amber-100/80')

        await act(async () => {
          ;(
            container.querySelector('[data-testid="desktop-scope-action"]') as HTMLButtonElement | null
          )?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        })
        await flushEffects()

        expect(centerLockChip()?.textContent).toContain('UAL123')
        expect(container.querySelectorAll('[data-testid="scope-bright-object-marker"]').length).toBe(2)
        expect(getScopeMarkerVisual('flight-1')?.className).toContain('border-amber-100/80')
        expect(getScopeMarkerVisual('star-sirius')).not.toBeNull()
        expect(getWideMarkerVisual('flight-1')?.className).toContain('border-amber-100/80')
        expect(getWideMarkerVisual('star-sirius')?.className).not.toContain('border-amber-100/80')
      } finally {
        global.fetch = originalFetch
      }
    },
    20_000,
  )

  it(
    'uses the widened scope marker set for on-object labels in scope mode',
    async () => {
      window.localStorage.setItem(
        VIEWER_SETTINGS_STORAGE_KEY,
        JSON.stringify({
          ...readViewerSettings(),
          labelDisplayMode: 'on_objects',
          scopeModeEnabled: true,
          scope: {
            verticalFovDeg: 10,
          },
        }),
      )
      mockNormalizeCelestialObjects.mockReturnValue({
        sunAltitudeDeg: -12,
        objects: [
          {
            id: 'star-sirius',
            type: 'star',
            label: 'Sirius',
            azimuthDeg: 2,
            elevationDeg: 16,
            magnitude: -1.46,
            importance: 74,
            metadata: {
              detail: {
                typeLabel: 'Star',
                magnitude: -1.46,
                elevationDeg: 16,
              },
            },
          },
        ],
      })
      mockResolveAircraftMotionObjects.mockReturnValue([
        {
          object: {
            id: 'flight-1',
            type: 'aircraft',
            label: 'UAL123',
            azimuthDeg: 0,
            elevationDeg: 16,
            rangeKm: 12.5,
            importance: 92,
            metadata: {
              detail: {
                typeLabel: 'Aircraft',
                altitudeFeet: 32000,
                altitudeMeters: 9754,
                rangeKm: 12.5,
              },
            },
          },
        },
      ])

      await renderViewer(
        {
          entry: 'demo',
          location: 'granted',
          camera: 'denied',
          orientation: 'denied',
        },
        {
          openDesktopViewerPanel: false,
        },
      )
      const aircraftLabel = container.querySelector(
        '[data-testid="sky-object-label"][data-object-id="flight-1"]',
      ) as HTMLDivElement | null

      expect(container.querySelectorAll('[data-testid="scope-bright-object-marker"]')).toHaveLength(2)
      expect(aircraftLabel).not.toBeNull()
      expect(aircraftLabel?.className).toContain('border-amber-200/70')
    },
    20_000,
  )

  it(
    'keeps wide-stage markers visible and clickable outside the scope lens in scope mode',
    async () => {
      window.localStorage.setItem(
        VIEWER_SETTINGS_STORAGE_KEY,
        JSON.stringify({
          ...readViewerSettings(),
          labelDisplayMode: 'center_only',
          scopeModeEnabled: true,
          scopeOptics: {
            apertureMm: 240,
            magnificationX: 50,
            transparencyPct: 85,
          },
          scope: {
            verticalFovDeg: 10,
          },
        }),
      )
      mockNormalizeCelestialObjects.mockReturnValue({
        sunAltitudeDeg: -12,
        objects: [
          {
            id: 'planet-mars',
            type: 'planet',
            label: 'Mars',
            azimuthDeg: 0,
            elevationDeg: 16,
            importance: 72,
            metadata: {
              detail: {
                typeLabel: 'Planet',
                elevationDeg: 16,
                azimuthDeg: 0,
              },
            },
          },
          {
            id: 'planet-jupiter',
            type: 'planet',
            label: 'Jupiter',
            azimuthDeg: 12,
            elevationDeg: 16,
            importance: 84,
            metadata: {
              detail: {
                typeLabel: 'Planet',
                elevationDeg: 16,
                azimuthDeg: 12,
                magnitude: -2.7,
              },
            },
          },
        ],
      })

      await renderViewer({
        entry: 'demo',
        location: 'granted',
        camera: 'denied',
        orientation: 'denied',
      })

      const outsideLensMarker = container.querySelector(
        '[data-testid="sky-object-marker"][data-object-id="planet-jupiter"]',
      ) as HTMLButtonElement | null

      expect(outsideLensMarker).not.toBeNull()
      expect(
        container.querySelector(
          '[data-testid="scope-bright-object-marker"][data-object-id="planet-jupiter"]',
        ),
      ).toBeNull()
      expect(
        container.querySelector('[data-testid="scope-bright-object-marker"][data-object-id="planet-mars"]'),
      ).not.toBeNull()

      await act(async () => {
        outsideLensMarker!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await flushEffects()

      expect(container.textContent).toContain('Selected object')
      expect(container.textContent).toContain('Jupiter')
    },
    20_000,
  )

  it(
    'keeps stage marker highlight ownership on the wide-scene center lock in scope mode',
    async () => {
      const originalPickCenterLockedCandidate = projectionCamera.pickCenterLockedCandidate
      const pickCenterLockedCandidateSpy = vi.spyOn(
        projectionCamera,
        'pickCenterLockedCandidate',
      )

      pickCenterLockedCandidateSpy.mockImplementation((candidates, angularRadiusDeg) => {
        if (candidates.some((candidate) => candidate.id === 'planet-jupiter')) {
          return candidates.find((candidate) => candidate.id === 'planet-jupiter') ?? null
        }

        if (candidates.some((candidate) => candidate.id === 'planet-mars')) {
          return candidates.find((candidate) => candidate.id === 'planet-mars') ?? null
        }

        return originalPickCenterLockedCandidate(candidates, angularRadiusDeg)
      })

      try {
        window.localStorage.setItem(
          VIEWER_SETTINGS_STORAGE_KEY,
          JSON.stringify({
            ...readViewerSettings(),
            labelDisplayMode: 'center_only',
            scopeModeEnabled: true,
            scope: {
              verticalFovDeg: 10,
            },
          }),
        )
        mockNormalizeCelestialObjects.mockReturnValue({
          sunAltitudeDeg: -12,
          objects: [
            {
              id: 'planet-mars',
              type: 'planet',
              label: 'Mars',
              azimuthDeg: 0,
              elevationDeg: 16,
              importance: 72,
              metadata: {
                detail: {
                  typeLabel: 'Planet',
                  elevationDeg: 16,
                  azimuthDeg: 0,
                },
              },
            },
            {
              id: 'planet-jupiter',
              type: 'planet',
              label: 'Jupiter',
              azimuthDeg: 12,
              elevationDeg: 16,
              importance: 84,
              metadata: {
                detail: {
                  typeLabel: 'Planet',
                  elevationDeg: 16,
                  azimuthDeg: 12,
                  magnitude: -2.7,
                },
              },
            },
          ],
        })

        await renderViewer(
          {
            entry: 'demo',
            location: 'granted',
            camera: 'denied',
            orientation: 'denied',
          },
          {
            openDesktopViewerPanel: false,
          },
        )

        const wideMarkerVisual = container.querySelector(
          '[data-testid="sky-object-marker"][data-object-id="planet-jupiter"] > span:last-child',
        ) as HTMLSpanElement | null

        expect(container.querySelector('[data-testid="center-lock-chip"]')?.textContent).toContain(
          'Mars',
        )
        expect(wideMarkerVisual?.className).toContain('border-amber-100/80')
        expect(
          container.querySelector(
            '[data-testid="scope-bright-object-marker"][data-object-id="planet-jupiter"]',
          ),
        ).toBeNull()
        expect(
          container.querySelector(
            '[data-testid="scope-bright-object-marker"][data-object-id="planet-mars"] > span',
          ),
        ).not.toBeNull()
      } finally {
        pickCenterLockedCandidateSpy.mockRestore()
      }
    },
    20_000,
  )

  it(
    'keeps motion-affordance coordinates aligned with the clicked stage marker in scope mode',
    async () => {
      const timerHarness = installWindowTimerHarness()

      try {
        window.localStorage.setItem(
          VIEWER_SETTINGS_STORAGE_KEY,
          JSON.stringify({
            ...readViewerSettings(),
            labelDisplayMode: 'center_only',
            motionQuality: 'low',
            scopeModeEnabled: true,
            scope: {
              verticalFovDeg: 10,
            },
          }),
        )
        mockNormalizeCelestialObjects.mockReturnValue({
          sunAltitudeDeg: -12,
          objects: [],
        })
        mockResolveSatelliteMotionObjects.mockReturnValue([
          {
            confidence: 1,
            motionState: 'propagated',
            object: {
              id: '25544',
              type: 'satellite',
              label: 'ISS (ZARYA)',
              sublabel: 'Satellite',
              azimuthDeg: 3,
              elevationDeg: 16,
              rangeKm: 420.7,
              importance: 88,
              metadata: {
                isIss: true,
                detail: {
                  typeLabel: 'Satellite',
                  noradId: 25544,
                  elevationDeg: 16,
                  azimuthDeg: 3,
                  rangeKm: 420.7,
                  isIss: true,
                },
              },
            },
          },
        ])

        await renderViewer({
          entry: 'demo',
          location: 'granted',
          camera: 'denied',
          orientation: 'denied',
          demoScenarioId: 'tokyo-iss',
        })

        const marker = container.querySelector(
          '[data-testid="sky-object-marker"][data-object-id="25544"]',
        ) as HTMLButtonElement | null

        expect(marker).not.toBeNull()

        const markerPosition = getAbsoluteMarkerPosition(marker!)

        await act(async () => {
          marker!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        })
        await flushEffects()

        const advanceSceneTime = timerHarness.getIntervalCallback(1_000)

        await act(async () => {
          advanceSceneTime()
        })
        await flushEffects()

        await act(async () => {
          advanceSceneTime()
        })
        await flushEffects()

        const vector = container.querySelector(
          '[data-testid="motion-affordance-vector"]',
        ) as SVGLineElement | null

        expect(vector).not.toBeNull()
        expect(Number(vector?.getAttribute('x1'))).toBeCloseTo(markerPosition.x, 3)
        expect(Number(vector?.getAttribute('y1'))).toBeCloseTo(markerPosition.y, 3)
      } finally {
        timerHarness.restore()
      }
    },
    20_000,
  )

  it(
    'keeps scope daylight-suppression overrides aligned with the centered label path',
    async () => {
      window.localStorage.setItem(
        VIEWER_SETTINGS_STORAGE_KEY,
        JSON.stringify({
          ...readViewerSettings(),
          scopeModeEnabled: true,
          scope: {
            verticalFovDeg: 10,
          },
        }),
      )
      mockNormalizeCelestialObjects.mockReturnValue({
        sunAltitudeDeg: 14,
        objects: [
          {
            id: 'planet-mars',
            type: 'planet',
            label: 'Mars',
            azimuthDeg: 0,
            elevationDeg: 16,
            importance: 72,
            metadata: {
              daylightLabelSuppressed: true,
              detail: {
                typeLabel: 'Planet',
                elevationDeg: 16,
                azimuthDeg: 0,
              },
            },
          },
        ],
      })

      await renderViewer(
        {
          entry: 'demo',
          location: 'granted',
          camera: 'denied',
          orientation: 'denied',
        },
        {
          openDesktopViewerPanel: false,
        },
      )

      expect(container.querySelector('[data-testid="center-lock-chip"]')?.textContent).toContain(
        'Mars',
      )
      expect(
        container.querySelector('[data-testid="sky-object-marker"][data-object-id="planet-mars"]'),
      ).not.toBeNull()
      expect(
        container.querySelector(
          '[data-testid="scope-bright-object-marker"][data-object-id="planet-mars"]',
        ),
      ).not.toBeNull()
    },
    40_000,
  )

  it('renders constellation line segments inside the scope overlay when scope mode is active', async () => {
    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...readViewerSettings(),
        labelDisplayMode: 'on_objects',
        scopeModeEnabled: true,
        scope: {
          verticalFovDeg: 10,
        },
      }),
    )
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [
        {
          id: 'star-sirius',
          type: 'star',
          label: 'Sirius',
          azimuthDeg: 0,
          elevationDeg: 16,
          magnitude: -1.46,
          importance: 74,
          metadata: {
            detail: {
              typeLabel: 'Star',
              magnitude: -1.46,
              elevationDeg: 16,
            },
          },
        },
      ],
    })
    mockBuildVisibleConstellations.mockReturnValue({
      objects: [
        {
          id: 'constellation-orion',
          type: 'constellation',
          label: 'Orion',
          azimuthDeg: 12,
          elevationDeg: 16,
          importance: 12,
          metadata: {
            detail: {
              typeLabel: 'Constellation',
              summaryText: 'Belt and shoulders',
            },
          },
        },
      ],
      lineSegments: [
        {
          constellationId: 'orion',
          start: { x: 12, y: 18 },
          end: { x: 40, y: 36 },
        },
      ],
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    const overlay = container.querySelector('[data-testid="scope-lens-overlay"]')
    const marker = container.querySelector(
      '[data-testid="sky-object-marker"][data-object-id="star-sirius"]',
    )
    const label = container.querySelector(
      '[data-testid="sky-object-label"][data-object-id="star-sirius"]',
    )
    const scopeConstellationLine = overlay?.querySelector('[data-testid="scope-constellation-line"]')

    expect(overlay).not.toBeNull()
    expect(marker).not.toBeNull()
    expect(label).not.toBeNull()
    expect(scopeConstellationLine).not.toBeNull()
    expect(marker!.compareDocumentPosition(overlay!) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(label!.compareDocumentPosition(overlay!) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  })

  it('keeps constellation line endpoints aligned with marker projections in normal view', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -18,
      objects: [
        {
          id: 'star-sirius',
          type: 'star',
          label: 'Sirius',
          azimuthDeg: 0,
          elevationDeg: 16,
          magnitude: -1.46,
          importance: 74,
          metadata: {
            detail: {
              typeLabel: 'Star',
              magnitude: -1.46,
              elevationDeg: 16,
            },
          },
        },
      ],
    })
    mockBuildVisibleConstellations.mockImplementation((input: {
      projectLinePoint?: (worldPoint: { azimuthDeg: number; elevationDeg: number }) => {
        x: number
        y: number
      }
    }) => {
      const projectLinePoint =
        input.projectLinePoint ??
        ((worldPoint: { azimuthDeg: number; elevationDeg: number }) => ({
          x: worldPoint.azimuthDeg,
          y: worldPoint.elevationDeg,
        }))

      return {
        objects: [],
        lineSegments: [
          {
            constellationId: 'orion',
            start: projectLinePoint({ azimuthDeg: 0, elevationDeg: 16 }),
            end: projectLinePoint({ azimuthDeg: 4, elevationDeg: 16 }),
          },
        ],
      }
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    const marker = container.querySelector(
      '[data-testid="sky-object-marker"][data-object-id="star-sirius"]',
    ) as HTMLElement | null
    const constellationLine = container.querySelector('svg line') as SVGLineElement | null

    expect(marker).not.toBeNull()
    expect(constellationLine).not.toBeNull()

    const markerPosition = getAbsoluteMarkerPosition(marker!)
    expect(Number(constellationLine?.getAttribute('x1'))).toBeCloseTo(markerPosition.x, 3)
    expect(Number(constellationLine?.getAttribute('y1'))).toBeCloseTo(markerPosition.y, 3)
  })

  it('keeps constellation line endpoints aligned with marker projections at the default main-view scale', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -18,
      objects: [
        {
          id: 'star-sirius',
          type: 'star',
          label: 'Sirius',
          azimuthDeg: 0,
          elevationDeg: 16,
          magnitude: -1.46,
          importance: 74,
          metadata: {
            detail: {
              typeLabel: 'Star',
              magnitude: -1.46,
              elevationDeg: 16,
            },
          },
        },
      ],
    })
    mockBuildVisibleConstellations.mockImplementation((input: {
      projectLinePoint?: (worldPoint: { azimuthDeg: number; elevationDeg: number }) => {
        x: number
        y: number
      }
    }) => {
      const projectLinePoint =
        input.projectLinePoint ??
        ((worldPoint: { azimuthDeg: number; elevationDeg: number }) => ({
          x: worldPoint.azimuthDeg,
          y: worldPoint.elevationDeg,
        }))

      return {
        objects: [],
        lineSegments: [
          {
            constellationId: 'orion',
            start: projectLinePoint({ azimuthDeg: 0, elevationDeg: 16 }),
            end: projectLinePoint({ azimuthDeg: 4, elevationDeg: 16 }),
          },
        ],
      }
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    const marker = container.querySelector(
      '[data-testid="sky-object-marker"][data-object-id="star-sirius"]',
    ) as HTMLElement | null
    const constellationLine = container.querySelector('svg line') as SVGLineElement | null

    expect(marker).not.toBeNull()
    expect(constellationLine).not.toBeNull()

    const markerPosition = getAbsoluteMarkerPosition(marker!)
    expect(Number(constellationLine?.getAttribute('x1'))).toBeCloseTo(markerPosition.x, 3)
    expect(Number(constellationLine?.getAttribute('y1'))).toBeCloseTo(markerPosition.y, 3)
  })

  it('routes constellation segments through the shared stage projector even before magnification is enabled', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -18,
      objects: [],
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    expect(mockBuildVisibleConstellations).toHaveBeenCalled()
    expect(mockBuildVisibleConstellations.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        projectLinePoint: expect.any(Function),
        viewport: expect.objectContaining({
          width: expect.any(Number),
          height: expect.any(Number),
          sourceWidth: expect.any(Number),
          sourceHeight: expect.any(Number),
        }),
      }),
    )
  })

  it.skip(
    'keeps focused aircraft trails aligned with aircraft markers in normal view',
    async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -18,
      objects: [],
    })
    mockResolveAircraftMotionObjects.mockReturnValue([
      {
        object: {
          id: 'flight-1',
          type: 'aircraft',
          label: 'UAL123',
          azimuthDeg: 0,
          elevationDeg: 16,
          rangeKm: 12.5,
          importance: 92,
          metadata: {
            detail: {
              typeLabel: 'Aircraft',
              altitudeFeet: 32000,
              altitudeMeters: 9754,
              rangeKm: 12.5,
            },
          },
        },
      },
    ])
    mockAircraftTrackerGetTrail.mockReturnValue([
      {
        timestampMs: 0,
        lat: 0,
        lon: 0,
        altitudeMeters: 9754,
        azimuthDeg: 0,
        elevationDeg: 16,
        rangeKm: 12.5,
      },
      {
        timestampMs: 1_000,
        lat: 0,
        lon: 0,
        altitudeMeters: 9754,
        azimuthDeg: 4,
        elevationDeg: 16,
        rangeKm: 12.6,
      },
    ])

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    const marker = container.querySelector(
      '[data-testid="sky-object-marker"][data-object-id="flight-1"]',
    ) as HTMLElement | null
    const trail = container.querySelector(
      '[data-testid="aircraft-trail"][data-object-id="flight-1"]',
    ) as SVGPolylineElement | null

    expect(marker).not.toBeNull()
    expect(trail).not.toBeNull()

    const markerPosition = getAbsoluteMarkerPosition(marker!)
    const [trailStart] = getPolylinePoints(trail!)

    expect(trailStart?.x).toBeCloseTo(markerPosition.x, 3)
    expect(trailStart?.y).toBeCloseTo(markerPosition.y, 3)
  }, 40_000)

  it('defaults the selected alignment target to Sun when only Sun is visible', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: 14,
      objects: [
        {
          id: 'sun',
          type: 'sun',
          label: 'Sun',
          azimuthDeg: 0,
          elevationDeg: 18,
          importance: 95,
          metadata: {
            detail: {
              typeLabel: 'Sun',
              elevationDeg: 18,
              azimuthDeg: 0,
            },
          },
        },
      ],
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    const latestSettingsProps = () =>
      mockSettingsSheetProps.mock.calls.at(-1)?.[0] as
        | {
            alignmentTargetPreference?: 'sun' | 'moon'
          }
        | undefined

    expect(container.textContent).toContain('Target Sun')
    expect(latestSettingsProps()?.alignmentTargetPreference).toBe('sun')
    },
    20_000,
  )

  it('defaults the selected alignment target to Moon when only Moon is visible', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [
        {
          id: 'moon',
          type: 'moon',
          label: 'Moon',
          azimuthDeg: 12,
          elevationDeg: 28,
          importance: 88,
          metadata: {
            detail: {
              typeLabel: 'Moon',
              elevationDeg: 28,
              azimuthDeg: 12,
            },
          },
        },
      ],
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    const initialSettingsProps = mockSettingsSheetProps.mock.calls[0]?.[0] as
      | {
          alignmentTargetPreference?: 'sun' | 'moon'
        }
      | undefined
    const latestSettingsProps = () =>
      mockSettingsSheetProps.mock.calls.at(-1)?.[0] as
        | {
            alignmentTargetPreference?: 'sun' | 'moon'
          }
        | undefined

    expect(initialSettingsProps?.alignmentTargetPreference).toBe('moon')
    expect(container.textContent).toContain('Target Moon')
    expect(latestSettingsProps()?.alignmentTargetPreference).toBe('moon')
  })

  it('defaults to the higher-elevation body when Sun and Moon are both visible', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [
        {
          id: 'sun',
          type: 'sun',
          label: 'Sun',
          azimuthDeg: 0,
          elevationDeg: 18,
          importance: 95,
          metadata: {
            detail: {
              typeLabel: 'Sun',
              elevationDeg: 18,
              azimuthDeg: 0,
            },
          },
        },
        {
          id: 'moon',
          type: 'moon',
          label: 'Moon',
          azimuthDeg: 12,
          elevationDeg: 28,
          importance: 88,
          metadata: {
            detail: {
              typeLabel: 'Moon',
              elevationDeg: 28,
              azimuthDeg: 12,
            },
          },
        },
        {
          id: 'planet-venus',
          type: 'planet',
          label: 'Venus',
          azimuthDeg: 22,
          elevationDeg: 24,
          magnitude: -4.3,
          importance: 82,
          metadata: {
            detail: {
              typeLabel: 'Planet',
              magnitude: -4.3,
              elevationDeg: 24,
              azimuthDeg: 22,
            },
          },
        },
        {
          id: 'star-sirius',
          type: 'star',
          label: 'Sirius',
          azimuthDeg: 34,
          elevationDeg: 32,
          magnitude: -1.46,
          importance: 74,
          metadata: {
            detail: {
              typeLabel: 'Star',
              magnitude: -1.46,
              elevationDeg: 32,
            },
          },
        },
      ],
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    const initialSettingsProps = mockSettingsSheetProps.mock.calls[0]?.[0] as
      | {
          alignmentTargetPreference?: 'sun' | 'moon'
        }
      | undefined
    const latestSettingsProps = () =>
      mockSettingsSheetProps.mock.calls.at(-1)?.[0] as
        | {
            alignmentTargetPreference?: 'sun' | 'moon'
            onAlignmentTargetPreferenceChange?: (target: 'sun' | 'moon') => void
          }
        | undefined

    expect(initialSettingsProps?.alignmentTargetPreference).toBe('moon')
    expect(container.textContent).toContain('Target Moon')
    expect(latestSettingsProps()?.alignmentTargetPreference).toBe('moon')

    await act(async () => {
      latestSettingsProps()?.onAlignmentTargetPreferenceChange?.('sun')
    })
    await flushEffects()

    expect(container.textContent).toContain('Target Sun')
  })

  it('falls back to day or night defaults when neither Sun nor Moon is visible', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: 14,
      objects: [],
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    const latestSettingsProps = () =>
      mockSettingsSheetProps.mock.calls.at(-1)?.[0] as
        | {
            alignmentTargetPreference?: 'sun' | 'moon'
          }
        | undefined

    expect(container.textContent).toContain('Target North marker')
    expect(latestSettingsProps()?.alignmentTargetPreference).toBe('sun')

    await act(async () => {
      root.unmount()
    })

    root = createRoot(container)
    mockSettingsSheetProps.mockClear()
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [],
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    const initialNightSettingsProps = mockSettingsSheetProps.mock.calls[0]?.[0] as
      | {
          alignmentTargetPreference?: 'sun' | 'moon'
        }
      | undefined

    expect(initialNightSettingsProps?.alignmentTargetPreference).toBe('moon')
    expect(container.textContent).toContain('Target North marker')
    expect(latestSettingsProps()?.alignmentTargetPreference).toBe('moon')
  })

  it('preserves a manual alignment target override across rerenders and scene changes', async () => {
    const initialState: ViewerRouteState = {
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    }

    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: 14,
      objects: [
        {
          id: 'sun',
          type: 'sun',
          label: 'Sun',
          azimuthDeg: 0,
          elevationDeg: 18,
          importance: 95,
          metadata: {
            detail: {
              typeLabel: 'Sun',
              elevationDeg: 18,
              azimuthDeg: 0,
            },
          },
        },
      ],
    })

    await renderViewer(initialState)

    const latestSettingsProps = () =>
      mockSettingsSheetProps.mock.calls.at(-1)?.[0] as
        | {
            alignmentTargetPreference?: 'sun' | 'moon'
            alignmentTargetFallbackLabel?: string | null
            onAlignmentTargetPreferenceChange?: (target: 'sun' | 'moon') => void
          }
        | undefined

    expect(latestSettingsProps()?.alignmentTargetPreference).toBe('sun')

    await act(async () => {
      latestSettingsProps()?.onAlignmentTargetPreferenceChange?.('moon')
    })
    await flushEffects()

    expect(latestSettingsProps()?.alignmentTargetPreference).toBe('moon')

    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: 14,
      objects: [
        {
          id: 'sun',
          type: 'sun',
          label: 'Sun',
          azimuthDeg: 0,
          elevationDeg: 26,
          importance: 95,
          metadata: {
            detail: {
              typeLabel: 'Sun',
              elevationDeg: 26,
              azimuthDeg: 0,
            },
          },
        },
      ],
    })

    await act(async () => {
      root.render(React.createElement(ViewerShell, { initialState }))
    })
    await flushEffects()

    expect(container.textContent).toContain('Target Sun')
    expect(latestSettingsProps()?.alignmentTargetPreference).toBe('moon')
    expect(latestSettingsProps()?.alignmentTargetFallbackLabel).toBe('Sun')
  })

  it('restores a persisted manual alignment target override after reload', async () => {
    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabledLayers: {
          aircraft: true,
          satellites: true,
          planets: true,
          stars: true,
          constellations: true,
        },
        likelyVisibleOnly: false,
        labelDisplayMode: 'center_only',
        motionQuality: 'balanced',
        alignmentTargetPreference: 'moon',
        verticalFovAdjustmentDeg: 0,
        onboardingCompleted: false,
      }),
    )

    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: 14,
      objects: [
        {
          id: 'sun',
          type: 'sun',
          label: 'Sun',
          azimuthDeg: 0,
          elevationDeg: 18,
          importance: 95,
          metadata: {
            detail: {
              typeLabel: 'Sun',
              elevationDeg: 18,
              azimuthDeg: 0,
            },
          },
        },
      ],
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    const latestSettingsProps = () =>
      mockSettingsSheetProps.mock.calls.at(-1)?.[0] as
        | {
            alignmentTargetPreference?: 'sun' | 'moon'
            alignmentTargetFallbackLabel?: string | null
          }
        | undefined

    expect(latestSettingsProps()?.alignmentTargetPreference).toBe('moon')
    expect(latestSettingsProps()?.alignmentTargetFallbackLabel).toBe('Sun')
  })

  it('falls back from suppressed sun to moon, then brightest planet, then brightest star', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [
        {
          id: 'sun',
          type: 'sun',
          label: 'Sun',
          azimuthDeg: 0,
          elevationDeg: 8,
          importance: 95,
          metadata: {
            daylightLabelSuppressed: true,
            detail: {
              typeLabel: 'Sun',
              elevationDeg: 8,
              azimuthDeg: 0,
            },
          },
        },
        {
          id: 'moon',
          type: 'moon',
          label: 'Moon',
          azimuthDeg: 16,
          elevationDeg: 20,
          importance: 88,
          metadata: {
            detail: {
              typeLabel: 'Moon',
              elevationDeg: 20,
              azimuthDeg: 16,
            },
          },
        },
      ],
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    expect(container.textContent).toContain('Target Moon')

    const latestSettingsProps = () =>
      mockSettingsSheetProps.mock.calls.at(-1)?.[0] as
        | {
            onAlignmentTargetPreferenceChange?: (target: 'sun' | 'moon') => void
          }
        | undefined

    await act(async () => {
      latestSettingsProps()?.onAlignmentTargetPreferenceChange?.('moon')
    })

    expect(container.textContent).toContain('Target Moon')

    await act(async () => {
      root.unmount()
    })

    root = createRoot(container)

    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -18,
      objects: [
        {
          id: 'planet-jupiter',
          type: 'planet',
          label: 'Jupiter',
          azimuthDeg: 26,
          elevationDeg: 30,
          magnitude: -2.4,
          importance: 80,
          metadata: {
            detail: {
              typeLabel: 'Planet',
              magnitude: -2.4,
              elevationDeg: 30,
              azimuthDeg: 26,
            },
          },
        },
        {
          id: 'planet-mars',
          type: 'planet',
          label: 'Mars',
          azimuthDeg: 40,
          elevationDeg: 18,
          magnitude: 0.7,
          importance: 73,
          metadata: {
            detail: {
              typeLabel: 'Planet',
              magnitude: 0.7,
              elevationDeg: 18,
              azimuthDeg: 40,
            },
          },
        },
        {
          id: 'star-sirius',
          type: 'star',
          label: 'Sirius',
          azimuthDeg: 52,
          elevationDeg: 22,
          magnitude: -1.46,
          importance: 76,
          metadata: {
            detail: {
              typeLabel: 'Star',
              magnitude: -1.46,
              elevationDeg: 22,
            },
          },
        },
      ],
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    expect(container.textContent).toContain('Target Jupiter')

    const latestSettingsPropsAfterPlanetFallback = () =>
      mockSettingsSheetProps.mock.calls.at(-1)?.[0] as
        | {
            onAlignmentTargetPreferenceChange?: (target: 'sun' | 'moon') => void
          }
        | undefined

    await act(async () => {
      latestSettingsPropsAfterPlanetFallback()?.onAlignmentTargetPreferenceChange?.('moon')
    })

    expect(container.textContent).toContain('Target Jupiter')

    await act(async () => {
      root.unmount()
    })

    root = createRoot(container)

    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -18,
      objects: [
        {
          id: 'star-sirius',
          type: 'star',
          label: 'Sirius',
          azimuthDeg: 52,
          elevationDeg: 22,
          magnitude: -1.46,
          importance: 76,
          metadata: {
            detail: {
              typeLabel: 'Star',
              magnitude: -1.46,
              elevationDeg: 22,
            },
          },
        },
        {
          id: 'star-vega',
          type: 'star',
          label: 'Vega',
          azimuthDeg: 70,
          elevationDeg: 44,
          magnitude: 0.03,
          importance: 70,
          metadata: {
            detail: {
              typeLabel: 'Star',
              magnitude: 0.03,
              elevationDeg: 44,
            },
          },
        },
      ],
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    expect(container.textContent).toContain('Target Sirius')
  })

  it('passes fallback target metadata into settings when the preferred body is unavailable', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [
        {
          id: 'sun',
          type: 'sun',
          label: 'Sun',
          azimuthDeg: 0,
          elevationDeg: 18,
          importance: 95,
          metadata: {
            detail: {
              typeLabel: 'Sun',
              elevationDeg: 18,
              azimuthDeg: 0,
            },
          },
        },
      ],
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    const latestSettingsProps = () =>
      mockSettingsSheetProps.mock.calls.at(-1)?.[0] as
        | {
            alignmentTargetAvailability?: {
              sun: boolean
              moon: boolean
            }
            alignmentTargetFallbackLabel?: string | null
            onAlignmentTargetPreferenceChange?: (target: 'sun' | 'moon') => void
          }
        | undefined

    expect(latestSettingsProps()?.alignmentTargetAvailability).toEqual({
      sun: true,
      moon: false,
    })
    expect(latestSettingsProps()?.alignmentTargetFallbackLabel).toBeNull()

    await act(async () => {
      latestSettingsProps()?.onAlignmentTargetPreferenceChange?.('moon')
    })
    await flushEffects()

    expect(container.textContent).toContain('Target Sun')
    expect(latestSettingsProps()?.alignmentTargetAvailability).toEqual({
      sun: true,
      moon: false,
    })
    expect(latestSettingsProps()?.alignmentTargetFallbackLabel).toBe('Sun')
  })

  it('switches the live on-screen alignment panel target when the user taps Sun', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [
        {
          id: 'sun',
          type: 'sun',
          label: 'Sun',
          azimuthDeg: 0,
          elevationDeg: 18,
          importance: 95,
          metadata: {
            detail: {
              typeLabel: 'Sun',
              elevationDeg: 18,
              azimuthDeg: 0,
            },
          },
        },
        {
          id: 'moon',
          type: 'moon',
          label: 'Moon',
          azimuthDeg: 12,
          elevationDeg: 24,
          importance: 88,
          metadata: {
            detail: {
              typeLabel: 'Moon',
              elevationDeg: 24,
              azimuthDeg: 12,
            },
          },
        },
      ],
    })
    mockSubscribeToOrientationPose.mockImplementationOnce((onPose: (state: unknown) => void) => {
      onPose({
        pose: {
          yawDeg: 0,
          pitchDeg: 0,
          rollDeg: 0,
          quaternion: [0, 0, 0, 1],
          alignmentHealth: 'poor',
          mode: 'sensor',
        },
        sample: {
          source: 'deviceorientation-relative',
          absolute: false,
          needsCalibration: true,
          timestampMs: Date.UTC(2026, 2, 26, 0, 45, 6),
          headingDeg: 0,
          pitchDeg: 0,
          rollDeg: 0,
          quaternion: [0, 0, 0, 1],
          rawQuaternion: [0, 0, 0, 1],
          rawSample: {
            source: 'deviceorientation-relative',
            localFrame: 'device',
            absolute: false,
            timestampMs: Date.UTC(2026, 2, 26, 0, 45, 6),
            worldFromLocal: [
              [1, 0, 0],
              [0, 1, 0],
              [0, 0, 1],
            ],
          },
        },
        history: [],
        orientationSource: 'deviceorientation-relative',
        orientationAbsolute: false,
        orientationNeedsCalibration: true,
        poseCalibration: {
          offsetQuaternion: [0, 0, 0, 1],
          calibrated: false,
          sourceAtCalibration: null,
          lastCalibratedAtMs: null,
        },
      })

      return SENSOR_CONTROLLER
    })

    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'denied',
      orientation: 'granted',
    })

    const latestSettingsProps = () =>
      mockSettingsSheetProps.mock.calls.at(-1)?.[0] as
        | {
            onFixAlignment?: () => void
          }
        | undefined

    await act(async () => {
      latestSettingsProps()?.onFixAlignment?.()
    })
    await flushEffects()

    const sunButton = container.querySelector(
      'button[aria-label="Use Sun for alignment"]',
    ) as HTMLButtonElement | null
    const moonButton = container.querySelector(
      'button[aria-label="Use Moon for alignment"]',
    ) as HTMLButtonElement | null

    expect(sunButton).not.toBeNull()
    expect(moonButton).not.toBeNull()
    expect(sunButton?.disabled).toBe(false)
    expect(moonButton?.disabled).toBe(false)
    expect(container.textContent).toContain('Current target Moon')
    expect(container.textContent).toContain(
      'Alignment is unavailable',
    )

    await act(async () => {
      sunButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    expect(container.textContent).toContain('Current target Sun')
    expect(container.textContent).toContain(
      'Alignment is unavailable',
    )
  })

  it('defaults to center-only overlay copy for the center-locked object', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [
        {
          id: 'sun',
          type: 'sun',
          label: 'Sun',
          azimuthDeg: 0,
          elevationDeg: 16,
          importance: 90,
          metadata: {
            detail: {
              typeLabel: 'Sun',
              elevationDeg: 16,
              azimuthDeg: 0,
            },
          },
        },
        {
          id: 'planet-venus',
          type: 'planet',
          label: 'Venus',
          azimuthDeg: 4,
          elevationDeg: 16,
          importance: 82,
          metadata: {
            detail: {
              typeLabel: 'Planet',
              elevationDeg: 16,
              azimuthDeg: 18,
              magnitude: -4.3,
            },
          },
        },
      ],
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    expect(container.querySelectorAll('[data-testid="sky-object-marker"]')).toHaveLength(2)
    expect(container.querySelector('[data-testid="center-lock-chip"]')?.textContent).toContain(
      'Sun',
    )
    expect(container.querySelectorAll('[data-testid="sky-object-label"]')).toHaveLength(0)
    expect(container.querySelector('[data-testid="sky-object-top-list"]')).toBeNull()
  })

  it(
    'allows dim stars to shrink to 1 px without changing brighter star sizes or the non-star minimum at scale 1',
    async () => {
      mockNormalizeCelestialObjects.mockReturnValue({
        sunAltitudeDeg: -12,
        objects: [
          {
            id: 'star-dim',
            type: 'star',
            label: 'Dim Star',
            azimuthDeg: 4,
            elevationDeg: 16,
            magnitude: 18,
            importance: 24,
            metadata: {
              detail: {
                typeLabel: 'Star',
                magnitude: 18,
                elevationDeg: 16,
              },
            },
          },
          {
            id: 'star-mid',
            type: 'star',
            label: 'Mid Star',
            azimuthDeg: 8,
            elevationDeg: 16,
            magnitude: 2,
            importance: 32,
            metadata: {
              detail: {
                typeLabel: 'Star',
                magnitude: 2,
                elevationDeg: 16,
              },
            },
          },
          {
            id: 'satellite-dim',
            type: 'satellite',
            label: 'Far Satellite',
            azimuthDeg: 0,
            elevationDeg: 16,
            rangeKm: 999,
            importance: 28,
            metadata: {
              detail: {
                typeLabel: 'Satellite',
                elevationDeg: 16,
              },
            },
          },
        ],
      })

      await renderViewer(
        {
          entry: 'demo',
          location: 'granted',
          camera: 'denied',
          orientation: 'denied',
        },
        {
          openDesktopViewerPanel: false,
        },
      )

      const dimStarMarker = container.querySelector(
        '[data-testid="sky-object-marker"][data-object-id="star-dim"]',
      ) as HTMLButtonElement | null
      const midStarMarker = container.querySelector(
        '[data-testid="sky-object-marker"][data-object-id="star-mid"]',
      ) as HTMLButtonElement | null
      const farSatelliteMarker = container.querySelector(
        '[data-testid="sky-object-marker"][data-object-id="satellite-dim"]',
      ) as HTMLButtonElement | null

      expect(dimStarMarker).not.toBeNull()
      expect(midStarMarker).not.toBeNull()
      expect(farSatelliteMarker).not.toBeNull()
      expect(getMarkerVisualSizePx(dimStarMarker!)).toBe(1)
      expect(getMarkerVisualSizePx(midStarMarker!)).toBe(7)
      expect(getMarkerVisualSizePx(farSatelliteMarker!)).toBe(6)
    },
    40_000,
  )

  it('applies settings-owned marker scale changes live and persists the chosen scale', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [
        {
          id: 'star-dim',
          type: 'star',
          label: 'Dim Star',
          azimuthDeg: 4,
          elevationDeg: 16,
          magnitude: 18,
          importance: 24,
          metadata: {
            detail: {
              typeLabel: 'Star',
              magnitude: 18,
              elevationDeg: 16,
            },
          },
        },
      ],
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    const latestSettingsProps = () =>
      mockSettingsSheetProps.mock.calls.at(-1)?.[0] as
        | {
            markerScale?: number
            onMarkerScaleChange?: (value: number) => void
          }
        | undefined
    const dimStarMarker = container.querySelector(
      '[data-testid="sky-object-marker"][data-object-id="star-dim"]',
    ) as HTMLButtonElement | null

    expect(latestSettingsProps()?.markerScale).toBe(1)
    expect(dimStarMarker).not.toBeNull()
    expect(getMarkerVisualSizePx(dimStarMarker!)).toBe(1)

    await act(async () => {
      latestSettingsProps()?.onMarkerScaleChange?.(4)
    })
    await flushEffects()

    expect(latestSettingsProps()?.markerScale).toBe(4)
    expect(getMarkerVisualSizePx(dimStarMarker!)).toBe(4)
    expect(readViewerSettings().markerScale).toBe(4)

    await act(async () => {
      root.unmount()
    })

    root = createRoot(container)

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    const reloadedSettingsProps = mockSettingsSheetProps.mock.calls.at(-1)?.[0] as
      | {
          markerScale?: number
        }
      | undefined
    const reloadedDimStarMarker = container.querySelector(
      '[data-testid="sky-object-marker"][data-object-id="star-dim"]',
    ) as HTMLButtonElement | null

    expect(reloadedSettingsProps?.markerScale).toBe(4)
    expect(reloadedDimStarMarker).not.toBeNull()
    expect(getMarkerVisualSizePx(reloadedDimStarMarker!)).toBe(4)
  })

  it('falls back to legacy scope marker sizing when scope render metadata is malformed', async () => {
    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...readViewerSettings(),
        scopeModeEnabled: true,
        scope: {
          verticalFovDeg: 10,
        },
      }),
    )
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [
        {
          id: 'star-fallback',
          type: 'star',
          label: 'Fallback Star',
          azimuthDeg: 0,
          elevationDeg: 16,
          magnitude: 1.5,
          importance: 72,
          metadata: {
            detail: {
              typeLabel: 'Star',
              magnitude: 1.5,
              elevationDeg: 16,
              constellationName: 'Orion',
            },
            scopeRender: {
              effectiveLimitMag: 10,
              relativeFlux: 1,
              transmission: 1,
              opticsGain: 1,
              intensity: Number.NaN,
              corePx: Number.POSITIVE_INFINITY,
              haloPx: Number.POSITIVE_INFINITY,
            },
          },
        },
      ],
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    const scopeMarkerVisual = container.querySelector(
      '[data-testid="scope-bright-object-marker"][data-object-id="star-fallback"] > span',
    ) as HTMLSpanElement | null

    expect(scopeMarkerVisual).not.toBeNull()
    expect(scopeMarkerVisual?.style.width).toBe('9px')
    expect(scopeMarkerVisual?.style.opacity).toBe('1')
  })

  it('renders stable nearby labels when on-object mode is enabled', async () => {
    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabledLayers: {
          aircraft: true,
          satellites: true,
          planets: true,
          stars: true,
          constellations: true,
        },
        likelyVisibleOnly: false,
        labelDisplayMode: 'on_objects',
        headingOffsetDeg: 0,
        pitchOffsetDeg: 0,
        verticalFovAdjustmentDeg: 0,
        onboardingCompleted: false,
      }),
    )

    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [
        {
          id: 'sun',
          type: 'sun',
          label: 'Sun',
          azimuthDeg: 0,
          elevationDeg: 16,
          importance: 90,
          metadata: {
            detail: {
              typeLabel: 'Sun',
              elevationDeg: 16,
              azimuthDeg: 0,
            },
          },
        },
        {
          id: 'planet-venus',
          type: 'planet',
          label: 'Venus',
          azimuthDeg: 4,
          elevationDeg: 16,
          importance: 82,
          metadata: {
            detail: {
              typeLabel: 'Planet',
              elevationDeg: 16,
              azimuthDeg: 18,
              magnitude: -4.3,
            },
          },
        },
      ],
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    const labels = Array.from(container.querySelectorAll('[data-testid="sky-object-label"]'))

    expect(labels.length).toBeGreaterThan(0)
    expect(labels.some((label) => label.textContent?.includes('Sun'))).toBe(true)
    expect(container.querySelector('[data-testid="center-lock-chip"]')).toBeNull()
  })

  it(
    'builds top-list mode from the full marker set instead of the suppressed on-object label set',
    async () => {
      window.localStorage.setItem(
        VIEWER_SETTINGS_STORAGE_KEY,
        JSON.stringify({
          enabledLayers: {
            aircraft: true,
            satellites: true,
            planets: true,
            stars: true,
            constellations: true,
          },
          likelyVisibleOnly: false,
          labelDisplayMode: 'top_list',
          headingOffsetDeg: 0,
          pitchOffsetDeg: 0,
          verticalFovAdjustmentDeg: 0,
          motionQuality: 'low',
          onboardingCompleted: false,
        }),
      )

      mockNormalizeCelestialObjects.mockReturnValue({
        sunAltitudeDeg: -12,
        objects: [],
      })
      mockResolveAircraftMotionObjects.mockReturnValue(
        Array.from({ length: 20 }, (_, index) => ({
          confidence: 1,
          motionState: 'live' as const,
          object: {
            id: `aircraft-${index}`,
            type: 'aircraft' as const,
            label: `Flight ${index}`,
            sublabel: 'Aircraft',
            azimuthDeg: normalizeTestAzimuth(-3.8 + index * 0.4),
            elevationDeg: 16,
            rangeKm: 20 + index,
            importance: 90 - index,
            metadata: {
              detail: {
                typeLabel: 'Aircraft',
                altitudeFeet: 35000,
                altitudeMeters: 10668,
                rangeKm: 20 + index,
              },
            },
          },
        })),
      )

      await renderViewer({
        entry: 'demo',
        location: 'granted',
        camera: 'denied',
        orientation: 'denied',
      })

      expect(container.querySelectorAll('[data-testid="sky-object-marker"]')).toHaveLength(20)
      expect(container.querySelectorAll('[data-testid="sky-object-top-list-item"]')).toHaveLength(20)
      expect(container.querySelectorAll('[data-testid="sky-object-label"]')).toHaveLength(0)
      expect(container.querySelector('[data-testid="sky-object-top-list"]')?.textContent).toContain(
        'Flight 0',
      )
      expect(container.querySelector('[data-testid="sky-object-top-list"]')?.textContent).toContain(
        'Flight 19',
      )
    },
    40_000,
  )

  it(
    'includes non-bright scope objects in scope-mode top-list candidates',
    async () => {
      window.localStorage.setItem(
        VIEWER_SETTINGS_STORAGE_KEY,
        JSON.stringify({
          ...readViewerSettings(),
          labelDisplayMode: 'top_list',
          scopeModeEnabled: true,
          scope: {
            verticalFovDeg: 10,
          },
        }),
      )
      mockNormalizeCelestialObjects.mockReturnValue({
        sunAltitudeDeg: -12,
        objects: [
          {
            id: 'star-sirius',
            type: 'star',
            label: 'Sirius',
            azimuthDeg: 2,
            elevationDeg: 16,
            magnitude: -1.46,
            importance: 74,
            metadata: {
              detail: {
                typeLabel: 'Star',
                magnitude: -1.46,
                elevationDeg: 16,
              },
            },
          },
        ],
      })
      mockResolveAircraftMotionObjects.mockReturnValue([
        {
          object: {
            id: 'flight-1',
            type: 'aircraft',
            label: 'UAL123',
            azimuthDeg: 0,
            elevationDeg: 16,
            rangeKm: 12.5,
            importance: 92,
            metadata: {
              detail: {
                typeLabel: 'Aircraft',
                altitudeFeet: 32000,
                altitudeMeters: 9754,
                rangeKm: 12.5,
              },
            },
          },
        },
      ])
      mockResolveSatelliteMotionObjects.mockReturnValue([
        {
          object: {
            id: '25544',
            type: 'satellite',
            label: 'ISS (ZARYA)',
            azimuthDeg: 1,
            elevationDeg: 16,
            rangeKm: 420.7,
            importance: 88,
            metadata: {
              isIss: true,
              detail: {
                typeLabel: 'Satellite',
                noradId: 25544,
                elevationDeg: 16,
                azimuthDeg: 1,
                rangeKm: 420.7,
                isIss: true,
              },
            },
          },
        },
      ])

      await renderViewer({
        entry: 'demo',
        location: 'granted',
        camera: 'denied',
        orientation: 'denied',
      })

      const topList = container.querySelector('[data-testid="sky-object-top-list"]') as
        | HTMLDivElement
        | null
      const flightTopListItem = Array.from(
        container.querySelectorAll('[data-testid="sky-object-top-list-item"]'),
      ).find((item) => item.textContent?.includes('UAL123')) as HTMLDivElement | undefined

      expect(container.querySelectorAll('[data-testid="scope-bright-object-marker"]')).toHaveLength(3)
      expect(topList?.textContent).toContain('UAL123')
      expect(topList?.textContent).toContain('ISS (ZARYA)')
      expect(topList?.textContent).toContain('Sirius')
      expect(flightTopListItem?.className).toContain('border-amber-200/60')
    },
    40_000,
  )

  it('keeps the bottom dock on the centered object after another label is tapped', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [
        {
          id: 'sun',
          type: 'sun',
          label: 'Sun',
          azimuthDeg: 0,
          elevationDeg: 16,
          importance: 90,
          metadata: {
            detail: {
              typeLabel: 'Sun',
              elevationDeg: 16,
              azimuthDeg: 0,
            },
          },
        },
        {
          id: 'planet-venus',
          type: 'planet',
          label: 'Venus',
          azimuthDeg: 4,
          elevationDeg: 16,
          importance: 82,
          metadata: {
            detail: {
              typeLabel: 'Planet',
              elevationDeg: 16,
              azimuthDeg: 18,
              magnitude: -4.3,
            },
          },
        },
      ],
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    const venusButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Venus'),
    )

    expect(venusButton).toBeDefined()

    await act(async () => {
      venusButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    expect(container.textContent).toContain('Viewer snapshot')
    expect(container.textContent).toContain('Angular distance 0.0°')
    expect(container.textContent).toContain('Selected object')
    expect(container.textContent).toContain('Venus')
  })

  it('does not turn label taps into manual-stage drags before opening the selected-object card', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [
        {
          id: 'sun',
          type: 'sun',
          label: 'Sun',
          azimuthDeg: 0,
          elevationDeg: 16,
          importance: 90,
          metadata: {
            detail: {
              typeLabel: 'Sun',
              elevationDeg: 16,
              azimuthDeg: 0,
            },
          },
        },
        {
          id: 'planet-venus',
          type: 'planet',
          label: 'Venus',
          azimuthDeg: 4,
          elevationDeg: 16,
          importance: 82,
          metadata: {
            detail: {
              typeLabel: 'Planet',
              elevationDeg: 16,
              azimuthDeg: 18,
              magnitude: -4.3,
            },
          },
        },
      ],
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    const stage = container.querySelector('[aria-label="Sky viewer stage"]') as
      | HTMLDivElement
      | null
    const venusButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Venus'),
    )

    expect(stage).not.toBeNull()
    expect(venusButton).toBeDefined()

    const setPointerCapture = vi.fn()
    const releasePointerCapture = vi.fn()
    const hasPointerCapture = vi.fn(() => false)

    Object.defineProperties(stage!, {
      setPointerCapture: {
        configurable: true,
        value: setPointerCapture,
      },
      releasePointerCapture: {
        configurable: true,
        value: releasePointerCapture,
      },
      hasPointerCapture: {
        configurable: true,
        value: hasPointerCapture,
      },
    })

    await act(async () => {
      dispatchPointerEvent(venusButton!, 'pointerdown', {
        pointerId: 1,
        clientX: 120,
        clientY: 140,
      })
      dispatchPointerEvent(stage!, 'pointermove', {
        pointerId: 1,
        clientX: 168,
        clientY: 140,
      })
      dispatchPointerEvent(stage!, 'pointerup', {
        pointerId: 1,
        clientX: 168,
        clientY: 140,
      })
      venusButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    expect(setPointerCapture).not.toHaveBeenCalled()
    expect(releasePointerCapture).not.toHaveBeenCalled()
    expect(hasPointerCapture).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Yaw 0°')
    expect(container.textContent).toContain('Selected object')
    expect(container.textContent).toContain('Venus')
  })

  it('keeps label transitions enabled when reduced motion is not preferred', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [
        {
          id: 'planet-venus',
          type: 'planet',
          label: 'Venus',
          azimuthDeg: 4,
          elevationDeg: 16,
          importance: 82,
          metadata: {
            detail: {
              typeLabel: 'Planet',
              elevationDeg: 16,
              azimuthDeg: 18,
              magnitude: -4.3,
            },
          },
        },
      ],
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    const venusButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Venus'),
    )

    expect(venusButton).toBeDefined()
    expect(venusButton?.className).toContain('transition')
  })

  it('removes label transitions when prefers-reduced-motion is enabled', async () => {
    setMatchMediaMatches(true)

    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [
        {
          id: 'planet-venus',
          type: 'planet',
          label: 'Venus',
          azimuthDeg: 4,
          elevationDeg: 16,
          importance: 82,
          metadata: {
            detail: {
              typeLabel: 'Planet',
              elevationDeg: 16,
              azimuthDeg: 18,
              magnitude: -4.3,
            },
          },
        },
      ],
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    const venusButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Venus'),
    )

    expect(venusButton).toBeDefined()
    expect(venusButton?.className).not.toContain('transition')
  })

  it('renders a low-quality motion vector for a moving object as scene time advances', async () => {
    const timerHarness = installWindowTimerHarness()
    try {
      window.localStorage.setItem(
        VIEWER_SETTINGS_STORAGE_KEY,
        JSON.stringify({
          enabledLayers: {
            aircraft: true,
            satellites: true,
            planets: true,
            stars: true,
            constellations: true,
          },
          likelyVisibleOnly: false,
          labelDisplayMode: 'center_only',
          headingOffsetDeg: 0,
          pitchOffsetDeg: 0,
          verticalFovAdjustmentDeg: 0,
          motionQuality: 'low',
          onboardingCompleted: false,
        }),
      )

      mockNormalizeCelestialObjects.mockReturnValue({
        sunAltitudeDeg: -12,
        objects: [],
      })
      mockResolveSatelliteMotionObjects.mockReturnValue([
        {
          confidence: 1,
          motionState: 'propagated',
          object: {
            id: '25544',
            type: 'satellite',
            label: 'ISS (ZARYA)',
            sublabel: 'Satellite',
            azimuthDeg: 0,
            elevationDeg: 16,
            rangeKm: 420.7,
            importance: 88,
            metadata: {
              isIss: true,
              detail: {
                typeLabel: 'Satellite',
                noradId: 25544,
                elevationDeg: 16,
                azimuthDeg: 0,
                rangeKm: 420.7,
                isIss: true,
              },
            },
          },
        },
      ])

      await renderViewer({
        entry: 'demo',
        location: 'granted',
        camera: 'denied',
        orientation: 'denied',
        demoScenarioId: 'tokyo-iss',
      })

      const advanceSceneTime = timerHarness.getIntervalCallback(1_000)
      const initialVector = container.querySelector(
        '[data-testid="motion-affordance-vector"]',
      ) as SVGLineElement | null

      if (initialVector) {
        expect(initialVector.getAttribute('x1')).toBe(initialVector.getAttribute('x2'))
        expect(initialVector.getAttribute('y1')).toBe(initialVector.getAttribute('y2'))
      }
      expect(container.querySelector('[data-testid="motion-affordance-trail"]')).toBeNull()

      await act(async () => {
        advanceSceneTime()
      })
      await flushEffects()

      await act(async () => {
        advanceSceneTime()
      })
      await flushEffects()

      expect(container.querySelector('[data-testid="motion-affordance-vector"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="motion-affordance-trail"]')).toBeNull()
    } finally {
      timerHarness.restore()
    }
  })

  it(
    'renders a trail for balanced motion quality',
    async () => {
      const timerHarness = installWindowTimerHarness()
      const originalRequestAnimationFrame = window.requestAnimationFrame
      const originalCancelAnimationFrame = window.cancelAnimationFrame
      Object.defineProperty(window, 'requestAnimationFrame', {
        configurable: true,
        writable: true,
        value: undefined,
      })
      Object.defineProperty(window, 'cancelAnimationFrame', {
        configurable: true,
        writable: true,
        value: undefined,
      })
      window.localStorage.setItem(
        VIEWER_SETTINGS_STORAGE_KEY,
        JSON.stringify({
          enabledLayers: {
            aircraft: true,
            satellites: true,
            planets: true,
            stars: true,
            constellations: true,
          },
          likelyVisibleOnly: false,
          labelDisplayMode: 'center_only',
          headingOffsetDeg: 0,
          pitchOffsetDeg: 0,
          verticalFovAdjustmentDeg: 0,
          motionQuality: 'balanced',
          onboardingCompleted: false,
        }),
      )

      mockNormalizeCelestialObjects.mockReturnValue({
        sunAltitudeDeg: -12,
        objects: [],
      })
      mockResolveSatelliteMotionObjects.mockReturnValue([
        {
          confidence: 1,
          motionState: 'propagated',
          object: {
            id: '25544',
            type: 'satellite',
            label: 'ISS (ZARYA)',
            sublabel: 'Satellite',
            azimuthDeg: 0,
            elevationDeg: 16,
            rangeKm: 420.7,
            importance: 88,
            metadata: {
              isIss: true,
              detail: {
                typeLabel: 'Satellite',
                noradId: 25544,
                elevationDeg: 16,
                azimuthDeg: 0,
                rangeKm: 420.7,
                isIss: true,
              },
            },
          },
        },
      ])

      try {
        await renderViewer({
          entry: 'demo',
          location: 'granted',
          camera: 'denied',
          orientation: 'denied',
          demoScenarioId: 'tokyo-iss',
        })

        const advanceSceneTime = timerHarness.getIntervalCallback(1_000)

        await act(async () => {
          advanceSceneTime()
        })
        await flushEffects()

        await act(async () => {
          advanceSceneTime()
        })
        await flushEffects()

        expect(container.querySelector('[data-testid="motion-affordance-vector"]')).toBeNull()
        expect(container.querySelector('[data-testid="motion-affordance-trail"]')).not.toBeNull()
      } finally {
        timerHarness.restore()
        Object.defineProperty(window, 'requestAnimationFrame', {
          configurable: true,
          writable: true,
          value: originalRequestAnimationFrame,
        })
        Object.defineProperty(window, 'cancelAnimationFrame', {
          configurable: true,
          writable: true,
          value: originalCancelAnimationFrame,
        })
      }
    },
    40_000,
  )

  it(
    'renders a trail for high motion quality',
    async () => {
      const timerHarness = installWindowTimerHarness()
      const originalRequestAnimationFrame = window.requestAnimationFrame
      const originalCancelAnimationFrame = window.cancelAnimationFrame
      Object.defineProperty(window, 'requestAnimationFrame', {
        configurable: true,
        writable: true,
        value: undefined,
      })
      Object.defineProperty(window, 'cancelAnimationFrame', {
        configurable: true,
        writable: true,
        value: undefined,
      })
      window.localStorage.setItem(
        VIEWER_SETTINGS_STORAGE_KEY,
        JSON.stringify({
          enabledLayers: {
            aircraft: true,
            satellites: true,
            planets: true,
            stars: true,
            constellations: true,
          },
          likelyVisibleOnly: false,
          labelDisplayMode: 'center_only',
          headingOffsetDeg: 0,
          pitchOffsetDeg: 0,
          verticalFovAdjustmentDeg: 0,
          motionQuality: 'high',
          onboardingCompleted: false,
        }),
      )

      mockNormalizeCelestialObjects.mockReturnValue({
        sunAltitudeDeg: -12,
        objects: [],
      })
      mockResolveSatelliteMotionObjects.mockReturnValue([
        {
          confidence: 1,
          motionState: 'propagated',
          object: {
            id: '25544',
            type: 'satellite',
            label: 'ISS (ZARYA)',
            sublabel: 'Satellite',
            azimuthDeg: 0,
            elevationDeg: 16,
            rangeKm: 420.7,
            importance: 88,
            metadata: {
              isIss: true,
              detail: {
                typeLabel: 'Satellite',
                noradId: 25544,
                elevationDeg: 16,
                azimuthDeg: 0,
                rangeKm: 420.7,
                isIss: true,
              },
            },
          },
        },
      ])

      try {
        await renderViewer({
          entry: 'demo',
          location: 'granted',
          camera: 'denied',
          orientation: 'denied',
          demoScenarioId: 'tokyo-iss',
        })

        const advanceSceneTime = timerHarness.getIntervalCallback(1_000)

        await act(async () => {
          advanceSceneTime()
        })
        await flushEffects()

        await act(async () => {
          advanceSceneTime()
        })
        await flushEffects()

        expect(container.querySelector('[data-testid="motion-affordance-vector"]')).toBeNull()
        expect(container.querySelector('[data-testid="motion-affordance-trail"]')).not.toBeNull()
      } finally {
        timerHarness.restore()
        Object.defineProperty(window, 'requestAnimationFrame', {
          configurable: true,
          writable: true,
          value: originalRequestAnimationFrame,
        })
        Object.defineProperty(window, 'cancelAnimationFrame', {
          configurable: true,
          writable: true,
          value: originalCancelAnimationFrame,
        })
      }
    },
    40_000,
  )

  it('suppresses the trail polyline when prefers-reduced-motion is enabled', async () => {
    const timerHarness = installWindowTimerHarness()
    setMatchMediaMatches(true)
    try {
      mockNormalizeCelestialObjects.mockReturnValue({
        sunAltitudeDeg: -12,
        objects: [],
      })
      mockResolveSatelliteMotionObjects.mockReturnValue([
        {
          confidence: 1,
          motionState: 'propagated',
          object: {
            id: '25544',
            type: 'satellite',
            label: 'ISS (ZARYA)',
            sublabel: 'Satellite',
            azimuthDeg: 0,
            elevationDeg: 16,
            rangeKm: 420.7,
            importance: 88,
            metadata: {
              isIss: true,
              detail: {
                typeLabel: 'Satellite',
                noradId: 25544,
                elevationDeg: 16,
                azimuthDeg: 0,
                rangeKm: 420.7,
                isIss: true,
              },
            },
          },
        },
      ])

      await renderViewer({
        entry: 'demo',
        location: 'granted',
        camera: 'denied',
        orientation: 'denied',
        demoScenarioId: 'tokyo-iss',
      })

      const advanceSceneTime = timerHarness.getIntervalCallback(1_000)

      await act(async () => {
        advanceSceneTime()
      })
      await flushEffects()

      await act(async () => {
        advanceSceneTime()
      })
      await flushEffects()

      expect(container.querySelector('[data-testid="motion-affordance-trail"]')).toBeNull()
      expect(container.querySelector('[data-testid="motion-affordance-vector"]')).toBeNull()
    } finally {
      timerHarness.restore()
    }
  })

  it('lets a daylit focus-only planet reach the centered label path', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: 14,
      objects: [
        {
          id: 'planet-mars',
          type: 'planet',
          label: 'Mars',
          azimuthDeg: 0,
          elevationDeg: 16,
          importance: 72,
          metadata: {
            daylightLabelSuppressed: true,
            detail: {
              typeLabel: 'Planet',
              elevationDeg: 16,
              azimuthDeg: 0,
            },
          },
        },
      ],
    })

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    const marsButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Mars'),
    )

    expect(marsButton).toBeDefined()
    expect(container.textContent).toContain('Viewer snapshot')
    expect(container.textContent).toContain('Mars')
    expect(container.textContent).toContain('Angular distance 0.0°')
  })

  it('renders the satellite detail-card contract and ISS badge state', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [],
    })
    mockResolveSatelliteMotionObjects.mockReturnValue([
      {
        confidence: 1,
        motionState: 'propagated',
        object: {
          id: '25544',
          type: 'satellite',
          label: 'ISS (ZARYA)',
          sublabel: 'Satellite',
          azimuthDeg: 0,
          elevationDeg: 16,
          rangeKm: 420.7,
          importance: 88,
          metadata: {
            isIss: true,
            detail: {
              typeLabel: 'Satellite',
              noradId: 25544,
              elevationDeg: 16,
              azimuthDeg: 0,
              rangeKm: 420.7,
              isIss: true,
            },
          },
        },
      },
    ])

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    expect(container.textContent).toContain('ISS (ZARYA)')
    expect(container.textContent).toContain('ISS')
    expect(container.textContent).toContain('NORAD ID')
    expect(container.textContent).toContain('25544')
    expect(container.textContent).toContain('Range')
    expect(container.textContent).toContain('420.7 km')
  })

  it('keeps stale satellite treatment additive for the ISS badge state', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [],
    })
    mockResolveSatelliteMotionObjects.mockReturnValue([
      {
        confidence: 0.7,
        motionState: 'stale',
        object: {
          id: '25544',
          type: 'satellite',
          label: 'ISS (ZARYA)',
          sublabel: 'Satellite',
          azimuthDeg: 0,
          elevationDeg: 16,
          rangeKm: 420.7,
          importance: 88,
          metadata: {
            isIss: true,
            motionState: 'stale',
            motionOpacity: 0.7,
            detail: {
              typeLabel: 'Satellite',
              noradId: 25544,
              elevationDeg: 16,
              azimuthDeg: 0,
              rangeKm: 420.7,
              isIss: true,
            },
          },
        },
      },
    ])

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    expect(container.textContent).toContain('Satellite Stale')
    expect(
      container.querySelector('[data-testid="object-badge"][data-badge-id="motion-stale"]'),
    ).not.toBeNull()
    expect(
      container.querySelector('[data-testid="object-badge"][data-badge-id="iss"]'),
    ).not.toBeNull()
  })

  it('renders the aircraft detail-card contract with Unknown flight fallback', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [],
    })
    mockResolveAircraftMotionObjects.mockReturnValue([
      {
        confidence: 1,
        motionState: 'live',
        object: {
          id: 'icao24-d4e5f6',
          type: 'aircraft',
          label: 'Unknown flight',
          sublabel: 'Aircraft',
          azimuthDeg: 0,
          elevationDeg: 16,
          rangeKm: 31.8,
          importance: 83,
          metadata: {
            detail: {
              typeLabel: 'Aircraft',
              altitudeFeet: 35000,
              altitudeMeters: 10668,
              trackCardinal: 'SE',
              speedKph: 864,
              rangeKm: 31.8,
              originCountry: 'Canada',
            },
          },
        },
      },
    ])

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

    expect(container.textContent).toContain('Unknown flight')
    expect(container.textContent).toContain('Aircraft')
    expect(container.textContent).toContain('Altitude')
    expect(container.textContent).toContain('35,000 ft / 10,668 m')
    expect(container.textContent).toContain('Track')
    expect(container.textContent).toContain('SE')
    expect(container.textContent).toContain('Speed')
    expect(container.textContent).toContain('864 km/h')
    expect(container.textContent).toContain('Range')
    expect(container.textContent).toContain('31.8 km')
    expect(container.textContent).toContain('Origin country')
    expect(container.textContent).toContain('Canada')
  })

  it('hard-fails into demo mode when the live astronomy pipeline throws', async () => {
    mockNormalizeCelestialObjects.mockImplementation(() => {
      throw new Error('critical astronomy failure')
    })

    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'denied',
      orientation: 'granted',
    })

    await flushEffects()

    expect(container.textContent).toContain('Astronomy fallback active.')
    expect(container.textContent).toContain('Demo viewer')
  })

  it('keeps the live viewer active when the satellite layer throws', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [
        {
          id: 'sun',
          type: 'sun',
          label: 'Sun',
          azimuthDeg: 0,
          elevationDeg: 16,
          importance: 90,
          metadata: {
            detail: {
              typeLabel: 'Sun',
              elevationDeg: 16,
              azimuthDeg: 0,
            },
          },
        },
      ],
    })
    mockResolveSatelliteMotionObjects.mockImplementation(() => {
      throw new Error('satellite propagation failed')
    })

    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'denied',
      orientation: 'granted',
    })

    expect(mockRouterReplace).not.toHaveBeenCalledWith(expect.stringMatching(/entry=demo/))
    expect(container.textContent).toContain('Sun')
    expect(container.textContent).not.toContain('Astronomy fallback active.')
  })

  it('keeps aircraft markers visible when satellite propagation throws', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [],
    })
    mockResolveAircraftMotionObjects.mockReturnValue([
      {
        confidence: 1,
        motionState: 'live',
        object: {
          id: 'icao24-alpha1',
          type: 'aircraft',
          label: 'ALPHA1',
          sublabel: 'Aircraft',
          azimuthDeg: 0,
          elevationDeg: 16,
          rangeKm: 31.8,
          importance: 83,
          metadata: {
            detail: {
              typeLabel: 'Aircraft',
              altitudeFeet: 35000,
              altitudeMeters: 10668,
              rangeKm: 31.8,
            },
          },
        },
      },
    ])
    mockResolveSatelliteMotionObjects.mockImplementation(() => {
      throw new Error('satellite propagation failed')
    })

    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'denied',
      orientation: 'granted',
    })

    expect(
      container.querySelector('[data-testid="sky-object-marker"][data-object-id="icao24-alpha1"]'),
    ).not.toBeNull()
    expect(container.textContent).toContain('ALPHA1')
    expect(container.textContent).not.toContain('Astronomy fallback active.')
  })

  it('keeps satellite markers visible when aircraft resolution throws', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [],
    })
    mockResolveAircraftMotionObjects.mockImplementation(() => {
      throw new Error('aircraft resolution failed')
    })
    mockResolveSatelliteMotionObjects.mockReturnValue([
      {
        confidence: 1,
        motionState: 'propagated',
        object: {
          id: '25544',
          type: 'satellite',
          label: 'ISS (ZARYA)',
          sublabel: 'Satellite',
          azimuthDeg: 0,
          elevationDeg: 16,
          rangeKm: 420.7,
          importance: 88,
          metadata: {
            isIss: true,
            detail: {
              typeLabel: 'Satellite',
              noradId: 25544,
              elevationDeg: 16,
              azimuthDeg: 0,
              rangeKm: 420.7,
              isIss: true,
            },
          },
        },
      },
    ])

    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'denied',
      orientation: 'granted',
    })

    expect(
      container.querySelector('[data-testid="sky-object-marker"][data-object-id="25544"]'),
    ).not.toBeNull()
    expect(container.textContent).toContain('ISS (ZARYA)')
    expect(container.textContent).not.toContain('Astronomy fallback active.')
  })

  async function renderViewer(
    initialState: ViewerRouteState,
    {
      openDesktopViewerPanel: shouldOpenDesktopViewerPanel = true,
    }: {
      openDesktopViewerPanel?: boolean
    } = {},
  ) {
    await act(async () => {
      root.render(React.createElement(ViewerShell, { initialState }))
    })

    await flushEffects()

    if (shouldOpenDesktopViewerPanel) {
      await openDesktopViewerPanel()
    }
  }

  async function setSliderValue(testId: string, value: string) {
    const slider = container.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement | null

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set

      valueSetter?.call(slider, value)
      slider?.dispatchEvent(new Event('input', { bubbles: true }))
      slider?.dispatchEvent(new Event('change', { bubbles: true }))
    })

    await flushEffects()
  }

  async function openDesktopViewerPanel() {
    if (container.querySelector('[data-testid="desktop-viewer-panel"]')) {
      return
    }

    const openViewerButton = container.querySelector(
      '[data-testid="desktop-open-viewer-action"]',
    ) as HTMLButtonElement | null

    if (!openViewerButton) {
      return
    }

    await act(async () => {
      openViewerButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()
  }

  async function flushEffects() {
    await act(async () => {
      await Promise.resolve()
    })
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })
    await act(async () => {
      await Promise.resolve()
    })
  }
})

function stubCanvasContext() {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => ({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      setTransform: vi.fn(),
      globalAlpha: 1,
      fillStyle: '',
    }),
  })
}

function getAbsoluteMarkerPosition(marker: HTMLElement) {
  return {
    x: Number.parseFloat(marker.style.left),
    y: Number.parseFloat(marker.style.top),
  }
}

function getPolylinePoints(polyline: SVGPolylineElement) {
  return (polyline.getAttribute('points') ?? '')
    .split(' ')
    .filter((point) => point.length > 0)
    .map((point) => {
      const [x, y] = point.split(',').map((value) => Number.parseFloat(value))

      return { x, y }
    })
}

function dispatchPointerEvent(
  target: EventTarget,
  type: string,
  init: {
    clientX: number
    clientY: number
    pointerId: number
  },
) {
  const PointerEventCtor = window.PointerEvent ?? MouseEvent
  const event = new PointerEventCtor(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX,
    clientY: init.clientY,
  })

  if (!('pointerId' in event)) {
    Object.defineProperty(event, 'pointerId', {
      configurable: true,
      value: init.pointerId,
    })
  }

  target.dispatchEvent(event)
}

function normalizeTestAzimuth(value: number) {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function getMarkerVisualSizePx(markerButton: HTMLButtonElement) {
  const markerVisual = markerButton.lastElementChild as HTMLElement | null

  return Number.parseInt(markerVisual?.style.width ?? '0', 10)
}

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set

  valueSetter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function setMatchMediaMatches(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function installWindowTimerHarness() {
  const intervalCallbacks = new Map<number, Array<() => void>>()
  const currentSetTimeout = window.setTimeout
  const currentClearTimeout = window.clearTimeout
  const currentSetInterval = window.setInterval
  const currentClearInterval = window.clearInterval

  Object.defineProperty(window, 'setTimeout', {
    configurable: true,
    writable: true,
    value: ((callback: TimerHandler) => {
      if (typeof callback === 'function') {
        callback()
      }

      return 1
    }) as typeof window.setTimeout,
  })

  Object.defineProperty(window, 'clearTimeout', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  })

  Object.defineProperty(window, 'setInterval', {
    configurable: true,
    writable: true,
    value: ((callback: TimerHandler, delay?: number) => {
      const normalizedDelay = typeof delay === 'number' ? delay : 0
      const callbacks = intervalCallbacks.get(normalizedDelay) ?? []

      callbacks.push(callback as () => void)
      intervalCallbacks.set(normalizedDelay, callbacks)

      return intervalCallbacks.size
    }) as typeof window.setInterval,
  })

  Object.defineProperty(window, 'clearInterval', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  })

  return {
    getIntervalCallback(delay: number) {
      const callback =
        intervalCallbacks.get(delay)?.[0] ??
        Array.from(intervalCallbacks.values()).flat()[0]

      if (!callback) {
        throw new Error(`No interval registered for ${delay}ms`)
      }

      return callback
    },
    restore() {
      Object.defineProperty(window, 'setTimeout', {
        configurable: true,
        writable: true,
        value: currentSetTimeout,
      })
      Object.defineProperty(window, 'clearTimeout', {
        configurable: true,
        writable: true,
        value: currentClearTimeout,
      })
      Object.defineProperty(window, 'setInterval', {
        configurable: true,
        writable: true,
        value: currentSetInterval,
      })
      Object.defineProperty(window, 'clearInterval', {
        configurable: true,
        writable: true,
        value: currentClearInterval,
      })
    },
  }
}
