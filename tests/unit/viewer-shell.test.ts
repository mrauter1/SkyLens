import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildViewerHref, type ViewerRouteState } from '../../lib/permissions/coordinator'
import {
  VIEWER_SETTINGS_STORAGE_KEY,
  readViewerSettings,
  writeViewerSettings,
} from '../../lib/viewer/settings'

const {
  mockRouterReplace,
  mockSettingsSheetProps,
  mockRequestStartupObserverState,
  mockStartObserverTracking,
  mockSubscribeToOrientationPose,
  mockRequestRearCameraStream,
  mockStopMediaStream,
  mockRequestOrientationPermission,
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
  mockRequestRearCameraStream: vi.fn(),
  mockStopMediaStream: vi.fn(),
  mockRequestOrientationPermission: vi.fn(),
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

    return React.createElement(
      'button',
      {
        type: 'button',
        'data-testid': 'settings-sheet',
      },
      'Settings',
    )
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
}))

vi.mock('../../lib/aircraft/client', () => ({
  fetchAircraftSnapshot: mockFetchAircraftSnapshot,
  getAircraftAvailabilityMessage: mockGetAircraftAvailabilityMessage,
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
  setCalibration: vi.fn(),
}

const TRACKER = {
  stop: vi.fn(),
}

const CAMERA_STREAM = {
  getTracks: vi.fn(() => []),
  getVideoTracks: vi.fn(() => []),
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
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: vi.fn(async () => []),
      },
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: createMatchMediaStub(false),
    })
    window.localStorage.clear()

    mockRouterReplace.mockReset()
    mockSettingsSheetProps.mockReset()
    mockRequestStartupObserverState.mockReset()
    mockStartObserverTracking.mockReset()
    mockSubscribeToOrientationPose.mockReset()
    mockRequestRearCameraStream.mockReset()
    mockStopMediaStream.mockReset()
    mockFetchAircraftSnapshot.mockReset()
    mockRequestOrientationPermission.mockReset()
    mockGetAircraftAvailabilityMessage.mockReset()
    mockFetchSatelliteCatalog.mockReset()
    mockResolveAircraftMotionObjects.mockReset()
    mockResolveSatelliteMotionObjects.mockReset()
    SENSOR_CONTROLLER.stop.mockReset()
    SENSOR_CONTROLLER.recenter.mockReset()
    SENSOR_CONTROLLER.setCalibration.mockReset()
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
    mockGetAircraftAvailabilityMessage.mockReturnValue(null)
    mockFetchSatelliteCatalog.mockResolvedValue({
      fetchedAt: '2026-03-26T00:00:00.000Z',
      expiresAt: '2026-03-26T06:00:00.000Z',
      satellites: [],
    })
    mockResolveAircraftMotionObjects.mockReturnValue([])
    mockResolveSatelliteMotionObjects.mockReturnValue([])
    mockRequestOrientationPermission.mockResolvedValue('granted')
  })

  afterEach(async () => {
    vi.useRealTimers()

    await act(async () => {
      root.unmount()
    })
    container.remove()
    window.localStorage.clear()
  })

  it('suppresses all startup side effects before Start AR is pressed', async () => {
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

  it('blocks live startup behind a secure context requirement', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: false,
    })

    await renderViewer({
      entry: 'live',
      location: 'unknown',
      camera: 'unknown',
      orientation: 'unknown',
    })

    const startArButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Start AR'),
    )

    expect(container.textContent).toContain('Live AR requires a secure context.')
    expect(container.textContent).toContain('HTTPS or localhost')
    expect(startArButton).toBeUndefined()
    expect(mockRequestStartupObserverState).not.toHaveBeenCalled()
    expect(mockRequestRearCameraStream).not.toHaveBeenCalled()
    expect(mockSubscribeToOrientationPose).not.toHaveBeenCalled()
  })

  it('requests motion, then camera, then location when Start AR is pressed in-view', async () => {
    const callOrder: string[] = []

    mockRequestOrientationPermission.mockImplementation(async () => {
      callOrder.push('orientation')
      return 'granted'
    })
    mockRequestRearCameraStream.mockImplementation(async () => {
      callOrder.push('camera')
      return CAMERA_STREAM
    })
    mockRequestStartupObserverState.mockImplementation(async () => {
      callOrder.push('location')
      return LIVE_OBSERVER_FIXTURE
    })

    await renderViewer({
      entry: 'live',
      location: 'unknown',
      camera: 'unknown',
      orientation: 'unknown',
    })

    const startArButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Start AR'),
    )

    expect(startArButton).toBeDefined()

    await act(async () => {
      startArButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    expect(callOrder).toEqual(['orientation', 'camera', 'location'])
    expect(mockRequestOrientationPermission).toHaveBeenCalledTimes(1)
    expect(mockRequestRearCameraStream).toHaveBeenCalledTimes(1)
    expect(mockRequestStartupObserverState).toHaveBeenCalledTimes(1)
  })

  it(
    'keeps location and orientation startup live in verified non-camera fallback',
    async () => {
      await renderViewer({
        entry: 'live',
        location: 'granted',
        camera: 'denied',
        orientation: 'granted',
      })

      expect(mockRequestStartupObserverState).toHaveBeenCalledTimes(1)
      expect(mockStartObserverTracking).toHaveBeenCalledTimes(1)
      expect(mockSubscribeToOrientationPose.mock.calls.length).toBeGreaterThanOrEqual(1)
      expect(mockRequestRearCameraStream).not.toHaveBeenCalled()
      expect(mockFetchAircraftSnapshot).toHaveBeenCalledTimes(1)
      expect(mockFetchSatelliteCatalog).toHaveBeenCalledTimes(1)
    },
    10_000,
  )

  it('keeps location and camera startup live in verified manual-pan fallback', async () => {
    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'granted',
      orientation: 'denied',
    })
    await flushEffects()

    expect(mockRequestStartupObserverState).toHaveBeenCalledTimes(1)
    expect(mockStartObserverTracking).toHaveBeenCalledTimes(1)
    expect(mockFetchAircraftSnapshot).toHaveBeenCalledTimes(1)
    expect(mockRequestRearCameraStream.mock.calls.length).toBeGreaterThanOrEqual(1)
    expect(mockSubscribeToOrientationPose).not.toHaveBeenCalled()
  })

  it('reopens the live camera when the picker switches back to auto rear camera', async () => {
    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'granted',
      orientation: 'granted',
    })

    const latestSettingsProps = () =>
      mockSettingsSheetProps.mock.calls.at(-1)?.[0] as
        | {
            onSelectedCameraDeviceChange?: (deviceId: string) => void
          }
        | undefined

    expect(mockRequestRearCameraStream).toHaveBeenCalledTimes(1)
    expect(latestSettingsProps()?.onSelectedCameraDeviceChange).toBeTypeOf('function')

    await act(async () => {
      latestSettingsProps()?.onSelectedCameraDeviceChange?.('rear-tele')
    })
    await flushEffects()

    expect(mockRequestRearCameraStream).toHaveBeenCalledTimes(2)

    await act(async () => {
      latestSettingsProps()?.onSelectedCameraDeviceChange?.('')
    })
    await flushEffects()

    expect(mockRequestRearCameraStream).toHaveBeenCalledTimes(3)
  })

  it('hydrates a persisted manual observer without re-requesting location on denied deep links', async () => {
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
        likelyVisibleOnly: true,
        labelDisplayMode: 'center_only',
        headingOffsetDeg: 0,
        pitchOffsetDeg: 0,
        verticalFovAdjustmentDeg: 0,
        selectedCameraDeviceId: null,
        manualObserver: {
          lat: 34.0522,
          lon: -118.2437,
          altMeters: 120,
        },
        onboardingCompleted: true,
      }),
    )

    await renderViewer({
      entry: 'live',
      location: 'denied',
      camera: 'granted',
      orientation: 'granted',
    })

    expect(mockRequestStartupObserverState).not.toHaveBeenCalled()
    expect(mockStartObserverTracking).not.toHaveBeenCalled()
    expect(mockRequestRearCameraStream.mock.calls.length).toBeGreaterThanOrEqual(1)
    expect(mockSubscribeToOrientationPose.mock.calls.length).toBeGreaterThanOrEqual(1)
    expect(container.textContent).toContain('Location: Manual observer')
  })

  it('keeps the viewer privacy reassurance copy visible before live startup begins', async () => {
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
    expect(container.querySelector('[data-testid="mobile-viewer-overlay-scroll-region"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="mobile-viewer-overlay-shell"]')).toBeNull()
    expect(mobileOverlay?.querySelector('[data-testid="settings-sheet"]')).not.toBeNull()
    expect(mobileOverlay?.textContent).toContain('Start AR')
    expect(mobileOverlay?.textContent).toContain('Try demo mode')
  })

  it('shows first-use mobile actions for permissions and alignment while keeping viewer access', async () => {
    await renderViewer({
      entry: 'live',
      location: 'unknown',
      camera: 'unknown',
      orientation: 'unknown',
    })

    const quickActions = container.querySelector(
      '[data-testid="mobile-viewer-quick-actions"]',
    ) as HTMLElement | null
    const openViewerButton = container.querySelector(
      '[data-testid="mobile-viewer-overlay-trigger"]',
    ) as HTMLButtonElement | null
    const permissionButton = container.querySelector(
      '[data-testid="mobile-permission-action"]',
    ) as HTMLButtonElement | null
    const alignButton = container.querySelector(
      '[data-testid="mobile-align-action"]',
    ) as HTMLButtonElement | null

    expect(quickActions).not.toBeNull()
    expect(openViewerButton?.textContent).toContain('Open viewer')
    expect(permissionButton?.textContent).toContain('Enable camera and motion')
    expect(alignButton?.textContent).toContain('Align')
    expect(alignButton?.disabled).toBe(false)
    expect(container.querySelector('[data-testid="mobile-viewer-overlay"]')).toBeNull()
  })

  it('keeps Align visible as the entry point before a live sample exists even after permissions are granted', async () => {
    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'granted',
      orientation: 'granted',
    })

    const openViewerButton = container.querySelector(
      '[data-testid="mobile-viewer-overlay-trigger"]',
    ) as HTMLButtonElement | null
    const permissionButton = container.querySelector(
      '[data-testid="mobile-permission-action"]',
    ) as HTMLButtonElement | null
    const alignButton = container.querySelector(
      '[data-testid="mobile-align-action"]',
    ) as HTMLButtonElement | null

    expect(openViewerButton?.textContent).toContain('Open viewer')
    expect(permissionButton).toBeNull()
    expect(alignButton?.textContent).toContain('Align')
    expect(alignButton?.disabled).toBe(false)
    expect(container.querySelector('[data-testid="mobile-viewer-overlay"]')).toBeNull()
  })

  it('surfaces live-panel blocker copy and a disabled start action before the first motion sample', async () => {
    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'granted',
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

    expect(container.querySelector('[data-testid="alignment-instructions-panel"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="alignment-focus-instruction"]')).toBeNull()
    expect(container.querySelector('[data-testid="alignment-crosshair-button"]')).toBeNull()
    expect(container.querySelector('[data-testid="alignment-start-action"]')).not.toBeNull()
    expect(
      (container.querySelector('[data-testid="alignment-start-action"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(container.textContent).toMatch(
      /Align stays disabled until live motion data is ready\. SkyLens will keep .* as the next target\./,
    )
    expect(container.textContent).toMatch(
      /Wait for live motion data, then press the middle of the screen to align to .*?\./,
    )
  })

  it('keeps Start alignment visible if the mobile viewer overlay is reopened while alignment is open', async () => {
    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'granted',
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

    const openViewerButton = container.querySelector(
      '[data-testid="mobile-viewer-overlay-trigger"]',
    ) as HTMLButtonElement | null

    expect(openViewerButton).not.toBeNull()

    await act(async () => {
      openViewerButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    const startAlignmentButton = container.querySelector(
      '[data-testid="alignment-start-action"]',
    ) as HTMLButtonElement | null

    expect(container.querySelector('[data-testid="mobile-viewer-overlay"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="alignment-instructions-panel"]')).not.toBeNull()
    expect(startAlignmentButton).not.toBeNull()
    expect(startAlignmentButton?.disabled).toBe(true)
    expect(container.querySelector('[data-testid="alignment-crosshair-button"]')).toBeNull()
  })

  it('routes the mobile align action through the panel before entering alignment focus', async () => {
    mockSubscribeToOrientationPose.mockImplementationOnce((onPose: (state: unknown) => void) => {
      onPose({
        pose: {
          yawDeg: 0,
          pitchDeg: 0,
          rollDeg: 0,
          quaternion: [0, 0, 0, 1],
          alignmentHealth: 'fair',
          mode: 'sensor',
        },
        sample: {
          source: 'absolute-sensor',
          absolute: true,
          needsCalibration: false,
          timestampMs: Date.UTC(2026, 2, 26, 0, 45, 6),
          headingDeg: 0,
          pitchDeg: 0,
          rollDeg: 0,
          quaternion: [0, 0, 0, 1],
          rawQuaternion: [0, 0, 0, 1],
          rawSample: {
            source: 'absolute-sensor',
            localFrame: 'screen',
            absolute: true,
            timestampMs: Date.UTC(2026, 2, 26, 0, 45, 6),
            worldFromLocal: [
              [1, 0, 0],
              [0, 1, 0],
              [0, 0, 1],
            ],
          },
        },
        history: [],
        orientationSource: 'absolute-sensor',
        orientationAbsolute: true,
        orientationNeedsCalibration: false,
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
      camera: 'granted',
      orientation: 'granted',
    })

    const permissionButton = container.querySelector(
      '[data-testid="mobile-permission-action"]',
    ) as HTMLButtonElement | null
    const alignButton = container.querySelector(
      '[data-testid="mobile-align-action"]',
    ) as HTMLButtonElement | null

    expect(permissionButton).toBeNull()
    expect(alignButton).not.toBeNull()
    expect(alignButton?.disabled).toBe(false)
    expect(readViewerSettings().poseCalibration.calibrated).toBe(false)

    const calibrationCallsBefore = SENSOR_CONTROLLER.setCalibration.mock.calls.length

    await act(async () => {
      alignButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    const startAlignmentButton = container.querySelector(
      '[data-testid="alignment-start-action"]',
    ) as HTMLButtonElement | null

    expect(container.querySelector('[data-testid="mobile-viewer-overlay"]')).toBeNull()
    expect(container.querySelector('[data-testid="mobile-viewer-overlay-trigger"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="mobile-permission-action"]')).toBeNull()
    expect(readViewerSettings().poseCalibration.calibrated).toBe(false)
    expect(SENSOR_CONTROLLER.setCalibration.mock.calls.length).toBe(calibrationCallsBefore)
    expect(container.querySelector('[data-testid="mobile-align-action"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="alignment-instructions-panel"]')).not.toBeNull()
    expect(startAlignmentButton).not.toBeNull()
    expect(startAlignmentButton?.disabled).toBe(false)
    expect(container.querySelector('[data-testid="alignment-crosshair-button"]')).toBeNull()
    expect(container.querySelector('[data-testid="alignment-focus-instruction"]')).toBeNull()

    await act(async () => {
      startAlignmentButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    expect(container.querySelector('[data-testid="mobile-viewer-overlay"]')).toBeNull()
    expect(container.querySelector('[data-testid="mobile-viewer-overlay-trigger"]')).toBeNull()
    expect(container.querySelector('[data-testid="mobile-permission-action"]')).toBeNull()
    expect(readViewerSettings().poseCalibration.calibrated).toBe(false)
    expect(SENSOR_CONTROLLER.setCalibration.mock.calls.length).toBe(calibrationCallsBefore)
    expect(container.querySelector('[data-testid="mobile-align-action"]')).toBeNull()
    expect(container.querySelector('[data-testid="alignment-instructions-panel"]')).toBeNull()
    expect(container.querySelector('[data-testid="alignment-crosshair-button"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="alignment-focus-instruction"]')).not.toBeNull()
  })

  it('closes the alignment view explicitly and restores the mobile Align action', async () => {
    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'granted',
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

    const closeButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Close'),
    ) as HTMLButtonElement | undefined

    expect(closeButton).toBeDefined()

    await act(async () => {
      closeButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    expect(container.querySelector('[data-testid="alignment-instructions-panel"]')).toBeNull()
    expect(container.querySelector('[data-testid="alignment-crosshair-button"]')).toBeNull()
    expect(container.querySelector('[data-testid="mobile-align-action"]')).not.toBeNull()
  })

  it('hides mobile overlay chrome and the alignment panel during explicit alignment focus', async () => {
    mockSubscribeToOrientationPose.mockImplementationOnce((onPose: (state: unknown) => void) => {
      onPose({
        pose: {
          yawDeg: 0,
          pitchDeg: 0,
          rollDeg: 0,
          quaternion: [0, 0, 0, 1],
          alignmentHealth: 'fair',
          mode: 'sensor',
        },
        sample: {
          source: 'absolute-sensor',
          absolute: true,
          needsCalibration: false,
          timestampMs: Date.UTC(2026, 2, 26, 0, 45, 6),
          headingDeg: 0,
          pitchDeg: 0,
          rollDeg: 0,
          quaternion: [0, 0, 0, 1],
          rawQuaternion: [0, 0, 0, 1],
          rawSample: {
            source: 'absolute-sensor',
            localFrame: 'screen',
            absolute: true,
            timestampMs: Date.UTC(2026, 2, 26, 0, 45, 6),
            worldFromLocal: [
              [1, 0, 0],
              [0, 1, 0],
              [0, 0, 1],
            ],
          },
        },
        history: [],
        orientationSource: 'absolute-sensor',
        orientationAbsolute: true,
        orientationNeedsCalibration: false,
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
      camera: 'granted',
      orientation: 'granted',
    })

    const openViewerButton = container.querySelector(
      '[data-testid="mobile-viewer-overlay-trigger"]',
    ) as HTMLButtonElement | null

    expect(openViewerButton).not.toBeNull()

    await act(async () => {
      openViewerButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
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

    const startAlignmentButton = container.querySelector(
      '[data-testid="alignment-start-action"]',
    ) as HTMLButtonElement | null

    expect(container.querySelector('[data-testid="mobile-viewer-overlay"]')).toBeNull()
    expect(container.querySelector('[data-testid="mobile-viewer-overlay-trigger"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="mobile-align-action"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="alignment-instructions-panel"]')).not.toBeNull()
    expect(startAlignmentButton).not.toBeNull()

    await act(async () => {
      startAlignmentButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    const quickActions = container.querySelector(
      '[data-testid="mobile-viewer-quick-actions"]',
    ) as HTMLElement | null
    const alignButton = container.querySelector(
      '[data-testid="mobile-align-action"]',
    ) as HTMLButtonElement | null

    expect(container.querySelector('[data-testid="mobile-viewer-overlay"]')).toBeNull()
    expect(container.querySelector('[data-testid="mobile-viewer-overlay-trigger"]')).toBeNull()
    expect(container.querySelector('[data-testid="mobile-permission-action"]')).toBeNull()
    expect(quickActions).not.toBeNull()
    expect(alignButton).toBeNull()
    expect(container.querySelector('[data-testid="alignment-instructions-panel"]')).toBeNull()
    expect(container.querySelector('[data-testid="alignment-crosshair-button"]')).not.toBeNull()
  })

  it('allows repeated alignment without requiring reset first', async () => {
    mockSubscribeToOrientationPose.mockImplementationOnce((onPose: (state: unknown) => void) => {
      onPose({
        pose: {
          yawDeg: 0,
          pitchDeg: 0,
          rollDeg: 0,
          quaternion: [0, 0, 0, 1],
          alignmentHealth: 'good',
          mode: 'sensor',
        },
        sample: {
          source: 'absolute-sensor',
          absolute: true,
          needsCalibration: false,
          timestampMs: Date.UTC(2026, 2, 26, 0, 45, 6),
          headingDeg: 0,
          pitchDeg: 0,
          rollDeg: 0,
          quaternion: [0, 0, 0, 1],
          rawQuaternion: [0, 0, 0, 1],
          rawSample: {
            source: 'absolute-sensor',
            localFrame: 'screen',
            absolute: true,
            timestampMs: Date.UTC(2026, 2, 26, 0, 45, 6),
            worldFromLocal: [
              [1, 0, 0],
              [0, 1, 0],
              [0, 0, 1],
            ],
          },
        },
        history: [],
        orientationSource: 'absolute-sensor',
        orientationAbsolute: true,
        orientationNeedsCalibration: false,
        poseCalibration: {
          offsetQuaternion: [0, 0, 0, 1],
          calibrated: true,
          sourceAtCalibration: 'absolute-sensor',
          lastCalibratedAtMs: Date.UTC(2026, 2, 26, 0, 45, 10),
        },
      })

      return SENSOR_CONTROLLER
    })

    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'granted',
      orientation: 'granted',
    })

    let alignButton = container.querySelector(
      '[data-testid="mobile-align-action"]',
    ) as HTMLButtonElement | null

    expect(alignButton).not.toBeNull()
    expect(alignButton?.disabled).toBe(false)

    await act(async () => {
      alignButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    let startAlignmentButton = container.querySelector(
      '[data-testid="alignment-start-action"]',
    ) as HTMLButtonElement | null

    expect(startAlignmentButton).not.toBeNull()
    expect(container.querySelector('[data-testid="alignment-crosshair-button"]')).toBeNull()

    await act(async () => {
      startAlignmentButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    const crosshairButton = container.querySelector(
      '[data-testid="alignment-crosshair-button"]',
    ) as HTMLButtonElement | null

    expect(crosshairButton).not.toBeNull()
    expect(container.querySelector('[data-testid="mobile-align-action"]')).toBeNull()
    expect(container.querySelector('[data-testid="mobile-viewer-overlay-trigger"]')).toBeNull()
    expect(container.querySelector('[data-testid="alignment-instructions-panel"]')).toBeNull()

    await act(async () => {
      crosshairButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    expect(readViewerSettings().poseCalibration.calibrated).toBe(true)
    expect(container.querySelector('[data-testid="alignment-instructions-panel"]')).toBeNull()
    expect(container.querySelector('[data-testid="alignment-crosshair-button"]')).toBeNull()
    expect(container.querySelector('[data-testid="mobile-align-action"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="mobile-viewer-overlay-trigger"]')).not.toBeNull()

    alignButton = container.querySelector(
      '[data-testid="mobile-align-action"]',
    ) as HTMLButtonElement | null

    await act(async () => {
      alignButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    expect(container.querySelector('[data-testid="alignment-instructions-panel"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="alignment-crosshair-button"]')).toBeNull()
    startAlignmentButton = container.querySelector(
      '[data-testid="alignment-start-action"]',
    ) as HTMLButtonElement | null
    expect(startAlignmentButton).not.toBeNull()

    await act(async () => {
      startAlignmentButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    expect(container.querySelector('[data-testid="alignment-instructions-panel"]')).toBeNull()
    expect(container.querySelector('[data-testid="alignment-crosshair-button"]')).not.toBeNull()
  })

  it('exposes on-view manual nudges and gated reset controls in the alignment panel', async () => {
    mockSubscribeToOrientationPose.mockImplementationOnce((onPose: (state: unknown) => void) => {
      onPose({
        pose: {
          yawDeg: 0,
          pitchDeg: 0,
          rollDeg: 0,
          quaternion: [0, 0, 0, 1],
          alignmentHealth: 'fair',
          mode: 'sensor',
        },
        sample: {
          source: 'deviceorientation-absolute',
          absolute: true,
          needsCalibration: false,
          timestampMs: Date.UTC(2026, 2, 26, 0, 45, 6),
          headingDeg: 0,
          pitchDeg: 0,
          rollDeg: 0,
          quaternion: [0, 0, 0, 1],
          rawQuaternion: [0, 0, 0, 1],
          rawSample: {
            source: 'deviceorientation-absolute',
            localFrame: 'device',
            absolute: true,
            timestampMs: Date.UTC(2026, 2, 26, 0, 45, 6),
            worldFromLocal: [
              [1, 0, 0],
              [0, 1, 0],
              [0, 0, 1],
            ],
          },
        },
        history: [],
        orientationSource: 'deviceorientation-absolute',
        orientationAbsolute: true,
        orientationNeedsCalibration: false,
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
      camera: 'granted',
      orientation: 'granted',
    })

    const alignButton = container.querySelector(
      '[data-testid="mobile-align-action"]',
    ) as HTMLButtonElement | null

    expect(alignButton?.disabled).toBe(false)

    await act(async () => {
      alignButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    const resetButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Reset calibration'),
    ) as HTMLButtonElement | undefined
    const nudgeRightButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Nudge right'),
    ) as HTMLButtonElement | undefined

    expect(resetButton?.disabled).toBe(true)
    expect(nudgeRightButton).toBeDefined()

    const calibrationCallsBefore = SENSOR_CONTROLLER.setCalibration.mock.calls.length

    await act(async () => {
      nudgeRightButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    expect(SENSOR_CONTROLLER.setCalibration.mock.calls.length).toBe(
      calibrationCallsBefore + 1,
    )
    expect(readViewerSettings().poseCalibration.calibrated).toBe(true)
  })

  it('shows the secure-context failure screen when live AR is unavailable on this origin', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: false,
    })

    await renderViewer({
      entry: 'live',
      location: 'unknown',
      camera: 'unknown',
      orientation: 'unknown',
    })

    expect(container.textContent).toContain('Live AR requires a secure context.')
    expect(container.textContent).toContain(
      'Open SkyLens from HTTPS or localhost so camera, geolocation, and motion sensors are allowed to start in the viewer.',
    )
    expect(container.textContent).toContain('Live AR requires HTTPS or `localhost`')
    expect(container.textContent).not.toContain('Start AR')
    expect(container.textContent).toContain('Try demo mode')
  })

  it('keeps the live camera stage locked while the compact mobile overlay content scrolls', async () => {
    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'granted',
      orientation: 'granted',
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
    const mobileOverlayShell = container.querySelector(
      '[data-testid="mobile-viewer-overlay-shell"]',
    ) as HTMLElement | null
    const compactOverlayContent = container.querySelector(
      '[data-testid="mobile-viewer-overlay-compact-content"]',
    ) as HTMLElement | null

    expect(mobileOverlay).not.toBeNull()
    expect(mobileOverlayShell).not.toBeNull()
    expect(compactOverlayContent).not.toBeNull()
    expect(container.querySelector('[data-testid="mobile-viewer-overlay-scroll-region"]')).toBeNull()
    expect(mobileOverlayShell?.className).toContain(
      'pt-[calc(1rem+env(safe-area-inset-top))]',
    )
    expect(mobileOverlayShell?.className).toContain(
      'pb-[calc(1rem+env(safe-area-inset-bottom))]',
    )
    expect(mobileOverlayShell?.className).toContain('overflow-hidden')
    expect(mobileOverlay?.className).toContain('flex')
    expect(mobileOverlay?.className).toContain('max-h-full')
    expect(mobileOverlay?.className).toContain('overflow-hidden')
    expect(mobileOverlay?.style.maxHeight).toBe(
      'calc(100dvh - (2rem + env(safe-area-inset-top) + env(safe-area-inset-bottom)))',
    )
    expect(compactOverlayContent?.className).toContain('flex-1')
    expect(compactOverlayContent?.className).toContain('overflow-y-auto')
    expect(compactOverlayContent?.className).toContain('overscroll-contain')
    expect(mobileOverlay?.textContent).toContain('Viewer snapshot')
    expect(mobileOverlay?.textContent).not.toContain('Privacy reassurance')
    expect(mobileOverlay?.textContent).not.toContain('Celestial layer')
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('preserves backdrop close behavior for the compact live mobile overlay', async () => {
    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'granted',
      orientation: 'granted',
    })

    const mobileTrigger = container.querySelector(
      '[data-testid="mobile-viewer-overlay-trigger"]',
    ) as HTMLButtonElement | null

    expect(mobileTrigger).not.toBeNull()

    await act(async () => {
      mobileTrigger!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const backdrop = container.querySelector(
      '[data-testid="mobile-viewer-overlay-backdrop"]',
    ) as HTMLButtonElement | null

    expect(container.querySelector('[data-testid="mobile-viewer-overlay-shell"]')).not.toBeNull()
    expect(backdrop).not.toBeNull()

    await act(async () => {
      backdrop!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.querySelector('[data-testid="mobile-viewer-overlay"]')).toBeNull()
    expect(container.querySelector('[data-testid="mobile-viewer-overlay-shell"]')).toBeNull()
    expect(container.querySelector('[data-testid="mobile-viewer-overlay-trigger"]')).not.toBeNull()
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('makes the compact alignment panel internally scrollable on mobile', async () => {
    mockSubscribeToOrientationPose.mockImplementationOnce((onPose: (state: unknown) => void) => {
      onPose({
        pose: {
          yawDeg: 0,
          pitchDeg: 0,
          rollDeg: 0,
          quaternion: [0, 0, 0, 1],
          alignmentHealth: 'fair',
          mode: 'sensor',
        },
        sample: {
          source: 'absolute-sensor',
          absolute: true,
          needsCalibration: false,
          timestampMs: Date.UTC(2026, 2, 26, 0, 45, 6),
          headingDeg: 0,
          pitchDeg: 0,
          rollDeg: 0,
          quaternion: [0, 0, 0, 1],
          rawQuaternion: [0, 0, 0, 1],
          rawSample: {
            source: 'absolute-sensor',
            localFrame: 'screen',
            absolute: true,
            timestampMs: Date.UTC(2026, 2, 26, 0, 45, 6),
            worldFromLocal: [
              [1, 0, 0],
              [0, 1, 0],
              [0, 0, 1],
            ],
          },
        },
        history: [],
        orientationSource: 'absolute-sensor',
        orientationAbsolute: true,
        orientationNeedsCalibration: false,
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
      camera: 'granted',
      orientation: 'granted',
    })

    const alignButton = container.querySelector(
      '[data-testid="mobile-align-action"]',
    ) as HTMLButtonElement | null

    expect(alignButton).not.toBeNull()

    await act(async () => {
      alignButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    const alignmentPanels = Array.from(
      container.querySelectorAll('[data-testid="alignment-instructions-panel"]'),
    ) as HTMLElement[]
    const alignmentPanel =
      alignmentPanels.find((panel) => panel.className.includes('overflow-y-auto')) ?? null
    const startAlignmentButton = container.querySelector(
      '[data-testid="alignment-start-action"]',
    ) as HTMLButtonElement | null

    expect(alignmentPanel).not.toBeNull()
    expect(alignmentPanel?.className).toContain('overflow-y-auto')
    expect(alignmentPanel?.className).toContain('overscroll-contain')
    expect(alignmentPanel?.style.maxHeight).toBe(
      'calc(100dvh - (6.5rem + env(safe-area-inset-bottom)))',
    )
    expect(startAlignmentButton).not.toBeNull()
    expect(startAlignmentButton?.disabled).toBe(false)
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
    expect(mockRouterReplace).toHaveBeenCalled()
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
    expect(mockRouterReplace).toHaveBeenCalled()
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

  it('surfaces the relative-sensor warning state and calibration target guidance', async () => {
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
      camera: 'granted',
      orientation: 'granted',
    })

    expect(container.textContent).toContain('Relative sensor mode needs alignment.')
    expect(container.textContent).toMatch(
      /Center .* in the crosshair, then press the middle of the screen to align before trusting label placement\./,
    )
    expect(container.querySelector('[data-testid="alignment-instructions-panel"]')).toBeNull()
    expect(container.textContent).toContain('Motion: Align first')
    expect(container.textContent).toContain('Sensor: Relative')
  })

  it('distinguishes absolute-sensor mode from relative and manual fallbacks', async () => {
    mockSubscribeToOrientationPose.mockImplementationOnce((onPose: (state: unknown) => void) => {
      onPose({
        pose: {
          yawDeg: 0,
          pitchDeg: 0,
          rollDeg: 0,
          quaternion: [0, 0, 0, 1],
          alignmentHealth: 'good',
          mode: 'sensor',
        },
        sample: {
          source: 'absolute-sensor',
          absolute: true,
          needsCalibration: false,
          timestampMs: Date.UTC(2026, 2, 26, 0, 45, 6),
          headingDeg: 0,
          pitchDeg: 0,
          rollDeg: 0,
          quaternion: [0, 0, 0, 1],
          rawQuaternion: [0, 0, 0, 1],
          rawSample: {
            source: 'absolute-sensor',
            localFrame: 'screen',
            absolute: true,
            timestampMs: Date.UTC(2026, 2, 26, 0, 45, 6),
            worldFromLocal: [
              [1, 0, 0],
              [0, 1, 0],
              [0, 0, 1],
            ],
          },
        },
        history: [],
        orientationSource: 'absolute-sensor',
        orientationAbsolute: true,
        orientationNeedsCalibration: false,
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
      camera: 'granted',
      orientation: 'granted',
    })

    expect(container.textContent).toContain('Motion: Absolute sensor')
    expect(container.textContent).toContain('Sensor: Absolute sensor')
    expect(container.textContent).not.toContain('Relative sensor mode needs alignment.')
  })

  it('advances demo scene time continuously with the animation-driven cadence', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-26T00:00:00.000Z'))

    const restoreAnimationFrame = installAnimationFrameClock()

    try {
      await renderViewer({
        entry: 'demo',
        location: 'unavailable',
        camera: 'unavailable',
        orientation: 'unavailable',
        demoScenarioId: 'sf-evening',
      })
      await flushEffects()

      const initialSceneTimeMs = getLatestSceneTimeMs()

      await act(async () => {
        vi.advanceTimersByTime(250)
      })
      await flushEffects()

      expect(getLatestSceneTimeMs()).toBeGreaterThan(initialSceneTimeMs + 150)
    } finally {
      restoreAnimationFrame()
    }
  })

  it('keeps live scene time synced to wall clock under the animation cadence', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-26T00:00:00.000Z'))

    const restoreAnimationFrame = installAnimationFrameClock()

    try {
      await renderViewer({
        entry: 'live',
        location: 'granted',
        camera: 'denied',
        orientation: 'denied',
      })
      await flushEffects()

      const initialSceneTimeMs = getLatestSceneTimeMs()

      await act(async () => {
        vi.advanceTimersByTime(250)
      })
      await flushEffects()

      expect(getLatestSceneTimeMs()).toBeGreaterThan(initialSceneTimeMs + 150)
    } finally {
      restoreAnimationFrame()
    }
  })

  it('falls back to the coarse scene cadence when reduced motion is preferred', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-26T00:00:00.000Z'))
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: createMatchMediaStub(true),
    })

    const restoreAnimationFrame = installAnimationFrameClock()

    try {
      await renderViewer({
        entry: 'demo',
        location: 'unavailable',
        camera: 'unavailable',
        orientation: 'unavailable',
        demoScenarioId: 'sf-evening',
      })
      await flushEffects()

      const initialSceneTimeMs = getLatestSceneTimeMs()

      await act(async () => {
        vi.advanceTimersByTime(900)
      })
      await flushEffects()

      expect(getLatestSceneTimeMs()).toBe(initialSceneTimeMs)

      await act(async () => {
        vi.advanceTimersByTime(200)
      })
      await flushEffects()

      expect(getLatestSceneTimeMs()).toBeGreaterThanOrEqual(initialSceneTimeMs + 1_000)
    } finally {
      restoreAnimationFrame()
    }
  })

  it('keeps demo scene time monotonic when reduced motion turns on mid-session', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-26T00:00:00.000Z'))
    const motionPreference = createMatchMediaController(false)
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: motionPreference.matchMedia,
    })

    const restoreAnimationFrame = installAnimationFrameClock()

    try {
      await renderViewer({
        entry: 'demo',
        location: 'unavailable',
        camera: 'unavailable',
        orientation: 'unavailable',
        demoScenarioId: 'sf-evening',
      })
      await flushEffects()

      await act(async () => {
        vi.advanceTimersByTime(250)
      })
      await flushEffects()

      const sceneTimeBeforePreferenceChange = getLatestSceneTimeMs()

      await act(async () => {
        motionPreference.setMatches(true)
      })
      await flushEffects()

      expect(getLatestSceneTimeMs()).toBeGreaterThanOrEqual(sceneTimeBeforePreferenceChange)
    } finally {
      restoreAnimationFrame()
    }
  })

  it('falls back to the coarse scene cadence when animation frames are unavailable', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-26T00:00:00.000Z'))
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

    try {
      await renderViewer({
        entry: 'demo',
        location: 'unavailable',
        camera: 'unavailable',
        orientation: 'unavailable',
        demoScenarioId: 'sf-evening',
      })
      await flushEffects()

      const initialSceneTimeMs = getLatestSceneTimeMs()

      await act(async () => {
        vi.advanceTimersByTime(900)
      })
      await flushEffects()

      expect(getLatestSceneTimeMs()).toBe(initialSceneTimeMs)

      await act(async () => {
        vi.advanceTimersByTime(200)
      })
      await flushEffects()

      expect(getLatestSceneTimeMs()).toBeGreaterThanOrEqual(initialSceneTimeMs + 1_000)
    } finally {
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
  })

  it('uses the same coarse battery-conscious cadence when motion quality is low', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-26T00:00:00.000Z'))
    writeViewerSettings({
      ...readViewerSettings(),
      motionQuality: 'low',
    })

    const restoreAnimationFrame = installAnimationFrameClock()

    try {
      await renderViewer({
        entry: 'demo',
        location: 'unavailable',
        camera: 'unavailable',
        orientation: 'unavailable',
        demoScenarioId: 'sf-evening',
      })

      const initialSceneTimeMs = getLatestSceneTimeMs()

      await act(async () => {
        vi.advanceTimersByTime(900)
      })
      await flushEffects()

      expect(getLatestSceneTimeMs()).toBe(initialSceneTimeMs)

      await act(async () => {
        vi.advanceTimersByTime(200)
      })
      await flushEffects()

      expect(getLatestSceneTimeMs()).toBeGreaterThanOrEqual(initialSceneTimeMs + 1_000)
    } finally {
      restoreAnimationFrame()
    }
  })

  it('retains previous and current aircraft snapshots across live polls', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-26T00:00:00.000Z'))
    const restoreAnimationFrame = installAnimationFrameClock()
    const firstSnapshot = createAircraftSnapshot('2026-03-26T00:00:00.000Z', [
      {
        id: 'icao24-alpha1',
        callsign: 'ALPHA1',
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
    const secondSnapshot = createAircraftSnapshot('2026-03-26T00:00:10.000Z', [
      {
        id: 'icao24-alpha1',
        callsign: 'ALPHA1',
        lat: 37.88,
        lon: -122.18,
        geoAltitudeM: 5200,
        velocityMps: 210,
        headingDeg: 214,
        azimuthDeg: 24,
        elevationDeg: 30,
        rangeKm: 16.1,
      },
    ])

    mockFetchAircraftSnapshot
      .mockResolvedValueOnce(firstSnapshot)
      .mockResolvedValueOnce(secondSnapshot)

    try {
      await renderViewer({
        entry: 'live',
        location: 'granted',
        camera: 'granted',
        orientation: 'granted',
      })
      await flushEffects()

      const firstCall = mockResolveAircraftMotionObjects.mock.calls.at(-1)?.[0] as
        | {
            snapshot?: unknown
            previousSnapshot?: unknown
            transitionStartedAtMs?: unknown
          }
        | undefined

      expect(firstCall?.snapshot).toEqual(firstSnapshot)
      expect(firstCall?.previousSnapshot).toBeNull()
      expect(typeof firstCall?.transitionStartedAtMs).toBe('number')

      await act(async () => {
        vi.advanceTimersByTime(10_000)
      })
      await flushEffects()

      const secondCall = mockResolveAircraftMotionObjects.mock.calls.at(-1)?.[0] as
        | {
            snapshot?: unknown
            previousSnapshot?: unknown
            transitionStartedAtMs?: unknown
          }
        | undefined

      expect(secondCall?.snapshot).toEqual(secondSnapshot)
      expect(secondCall?.previousSnapshot).toEqual(firstSnapshot)
      expect(typeof secondCall?.transitionStartedAtMs).toBe('number')
    } finally {
      restoreAnimationFrame()
    }
  })

  it('keeps the last aircraft snapshot active when a live refresh fails', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-26T00:00:00.000Z'))
    const restoreAnimationFrame = installAnimationFrameClock()
    const firstSnapshot = createAircraftSnapshot('2026-03-26T00:00:00.000Z', [
      {
        id: 'icao24-bravo1',
        callsign: 'BRAVO1',
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

    mockFetchAircraftSnapshot
      .mockResolvedValueOnce(firstSnapshot)
      .mockRejectedValueOnce(new Error('temporary outage'))

    try {
      await renderViewer({
        entry: 'live',
        location: 'granted',
        camera: 'granted',
        orientation: 'granted',
      })
      await flushEffects()

      await act(async () => {
        vi.advanceTimersByTime(10_000)
      })
      await flushEffects()

      const latestCall = mockResolveAircraftMotionObjects.mock.calls.at(-1)?.[0] as
        | { snapshot?: unknown; previousSnapshot?: unknown }
        | undefined

      expect(latestCall?.snapshot).toEqual(firstSnapshot)
      expect(latestCall?.previousSnapshot).toBeNull()
    } finally {
      restoreAnimationFrame()
    }
  })

  it('surfaces stale aircraft motion metadata in marker labels and opacity', async () => {
    mockResolveAircraftMotionObjects.mockReturnValue([
      {
        confidence: 0.4,
        motionState: 'stale',
        object: {
          id: 'icao24-staleui',
          type: 'aircraft',
          label: 'STALEUI',
          sublabel: 'Aircraft',
          azimuthDeg: 0,
          elevationDeg: 16,
          rangeKm: 31.8,
          importance: 83,
          metadata: {
            motionState: 'stale',
            motionOpacity: 0.4,
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

    await renderViewer({
      entry: 'demo',
      location: 'unavailable',
      camera: 'unavailable',
      orientation: 'unavailable',
      demoScenarioId: 'tokyo-iss',
    })

    const marker = container.querySelector(
      '[data-testid="sky-object-marker"][data-object-id="icao24-staleui"]',
    ) as HTMLButtonElement | null

    expect(marker).not.toBeNull()
    expect(marker?.getAttribute('aria-label')).toContain('Aircraft Stale')
    expect(marker?.style.opacity).toBe('0.4')
  })

  it('surfaces stale satellite motion metadata in marker labels and opacity', async () => {
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
      location: 'unavailable',
      camera: 'unavailable',
      orientation: 'unavailable',
      demoScenarioId: 'tokyo-iss',
    })

    const marker = container.querySelector(
      '[data-testid="sky-object-marker"][data-object-id="25544"]',
    ) as HTMLButtonElement | null

    expect(marker).not.toBeNull()
    expect(marker?.getAttribute('aria-label')).toContain('Satellite Stale')
    expect(marker?.style.opacity).toBe('0.7')
  })

  it('surfaces estimated aircraft labels and badges in the selected detail view', async () => {
    mockResolveAircraftMotionObjects.mockReturnValue([
      {
        confidence: 0.7,
        motionState: 'estimated',
        object: {
          id: 'icao24-estui',
          type: 'aircraft',
          label: 'ESTUI',
          sublabel: 'Aircraft',
          azimuthDeg: 0,
          elevationDeg: 16,
          rangeKm: 31.8,
          importance: 88,
          metadata: {
            motionState: 'estimated',
            motionOpacity: 0.7,
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

    await renderViewer({
      entry: 'demo',
      location: 'unavailable',
      camera: 'unavailable',
      orientation: 'unavailable',
      demoScenarioId: 'tokyo-iss',
    })

    const marker = container.querySelector(
      '[data-testid="sky-object-marker"][data-object-id="icao24-estui"]',
    ) as HTMLButtonElement | null

    expect(marker).not.toBeNull()
    expect(marker?.getAttribute('aria-label')).toContain('Aircraft Estimated')

    await act(async () => {
      marker?.click()
    })
    await flushEffects()

    expect(container.textContent).toContain('Selected object')
    expect(container.textContent).toContain('Aircraft Estimated')
    expect(
      Array.from(container.querySelectorAll('span')).some(
        (element) => element.textContent?.trim() === 'Estimated',
      ),
    ).toBe(true)
  })

  it('uses requestAnimationFrame as the render-loop fallback when video-frame callbacks are unavailable', async () => {
    let animationFrameCallback: FrameRequestCallback | null = null
    const originalRequestAnimationFrame = window.requestAnimationFrame
    const originalCancelAnimationFrame = window.cancelAnimationFrame
    const originalRequestVideoFrameCallback = (
      HTMLVideoElement.prototype as HTMLVideoElement & {
        requestVideoFrameCallback?: (
          callback: (now: number, metadata: { width?: number; height?: number }) => void,
        ) => number
      }
    ).requestVideoFrameCallback
    const originalCancelVideoFrameCallback = (
      HTMLVideoElement.prototype as HTMLVideoElement & {
        cancelVideoFrameCallback?: (handle: number) => void
      }
    ).cancelVideoFrameCallback

    Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', {
      configurable: true,
      writable: true,
      value: undefined,
    })
    Object.defineProperty(HTMLVideoElement.prototype, 'cancelVideoFrameCallback', {
      configurable: true,
      writable: true,
      value: undefined,
    })

    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: vi.fn((callback: FrameRequestCallback) => {
        animationFrameCallback = callback
        return 1
      }),
    })
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    })

    try {
      await renderViewer({
        entry: 'live',
        location: 'granted',
        camera: 'granted',
        orientation: 'granted',
      })

      const stage = container.querySelector('[aria-label="Sky viewer stage"]') as
        | HTMLDivElement
        | null

      expect(stage).not.toBeNull()
      expect(animationFrameCallback).toBeTypeOf('function')

      const frameTokenBefore = Number(stage?.getAttribute('data-frame-token') ?? '0')

      await act(async () => {
        animationFrameCallback?.(16)
      })
      await flushEffects()

      expect(Number(stage?.getAttribute('data-frame-token') ?? '0')).toBeGreaterThan(
        frameTokenBefore,
      )
    } finally {
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
      Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', {
        configurable: true,
        writable: true,
        value: originalRequestVideoFrameCallback,
      })
      Object.defineProperty(HTMLVideoElement.prototype, 'cancelVideoFrameCallback', {
        configurable: true,
        writable: true,
        value: originalCancelVideoFrameCallback,
      })
    }
  })

  it(
    'syncs fine-adjust and reset calibration actions into persisted viewer settings',
    async () => {
      await renderViewer({
        entry: 'live',
        location: 'granted',
        camera: 'granted',
        orientation: 'granted',
      })

      const latestSettingsProps = () =>
        mockSettingsSheetProps.mock.calls.at(-1)?.[0] as
          | {
              onFineAdjustCalibration?: (adjustment: {
                axis: 'yaw' | 'pitch'
                deltaDeg: number
              }) => void
              onResetCalibration?: () => void
            }
          | undefined

      expect(latestSettingsProps()?.onFineAdjustCalibration).toBeTypeOf('function')
      expect(latestSettingsProps()?.onResetCalibration).toBeTypeOf('function')
      expect(readViewerSettings().poseCalibration.calibrated).toBe(false)
      const calibrationCallsBefore = SENSOR_CONTROLLER.setCalibration.mock.calls.length

      await act(async () => {
        latestSettingsProps()?.onFineAdjustCalibration?.({ axis: 'yaw', deltaDeg: 0.75 })
      })
      await flushEffects()

      expect(SENSOR_CONTROLLER.setCalibration.mock.calls.length).toBe(
        calibrationCallsBefore + 1,
      )
      expect(readViewerSettings().poseCalibration.calibrated).toBe(true)

      await act(async () => {
        latestSettingsProps()?.onResetCalibration?.()
      })
      await flushEffects()

      expect(SENSOR_CONTROLLER.setCalibration.mock.calls.length).toBe(
        calibrationCallsBefore + 2,
      )
      expect(readViewerSettings().poseCalibration.calibrated).toBe(false)
    },
    10_000,
  )

  it('wires live-panel fine-adjust and reset controls into the existing calibration path', async () => {
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
      camera: 'granted',
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

    const nudgeLeftButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Nudge left'),
    ) as HTMLButtonElement | undefined

    expect(nudgeLeftButton).toBeDefined()

    const calibrationCallsBefore = SENSOR_CONTROLLER.setCalibration.mock.calls.length

    await act(async () => {
      nudgeLeftButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    expect(SENSOR_CONTROLLER.setCalibration.mock.calls.length).toBe(
      calibrationCallsBefore + 1,
    )
    expect(readViewerSettings().poseCalibration.calibrated).toBe(true)

    const resetCalibrationButton = Array.from(container.querySelectorAll('button')).find(
      (button) =>
        button.textContent?.includes('Reset calibration') &&
        !(button as HTMLButtonElement).disabled,
    ) as HTMLButtonElement | undefined

    expect(resetCalibrationButton).toBeDefined()

    await act(async () => {
      resetCalibrationButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    expect(SENSOR_CONTROLLER.setCalibration.mock.calls.length).toBe(
      calibrationCallsBefore + 2,
    )
    expect(readViewerSettings().poseCalibration.calibrated).toBe(false)
  })

  it('uses video-frame metadata when requestVideoFrameCallback is available', async () => {
    let videoFrameCallback:
      | ((now: number, metadata: { width?: number; height?: number }) => void)
      | null = null
    const originalRequestVideoFrameCallback = (
      HTMLVideoElement.prototype as HTMLVideoElement & {
        requestVideoFrameCallback?: (
          callback: (now: number, metadata: { width?: number; height?: number }) => void,
        ) => number
      }
    ).requestVideoFrameCallback
    const originalCancelVideoFrameCallback = (
      HTMLVideoElement.prototype as HTMLVideoElement & {
        cancelVideoFrameCallback?: (handle: number) => void
      }
    ).cancelVideoFrameCallback

    Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', {
      configurable: true,
      value: vi.fn(
        (callback: (now: number, metadata: { width?: number; height?: number }) => void) => {
          videoFrameCallback = callback
          return 1
        },
      ),
    })
    Object.defineProperty(HTMLVideoElement.prototype, 'cancelVideoFrameCallback', {
      configurable: true,
      value: vi.fn(),
    })

    try {
      await renderViewer({
        entry: 'live',
        location: 'granted',
        camera: 'granted',
        orientation: 'granted',
      })

      const stage = container.querySelector('[aria-label="Sky viewer stage"]') as
        | HTMLDivElement
        | null

      expect(stage).not.toBeNull()
      expect(videoFrameCallback).toBeTypeOf('function')

      const frameTokenBefore = Number(stage?.getAttribute('data-frame-token') ?? '0')

      await act(async () => {
        videoFrameCallback?.(0, { width: 1920, height: 1080 })
      })
      await flushEffects()

      expect(Number(stage?.getAttribute('data-frame-token') ?? '0')).toBeGreaterThan(
        frameTokenBefore,
      )
      expect(container.textContent).toContain('Frame 1920×1080')
    } finally {
      Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', {
        configurable: true,
        value: originalRequestVideoFrameCallback,
      })
      Object.defineProperty(HTMLVideoElement.prototype, 'cancelVideoFrameCallback', {
        configurable: true,
        value: originalCancelVideoFrameCallback,
      })
    }
  })

  it('pushes fine-adjust and reset calibration changes into storage and the live sensor controller', async () => {
    mockSubscribeToOrientationPose.mockImplementation((onPose: (state: unknown) => void) => {
      onPose({
        pose: {
          yawDeg: 0,
          pitchDeg: 0,
          rollDeg: 0,
          quaternion: [0, 0, 0, 1],
          alignmentHealth: 'fair',
          mode: 'sensor',
        },
        sample: {
          source: 'deviceorientation-absolute',
          absolute: true,
          needsCalibration: false,
          timestampMs: 1,
          headingDeg: 0,
          pitchDeg: 0,
          rollDeg: 0,
          quaternion: [0, 0, 0, 1],
          rawQuaternion: [0, 0, 0, 1],
          rawSample: {
            source: 'deviceorientation-absolute',
            localFrame: 'device',
            absolute: true,
            timestampMs: 1,
            worldFromLocal: [
              [1, 0, 0],
              [0, 1, 0],
              [0, 0, 1],
            ],
          },
        },
        orientationSource: 'deviceorientation-absolute',
        orientationAbsolute: true,
        orientationNeedsCalibration: false,
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
      camera: 'granted',
      orientation: 'granted',
    })

    const latestSettingsProps = () =>
      mockSettingsSheetProps.mock.calls.at(-1)?.[0] as
        | {
            onFineAdjustCalibration?: (adjustment: {
              axis: 'yaw' | 'pitch'
              deltaDeg: number
            }) => void
            onResetCalibration?: () => void
          }
        | undefined

    await act(async () => {
      latestSettingsProps()?.onFineAdjustCalibration?.({ axis: 'yaw', deltaDeg: 0.75 })
    })
    await flushEffects()

    expect(SENSOR_CONTROLLER.setCalibration).toHaveBeenCalled()
    expect(readViewerSettings().poseCalibration.calibrated).toBe(true)
    expect(readViewerSettings().poseCalibration.offsetQuaternion).not.toEqual([0, 0, 0, 1])

    await act(async () => {
      latestSettingsProps()?.onResetCalibration?.()
    })
    await flushEffects()

    expect(readViewerSettings().poseCalibration).toMatchObject({
      calibrated: false,
      sourceAtCalibration: null,
      lastCalibratedAtMs: null,
      offsetQuaternion: [0, 0, 0, 1],
    })
  })

  it('surfaces relative sensor status and alignment-required messaging when calibration is still needed', async () => {
    mockSubscribeToOrientationPose.mockImplementation((onPose: (state: unknown) => void) => {
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
          timestampMs: 1,
          headingDeg: 0,
          pitchDeg: 0,
          rollDeg: 0,
          quaternion: [0, 0, 0, 1],
          rawQuaternion: [0, 0, 0, 1],
          rawSample: {
            source: 'deviceorientation-relative',
            localFrame: 'device',
            absolute: false,
            timestampMs: 1,
            worldFromLocal: [
              [1, 0, 0],
              [0, 1, 0],
              [0, 0, 1],
            ],
          },
        },
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
      camera: 'granted',
      orientation: 'granted',
    })

    expect(container.textContent).toContain('Sensor: Relative')
    expect(container.textContent).toContain('Motion: Align first')
    expect(container.textContent).toContain('Relative sensor mode needs alignment.')
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

function createAircraftSnapshot(
  fetchedAt: string,
  aircraft: Array<{
    id: string
    callsign?: string
    lat: number
    lon: number
    geoAltitudeM?: number
    velocityMps?: number
    headingDeg?: number
    azimuthDeg: number
    elevationDeg: number
    rangeKm: number
  }>,
) {
  return {
    fetchedAt,
    observer: {
      lat: LIVE_OBSERVER_FIXTURE.lat,
      lon: LIVE_OBSERVER_FIXTURE.lon,
      altMeters: LIVE_OBSERVER_FIXTURE.altMeters,
    },
    availability: 'available' as const,
    aircraft,
  }
}

function createMatchMediaStub(matches: boolean) {
  return vi.fn((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  }))
}

function createMatchMediaController(initialMatches: boolean) {
  let matches = initialMatches
  const changeListeners = new Set<(event: { matches: boolean; media: string }) => void>()

  return {
    matchMedia: vi.fn((query: string) => ({
      get matches() {
        return matches
      },
      media: query,
      onchange: null,
      addEventListener: vi.fn((type: string, listener: (event: { matches: boolean; media: string }) => void) => {
        if (type === 'change') {
          changeListeners.add(listener)
        }
      }),
      removeEventListener: vi.fn((type: string, listener: (event: { matches: boolean; media: string }) => void) => {
        if (type === 'change') {
          changeListeners.delete(listener)
        }
      }),
      addListener: vi.fn((listener: (event: { matches: boolean; media: string }) => void) => {
        changeListeners.add(listener)
      }),
      removeListener: vi.fn((listener: (event: { matches: boolean; media: string }) => void) => {
        changeListeners.delete(listener)
      }),
      dispatchEvent: vi.fn(() => false),
    })),
    setMatches(nextMatches: boolean) {
      matches = nextMatches

      for (const listener of changeListeners) {
        listener({
          matches,
          media: '(prefers-reduced-motion: reduce)',
        })
      }
    },
  }
}

function installAnimationFrameClock() {
  const originalRequestAnimationFrame = window.requestAnimationFrame
  const originalCancelAnimationFrame = window.cancelAnimationFrame
  const handles = new Map<number, number>()
  let nextHandle = 1

  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    writable: true,
    value: vi.fn((callback: FrameRequestCallback) => {
      const handle = nextHandle++
      const timeoutId = window.setTimeout(() => {
        handles.delete(handle)
        callback(Date.now())
      }, 16)

      handles.set(handle, timeoutId)
      return handle
    }),
  })

  Object.defineProperty(window, 'cancelAnimationFrame', {
    configurable: true,
    writable: true,
    value: vi.fn((handle: number) => {
      const timeoutId = handles.get(handle)

      if (typeof timeoutId === 'number') {
        window.clearTimeout(timeoutId)
        handles.delete(handle)
      }
    }),
  })

  return () => {
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
}

function getLatestSceneTimeMs() {
  const latestCall = mockResolveSatelliteMotionObjects.mock.calls.at(-1)?.[0] as
    | { timeMs?: number }
    | undefined

  return latestCall?.timeMs ?? 0
}
