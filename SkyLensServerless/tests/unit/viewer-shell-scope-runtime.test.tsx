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

describe('ViewerShell scope runtime', () => {
  let container: HTMLDivElement
  let root: Root
  let originalFetch: typeof global.fetch | undefined
  let originalGetBoundingClientRect: PropertyDescriptor | undefined
  let stageBounds = {
    width: 390,
    height: 844,
  }

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

  it('filters marginal deep stars at weak optics and brightens them under stronger optics', async () => {
    const dataset = createMultiBandScopeDataset([
      {
        azimuthDeg: 0,
        elevationDeg: getDemoScenario('tokyo-iss').initialPitchDeg,
        vMag: 6.15,
      },
    ])
    global.fetch = vi.fn().mockImplementation(dataset.fetcher) as typeof fetch

    setStoredViewerSettings({
      scopeModeEnabled: true,
      scopeOptics: {
        apertureMm: 40,
        magnificationX: 50,
        transparencyPct: 40,
      },
      labelDisplayMode: 'center_only',
    })

    await renderViewer()

    expect(getCanvasStars()).toHaveLength(0)

    await rerenderViewerWithSettings({
      scopeModeEnabled: true,
      scopeOptics: {
        apertureMm: 240,
        magnificationX: 120,
        transparencyPct: 95,
      },
      labelDisplayMode: 'center_only',
    })

    const brightStars = getCanvasStars()

    expect(brightStars).toHaveLength(1)
    expect(Math.max(...brightStars[0].radii)).toBeGreaterThan(3)
    expect(Math.max(...brightStars[0].alphas)).toBeGreaterThan(0.7)
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

    const lensCenterPx = 113.1
    const lowMagnificationStars = getCanvasStars()
    const lowFarthestStar = getFarthestCanvasStar(lowMagnificationStars, lensCenterPx, lensCenterPx)
    const lowHaloRadius = Math.max(...(lowFarthestStar?.radii ?? [0]))

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
    const highHaloRadius = Math.max(...(highFarthestStar?.radii ?? [0]))

    expect(lowMagnificationStars).toHaveLength(2)
    expect(highMagnificationStars).toHaveLength(2)
    expect(highFarthestStar).not.toBeNull()
    expect(lowFarthestStar).not.toBeNull()
    expect(highFarthestStar!.distanceFromCenterPx).toBeGreaterThan(
      lowFarthestStar!.distanceFromCenterPx,
    )
    expect(highHaloRadius).toBeGreaterThan(0)
    expect(highHaloRadius).toBeLessThan(lowHaloRadius * 2)
  })

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
    vMagMilli: 5800,
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
  return {
    ok: true,
    arrayBuffer: async () => payload.buffer.slice(0),
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

function setStoredViewerSettings(overrides: Record<string, unknown>) {
  window.localStorage.setItem(
    VIEWER_SETTINGS_STORAGE_KEY,
    JSON.stringify({
      ...readViewerSettings(),
      ...overrides,
    }),
  )
}
