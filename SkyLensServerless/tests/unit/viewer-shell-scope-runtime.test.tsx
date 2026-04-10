import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { ViewerShell } from '../../components/viewer/viewer-shell'
import { getDemoScenario } from '../../lib/demo/scenarios'
import { resetScopeCatalogSessionCacheForTests } from '../../lib/scope/catalog'
import { convertScopeHorizontalToEquatorial } from '../../lib/scope/coordinates'
import {
  VIEWER_SETTINGS_STORAGE_KEY,
  readViewerSettings,
} from '../../lib/viewer/settings'
import {
  computeScopeDeepStarCoreRadiusPx,
  computeScopeDeepStarEmergenceAlpha,
  computeScopeLimitingMagnitude,
} from '../../lib/viewer/scope-optics'

const {
  mockRouterReplace,
  mockSettingsSheetProps,
  mockRequestStartupObserverState,
  mockStartObserverTracking,
  mockSubscribeToOrientationPose,
  mockNormalizeCelestialObjects,
  mockNormalizeVisibleStars,
  mockBuildVisibleConstellations,
  mockFetchAircraftSnapshot,
  mockGetAircraftAvailabilityMessage,
  mockFetchSatelliteCatalog,
  mockResolveAircraftMotionObjects,
  mockResolveSatelliteMotionObjects,
} = vi.hoisted(() => ({
  mockRouterReplace: vi.fn(),
  mockSettingsSheetProps: vi.fn(),
  mockRequestStartupObserverState: vi.fn(),
  mockStartObserverTracking: vi.fn(),
  mockSubscribeToOrientationPose: vi.fn(),
  mockNormalizeCelestialObjects: vi.fn(),
  mockNormalizeVisibleStars: vi.fn(),
  mockBuildVisibleConstellations: vi.fn(),
  mockFetchAircraftSnapshot: vi.fn(),
  mockGetAircraftAvailabilityMessage: vi.fn(),
  mockFetchSatelliteCatalog: vi.fn(),
  mockResolveAircraftMotionObjects: vi.fn(),
  mockResolveSatelliteMotionObjects: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
  }),
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

vi.mock('../../lib/satellites/client', () => ({
  fetchSatelliteCatalog: mockFetchSatelliteCatalog,
}))

vi.mock('../../lib/viewer/motion', () => ({
  resolveAircraftMotionObjects: mockResolveAircraftMotionObjects,
  resolveSatelliteMotionObjects: mockResolveSatelliteMotionObjects,
}))

const SENSOR_CONTROLLER = {
  stop: vi.fn(),
  recenter: vi.fn(),
}

const TRACKER = {
  stop: vi.fn(),
}

type CanvasFillCall = {
  x: number
  y: number
  radius: number
  alpha: number
  fillStyle: unknown
}

let canvasFillCalls: CanvasFillCall[] = []
let canvasRedrawCount = 0
let container: HTMLDivElement
let root: Root
let originalFetch: typeof global.fetch | undefined
let originalGetBoundingClientRect: PropertyDescriptor | undefined
let stageBounds = {
  width: 390,
  height: 844,
}

describe('ViewerShell scope runtime', () => {
  beforeAll(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true
    originalGetBoundingClientRect = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'getBoundingClientRect',
    )
  })

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    originalFetch = global.fetch

    mockRouterReplace.mockReset()
    mockSettingsSheetProps.mockReset()
    mockRequestStartupObserverState.mockReset()
    mockStartObserverTracking.mockReset()
    mockSubscribeToOrientationPose.mockReset()
    mockNormalizeCelestialObjects.mockReset()
    mockNormalizeVisibleStars.mockReset()
    mockBuildVisibleConstellations.mockReset()
    mockFetchAircraftSnapshot.mockReset()
    mockGetAircraftAvailabilityMessage.mockReset()
    mockFetchSatelliteCatalog.mockReset()
    mockResolveAircraftMotionObjects.mockReset()
    mockResolveSatelliteMotionObjects.mockReset()
    SENSOR_CONTROLLER.stop.mockReset()
    SENSOR_CONTROLLER.recenter.mockReset()
    TRACKER.stop.mockReset()

    mockRequestStartupObserverState.mockResolvedValue(null)
    mockStartObserverTracking.mockReturnValue(TRACKER)
    mockSubscribeToOrientationPose.mockReturnValue(SENSOR_CONTROLLER)
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -18,
      objects: [],
    })
    mockNormalizeVisibleStars.mockReturnValue([])
    mockBuildVisibleConstellations.mockReturnValue({
      objects: [],
      lineSegments: [],
    })
    mockFetchAircraftSnapshot.mockResolvedValue({
      fetchedAt: '2026-04-05T00:00:00.000Z',
      observer: {
        lat: 0,
        lon: 0,
        altMeters: 0,
      },
      availability: 'available',
      aircraft: [],
    })
    mockGetAircraftAvailabilityMessage.mockReturnValue(null)
    mockFetchSatelliteCatalog.mockResolvedValue({
      fetchedAt: '2026-04-05T00:00:00.000Z',
      expiresAt: '2026-04-05T06:00:00.000Z',
      satellites: [],
    })
    mockResolveAircraftMotionObjects.mockReturnValue([])
    mockResolveSatelliteMotionObjects.mockReturnValue([])
    canvasFillCalls = []
    canvasRedrawCount = 0

    window.localStorage.clear()
    resetScopeCatalogSessionCacheForTests()
    stubCanvasContext()
    stageBounds = {
      width: 390,
      height: 844,
    }
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        width: stageBounds.width,
        height: stageBounds.height,
        top: 0,
        left: 0,
        right: stageBounds.width,
        bottom: stageBounds.height,
        x: 0,
        y: 0,
        toJSON: () => null,
      }),
    })
  })

  afterEach(async () => {
    if (originalFetch) {
      global.fetch = originalFetch
    }

    await act(async () => {
      root.unmount()
    })

    container.remove()
    window.localStorage.clear()
    resetScopeCatalogSessionCacheForTests()

    if (originalGetBoundingClientRect) {
      Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', originalGetBoundingClientRect)
    }
  })

  it('surfaces a named deep scope star through center-lock while keeping it canvas-only', async () => {
    const dataset = createScopeDataset('Scope Rigel')
    global.fetch = vi.fn().mockImplementation(dataset.fetcher) as typeof fetch

    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...readViewerSettings(),
        scopeModeEnabled: true,
        scope: {
          verticalFovDeg: 10,
        },
        labelDisplayMode: 'center_only',
      }),
    )

    await renderViewer()

    expect(container.querySelector('[data-testid="scope-star-canvas"]')).not.toBeNull()
    const centerLockChip = container.querySelector('[data-testid="center-lock-chip"]') as
      | HTMLElement
      | null

    expect(centerLockChip).not.toBeNull()
    expect(centerLockChip?.textContent ?? '').toContain('Scope Rigel')
    expect(container.querySelectorAll('[data-testid="scope-bright-object-marker"]')).toHaveLength(0)
    expect(container.querySelector('[data-testid="sky-object-marker"]')).toBeNull()
  })

  it('ignores stale tile responses after scope is disabled', async () => {
    const deferredTile = createDeferred<Response>()
    const dataset = createScopeDataset('Scope Vega', deferredTile)
    global.fetch = vi.fn().mockImplementation(dataset.fetcher) as typeof fetch

    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...readViewerSettings(),
        scopeModeEnabled: true,
        scope: {
          verticalFovDeg: 10,
        },
        labelDisplayMode: 'center_only',
      }),
    )

    await renderViewer()

    await act(async () => {
      ;(
        container.querySelector('[data-testid="desktop-scope-action"]') as HTMLButtonElement | null
      )?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    deferredTile.resolve(binaryResponse(dataset.tileBytes))
    await flushEffects()

    expect(container.querySelector('[data-testid="scope-lens-overlay"]')).toBeNull()
    expect(container.textContent).not.toContain('Scope Vega')
  })

  it('keeps scope-mode deep-star rendering unchanged when the main-view toggle is off', async () => {
    const dataset = createMultiBandScopeDataset([
      {
        azimuthDeg: 0,
        elevationDeg: getDemoScenario('tokyo-iss').initialPitchDeg,
        vMag: 5.2,
        nameId: 1,
      },
    ])
    global.fetch = vi.fn().mockImplementation(dataset.fetcher) as typeof fetch

    setStoredViewerSettings({
      scopeModeEnabled: true,
      mainViewDeepStarsEnabled: false,
      scopeOptics: {
        apertureMm: 240,
        magnificationX: 50,
        transparencyPct: 85,
      },
      labelDisplayMode: 'center_only',
    })

    await renderViewer()

    expect(container.querySelector('[data-testid="scope-lens-overlay"]')).not.toBeNull()
    expect(getCanvasStars()).toHaveLength(1)
  })

  it('fetches portrait edge tiles using the square scope lens viewport', async () => {
    const dataset = createPortraitScopeSelectionDataset()
    global.fetch = vi.fn().mockImplementation(dataset.fetcher) as typeof fetch

    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...readViewerSettings(),
        scopeModeEnabled: true,
        scope: {
          verticalFovDeg: 10,
        },
        labelDisplayMode: 'center_only',
      }),
    )

    await renderViewer()

    expect(dataset.requestedUrls.some((url) => url.endsWith(dataset.edgeTileFile))).toBe(true)
  })

  it('fetches deep-star tiles in main view using the full stage viewport while scope mode is off', async () => {
    const dataset = createMainViewSelectionDataset()
    global.fetch = vi.fn().mockImplementation(dataset.fetcher) as typeof fetch

    setStoredViewerSettings({
      scopeModeEnabled: false,
      labelDisplayMode: 'center_only',
    })

    await renderViewer()

    expect(container.querySelector('[data-testid="scope-lens-overlay"]')).toBeNull()
    expect(dataset.requestedUrls.some((url) => url.endsWith(dataset.edgeTileFile))).toBe(true)
  })

  it('skips main-view deep-star catalog work entirely when the persisted toggle is off', async () => {
    const dataset = createMainViewSelectionDataset()
    global.fetch = vi.fn().mockImplementation(dataset.fetcher) as typeof fetch

    setStoredViewerSettings({
      scopeModeEnabled: false,
      mainViewDeepStarsEnabled: false,
      labelDisplayMode: 'center_only',
    })

    await renderViewer()

    expect(container.querySelector('[data-testid="scope-lens-overlay"]')).toBeNull()
    expect(dataset.requestedUrls).toHaveLength(0)
    expect(getSkyObjectMarkerPositionByLabel('Scope Star')).toBeNull()
  })

  it('lets main-view deep stars participate in center-lock and on-object labels without scope mode', async () => {
    const scenario = getDemoScenario('tokyo-iss')
    const dataset = createMultiBandScopeDataset([
      {
        azimuthDeg: 0,
        elevationDeg: scenario.initialPitchDeg,
        vMag: 4.8,
        nameId: 1,
      },
    ])
    global.fetch = vi.fn().mockImplementation(dataset.fetcher) as typeof fetch

    setStoredViewerSettings({
      scopeModeEnabled: false,
      mainViewOptics: {
        apertureMm: 100,
        magnificationX: 1,
      },
      scopeOptics: {
        apertureMm: 100,
        magnificationX: 50,
        transparencyPct: 85,
      },
      labelDisplayMode: 'center_only',
    })

    await renderViewer()

    expect(container.querySelector('[data-testid="scope-lens-overlay"]')).toBeNull()
    expect(container.querySelector('[data-testid="main-star-canvas"]')).not.toBeNull()
    expect(container.querySelectorAll('[data-testid="sky-object-marker"]')).toHaveLength(0)
    expect(container.querySelector('[data-testid="center-lock-chip"]')?.textContent).toContain(
      'Scope Star 1',
    )

    await rerenderViewerWithSettings({
      scopeModeEnabled: false,
      scopeOptics: {
        apertureMm: 100,
        magnificationX: 50,
        transparencyPct: 85,
      },
      labelDisplayMode: 'on_objects',
    })

    const labels = Array.from(container.querySelectorAll('[data-testid="sky-object-label"]'))
    expect(labels.some((label) => label.textContent?.includes('Scope Star 1'))).toBe(true)
  })

  it('renders visible normal-view deep stars on canvas while preserving center-lock and label membership', async () => {
    const scenario = getDemoScenario('tokyo-iss')
    const dataset = createMultiBandScopeDataset([
      {
        azimuthDeg: 0,
        elevationDeg: scenario.initialPitchDeg,
        vMag: 2.1,
        nameId: 1,
      },
      {
        azimuthDeg: 8,
        elevationDeg: scenario.initialPitchDeg,
        vMag: 2.3,
        nameId: 2,
      },
    ])
    global.fetch = vi.fn().mockImplementation(dataset.fetcher) as typeof fetch

    setStoredViewerSettings({
      scopeModeEnabled: false,
      labelDisplayMode: 'center_only',
    })

    await renderViewer()

    expect(container.querySelector('[data-testid="main-star-canvas"]')).not.toBeNull()
    expect(container.querySelectorAll('[data-testid="sky-object-marker"]')).toHaveLength(0)
    expect(getCanvasStars()).toHaveLength(2)
    expect(container.querySelector('[data-testid="center-lock-chip"]')?.textContent ?? '').toContain(
      'Scope Star 1',
    )

    await rerenderViewerWithSettings({
      scopeModeEnabled: false,
      labelDisplayMode: 'on_objects',
    })

    const labels = Array.from(container.querySelectorAll('[data-testid="sky-object-label"]'))

    expect(labels.some((label) => label.textContent?.includes('Scope Star 1'))).toBe(true)
    expect(labels.some((label) => label.textContent?.includes('Scope Star 2'))).toBe(true)
  })

  it('does not redraw the main-view deep-star canvas on an unrelated same-mounted viewer rerender', async () => {
    const scenario = getDemoScenario('tokyo-iss')
    const dataset = createMultiBandScopeDataset([
      {
        azimuthDeg: 0,
        elevationDeg: scenario.initialPitchDeg,
        vMag: 2.1,
        nameId: 1,
      },
      {
        azimuthDeg: 8,
        elevationDeg: scenario.initialPitchDeg,
        vMag: 2.3,
        nameId: 2,
      },
    ])
    global.fetch = vi.fn().mockImplementation(dataset.fetcher) as typeof fetch
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(scenario.observer.timestampMs)

    try {
      setStoredViewerSettings({
        scopeModeEnabled: false,
        labelDisplayMode: 'center_only',
      })

      await renderViewer()

      expect(container.querySelector('[data-testid="main-star-canvas"]')).not.toBeNull()
      expect(getCanvasStars()).toHaveLength(2)
      const initialCanvasRedrawCount = canvasRedrawCount

      await openDesktopViewerPanel()

      expect(container.querySelector('[data-testid="desktop-viewer-panel"]')).not.toBeNull()
      expect(getCanvasStars()).toHaveLength(2)
      expect(canvasRedrawCount).toBe(initialCanvasRedrawCount)
      expect(container.querySelector('[data-testid="center-lock-chip"]')?.textContent ?? '').toContain(
        'Scope Star 1',
      )
    } finally {
      dateNowSpy.mockRestore()
    }
  })

  it(
    'keeps non-scope deep stars in top-list labels while visible-marker diagnostics stay DOM-only',
    async () => {
      const scenario = getDemoScenario('tokyo-iss')
      const dataset = createMultiBandScopeDataset([
        {
          azimuthDeg: 0,
          elevationDeg: scenario.initialPitchDeg,
          vMag: 2.1,
          nameId: 1,
        },
        {
          azimuthDeg: 8,
          elevationDeg: scenario.initialPitchDeg,
          vMag: 2.3,
          nameId: 2,
        },
      ])
      global.fetch = vi.fn().mockImplementation(dataset.fetcher) as typeof fetch

      setStoredViewerSettings({
        scopeModeEnabled: false,
        labelDisplayMode: 'top_list',
      })

      await renderViewer()

      const topList = container.querySelector('[data-testid="sky-object-top-list"]')
      const topListItems = Array.from(container.querySelectorAll('[data-testid="sky-object-top-list-item"]'))

      expect(container.querySelector('[data-testid="main-star-canvas"]')).not.toBeNull()
      expect(container.querySelectorAll('[data-testid="sky-object-marker"]')).toHaveLength(0)
      expect(topList).not.toBeNull()
      expect(topListItems).toHaveLength(2)
      expect(topList?.textContent).toContain('Scope Star 1')
      expect(topList?.textContent).toContain('Scope Star 2')

      await openDesktopViewerPanel()

      expect(container.textContent).toContain('Visible markers 0')
    },
    10_000,
  )

  it('shares the B-V deep-star color mapping for main-view canvas stars', async () => {
    const scenario = getDemoScenario('tokyo-iss')
    const dataset = createMultiBandScopeDataset([
      {
        azimuthDeg: 0,
        elevationDeg: scenario.initialPitchDeg,
        vMag: 2.1,
        bMinusV: 0.95,
        nameId: 1,
      },
    ])
    global.fetch = vi.fn().mockImplementation(dataset.fetcher) as typeof fetch

    setStoredViewerSettings({
      scopeModeEnabled: false,
      labelDisplayMode: 'center_only',
    })

    await renderViewer()

    expect(container.querySelector('[data-testid="main-star-canvas"]')).not.toBeNull()
    expect(container.querySelectorAll('[data-testid="sky-object-marker"]')).toHaveLength(0)
    expect(canvasFillCalls).toHaveLength(1)
    expect(canvasFillCalls[0]?.fillStyle).toBe('rgba(255, 222, 186, 0.88)')
  })

  it('keeps center-lock ordering unchanged when a brighter object wins focus under magnified projection', async () => {
    const scenario = getDemoScenario('tokyo-iss')
    const sharedElevationDeg = scenario.initialPitchDeg
    const dataset = createMultiBandScopeDataset([
      {
        azimuthDeg: 0,
        elevationDeg: sharedElevationDeg,
        vMag: 2.1,
        nameId: 1,
      },
    ])
    global.fetch = vi.fn().mockImplementation(dataset.fetcher) as typeof fetch
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -18,
      objects: [
        {
          id: 'planet-jupiter',
          type: 'planet',
          label: 'Jupiter',
          azimuthDeg: 0,
          elevationDeg: sharedElevationDeg,
          importance: 90,
          metadata: {
            detail: {
              typeLabel: 'Planet',
              elevationDeg: sharedElevationDeg,
              azimuthDeg: 0,
            },
          },
        },
      ],
    })

    setStoredViewerSettings({
      scopeModeEnabled: false,
      scopeOptics: {
        apertureMm: 240,
        magnificationX: 50,
        transparencyPct: 85,
      },
      labelDisplayMode: 'center_only',
    })

    await renderViewer()
    await openDesktopViewerPanel()

    const markerPosition = getSkyObjectMarkerPosition('planet-jupiter')
    const deepStarCanvasStar = getCanvasStars()[0] ?? null

    expect(markerPosition).not.toBeNull()
    expect(deepStarCanvasStar).not.toBeNull()
    expect(container.querySelector('[data-testid="center-lock-chip"]')?.textContent).toContain(
      'Jupiter',
    )
  })

  it('rejects below-horizon deep stars while retaining optics-eligible stars', async () => {
    const dataset = createMultiBandScopeDataset([
      {
        azimuthDeg: 0,
        elevationDeg: getDemoScenario('tokyo-iss').initialPitchDeg,
        vMag: 5.2,
        nameId: 1,
      },
      {
        azimuthDeg: 1.2,
        elevationDeg: getDemoScenario('tokyo-iss').initialPitchDeg + 0.4,
        vMag: 6.15,
        nameId: 2,
      },
      {
        azimuthDeg: 0.6,
        elevationDeg: -4,
        vMag: 1.8,
        nameId: 3,
      },
    ])
    global.fetch = vi.fn().mockImplementation(dataset.fetcher) as typeof fetch

    setStoredViewerSettings({
      scopeModeEnabled: true,
      scopeOptics: {
        apertureMm: 240,
        magnificationX: 50,
        transparencyPct: 85,
      },
      labelDisplayMode: 'center_only',
    })

    await renderViewer()

    expect(getCanvasStars()).toHaveLength(2)
  })

  it('keeps deep stars that fail the limiting-magnitude gate out of the canvas output', async () => {
    const dataset = createMultiBandScopeDataset([
      {
        azimuthDeg: 0,
        elevationDeg: getDemoScenario('tokyo-iss').initialPitchDeg,
        vMag: 5.4,
      },
      {
        azimuthDeg: 1.2,
        elevationDeg: getDemoScenario('tokyo-iss').initialPitchDeg + 0.2,
        vMag: 10.2,
      },
    ])
    global.fetch = vi.fn().mockImplementation(dataset.fetcher) as typeof fetch

    setStoredViewerSettings({
      scopeModeEnabled: true,
      scopeOptics: {
        apertureMm: 240,
        magnificationX: 50,
        transparencyPct: 85,
      },
      labelDisplayMode: 'center_only',
    })

    await renderViewer()

    expect(getCanvasStars()).toHaveLength(1)
  })

  it('keeps stage and lens marker sizing aligned to scope optics for non-bright objects', async () => {
    mockResolveSatelliteMotionObjects.mockReturnValue([
      {
        object: {
          id: '25544',
          type: 'satellite',
          label: 'ISS (ZARYA)',
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

    setStoredViewerSettings({
      scopeModeEnabled: true,
      scopeOptics: {
        apertureMm: 240,
        magnificationX: 120,
        transparencyPct: 85,
      },
      labelDisplayMode: 'center_only',
    })

    await renderViewer()

    expect(container.querySelector('[data-testid="scope-lens-overlay"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="center-lock-chip"]')?.textContent).toContain(
      'ISS (ZARYA)',
    )
    expect(getScopeMarkerSizePx('25544')).toBe(getSkyObjectMarkerSizePx('25544'))
  })

  it('reveals more normal-view deep stars as aperture increases', async () => {
    const scenario = getDemoScenario('tokyo-iss')
    const dataset = createMultiBandScopeDataset([
      {
        azimuthDeg: 0,
        elevationDeg: scenario.initialPitchDeg,
        vMag: 2.1,
        nameId: 1,
      },
      {
        azimuthDeg: 6,
        elevationDeg: scenario.initialPitchDeg,
        vMag: 4.8,
        nameId: 2,
      },
    ])
    global.fetch = vi.fn().mockImplementation(dataset.fetcher) as typeof fetch

    setStoredViewerSettings({
      scopeModeEnabled: false,
      labelDisplayMode: 'on_objects',
    })

    await renderViewer()

    expect(container.querySelector('[data-testid="main-star-canvas"]')).not.toBeNull()
    expect(getCanvasStars()).toHaveLength(1)
    expect(container.querySelectorAll('[data-testid="sky-object-marker"]')).toHaveLength(0)

    await openDesktopViewerPanel()
    await setSliderValue('desktop-scope-aperture-slider', '100')

    expect(getCanvasStars()).toHaveLength(2)
    expect(container.querySelectorAll('[data-testid="sky-object-marker"]')).toHaveLength(0)
  })

  it('progressively reveals deep stars across the 20mm to 400mm anchored aperture range while keeping radius fixed', async () => {
    const dataset = createMultiBandScopeDataset([
      {
        azimuthDeg: 0,
        elevationDeg: getDemoScenario('tokyo-iss').initialPitchDeg,
        vMag: 2.7,
      },
    ])
    global.fetch = vi.fn().mockImplementation(dataset.fetcher) as typeof fetch

    setStoredViewerSettings({
      scopeModeEnabled: true,
      scopeOptics: {
        apertureMm: 20,
        magnificationX: 50,
        transparencyPct: 85,
      },
      labelDisplayMode: 'center_only',
    })

    await renderViewer()

    const dimStars = getCanvasStars()
    const edgeDimLimit = computeScopeLimitingMagnitude({
      apertureMm: 20,
      magnificationX: 50,
      transparencyPct: 85,
      altitudeDeg: getDemoScenario('tokyo-iss').initialPitchDeg,
    })
    const expectedEdgeDimAlpha = computeScopeDeepStarEmergenceAlpha(edgeDimLimit - 2.7)

    expect(expectedEdgeDimAlpha).toBe(0)
    expect(dimStars).toHaveLength(0)

    await rerenderViewerWithSettings({
      scopeModeEnabled: true,
      scopeOptics: {
        apertureMm: 40,
        magnificationX: 50,
        transparencyPct: 85,
      },
      labelDisplayMode: 'center_only',
    })

    const lowAnchorStars = getCanvasStars()
    const expectedRadius = computeScopeDeepStarCoreRadiusPx(2.7)
    const lowAnchorLimit = computeScopeLimitingMagnitude({
      apertureMm: 40,
      magnificationX: 50,
      transparencyPct: 85,
      altitudeDeg: getDemoScenario('tokyo-iss').initialPitchDeg,
    })
    const expectedLowAnchorAlpha = computeScopeDeepStarEmergenceAlpha(lowAnchorLimit - 2.7)

    expect(lowAnchorStars).toHaveLength(1)
    expect(lowAnchorStars[0]?.radii[0]).toBeCloseTo(expectedRadius)
    expect(lowAnchorStars[0]?.alphas[0]).toBeCloseTo(expectedLowAnchorAlpha)
    expect(Math.max(...(lowAnchorStars[0]?.alphas ?? [0]))).toBeGreaterThan(0)
    expect(Math.max(...(lowAnchorStars[0]?.alphas ?? [1]))).toBeLessThan(1)

    await rerenderViewerWithSettings({
      scopeModeEnabled: true,
      scopeOptics: {
        apertureMm: 240,
        magnificationX: 50,
        transparencyPct: 85,
      },
      labelDisplayMode: 'center_only',
    })

    const highAnchorStars = getCanvasStars()
    const highAnchorLimit = computeScopeLimitingMagnitude({
      apertureMm: 240,
      magnificationX: 50,
      transparencyPct: 85,
      altitudeDeg: getDemoScenario('tokyo-iss').initialPitchDeg,
    })
    const expectedHighAnchorAlpha = computeScopeDeepStarEmergenceAlpha(highAnchorLimit - 2.7)

    expect(highAnchorStars).toHaveLength(1)
    expect(highAnchorStars[0]?.radii[0]).toBeCloseTo(expectedRadius)
    expect(highAnchorStars[0]?.alphas[0]).toBeCloseTo(expectedHighAnchorAlpha)

    await rerenderViewerWithSettings({
      scopeModeEnabled: true,
      scopeOptics: {
        apertureMm: 400,
        magnificationX: 50,
        transparencyPct: 85,
      },
      labelDisplayMode: 'center_only',
    })

    const brightStars = getCanvasStars()
    const brightLimit = computeScopeLimitingMagnitude({
      apertureMm: 400,
      magnificationX: 50,
      transparencyPct: 85,
      altitudeDeg: getDemoScenario('tokyo-iss').initialPitchDeg,
    })
    const expectedBrightAlpha = computeScopeDeepStarEmergenceAlpha(brightLimit - 2.7)

    expect(brightStars).toHaveLength(1)
    expect(brightStars[0]?.radii[0]).toBeCloseTo(expectedRadius)
    expect(brightStars[0]?.alphas[0]).toBeCloseTo(expectedBrightAlpha)
    expect(highAnchorLimit).toBeGreaterThan(lowAnchorLimit)
    expect(brightLimit).toBeGreaterThan(highAnchorLimit)
    expect(Math.max(...highAnchorStars[0].alphas)).toBeGreaterThan(
      Math.max(...lowAnchorStars[0].alphas),
    )
    expect(Math.max(...brightStars[0].alphas)).toBe(1)
  })

  it('renders brighter deep stars with larger canvas radii than dimmer deep stars', async () => {
    const scenario = getDemoScenario('tokyo-iss')
    const dataset = createMultiBandScopeDataset([
      {
        azimuthDeg: 0,
        elevationDeg: scenario.initialPitchDeg,
        vMag: 5.4,
      },
      {
        azimuthDeg: 1.8,
        elevationDeg: scenario.initialPitchDeg,
        vMag: 6.9,
      },
    ])
    global.fetch = vi.fn().mockImplementation(dataset.fetcher) as typeof fetch

    setStoredViewerSettings({
      scopeModeEnabled: true,
      scopeOptics: {
        apertureMm: 240,
        magnificationX: 50,
        transparencyPct: 85,
      },
      labelDisplayMode: 'center_only',
    })

    await renderViewer()

    const lensCenterPx = getScopeLensRadiusPx()
    const canvasStars = getCanvasStars()
    const nearestCanvasStar =
      canvasStars
        .map((star) => ({
          ...star,
          distanceFromCenterPx: Math.hypot(star.x - lensCenterPx, star.y - lensCenterPx),
        }))
        .sort((left, right) => left.distanceFromCenterPx - right.distanceFromCenterPx)[0] ?? null
    const farthestCanvasStar = getFarthestCanvasStar(canvasStars, lensCenterPx, lensCenterPx)

    expect(canvasStars).toHaveLength(2)
    expect(nearestCanvasStar).not.toBeNull()
    expect(farthestCanvasStar).not.toBeNull()
    expect(Math.max(...(nearestCanvasStar?.radii ?? [0]))).toBeGreaterThan(
      Math.max(...(farthestCanvasStar?.radii ?? [0])),
    )
  })

  it('widens deep-star spacing with magnification without scaling star size linearly', async () => {
    const scenario = getDemoScenario('tokyo-iss')
    const dataset = createMultiBandScopeDataset([
      {
        azimuthDeg: 0,
        elevationDeg: scenario.initialPitchDeg,
        vMag: 5.4,
      },
      {
        azimuthDeg: 1.8,
        elevationDeg: scenario.initialPitchDeg,
        vMag: 5.8,
      },
    ])
    global.fetch = vi.fn().mockImplementation(dataset.fetcher) as typeof fetch

    setStoredViewerSettings({
      scopeModeEnabled: true,
      scopeOptics: {
        apertureMm: 160,
        magnificationX: 25,
        transparencyPct: 85,
      },
      labelDisplayMode: 'center_only',
    })

    await renderViewer()

    const lensCenterPx = getScopeLensRadiusPx()
    const lowMagnificationStars = getCanvasStars()
    const lowFarthestStar = getFarthestCanvasStar(lowMagnificationStars, lensCenterPx, lensCenterPx)
    const lowCoreRadius = Math.max(...(lowFarthestStar?.radii ?? [0]))

    await rerenderViewerWithSettings({
      scopeModeEnabled: true,
      scopeOptics: {
        apertureMm: 160,
        magnificationX: 100,
        transparencyPct: 85,
      },
      labelDisplayMode: 'center_only',
    })

    const highMagnificationStars = getCanvasStars()
    const highFarthestStar = getFarthestCanvasStar(highMagnificationStars, lensCenterPx, lensCenterPx)
    const highCoreRadius = Math.max(...(highFarthestStar?.radii ?? [0]))

    expect(lowMagnificationStars).toHaveLength(2)
    expect(highMagnificationStars).toHaveLength(2)
    expect(highFarthestStar).not.toBeNull()
    expect(lowFarthestStar).not.toBeNull()
    expect(highFarthestStar!.distanceFromCenterPx).toBeGreaterThan(
      lowFarthestStar!.distanceFromCenterPx,
    )
    expect(highCoreRadius).toBeGreaterThan(0)
    expect(highCoreRadius).toBeLessThan(lowCoreRadius * 2)
  })

  it('updates the runtime scope lens diameter from the persisted height percentage while staying viewport-safe', async () => {
    setStoredViewerSettings({
      scopeModeEnabled: true,
      scopeLensDiameterPct: 50,
      labelDisplayMode: 'center_only',
    })

    await renderViewer()

    expect(getScopeLensDiameterPxFromDom()).toBeCloseTo(180)

    await rerenderViewerWithSettings({
      scopeModeEnabled: true,
      scopeLensDiameterPct: 90,
      labelDisplayMode: 'center_only',
    })

    expect(getScopeLensDiameterPxFromDom()).toBeCloseTo(358)
  })

  it('remaps supported telescope diameter percentages across the safe envelope on narrow portrait layouts', async () => {
    stageBounds = {
      width: 260,
      height: 844,
    }

    setStoredViewerSettings({
      scopeModeEnabled: true,
      scopeLensDiameterPct: 50,
      labelDisplayMode: 'center_only',
    })

    await renderViewer()

    const narrowLowDiameterPx = getScopeLensDiameterPxFromDom()

    await rerenderViewerWithSettings({
      scopeModeEnabled: true,
      scopeLensDiameterPct: 90,
      labelDisplayMode: 'center_only',
    })

    const narrowHighDiameterPx = getScopeLensDiameterPxFromDom()

    expect(narrowLowDiameterPx).toBeCloseTo(180)
    expect(narrowHighDiameterPx).toBeCloseTo(228)
    expect(narrowHighDiameterPx).toBeGreaterThan(narrowLowDiameterPx)
  })

  it(
    'scales scope planet size with magnification while opacity stays aperture-driven',
    async () => {
      mockNormalizeCelestialObjects.mockReturnValue({
        sunAltitudeDeg: -12,
        objects: [
          {
            id: 'planet-jupiter',
            type: 'planet',
            label: 'Jupiter',
            azimuthDeg: 0,
            elevationDeg: getDemoScenario('tokyo-iss').initialPitchDeg,
            magnitude: -2.7,
            importance: 90,
            metadata: {
              detail: {
                typeLabel: 'Planet',
                magnitude: -2.7,
                elevationDeg: getDemoScenario('tokyo-iss').initialPitchDeg,
              },
            },
          },
        ],
      })

      setStoredViewerSettings({
        scopeModeEnabled: true,
        scopeOptics: {
          apertureMm: 120,
          magnificationX: 25,
          transparencyPct: 85,
        },
        labelDisplayMode: 'center_only',
      })

      await renderViewer()
      await flushEffects()

      const lowMagnificationSizePx = getScopeMarkerSizePx('planet-jupiter')
      const lowMagnificationOpacity = getScopeMarkerOpacity('planet-jupiter')

      await rerenderViewerWithSettings({
        scopeModeEnabled: true,
        scopeOptics: {
          apertureMm: 120,
          magnificationX: 100,
          transparencyPct: 85,
        },
        labelDisplayMode: 'center_only',
      })
      await flushEffects()

      const highMagnificationSizePx = getScopeMarkerSizePx('planet-jupiter')
      const highMagnificationOpacity = getScopeMarkerOpacity('planet-jupiter')

      await rerenderViewerWithSettings({
        scopeModeEnabled: true,
        scopeOptics: {
          apertureMm: 240,
          magnificationX: 100,
          transparencyPct: 85,
        },
        labelDisplayMode: 'center_only',
      })
      await flushEffects()

      const largeApertureOpacity = getScopeMarkerOpacity('planet-jupiter')

      expect(highMagnificationSizePx).toBeGreaterThan(lowMagnificationSizePx)
      expect(highMagnificationOpacity).toBe(lowMagnificationOpacity)
      expect(largeApertureOpacity).toBeGreaterThanOrEqual(highMagnificationOpacity)
    },
    10_000,
  )

  it('keeps daylight suppression unchanged for scope deep-star tile fetches', async () => {
    const dataset = createMultiBandScopeDataset([
      {
        azimuthDeg: 0,
        elevationDeg: getDemoScenario('tokyo-iss').initialPitchDeg,
        vMag: 5.2,
      },
    ])
    global.fetch = vi.fn().mockImplementation(dataset.fetcher) as typeof fetch
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -2,
      objects: [],
    })

    setStoredViewerSettings({
      likelyVisibleOnly: true,
      scopeModeEnabled: true,
      scopeOptics: {
        apertureMm: 160,
        magnificationX: 50,
        transparencyPct: 85,
      },
      labelDisplayMode: 'center_only',
    })

    await renderViewer()

    expect(dataset.requestedUrls.some((url) => url.endsWith('.bin'))).toBe(false)
    expect(getCanvasStars()).toHaveLength(0)
  })

  async function renderViewer() {
    await act(async () => {
      root.render(
        React.createElement(ViewerShell, {
          initialState: {
            entry: 'demo',
            location: 'granted',
            camera: 'denied',
            orientation: 'denied',
            demoScenarioId: 'tokyo-iss',
          },
        }),
      )
    })

    await flushEffects()
    await flushEffects()
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

  async function rerenderViewerWithSettings(settings: Record<string, unknown>) {
    await act(async () => {
      root.unmount()
    })
    root = createRoot(container)
    canvasFillCalls = []
    canvasRedrawCount = 0
    setStoredViewerSettings(settings)
    await renderViewer()
  }
})

function createScopeDataset(name: string, deferredTile?: ReturnType<typeof createDeferred<Response>>) {
  const scenario = getDemoScenario('tokyo-iss')
  const centeredEquatorial = convertScopeHorizontalToEquatorial(
    {
      azimuthDeg: 0,
      elevationDeg: scenario.initialPitchDeg,
    },
    scenario.observer,
    scenario.observer.timestampMs,
  )
  const manifest = {
    version: 1,
    kind: 'dev',
    sourceCatalog: 'dev-synthetic-from-stars-200',
    epoch: 'J2000',
    rowFormat: 'scope-star-v2-le',
    namesPath: 'names.json',
    bands: [
      {
        bandDir: 'mag6p5',
        maxMagnitude: 6.5,
        raStepDeg: 90,
        decStepDeg: 45,
        indexPath: 'mag6p5/index.json',
        totalRows: 0,
        namedRows: 0,
      },
      {
        bandDir: 'mag8p0',
        maxMagnitude: 8,
        raStepDeg: 45,
        decStepDeg: 30,
        indexPath: 'mag8p0/index.json',
        totalRows: 0,
        namedRows: 0,
      },
      {
        bandDir: 'mag9p5',
        maxMagnitude: 9.5,
        raStepDeg: 22.5,
        decStepDeg: 22.5,
        indexPath: 'mag9p5/index.json',
        totalRows: 1,
        namedRows: 1,
      },
      {
        bandDir: 'mag10p5',
        maxMagnitude: 10.5,
        raStepDeg: 11.25,
        decStepDeg: 11.25,
        indexPath: 'mag10p5/index.json',
        totalRows: 0,
        namedRows: 0,
      },
    ],
  }
  const index = {
    bandDir: 'mag9p5',
    maxMagnitude: 9.5,
    raStepDeg: 22.5,
    decStepDeg: 22.5,
    tiles: [
      {
        raIndex: Math.floor(centeredEquatorial.raDeg / 22.5),
        decIndex: Math.floor((centeredEquatorial.decDeg + 90) / 22.5),
        file: `r${Math.floor(centeredEquatorial.raDeg / 22.5)}_d${Math.floor((centeredEquatorial.decDeg + 90) / 22.5)}.bin`,
        count: 1,
      },
    ],
  }
  const tileBytes = encodeScopeRow({
    raMicroDeg: Math.round(centeredEquatorial.raDeg * 1_000_000),
    decMicroDeg: Math.round(centeredEquatorial.decDeg * 1_000_000),
    pmRaMasPerYear: 0,
    pmDecMasPerYear: 0,
    vMagMilli: 5200,
    bMinusVMilli: 200,
    nameId: 1,
  })

  return {
    tileBytes,
    fetcher: async (input: string | URL | Request) => {
      const url = String(input)

      if (url.endsWith('/manifest.json')) {
        return jsonResponse(manifest)
      }

      if (url.endsWith('/names.json')) {
        return jsonResponse({ 1: name })
      }

      if (url.endsWith('/mag9p5/index.json')) {
        return jsonResponse(index)
      }

      if (url.endsWith(`/mag9p5/${index.tiles[0]?.file}`)) {
        if (deferredTile) {
          return deferredTile.promise
        }

        return binaryResponse(tileBytes)
      }

      return jsonResponse({
        bandDir: 'mag6p5',
        maxMagnitude: 6.5,
        raStepDeg: 90,
        decStepDeg: 45,
        tiles: [],
      })
    },
  }
}

function createMultiBandScopeDataset(
  rows: Array<{
    azimuthDeg: number
    elevationDeg: number
    vMag: number
    bMinusV?: number
    nameId?: number
  }>,
) {
  const scenario = getDemoScenario('tokyo-iss')
  const centeredEquatorial = convertScopeHorizontalToEquatorial(
    {
      azimuthDeg: 0,
      elevationDeg: scenario.initialPitchDeg,
    },
    scenario.observer,
    scenario.observer.timestampMs,
  )
  const bandDefinitions = [
    { bandDir: 'mag6p5', maxMagnitude: 6.5, raStepDeg: 90, decStepDeg: 45 },
    { bandDir: 'mag8p0', maxMagnitude: 8, raStepDeg: 45, decStepDeg: 30 },
    { bandDir: 'mag9p5', maxMagnitude: 9.5, raStepDeg: 22.5, decStepDeg: 22.5 },
    { bandDir: 'mag10p5', maxMagnitude: 10.5, raStepDeg: 11.25, decStepDeg: 11.25 },
  ] as const
  const requestedUrls: string[] = []
  const names: Record<string, string> = {}
  const tileFile = 'r0_d0.bin'
  const tileBytes = encodeScopeRows(
    rows.map((row) => {
      const equatorial = convertScopeHorizontalToEquatorial(
        {
          azimuthDeg: row.azimuthDeg,
          elevationDeg: row.elevationDeg,
        },
        scenario.observer,
        scenario.observer.timestampMs,
      )

      if (row.nameId) {
        names[String(row.nameId)] = `Scope Star ${row.nameId}`
      }

      return {
        raMicroDeg: Math.round(equatorial.raDeg * 1_000_000),
        decMicroDeg: Math.round(equatorial.decDeg * 1_000_000),
        pmRaMasPerYear: 0,
        pmDecMasPerYear: 0,
        vMagMilli: Math.round(row.vMag * 1_000),
        bMinusVMilli: Math.round((row.bMinusV ?? 0.2) * 1_000),
        nameId: row.nameId ?? 0,
      }
    }),
  )

  return {
    requestedUrls,
    fetcher: async (input: string | URL | Request) => {
      const url = String(input)
      requestedUrls.push(url)

      if (url.endsWith('/manifest.json')) {
        return jsonResponse({
          version: 1,
          kind: 'dev',
          sourceCatalog: 'dev-synthetic-from-stars-200',
          epoch: 'J2000',
          rowFormat: 'scope-star-v2-le',
          namesPath: 'names.json',
          bands: bandDefinitions.map((band) => ({
            ...band,
            indexPath: `${band.bandDir}/index.json`,
            totalRows: rows.length,
            namedRows: Object.keys(names).length,
          })),
        })
      }

      if (url.endsWith('/names.json')) {
        return jsonResponse(names)
      }

      for (const band of bandDefinitions) {
        if (url.endsWith(`/${band.bandDir}/index.json`)) {
          return jsonResponse({
            bandDir: band.bandDir,
            maxMagnitude: band.maxMagnitude,
            raStepDeg: band.raStepDeg,
            decStepDeg: band.decStepDeg,
            tiles: [
              {
                raIndex: Math.floor(centeredEquatorial.raDeg / band.raStepDeg),
                decIndex: Math.floor((centeredEquatorial.decDeg + 90) / band.decStepDeg),
                file: tileFile,
                count: rows.length,
              },
            ],
          })
        }

        if (url.endsWith(`/${band.bandDir}/${tileFile}`)) {
          return binaryResponse(tileBytes)
        }
      }

      throw new Error(`Unhandled scope dataset request: ${url}`)
    },
  }
}

function createPortraitScopeSelectionDataset() {
  const scenario = getDemoScenario('tokyo-iss')
  const centeredEquatorial = convertScopeHorizontalToEquatorial(
    {
      azimuthDeg: 0,
      elevationDeg: scenario.initialPitchDeg,
    },
    scenario.observer,
    scenario.observer.timestampMs,
  )
  const centerDecIndex = Math.floor(centeredEquatorial.decDeg + 90)
  const edgeTileFile = `r0_d${centerDecIndex + 8}.bin`
  const requestedUrls: string[] = []
  const manifest = {
    version: 1,
    kind: 'dev',
    sourceCatalog: 'dev-synthetic-from-stars-200',
    epoch: 'J2000',
    rowFormat: 'scope-star-v2-le',
    namesPath: 'names.json',
    bands: [
      {
        bandDir: 'mag6p5',
        maxMagnitude: 6.5,
        raStepDeg: 90,
        decStepDeg: 45,
        indexPath: 'mag6p5/index.json',
        totalRows: 0,
        namedRows: 0,
      },
      {
        bandDir: 'mag8p0',
        maxMagnitude: 8,
        raStepDeg: 45,
        decStepDeg: 30,
        indexPath: 'mag8p0/index.json',
        totalRows: 0,
        namedRows: 0,
      },
      {
        bandDir: 'mag9p5',
        maxMagnitude: 9.5,
        raStepDeg: 360,
        decStepDeg: 1,
        indexPath: 'mag9p5/index.json',
        totalRows: 2,
        namedRows: 0,
      },
      {
        bandDir: 'mag10p5',
        maxMagnitude: 10.5,
        raStepDeg: 11.25,
        decStepDeg: 11.25,
        indexPath: 'mag10p5/index.json',
        totalRows: 0,
        namedRows: 0,
      },
    ],
  }
  const index = {
    bandDir: 'mag9p5',
    maxMagnitude: 9.5,
    raStepDeg: 360,
    decStepDeg: 1,
    tiles: [
      {
        raIndex: 0,
        decIndex: centerDecIndex,
        file: `r0_d${centerDecIndex}.bin`,
        count: 1,
      },
      {
        raIndex: 0,
        decIndex: centerDecIndex + 8,
        file: edgeTileFile,
        count: 1,
      },
    ],
  }
  const emptyTileBytes = new Uint8Array(0)

  return {
    edgeTileFile,
    requestedUrls,
    fetcher: async (input: string | URL | Request) => {
      const url = String(input)
      requestedUrls.push(url)

      if (url.endsWith('/manifest.json')) {
        return jsonResponse(manifest)
      }

      if (url.endsWith('/names.json')) {
        return jsonResponse({})
      }

      if (url.endsWith('/mag9p5/index.json')) {
        return jsonResponse(index)
      }

      if (
        url.endsWith(`/${index.tiles[0]?.file}`) ||
        url.endsWith(`/${index.tiles[1]?.file}`)
      ) {
        return binaryResponse(emptyTileBytes)
      }

      return jsonResponse({
        bandDir: 'mag6p5',
        maxMagnitude: 6.5,
        raStepDeg: 90,
        decStepDeg: 45,
        tiles: [],
      })
    },
  }
}

function createMainViewSelectionDataset() {
  const scenario = getDemoScenario('tokyo-iss')
  const centeredEquatorial = convertScopeHorizontalToEquatorial(
    {
      azimuthDeg: 0,
      elevationDeg: scenario.initialPitchDeg,
    },
    scenario.observer,
    scenario.observer.timestampMs,
  )
  const centerDecIndex = Math.floor(centeredEquatorial.decDeg + 90)
  const edgeTileFile = `r0_d${centerDecIndex + 12}.bin`
  const requestedUrls: string[] = []
  const manifest = {
    version: 1,
    kind: 'dev',
    sourceCatalog: 'dev-synthetic-from-stars-200',
    epoch: 'J2000',
    rowFormat: 'scope-star-v2-le',
    namesPath: 'names.json',
    bands: [
      {
        bandDir: 'mag6p5',
        maxMagnitude: 6.5,
        raStepDeg: 90,
        decStepDeg: 45,
        indexPath: 'mag6p5/index.json',
        totalRows: 2,
        namedRows: 0,
      },
      {
        bandDir: 'mag8p0',
        maxMagnitude: 8,
        raStepDeg: 45,
        decStepDeg: 30,
        indexPath: 'mag8p0/index.json',
        totalRows: 2,
        namedRows: 0,
      },
      {
        bandDir: 'mag9p5',
        maxMagnitude: 9.5,
        raStepDeg: 360,
        decStepDeg: 1,
        indexPath: 'mag9p5/index.json',
        totalRows: 2,
        namedRows: 0,
      },
      {
        bandDir: 'mag10p5',
        maxMagnitude: 10.5,
        raStepDeg: 11.25,
        decStepDeg: 11.25,
        indexPath: 'mag10p5/index.json',
        totalRows: 2,
        namedRows: 0,
      },
    ],
  }
  const emptyTileBytes = new Uint8Array(0)

  return {
    edgeTileFile,
    requestedUrls,
    fetcher: async (input: string | URL | Request) => {
      const url = String(input)
      requestedUrls.push(url)

      if (url.endsWith('/manifest.json')) {
        return jsonResponse(manifest)
      }

      if (url.endsWith('/names.json')) {
        return jsonResponse({})
      }

      if (url.endsWith('/index.json')) {
        return jsonResponse({
          bandDir: 'mag9p5',
          maxMagnitude: 9.5,
          raStepDeg: 360,
          decStepDeg: 1,
          tiles: [
            {
              raIndex: 0,
              decIndex: centerDecIndex,
              file: `r0_d${centerDecIndex}.bin`,
              count: 1,
            },
            {
              raIndex: 0,
              decIndex: centerDecIndex + 12,
              file: edgeTileFile,
              count: 1,
            },
          ],
        })
      }

      if (
        url.endsWith(`/r0_d${centerDecIndex}.bin`) ||
        url.endsWith(`/${edgeTileFile}`)
      ) {
        return binaryResponse(emptyTileBytes)
      }

      throw new Error(`Unhandled scope selection request: ${url}`)
    },
  }
}

function encodeScopeRow({
  raMicroDeg,
  decMicroDeg,
  pmRaMasPerYear,
  pmDecMasPerYear,
  vMagMilli,
  bMinusVMilli,
  nameId,
}: {
  raMicroDeg: number
  decMicroDeg: number
  pmRaMasPerYear: number
  pmDecMasPerYear: number
  vMagMilli: number
  bMinusVMilli: number
  nameId: number
}) {
  const bytes = new Uint8Array(20)
  const view = new DataView(bytes.buffer)

  view.setUint32(0, raMicroDeg, true)
  view.setInt32(4, decMicroDeg, true)
  view.setInt16(8, pmRaMasPerYear, true)
  view.setInt16(10, pmDecMasPerYear, true)
  view.setInt16(12, vMagMilli, true)
  view.setInt16(14, bMinusVMilli, true)
  view.setUint32(16, nameId, true)

  return bytes
}

function encodeScopeRows(
  rows: Array<{
    raMicroDeg: number
    decMicroDeg: number
    pmRaMasPerYear: number
    pmDecMasPerYear: number
    vMagMilli: number
    bMinusVMilli: number
    nameId: number
  }>,
) {
  const bytes = new Uint8Array(rows.length * 20)

  rows.forEach((row, index) => {
    bytes.set(
      encodeScopeRow(row),
      index * 20,
    )
  })

  return bytes
}

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => payload,
  } satisfies Partial<Response> as Response
}

function binaryResponse(payload: Uint8Array) {
  const buffer = new ArrayBuffer(payload.byteLength)
  new Uint8Array(buffer).set(payload)

  return {
    ok: true,
    arrayBuffer: async () => buffer,
  } satisfies Partial<Response> as Response
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return {
    promise,
    resolve,
    reject,
  }
}

function stubCanvasContext() {
  let currentArc:
    | {
        x: number
        y: number
        radius: number
      }
    | null = null
  const context = {
    clearRect: vi.fn(() => {
      canvasRedrawCount += 1
      canvasFillCalls = []
      currentArc = null
    }),
    beginPath: vi.fn(() => {
      currentArc = null
    }),
    arc: vi.fn((x: number, y: number, radius: number) => {
      currentArc = { x, y, radius }
    }),
    fill: vi.fn(() => {
      if (!currentArc) {
        return
      }

      canvasFillCalls.push({
        ...currentArc,
        alpha: context.globalAlpha,
        fillStyle: context.fillStyle,
      })
    }),
    setTransform: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    globalAlpha: 1,
    fillStyle: '' as unknown,
  }

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => context,
  })
}

function getCanvasStars() {
  const starsByPoint = new Map<
    string,
    {
      x: number
      y: number
      radii: number[]
      alphas: number[]
    }
  >()

  for (const call of canvasFillCalls) {
    const key = `${call.x.toFixed(3)}:${call.y.toFixed(3)}`
    const existing = starsByPoint.get(key)

    if (existing) {
      existing.radii.push(call.radius)
      existing.alphas.push(call.alpha)
      continue
    }

    starsByPoint.set(key, {
      x: call.x,
      y: call.y,
      radii: [call.radius],
      alphas: [call.alpha],
    })
  }

  return [...starsByPoint.values()]
}

function getFarthestCanvasStar(
  stars: Array<{
    x: number
    y: number
    radii: number[]
    alphas: number[]
  }>,
  centerX: number,
  centerY: number,
) {
  return stars
    .map((star) => ({
      ...star,
      distanceFromCenterPx: Math.hypot(star.x - centerX, star.y - centerY),
    }))
    .sort((left, right) => right.distanceFromCenterPx - left.distanceFromCenterPx)[0] ?? null
}

function getScopeLensDiameterPxFromDom() {
  const lensFrame = container.querySelector('[data-testid="scope-lens-frame"]') as
    | HTMLDivElement
    | null

  return lensFrame ? Number.parseFloat(lensFrame.style.width) : Number.NaN
}

function getScopeLensRadiusPx() {
  return getScopeLensDiameterPxFromDom() / 2
}

function getScopeMarkerVisual(objectId: string) {
  return container.querySelector(
    `[data-testid="scope-bright-object-marker"][data-object-id="${objectId}"] > span`,
  ) as HTMLSpanElement | null
}

function getScopeMarkerSizePx(objectId: string) {
  const marker = getScopeMarkerVisual(objectId)
  return marker ? Number.parseFloat(marker.style.width) : Number.NaN
}

function getScopeMarkerOpacity(objectId: string) {
  const marker = getScopeMarkerVisual(objectId)
  return marker ? Number.parseFloat(marker.style.opacity) : Number.NaN
}

function getSkyObjectMarkerSizePx(objectId: string) {
  const marker = container.querySelector(
    `[data-testid="sky-object-marker"][data-object-id="${objectId}"] > span:last-child`,
  ) as HTMLSpanElement | null

  return marker ? Number.parseFloat(marker.style.width) : Number.NaN
}

function getSkyObjectMarkerPosition(objectId: string) {
  const marker = container.querySelector(
    `[data-testid="sky-object-marker"][data-object-id="${objectId}"]`,
  ) as HTMLElement | null

  if (!marker) {
    return null
  }

  return {
    x: Number.parseFloat(marker.style.left),
    y: Number.parseFloat(marker.style.top),
  }
}

function getSkyObjectMarkerPositionByLabel(label: string) {
  const marker = Array.from(
    container.querySelectorAll('[data-testid="sky-object-marker"]'),
  ).find((element) => element.getAttribute('aria-label')?.includes(label)) as HTMLElement | undefined

  if (!marker) {
    return null
  }

  return {
    x: Number.parseFloat(marker.style.left),
    y: Number.parseFloat(marker.style.top),
  }
}

function setStoredViewerSettings(overrides: Record<string, unknown>) {
  window.localStorage.setItem(
    VIEWER_SETTINGS_STORAGE_KEY,
    JSON.stringify({
      ...readViewerSettings(),
      ...overrides,
    }),
  )
}
