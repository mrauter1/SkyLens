import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildViewerHref, type ViewerRouteState } from '../../lib/permissions/coordinator'
import { VIEWER_SETTINGS_STORAGE_KEY, readViewerSettings } from '../../lib/viewer/settings'

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
  mockNormalizeAircraftObjects,
  mockGetAircraftAvailabilityMessage,
  mockFetchSatelliteCatalog,
  mockNormalizeSatelliteObjects,
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
    mockNormalizeAircraftObjects.mockReset()
    mockGetAircraftAvailabilityMessage.mockReset()
    mockFetchSatelliteCatalog.mockReset()
    mockNormalizeSatelliteObjects.mockReset()
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
    expect(alignButton?.disabled).toBe(true)
    expect(container.querySelector('[data-testid="mobile-viewer-overlay"]')).toBeNull()
  })

  it('keeps align visible but disabled before a live sample exists even after permissions are granted', async () => {
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
    expect(alignButton?.disabled).toBe(true)
    expect(container.querySelector('[data-testid="mobile-viewer-overlay"]')).toBeNull()
  })

  it('routes the closed mobile align action into alignment focus once calibration can run', async () => {
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

    const focusedAlignButton = container.querySelector(
      '[data-testid="mobile-align-action"]',
    ) as HTMLButtonElement | null

    expect(container.querySelector('[data-testid="mobile-viewer-overlay"]')).toBeNull()
    expect(container.querySelector('[data-testid="mobile-viewer-overlay-trigger"]')).toBeNull()
    expect(container.querySelector('[data-testid="mobile-permission-action"]')).toBeNull()
    expect(readViewerSettings().poseCalibration.calibrated).toBe(false)
    expect(SENSOR_CONTROLLER.setCalibration.mock.calls.length).toBe(calibrationCallsBefore)
    expect(focusedAlignButton).not.toBeNull()
    expect(focusedAlignButton?.disabled).toBe(false)
  })

  it('hides mobile overlay chrome during explicit alignment focus and leaves only align visible', async () => {
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
    expect(alignButton).not.toBeNull()
    expect(alignButton?.disabled).toBe(true)
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
    const mobileOverlayScrollRegion = container.querySelector(
      '[data-testid="mobile-viewer-overlay-scroll-region"]',
    ) as HTMLElement | null

    expect(mobileOverlay).not.toBeNull()
    expect(mobileOverlayScrollRegion).not.toBeNull()
    expect(mobileOverlayScrollRegion?.className).toContain(
      'pt-[calc(1rem+env(safe-area-inset-top))]',
    )
    expect(mobileOverlayScrollRegion?.className).toContain(
      'pb-[calc(1rem+env(safe-area-inset-bottom))]',
    )
    expect(mobileOverlayScrollRegion?.className).toContain('overflow-y-auto')
    expect(mobileOverlayScrollRegion?.className).not.toContain('sm:hidden')
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
      /Center .* in the reticle, then align before trusting label placement\./,
    )
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
