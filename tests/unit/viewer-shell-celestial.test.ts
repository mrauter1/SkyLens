import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewerRouteState } from '../../lib/permissions/coordinator'

const {
  mockRouterReplace,
  mockRequestStartupObserverState,
  mockStartObserverTracking,
  mockSubscribeToOrientationPose,
  mockFetchAircraftSnapshot,
  mockNormalizeAircraftObjects,
  mockGetAircraftAvailabilityMessage,
  mockNormalizeCelestialObjects,
  mockNormalizeVisibleStars,
  mockBuildVisibleConstellations,
  mockFetchSatelliteCatalog,
  mockNormalizeSatelliteObjects,
} = vi.hoisted(() => ({
  mockRouterReplace: vi.fn(),
  mockRequestStartupObserverState: vi.fn(),
  mockStartObserverTracking: vi.fn(),
  mockSubscribeToOrientationPose: vi.fn(),
  mockFetchAircraftSnapshot: vi.fn(),
  mockNormalizeAircraftObjects: vi.fn(),
  mockGetAircraftAvailabilityMessage: vi.fn(),
  mockNormalizeCelestialObjects: vi.fn(),
  mockNormalizeVisibleStars: vi.fn(),
  mockBuildVisibleConstellations: vi.fn(),
  mockFetchSatelliteCatalog: vi.fn(),
  mockNormalizeSatelliteObjects: vi.fn(),
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
  SettingsSheet: () => React.createElement('div', { 'data-testid': 'settings-sheet' }),
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
  normalizeAircraftObjects: mockNormalizeAircraftObjects,
  getAircraftAvailabilityMessage: mockGetAircraftAvailabilityMessage,
}))

vi.mock('../../lib/satellites/client', () => ({
  fetchSatelliteCatalog: mockFetchSatelliteCatalog,
  normalizeSatelliteObjects: mockNormalizeSatelliteObjects,
}))

import { ViewerShell } from '../../components/viewer/viewer-shell'

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
  })

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    mockRouterReplace.mockReset()
    mockRequestStartupObserverState.mockReset()
    mockStartObserverTracking.mockReset()
    mockSubscribeToOrientationPose.mockReset()
    mockFetchAircraftSnapshot.mockReset()
    mockNormalizeAircraftObjects.mockReset()
    mockGetAircraftAvailabilityMessage.mockReset()
    mockNormalizeCelestialObjects.mockReset()
    mockNormalizeVisibleStars.mockReset()
    mockBuildVisibleConstellations.mockReset()
    mockFetchSatelliteCatalog.mockReset()
    mockNormalizeSatelliteObjects.mockReset()
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
    mockNormalizeAircraftObjects.mockReturnValue([])
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
    mockNormalizeSatelliteObjects.mockReturnValue([])
  })

  afterEach(async () => {
    vi.useRealTimers()
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
  })

  it('shows the bottom dock from the centered celestial object metadata', async () => {
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

    expect(container.textContent).toContain('Bottom dock')
    expect(container.textContent).toContain('Sun')
    expect(container.textContent).toContain('Type')
    expect(container.textContent).toContain('Elevation')
    expect(container.textContent).toContain('Azimuth')
  })

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

    expect(container.textContent).toContain('Bottom dock')
    expect(container.textContent).toContain('Move until an object snaps here.')
  })

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

    expect(container.textContent).toContain('Bottom dock')
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

  it('renders a trail polyline for a trail-eligible object as scene time advances', async () => {
    const timerHarness = installWindowTimerHarness()

    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [],
    })
    mockNormalizeSatelliteObjects.mockReturnValue([
      {
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
    ])

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
      demoScenarioId: 'tokyo-iss',
    })

    const advanceSceneTime = timerHarness.getIntervalCallback(1_000)

    expect(container.querySelector('polyline')).toBeNull()

    await act(async () => {
      advanceSceneTime()
    })
    await flushEffects()

    await act(async () => {
      advanceSceneTime()
    })
    await flushEffects()

    expect(container.querySelector('polyline')).not.toBeNull()
  })

  it('suppresses the trail polyline when prefers-reduced-motion is enabled', async () => {
    const timerHarness = installWindowTimerHarness()
    setMatchMediaMatches(true)

    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [],
    })
    mockNormalizeSatelliteObjects.mockReturnValue([
      {
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

    expect(container.querySelector('polyline')).toBeNull()
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
    expect(container.textContent).toContain('Bottom dock')
    expect(container.textContent).toContain('Mars')
    expect(container.textContent).toContain('Angular distance 0.0°')
  })

  it('renders the satellite detail-card contract and ISS badge state', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [],
    })
    mockNormalizeSatelliteObjects.mockReturnValue([
      {
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

  it('renders the aircraft detail-card contract with Unknown flight fallback', async () => {
    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [],
    })
    mockNormalizeAircraftObjects.mockReturnValue([
      {
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
            headingCardinal: 'SE',
            speedKph: 864,
            rangeKm: 31.8,
            originCountry: 'Canada',
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
    expect(container.textContent).toContain('Heading')
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

    expect(mockRouterReplace).toHaveBeenCalledWith(expect.stringMatching(/entry=demo/))
    expect(container.textContent).toContain('Astronomy fallback active.')
    expect(container.textContent).toContain('Demo mode is active.')
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
    mockNormalizeSatelliteObjects.mockImplementation(() => {
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

  async function renderViewer(initialState: ViewerRouteState) {
    await act(async () => {
      root.render(React.createElement(ViewerShell, { initialState }))
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
      const callback = intervalCallbacks.get(delay)?.[0]

      if (!callback) {
        throw new Error(`No interval registered for ${delay}ms`)
      }

      return callback
    },
  }
}
