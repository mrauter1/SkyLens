import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildViewerHref, type ViewerRouteState } from '../../lib/permissions/coordinator'

const {
  mockRouterReplace,
  mockRequestStartupObserverState,
  mockStartObserverTracking,
  mockSubscribeToOrientationPose,
  mockRequestRearCameraStream,
  mockStopMediaStream,
  mockRequestOrientationPermission,
  mockFetchAircraftSnapshot,
  mockNormalizeAircraftObjects,
  mockGetAircraftAvailabilityMessage,
  mockFetchSatelliteCatalog,
  mockNormalizeSatelliteObjects,
} = vi.hoisted(() => ({
  mockRouterReplace: vi.fn(),
  mockRequestStartupObserverState: vi.fn(),
  mockStartObserverTracking: vi.fn(),
  mockSubscribeToOrientationPose: vi.fn(),
  mockRequestRearCameraStream: vi.fn(),
  mockStopMediaStream: vi.fn(),
  mockRequestOrientationPermission: vi.fn(),
  mockFetchAircraftSnapshot: vi.fn(),
  mockNormalizeAircraftObjects: vi.fn(),
  mockGetAircraftAvailabilityMessage: vi.fn(),
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
  SettingsSheet: () =>
    React.createElement(
      'button',
      {
        type: 'button',
        'data-testid': 'settings-sheet',
      },
      'Settings',
    ),
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
    requestOrientationPermission: mockRequestOrientationPermission,
  }
})

vi.mock('../../lib/projection/camera', async () => {
  const actual = await vi.importActual<typeof import('../../lib/projection/camera')>(
    '../../lib/projection/camera',
  )

  return {
    ...actual,
    requestRearCameraStream: mockRequestRearCameraStream,
    stopMediaStream: mockStopMediaStream,
  }
})

vi.mock('../../lib/satellites/client', () => ({
  fetchSatelliteCatalog: mockFetchSatelliteCatalog,
  normalizeSatelliteObjects: mockNormalizeSatelliteObjects,
}))

vi.mock('../../lib/aircraft/client', () => ({
  fetchAircraftSnapshot: mockFetchAircraftSnapshot,
  normalizeAircraftObjects: mockNormalizeAircraftObjects,
  getAircraftAvailabilityMessage: mockGetAircraftAvailabilityMessage,
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

const CAMERA_STREAM = {
  getTracks: vi.fn(() => []),
} as unknown as MediaStream

describe('ViewerShell startup gating', () => {
  let container: HTMLDivElement
  let root: Root

  beforeAll(() => {
    // React 19 warns unless the test environment opts into act-aware updates.
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
  })

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    mockRouterReplace.mockReset()
    mockRequestStartupObserverState.mockReset()
    mockStartObserverTracking.mockReset()
    mockSubscribeToOrientationPose.mockReset()
    mockRequestRearCameraStream.mockReset()
    mockStopMediaStream.mockReset()
    mockFetchAircraftSnapshot.mockReset()
    mockRequestOrientationPermission.mockReset()
    mockNormalizeAircraftObjects.mockReset()
    mockGetAircraftAvailabilityMessage.mockReset()
    mockFetchSatelliteCatalog.mockReset()
    mockNormalizeSatelliteObjects.mockReset()
    SENSOR_CONTROLLER.stop.mockReset()
    SENSOR_CONTROLLER.recenter.mockReset()
    TRACKER.stop.mockReset()

    mockRequestStartupObserverState.mockResolvedValue(LIVE_OBSERVER_FIXTURE)
    mockStartObserverTracking.mockReturnValue(TRACKER)
    mockSubscribeToOrientationPose.mockReturnValue(SENSOR_CONTROLLER)
    mockRequestRearCameraStream.mockResolvedValue(CAMERA_STREAM)
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
    mockFetchSatelliteCatalog.mockResolvedValue({
      fetchedAt: '2026-03-26T00:00:00.000Z',
      expiresAt: '2026-03-26T06:00:00.000Z',
      satellites: [],
    })
    mockNormalizeSatelliteObjects.mockReturnValue([])
    mockRequestOrientationPermission.mockResolvedValue('granted')
  })

  afterEach(async () => {
    vi.useRealTimers()

    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('suppresses all startup side effects while the live route is still blocked preflight', async () => {
    await renderViewer({
      entry: 'live',
      location: 'unknown',
      camera: 'unknown',
      orientation: 'unknown',
    })

    expect(mockRequestStartupObserverState).not.toHaveBeenCalled()
    expect(mockStartObserverTracking).not.toHaveBeenCalled()
    expect(mockRequestRearCameraStream).not.toHaveBeenCalled()
    expect(mockSubscribeToOrientationPose).not.toHaveBeenCalled()
    expect(mockFetchAircraftSnapshot).not.toHaveBeenCalled()
    expect(mockFetchSatelliteCatalog).not.toHaveBeenCalled()
  })

  it('keeps location and orientation startup live in verified non-camera fallback', async () => {
    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'denied',
      orientation: 'granted',
    })

    expect(mockRequestStartupObserverState).toHaveBeenCalledTimes(1)
    expect(mockStartObserverTracking).toHaveBeenCalledTimes(1)
    expect(mockSubscribeToOrientationPose).toHaveBeenCalledTimes(1)
    expect(mockRequestRearCameraStream).not.toHaveBeenCalled()
    expect(mockFetchAircraftSnapshot).toHaveBeenCalledTimes(1)
    expect(mockFetchSatelliteCatalog).toHaveBeenCalledTimes(1)
  })

  it('keeps location and camera startup live in verified manual-pan fallback', async () => {
    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'granted',
      orientation: 'denied',
    })

    expect(mockRequestStartupObserverState).toHaveBeenCalledTimes(1)
    expect(mockStartObserverTracking).toHaveBeenCalledTimes(1)
    expect(mockFetchAircraftSnapshot).toHaveBeenCalledTimes(1)
    expect(mockRequestRearCameraStream).toHaveBeenCalledTimes(1)
    expect(mockSubscribeToOrientationPose).not.toHaveBeenCalled()
  })

  it('keeps the viewer privacy reassurance copy visible during the blocked preflight shell', async () => {
    await renderViewer({
      entry: 'live',
      location: 'unknown',
      camera: 'unknown',
      orientation: 'unknown',
    })

    expect(container.textContent).toContain('Privacy reassurance')
    expect(container.textContent).toContain('Camera stays on your device.')
    expect(container.textContent).toContain(
      'Location is used only to calculate what is above you right now.',
    )
  })

  it('supports keyboard panning in manual mode for desktop fallback', async () => {
    await renderViewer({
      entry: 'demo',
      location: 'unavailable',
      camera: 'unavailable',
      orientation: 'unavailable',
      demoScenarioId: 'sf-evening',
    })

    const stage = container.querySelector('[aria-label="Sky viewer stage"]') as
      | HTMLDivElement
      | null

    expect(stage).not.toBeNull()
    expect(container.textContent).toContain('Yaw 0°')

    await act(async () => {
      stage!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
        }),
      )
    })

    expect(container.textContent).toContain('Yaw 3°')
  })

  it('recenters manual mode only after a second tap lands within the double-tap window', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-26T00:00:00.000Z'))

    await renderViewer({
      entry: 'demo',
      location: 'unavailable',
      camera: 'unavailable',
      orientation: 'unavailable',
      demoScenarioId: 'sf-evening',
    })

    const stage = container.querySelector('[aria-label="Sky viewer stage"]') as
      | HTMLDivElement
      | null

    expect(stage).not.toBeNull()

    Object.defineProperties(stage!, {
      setPointerCapture: {
        configurable: true,
        value: vi.fn(),
      },
      releasePointerCapture: {
        configurable: true,
        value: vi.fn(),
      },
      hasPointerCapture: {
        configurable: true,
        value: vi.fn(() => true),
      },
    })

    await act(async () => {
      stage!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
        }),
      )
    })

    expect(container.textContent).toContain('Yaw 3°')

    await act(async () => {
      dispatchPointerEvent(stage!, 'pointerdown', {
        pointerId: 1,
        clientX: 120,
        clientY: 160,
      })
      dispatchPointerEvent(stage!, 'pointerup', {
        pointerId: 1,
        clientX: 120,
        clientY: 160,
      })
    })

    expect(container.textContent).toContain('Yaw 3°')

    await act(async () => {
      vi.advanceTimersByTime(200)
      dispatchPointerEvent(stage!, 'pointerdown', {
        pointerId: 2,
        clientX: 120,
        clientY: 160,
      })
      dispatchPointerEvent(stage!, 'pointerup', {
        pointerId: 2,
        clientX: 120,
        clientY: 160,
      })
    })

    expect(container.textContent).toContain('Yaw 0°')
  })

  it('collapses mobile chrome behind the bottom trigger and restores it when opened', async () => {
    await renderViewer({
      entry: 'demo',
      location: 'unavailable',
      camera: 'unavailable',
      orientation: 'unavailable',
      demoScenarioId: 'sf-evening',
    })

    const mobileTrigger = container.querySelector(
      '[data-testid="mobile-viewer-overlay-trigger"]',
    ) as HTMLButtonElement | null

    expect(mobileTrigger).not.toBeNull()
    expect(mobileTrigger?.getAttribute('aria-controls')).toBe('mobile-viewer-overlay')
    expect(mobileTrigger?.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('[data-testid="mobile-viewer-overlay"]')).toBeNull()
    expect(container.querySelector('[data-testid="mobile-viewer-header"]')).toBeNull()

    await act(async () => {
      mobileTrigger!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const mobileOverlay = container.querySelector(
      '[data-testid="mobile-viewer-overlay"]',
    ) as HTMLElement | null
    const mobileOverlayBackdrop = container.querySelector(
      '[data-testid="mobile-viewer-overlay-backdrop"]',
    ) as HTMLButtonElement | null
    const mobileHeader = container.querySelector(
      '[data-testid="mobile-viewer-header"]',
    ) as HTMLElement | null

    expect(mobileOverlay).not.toBeNull()
    expect(mobileOverlayBackdrop).not.toBeNull()
    expect(mobileHeader).not.toBeNull()
    expect(mobileHeader?.textContent).toContain('SkyLens')
    expect(mobileHeader?.textContent).toContain('Demo viewer')
    expect(mobileOverlay?.querySelector('[data-testid="settings-sheet"]')).not.toBeNull()
    expect(mobileOverlay?.textContent).toContain('Location')
    expect(mobileOverlay?.textContent).toContain('Camera')
    expect(mobileOverlay?.textContent).toContain('Motion')
    expect(mobileOverlay?.textContent).toContain('Celestial layer')
    expect(mobileOverlay?.textContent).toContain('Privacy reassurance')

    const closeButton = Array.from(mobileOverlay!.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Close'),
    )

    expect(closeButton).toBeDefined()

    await act(async () => {
      closeButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.querySelector('[data-testid="mobile-viewer-overlay"]')).toBeNull()
    expect(container.querySelector('[data-testid="mobile-viewer-header"]')).toBeNull()
  })

  it('closes mobile overlay on backdrop click without closing from inner panel clicks', async () => {
    await renderViewer({
      entry: 'demo',
      location: 'unavailable',
      camera: 'unavailable',
      orientation: 'unavailable',
      demoScenarioId: 'sf-evening',
    })

    const mobileTrigger = container.querySelector(
      '[data-testid="mobile-viewer-overlay-trigger"]',
    ) as HTMLButtonElement | null

    expect(mobileTrigger).not.toBeNull()

    await act(async () => {
      mobileTrigger!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const mobileOverlay = container.querySelector(
      '[data-testid="mobile-viewer-overlay"]',
    ) as HTMLElement | null
    const backdrop = container.querySelector(
      '[data-testid="mobile-viewer-overlay-backdrop"]',
    ) as HTMLButtonElement | null
    const settingsButton = mobileOverlay?.querySelector(
      '[data-testid="settings-sheet"]',
    ) as HTMLButtonElement | null

    expect(mobileOverlay).not.toBeNull()
    expect(backdrop).not.toBeNull()
    expect(settingsButton).not.toBeNull()

    await act(async () => {
      settingsButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.querySelector('[data-testid="mobile-viewer-overlay"]')).not.toBeNull()

    await act(async () => {
      backdrop!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.querySelector('[data-testid="mobile-viewer-overlay"]')).toBeNull()
  })

  it('keeps blocked-state actions reachable inside the expanded mobile overlay', async () => {
    await renderViewer({
      entry: 'live',
      location: 'unknown',
      camera: 'unknown',
      orientation: 'unknown',
    })

    const mobileTrigger = container.querySelector(
      '[data-testid="mobile-viewer-overlay-trigger"]',
    ) as HTMLButtonElement | null

    expect(mobileTrigger).not.toBeNull()

    await act(async () => {
      mobileTrigger!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const mobileOverlay = container.querySelector(
      '[data-testid="mobile-viewer-overlay"]',
    ) as HTMLElement | null

    expect(mobileOverlay).not.toBeNull()
    expect(mobileOverlay?.querySelector('[data-testid="settings-sheet"]')).not.toBeNull()
    expect(mobileOverlay?.textContent).toContain('Retry permissions')
    expect(mobileOverlay?.textContent).toContain('Try demo mode')
  })

  it('keeps the expanded mobile overlay inside the safe viewport bounds', async () => {
    await renderViewer({
      entry: 'demo',
      location: 'unavailable',
      camera: 'unavailable',
      orientation: 'unavailable',
      demoScenarioId: 'sf-evening',
    })

    const mobileTrigger = container.querySelector(
      '[data-testid="mobile-viewer-overlay-trigger"]',
    ) as HTMLButtonElement | null

    expect(mobileTrigger).not.toBeNull()

    await act(async () => {
      mobileTrigger!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const mobileOverlay = container.querySelector(
      '[data-testid="mobile-viewer-overlay"]',
    ) as HTMLElement | null
    const mobileOverlayWrapper = mobileOverlay?.parentElement as HTMLElement | null

    expect(mobileOverlay).not.toBeNull()
    expect(mobileOverlayWrapper).not.toBeNull()
    expect(mobileOverlayWrapper?.className).toContain(
      'pt-[calc(1rem+env(safe-area-inset-top))]',
    )
    expect(mobileOverlayWrapper?.className).toContain(
      'pb-[calc(1rem+env(safe-area-inset-bottom))]',
    )
    expect(mobileOverlayWrapper?.className).not.toContain('sm:hidden')
    expect(mobileOverlay?.className).toContain('max-h-full')
  })

  it('surfaces motion recovery guidance and retries orientation permission', async () => {
    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'granted',
      orientation: 'denied',
    })

    expect(container.textContent).toContain('Motion recovery')
    expect(container.textContent).toContain('iOS Settings → Safari → Motion & Orientation Access')

    const enableMotionButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Enable motion'),
    )

    expect(enableMotionButton).toBeDefined()

    await act(async () => {
      enableMotionButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    expect(mockRequestOrientationPermission).toHaveBeenCalledTimes(1)
    expect(mockRouterReplace).toHaveBeenCalledTimes(1)
    expect(mockRouterReplace).toHaveBeenCalledWith(
      buildViewerHref({
        entry: 'live',
        location: 'granted',
        camera: 'granted',
        orientation: 'granted',
      }),
    )
    expect(container.textContent).not.toContain('Motion recovery')
  })

  it('keeps motion recovery visible and syncs denied retry state to the route', async () => {
    mockRequestOrientationPermission.mockResolvedValueOnce('denied')

    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'granted',
      orientation: 'denied',
    })

    const enableMotionButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Enable motion'),
    )

    expect(enableMotionButton).toBeDefined()

    await act(async () => {
      enableMotionButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    expect(mockRequestOrientationPermission).toHaveBeenCalledTimes(1)
    expect(mockRouterReplace).toHaveBeenCalledTimes(1)
    expect(mockRouterReplace).toHaveBeenCalledWith(
      buildViewerHref({
        entry: 'live',
        location: 'granted',
        camera: 'granted',
        orientation: 'denied',
      }),
    )
    expect(container.textContent).toContain('Motion recovery')
    expect(container.textContent).toContain(
      'Motion access is still denied. Check iOS Settings → Safari → Motion & Orientation Access, then retry.',
    )
  })

  it('preserves the desktop viewer header and desktop content composition', async () => {
    await renderViewer({
      entry: 'demo',
      location: 'unavailable',
      camera: 'unavailable',
      orientation: 'unavailable',
      demoScenarioId: 'sf-evening',
    })

    const desktopHeader = container.querySelector(
      '[data-testid="desktop-viewer-header"]',
    ) as HTMLElement | null
    const desktopContent = container.querySelector(
      '[data-testid="desktop-viewer-content"]',
    ) as HTMLElement | null

    expect(desktopHeader).not.toBeNull()
    expect(desktopHeader?.textContent).toContain('SkyLens')
    expect(desktopHeader?.querySelector('[data-testid="settings-sheet"]')).not.toBeNull()
    expect(desktopContent).not.toBeNull()
    expect(desktopContent?.textContent).toContain('Bottom dock')
    expect(desktopContent?.textContent).toContain('Privacy reassurance')
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
