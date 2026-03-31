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
  mockGetOrientationCapabilities,
  mockFetchAircraftSnapshot,
  mockGetAircraftAvailabilityMessage,
  mockFetchSatelliteCatalog,
  mockResolveAircraftMotionObjects,
  mockResolveSatelliteMotionObjects,
  mockAircraftTracker,
  mockCreateAircraftTracker,
} = vi.hoisted(() => ({
  mockRouterReplace: vi.fn(),
  mockSettingsSheetProps: vi.fn(),
  mockRequestStartupObserverState: vi.fn(),
  mockStartObserverTracking: vi.fn(),
  mockSubscribeToOrientationPose: vi.fn(),
  mockRequestRearCameraStream: vi.fn(),
  mockStopMediaStream: vi.fn(),
  mockRequestOrientationPermission: vi.fn(),
  mockGetOrientationCapabilities: vi.fn(),
  mockFetchAircraftSnapshot: vi.fn(),
  mockGetAircraftAvailabilityMessage: vi.fn(),
  mockFetchSatelliteCatalog: vi.fn(),
  mockResolveAircraftMotionObjects: vi.fn(),
  mockResolveSatelliteMotionObjects: vi.fn(),
  mockAircraftTracker: {
    ingest: vi.fn(),
    resolve: vi.fn(),
    getTrail: vi.fn(),
    prune: vi.fn(),
    reset: vi.fn(),
  },
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
  SettingsSheet: (props: { triggerSurfaceId?: string }) => {
    mockSettingsSheetProps(props)

    return React.createElement(
      'button',
      {
        type: 'button',
        'data-testid': 'settings-sheet',
        'data-focus-surface': props.triggerSurfaceId,
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
    getOrientationCapabilities: mockGetOrientationCapabilities,
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

vi.mock('../../lib/aircraft/tracker', () => ({
  createAircraftTracker: mockCreateAircraftTracker,
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
  let rootMounted = false
  let afterUnmountCleanup: (() => Promise<void> | void) | null = null

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
    rootMounted = false
    afterUnmountCleanup = null
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
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
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
    mockGetOrientationCapabilities.mockReset()
    mockGetAircraftAvailabilityMessage.mockReset()
    mockFetchSatelliteCatalog.mockReset()
    mockResolveAircraftMotionObjects.mockReset()
    mockResolveSatelliteMotionObjects.mockReset()
    mockAircraftTracker.ingest.mockReset()
    mockAircraftTracker.resolve.mockReset()
    mockAircraftTracker.getTrail.mockReset()
    mockAircraftTracker.prune.mockReset()
    mockAircraftTracker.reset.mockReset()
    mockCreateAircraftTracker.mockReset()
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
      snapshotTimeS: 1774483200,
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
    mockGetOrientationCapabilities.mockReturnValue({
      hasEvents: true,
      hasAbsoluteEvent: true,
      hasAbsoluteSensor: false,
      hasRelativeSensor: false,
      canRequestPermission: true,
    })
    mockResolveAircraftMotionObjects.mockReturnValue([])
    mockResolveSatelliteMotionObjects.mockReturnValue([])
    mockAircraftTracker.resolve.mockReturnValue([])
    mockAircraftTracker.getTrail.mockReturnValue([])
    mockCreateAircraftTracker.mockReturnValue(mockAircraftTracker)
    mockRequestOrientationPermission.mockResolvedValue('granted')
  })

  afterEach(async () => {
    if (rootMounted) {
      await act(async () => {
        root.unmount()
      })
      rootMounted = false
    }

    if (afterUnmountCleanup) {
      await afterUnmountCleanup()
      afterUnmountCleanup = null
    }

    vi.clearAllTimers()
    vi.useRealTimers()
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

    await openDesktopViewerPanel()

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

    await openDesktopViewerPanel()

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

  it('keeps route orientation unknown until the first usable sample arrives', async () => {
    let emitPose:
      | ((state: ReturnType<typeof createMockOrientationPoseUpdate>) => void)
      | null = null

    mockSubscribeToOrientationPose.mockImplementationOnce((onPose: (state: unknown) => void) => {
      emitPose = onPose as (state: ReturnType<typeof createMockOrientationPoseUpdate>) => void
      return SENSOR_CONTROLLER
    })

    await renderViewer({
      entry: 'live',
      location: 'unknown',
      camera: 'unknown',
      orientation: 'unknown',
    })

    await openDesktopViewerPanel()

    const startArButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Start AR'),
    )

    await act(async () => {
      startArButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()
    await flushEffects()

    expect(mockRouterReplace).toHaveBeenCalledWith(
      buildViewerHref({
        entry: 'live',
        location: 'granted',
        camera: 'granted',
        orientation: 'unknown',
      }),
    )
    expect(mockSubscribeToOrientationPose).toHaveBeenCalled()
    expect(emitPose).not.toBeNull()
    expect(container.textContent).toContain('Waiting for motion data.')
    expect(container.textContent).toContain('Motion Pending')

    await act(async () => {
      emitPose?.(
        createMockOrientationPoseUpdate({
          source: 'deviceorientation-absolute',
          providerKind: 'event',
          absolute: true,
        }),
      )
    })
    await flushEffects()
    await act(async () => {
      emitPose?.(
        createMockOrientationPoseUpdate({
          source: 'deviceorientation-absolute',
          providerKind: 'event',
          absolute: true,
        }),
      )
    })
    await flushEffects()

    expect(mockRouterReplace).toHaveBeenLastCalledWith(
      buildViewerHref({
        entry: 'live',
        location: 'granted',
        camera: 'granted',
        orientation: 'granted',
      }),
    )
    expect(container.textContent).not.toContain('Waiting for motion data.')
  })

  it('times out unknown startup to denied when orientation APIs exist but no provider emits', async () => {
    vi.useFakeTimers()

    mockSubscribeToOrientationPose.mockImplementationOnce(() => SENSOR_CONTROLLER)
    mockGetOrientationCapabilities.mockReturnValue({
      hasEvents: true,
      hasAbsoluteEvent: false,
      hasAbsoluteSensor: false,
      hasRelativeSensor: false,
      canRequestPermission: false,
    })

    await renderViewer({
      entry: 'live',
      location: 'unknown',
      camera: 'unknown',
      orientation: 'unknown',
    })

    await openDesktopViewerPanel()

    const startArButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Start AR'),
    )

    await act(async () => {
      startArButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_600)
    })
    await flushEffects()

    expect(mockRouterReplace).toHaveBeenLastCalledWith(
      buildViewerHref({
        entry: 'live',
        location: 'granted',
        camera: 'granted',
        orientation: 'denied',
      }),
    )
    expect(container.textContent).toContain('Motion recovery')
    expect(container.textContent).toContain('Motion access is still denied.')
  })

  it('times out unknown startup to unavailable when no orientation APIs exist', async () => {
    vi.useFakeTimers()

    mockSubscribeToOrientationPose.mockImplementationOnce(() => SENSOR_CONTROLLER)
    mockGetOrientationCapabilities.mockReturnValue({
      hasEvents: false,
      hasAbsoluteEvent: false,
      hasAbsoluteSensor: false,
      hasRelativeSensor: false,
      canRequestPermission: false,
    })

    await renderViewer({
      entry: 'live',
      location: 'unknown',
      camera: 'unknown',
      orientation: 'unknown',
    })

    await openDesktopViewerPanel()

    const startArButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Start AR'),
    )

    await act(async () => {
      startArButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_600)
    })
    await flushEffects()

    expect(mockRouterReplace).toHaveBeenLastCalledWith(
      buildViewerHref({
        entry: 'live',
        location: 'granted',
        camera: 'granted',
        orientation: 'unavailable',
      }),
    )
    expect(container.textContent).toContain('Motion recovery')
    expect(container.textContent).toContain('Motion sensors are unavailable')
  })

  it(
    'keeps location and orientation startup live in verified non-camera fallback',
    async () => {
      const originalRequestAnimationFrame = window.requestAnimationFrame
      const originalCancelAnimationFrame = window.cancelAnimationFrame

      Object.defineProperty(window, 'requestAnimationFrame', {
        configurable: true,
        writable: true,
        value: vi.fn(() => 1),
      })
      Object.defineProperty(window, 'cancelAnimationFrame', {
        configurable: true,
        writable: true,
        value: vi.fn(),
      })

      mockSubscribeToOrientationPose.mockImplementationOnce((onPose: (state: unknown) => void) => {
        onPose(
          createMockOrientationPoseUpdate({
            source: 'deviceorientation-absolute',
            providerKind: 'event',
            absolute: true,
          }),
        )
        return SENSOR_CONTROLLER
      })

      try {
        await renderViewer({
          entry: 'live',
          location: 'granted',
          camera: 'denied',
          orientation: 'granted',
        })

        expect(mockRequestStartupObserverState.mock.calls.length).toBeGreaterThanOrEqual(1)
        expect(mockStartObserverTracking.mock.calls.length).toBeGreaterThanOrEqual(1)
        expect(mockSubscribeToOrientationPose.mock.calls.length).toBeGreaterThanOrEqual(1)
        expect(mockRequestRearCameraStream).not.toHaveBeenCalled()
        expect(mockFetchAircraftSnapshot).toHaveBeenCalledTimes(1)
        expect(mockFetchSatelliteCatalog).toHaveBeenCalledTimes(1)

        const latestSettingsProps = () =>
          mockSettingsSheetProps.mock.calls.at(-1)?.[0] as
            | {
                onEnterDemoMode?: () => void
              }
            | undefined

        await act(async () => {
          latestSettingsProps()?.onEnterDemoMode?.()
        })
        await flushEffects()
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

    await openDesktopViewerPanel()

    expect(mockRequestStartupObserverState).not.toHaveBeenCalled()
    expect(mockStartObserverTracking).not.toHaveBeenCalled()
    expect(mockRequestRearCameraStream.mock.calls.length).toBeGreaterThanOrEqual(1)
    expect(mockSubscribeToOrientationPose.mock.calls.length).toBeGreaterThanOrEqual(1)
    expect(container.textContent).toContain('Location Manual observer')
  })

  it('shows the startup-blocked viewer panel before live startup begins', async () => {
    await renderViewer({
      entry: 'live',
      location: 'unknown',
      camera: 'unknown',
      orientation: 'unknown',
    })

    await openDesktopViewerPanel()

    expect(container.textContent).toContain('Start required')
    expect(container.textContent).toContain('Start AR from this viewer.')
    expect(container.textContent).toContain(
      'The viewer owns the live startup flow now. Use Start AR here to request motion access, attach the rear camera inline, and then resolve location or manual observer fallback.',
    )
    expect(container.textContent).toContain('Try demo mode')
  })

  it('supports keyboard panning in manual mode for desktop fallback', async () => {
    await renderViewer({
      entry: 'demo',
      location: 'unavailable',
      camera: 'unavailable',
      orientation: 'unavailable',
      demoScenarioId: 'sf-evening',
    })

    await openDesktopViewerPanel()

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

    await openDesktopViewerPanel()

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
    await flushEffects()
    await waitForMacrotask()

    const restoredTrigger = container.querySelector(
      '[data-testid="mobile-viewer-overlay-trigger"]',
    ) as HTMLButtonElement | null
    expect(container.querySelector('[data-testid="mobile-viewer-overlay"]')).toBeNull()
    expect(restoredTrigger).not.toBeNull()
  })

  it('closes the mobile viewer overlay on Escape and restores focus to the trigger', async () => {
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

    mobileTrigger!.focus()

    await act(async () => {
      mobileTrigger!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const mobileOverlay = container.querySelector(
      '[data-testid="mobile-viewer-overlay"]',
    ) as HTMLElement | null

    expect(mobileOverlay).not.toBeNull()

    await act(async () => {
      mobileOverlay!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }),
      )
    })
    await flushEffects()

    const restoredTrigger = container.querySelector(
      '[data-testid="mobile-viewer-overlay-trigger"]',
    ) as HTMLButtonElement | null
    expect(container.querySelector('[data-testid="mobile-viewer-overlay"]')).toBeNull()
    expect(document.activeElement).toBe(restoredTrigger)
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
    expect(container.querySelector('[data-testid="mobile-viewer-overlay-shell"]')).not.toBeNull()
    expect(mobileOverlay?.querySelector('[data-testid="settings-sheet"]')).not.toBeNull()
    expect(mobileOverlay?.textContent).toContain('Start AR')
    expect(mobileOverlay?.textContent).toContain('Try demo mode')

    const backdrop = container.querySelector(
      '[data-testid="mobile-viewer-overlay-backdrop"]',
    ) as HTMLButtonElement | null

    expect(backdrop).not.toBeNull()

    await act(async () => {
      backdrop!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()
    await waitForMacrotask()

    expect(container.querySelector('[data-testid="mobile-viewer-overlay"]')).toBeNull()
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
      /SkyLens will enable alignment after the next usable live motion sample arrives for .*?\./,
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
    expect(container.querySelector('[data-testid="mobile-alignment-overlay-shell"]')).not.toBeNull()
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
    const quickActions = container.querySelector(
      '[data-testid="mobile-viewer-quick-actions"]',
    ) as HTMLElement | null
    const alignmentOverlayShell = container.querySelector(
      '[data-testid="mobile-alignment-overlay-shell"]',
    ) as HTMLElement | null
    const alignmentOverlayPanel = container.querySelector(
      '[data-testid="mobile-alignment-overlay-panel"]',
    ) as HTMLElement | null
    const alignmentOverlayScrollRegion = container.querySelector(
      '[data-testid="mobile-alignment-overlay-scroll-region"]',
    ) as HTMLElement | null

    expect(container.querySelector('[data-testid="mobile-viewer-overlay"]')).toBeNull()
    expect(container.querySelector('[data-testid="mobile-viewer-overlay-trigger"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="mobile-permission-action"]')).toBeNull()
    expect(readViewerSettings().poseCalibration.calibrated).toBe(false)
    expect(SENSOR_CONTROLLER.setCalibration.mock.calls.length).toBe(calibrationCallsBefore)
    expect(container.querySelector('[data-testid="mobile-align-action"]')).not.toBeNull()
    expect(alignmentOverlayShell).not.toBeNull()
    expect(alignmentOverlayShell?.className).toContain('fixed')
    expect(alignmentOverlayShell?.className).toContain('z-40')
    expect(alignmentOverlayPanel).not.toBeNull()
    expect(alignmentOverlayPanel?.className).toContain('max-h-full')
    expect(alignmentOverlayPanel?.className).toContain('overflow-hidden')
    expect(alignmentOverlayPanel?.style.maxHeight).toBe(
      'calc(100dvh - (2rem + env(safe-area-inset-top) + env(safe-area-inset-bottom)))',
    )
    expect(alignmentOverlayScrollRegion).not.toBeNull()
    expect(alignmentOverlayScrollRegion?.className).toContain('overflow-y-auto')
    expect(alignmentOverlayScrollRegion?.className).toContain('overscroll-contain')
    expect(container.querySelector('[data-testid="alignment-instructions-panel"]')).not.toBeNull()
    expect(
      quickActions?.querySelector('[data-testid="alignment-instructions-panel"]'),
    ).toBeNull()
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

  it('matches compact alignment max height to the compact mobile viewer overlay contract', async () => {
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
    const openViewerButton = container.querySelector(
      '[data-testid="mobile-viewer-overlay-trigger"]',
    ) as HTMLButtonElement | null

    await act(async () => {
      alignButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    await act(async () => {
      openViewerButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    const compactViewerOverlay = container.querySelector(
      '[data-testid="mobile-viewer-overlay"]',
    ) as HTMLElement | null
    const compactAlignmentPanel = container.querySelector(
      '[data-testid="mobile-alignment-overlay-panel"]',
    ) as HTMLElement | null

    expect(compactViewerOverlay).not.toBeNull()
    expect(compactAlignmentPanel).not.toBeNull()
    expect(compactAlignmentPanel?.style.maxHeight).toBe(compactViewerOverlay?.style.maxHeight)
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
    await waitForMacrotask()

    expect(container.querySelector('[data-testid="alignment-instructions-panel"]')).toBeNull()
    expect(container.querySelector('[data-testid="alignment-crosshair-button"]')).toBeNull()
    expect(container.querySelector('[data-testid="mobile-alignment-overlay-shell"]')).toBeNull()
    const alignButton = container.querySelector(
      '[data-testid="mobile-align-action"]',
    ) as HTMLButtonElement | null

    expect(alignButton).not.toBeNull()
  })

  it('closes the alignment overlay on backdrop click and restores focus to mobile Align', async () => {
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

    alignButton!.focus()

    await act(async () => {
      alignButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    const backdrop = container.querySelector(
      '[data-testid="mobile-alignment-overlay-backdrop"]',
    ) as HTMLButtonElement | null

    expect(backdrop).not.toBeNull()

    await act(async () => {
      backdrop!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    const restoredAlignButton = container.querySelector(
      '[data-testid="mobile-align-action"]',
    ) as HTMLButtonElement | null

    expect(container.querySelector('[data-testid="mobile-alignment-overlay-shell"]')).toBeNull()
    expect(document.activeElement).toBe(restoredAlignButton)
  })

  it('falls back to the mobile Align action when alignment closes after its settings opener unmounts', async () => {
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

    const openViewerButton = container.querySelector(
      '[data-testid="mobile-viewer-overlay-trigger"]',
    ) as HTMLButtonElement | null

    await act(async () => {
      openViewerButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    const mobileOverlay = container.querySelector(
      '[data-testid="mobile-viewer-overlay"]',
    ) as HTMLElement | null
    const settingsButton = mobileOverlay?.querySelector(
      '[data-testid="settings-sheet"]',
    ) as HTMLButtonElement | null

    expect(settingsButton).not.toBeNull()

    settingsButton!.focus()

    await act(async () => {
      latestSettingsProps()?.onFixAlignment?.()
    })
    await flushEffects()

    expect(container.querySelector('[data-testid="mobile-viewer-overlay"]')).toBeNull()
    expect(container.querySelector('[data-testid="mobile-alignment-overlay-shell"]')).not.toBeNull()

    const closeButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Close'),
    ) as HTMLButtonElement | undefined

    expect(closeButton).toBeDefined()

    await act(async () => {
      closeButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    const alignFallbackButton = container.querySelector(
      '[data-testid="mobile-align-action"]',
    ) as HTMLButtonElement | null

    expect(container.querySelector('[data-testid="mobile-alignment-overlay-shell"]')).toBeNull()
    expect(alignFallbackButton).not.toBeNull()
    expect(document.activeElement).toBe(alignFallbackButton)
  })

  it('prefers the visible mobile settings trigger when alignment closes over a reopened mobile viewer overlay', async () => {
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

    const openViewerButton = container.querySelector(
      '[data-testid="mobile-viewer-overlay-trigger"]',
    ) as HTMLButtonElement | null

    await act(async () => {
      openViewerButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    const mobileOverlay = container.querySelector(
      '[data-testid="mobile-viewer-overlay"]',
    ) as HTMLElement | null
    const mobileSettingsButton = mobileOverlay?.querySelector(
      '[data-focus-surface="mobile-settings-trigger"]',
    ) as HTMLButtonElement | null

    expect(mobileSettingsButton).not.toBeNull()

    mobileSettingsButton!.focus()

    await act(async () => {
      latestSettingsProps()?.onFixAlignment?.()
    })
    await flushEffects()

    const reopenedViewerButton = container.querySelector(
      '[data-testid="mobile-viewer-overlay-trigger"]',
    ) as HTMLButtonElement | null

    expect(reopenedViewerButton).not.toBeNull()

    await act(async () => {
      reopenedViewerButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    const alignmentBackdrop = container.querySelector(
      '[data-testid="mobile-alignment-overlay-backdrop"]',
    ) as HTMLButtonElement | null

    expect(alignmentBackdrop).not.toBeNull()

    await act(async () => {
      alignmentBackdrop!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    const reopenedOverlay = container.querySelector(
      '[data-testid="mobile-viewer-overlay"]',
    ) as HTMLElement | null
    const restoredMobileSettingsButton = reopenedOverlay?.querySelector(
      '[data-focus-surface="mobile-settings-trigger"]',
    ) as HTMLButtonElement | null

    expect(container.querySelector('[data-testid="mobile-alignment-overlay-shell"]')).toBeNull()
    expect(reopenedOverlay).not.toBeNull()
    expect(restoredMobileSettingsButton).not.toBeNull()
    expect(document.activeElement).toBe(restoredMobileSettingsButton)
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
    expect(container.querySelector('[data-testid="mobile-alignment-overlay-shell"]')).toBeNull()
    expect(container.querySelector('[data-testid="mobile-alignment-overlay-backdrop"]')).toBeNull()
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

    await openDesktopViewerPanel()

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

  it('locks and unlocks document scroll from ViewerShell when the settings sheet reports open state', async () => {
    await renderViewer({
      entry: 'demo',
      location: 'unavailable',
      camera: 'unavailable',
      orientation: 'unavailable',
      demoScenarioId: 'sf-evening',
    })

    const latestSettingsProps = () =>
      mockSettingsSheetProps.mock.calls.at(-1)?.[0] as
        | {
            onOpenChange?: (open: boolean) => void
          }
        | undefined

    expect(document.documentElement.style.overflow).toBe('')
    expect(document.body.style.overflow).toBe('')

    await act(async () => {
      latestSettingsProps()?.onOpenChange?.(true)
    })
    await flushEffects()

    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.body.style.overflow).toBe('hidden')

    await act(async () => {
      latestSettingsProps()?.onOpenChange?.(false)
    })
    await flushEffects()

    expect(document.documentElement.style.overflow).toBe('')
    expect(document.body.style.overflow).toBe('')
  })

  it('keeps the viewer-level scroll lock active when settings stays open after the live camera lock clears', async () => {
    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'granted',
      orientation: 'granted',
    })

    const latestSettingsProps = () =>
      mockSettingsSheetProps.mock.calls.at(-1)?.[0] as
        | {
            onOpenChange?: (open: boolean) => void
            onEnterDemoMode?: () => void
          }
        | undefined

    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.body.style.overflow).toBe('hidden')

    await act(async () => {
      latestSettingsProps()?.onOpenChange?.(true)
    })
    await flushEffects()

    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.body.style.overflow).toBe('hidden')

    await act(async () => {
      latestSettingsProps()?.onEnterDemoMode?.()
    })
    await flushEffects()

    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.body.style.overflow).toBe('hidden')

    await act(async () => {
      latestSettingsProps()?.onOpenChange?.(false)
    })
    await flushEffects()

    expect(document.documentElement.style.overflow).toBe('')
    expect(document.body.style.overflow).toBe('')
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

    const alignmentPanel = container.querySelector(
      '[data-testid="alignment-instructions-panel"]',
    ) as HTMLElement | null
    const alignmentOverlayPanel = container.querySelector(
      '[data-testid="mobile-alignment-overlay-panel"]',
    ) as HTMLElement | null
    const alignmentScrollRegion = container.querySelector(
      '[data-testid="mobile-alignment-overlay-scroll-region"]',
    ) as HTMLElement | null
    const startAlignmentButton = container.querySelector(
      '[data-testid="alignment-start-action"]',
    ) as HTMLButtonElement | null

    expect(alignmentPanel).not.toBeNull()
    expect(alignmentOverlayPanel).not.toBeNull()
    expect(alignmentOverlayPanel?.style.maxHeight).toBe(
      'calc(100dvh - (2rem + env(safe-area-inset-top) + env(safe-area-inset-bottom)))',
    )
    expect(alignmentScrollRegion?.className).toContain('overflow-y-auto')
    expect(alignmentScrollRegion?.className).toContain('overscroll-contain')
    expect(startAlignmentButton).not.toBeNull()
    expect(startAlignmentButton?.disabled).toBe(false)
  })

  it('keeps motion-only retries pending until a usable sample arrives', async () => {
    let emitPose:
      | ((state: ReturnType<typeof createMockOrientationPoseUpdate>) => void)
      | null = null

    mockSubscribeToOrientationPose.mockImplementation((onPose: (state: unknown) => void) => {
      emitPose = onPose as (state: ReturnType<typeof createMockOrientationPoseUpdate>) => void
      return SENSOR_CONTROLLER
    })

    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'granted',
      orientation: 'denied',
    })

    await openDesktopViewerPanel()

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
    expect(mockRouterReplace).toHaveBeenCalledWith(
      buildViewerHref({
        entry: 'live',
        location: 'granted',
        camera: 'granted',
        orientation: 'unknown',
      }),
    )
    expect(container.textContent).toContain('Waiting for motion data.')
    expect(container.textContent).toContain('Motion Pending')
    expect(container.textContent).toContain('Sensor Waiting')
    expect(emitPose).not.toBeNull()

    await act(async () => {
      emitPose?.(
        createMockOrientationPoseUpdate({
          source: 'deviceorientation-absolute',
          providerKind: 'event',
          absolute: true,
        }),
      )
    })
    await flushEffects()
    await act(async () => {
      emitPose?.(
        createMockOrientationPoseUpdate({
          source: 'deviceorientation-absolute',
          providerKind: 'event',
          absolute: true,
        }),
      )
    })
    await flushEffects()

    expect(mockRouterReplace).toHaveBeenLastCalledWith(
      buildViewerHref({
        entry: 'live',
        location: 'granted',
        camera: 'granted',
        orientation: 'granted',
      }),
    )
    expect(container.textContent).not.toContain('Motion recovery')
  })

  it('clears stale live sensor state when switching into demo mode', async () => {
    let emitPose:
      | ((state: ReturnType<typeof createMockOrientationPoseUpdate>) => void)
      | null = null

    mockSubscribeToOrientationPose.mockImplementation((onPose: (state: unknown) => void) => {
      emitPose = onPose as (state: ReturnType<typeof createMockOrientationPoseUpdate>) => void
      return SENSOR_CONTROLLER
    })

    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'granted',
      orientation: 'granted',
    })

    await openDesktopViewerPanel()

    await act(async () => {
      emitPose?.(
        createMockOrientationPoseUpdate({
          source: 'deviceorientation-absolute',
          providerKind: 'event',
          absolute: true,
        }),
      )
    })
    await flushEffects()

    expect(container.textContent).toContain('Sensor Absolute')

    const latestSettingsProps = () =>
      mockSettingsSheetProps.mock.calls.at(-1)?.[0] as
        | {
            onEnterDemoMode?: () => void
          }
        | undefined

    await act(async () => {
      latestSettingsProps()?.onEnterDemoMode?.()
    })
    await flushEffects()

    expect(SENSOR_CONTROLLER.stop).toHaveBeenCalled()
    expect(container.textContent).toContain('Sensor Manual')
    expect(container.textContent).not.toContain('Sensor Absolute')
  })

  it('times out a motion-only retry back to denied when no provider emits after the prompt succeeds', async () => {
    vi.useFakeTimers()

    mockSubscribeToOrientationPose.mockImplementationOnce(() => SENSOR_CONTROLLER)
    mockGetOrientationCapabilities.mockReturnValue({
      hasEvents: true,
      hasAbsoluteEvent: false,
      hasAbsoluteSensor: false,
      hasRelativeSensor: false,
      canRequestPermission: false,
    })

    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'granted',
      orientation: 'denied',
    })

    await openDesktopViewerPanel()

    const enableMotionButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Enable motion'),
    )

    expect(enableMotionButton).toBeDefined()

    await act(async () => {
      enableMotionButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_600)
    })
    await flushEffects()

    expect(mockRouterReplace).toHaveBeenNthCalledWith(
      1,
      buildViewerHref({
        entry: 'live',
        location: 'granted',
        camera: 'granted',
        orientation: 'unknown',
      }),
    )
    expect(mockRouterReplace).toHaveBeenLastCalledWith(
      buildViewerHref({
        entry: 'live',
        location: 'granted',
        camera: 'granted',
        orientation: 'denied',
      }),
    )
    expect(container.textContent).toContain('Motion recovery')
    expect(container.textContent).toContain('Motion access is still denied.')
  })

  it('switches motion recovery help copy by browser family without changing the provider flow', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36',
    })

    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'granted',
      orientation: 'denied',
    })

    await openDesktopViewerPanel()

    expect(container.textContent).toContain('Motion recovery')
    expect(container.textContent).toContain(
      'On Chrome for Android, confirm site motion sensors are allowed for this origin, then retry from the viewer.',
    )
  })

  it('reuses the combined recovery CTA inside the motion panel when camera and motion are both missing', async () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame
    const originalCancelAnimationFrame = window.cancelAnimationFrame

    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 1),
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
        camera: 'denied',
        orientation: 'denied',
      })

      await openDesktopViewerPanel()

      expect(container.textContent).toContain('Motion recovery')

      const enableCameraAndMotionButton = Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent?.includes('Enable camera and motion'),
      )

      expect(enableCameraAndMotionButton).toBeDefined()

      act(() => {
        enableCameraAndMotionButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await flushEffects()
      await flushEffects()

      expect(mockRequestOrientationPermission).toHaveBeenCalledTimes(1)
      expect(mockRequestRearCameraStream).toHaveBeenCalledTimes(1)
      expect(mockRouterReplace).toHaveBeenCalledWith(
        buildViewerHref({
          entry: 'live',
          location: 'granted',
          camera: 'granted',
          orientation: 'unknown',
        }),
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
    }
  })

  it('keeps camera recovery active when combined motion retry throws and surfaces the motion retry error', async () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame
    const originalCancelAnimationFrame = window.cancelAnimationFrame

    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 1),
    })
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    })

    mockRequestOrientationPermission.mockRejectedValueOnce(new Error('motion retry failed'))

    try {
      await renderViewer({
        entry: 'live',
        location: 'granted',
        camera: 'denied',
        orientation: 'denied',
      })

      await openDesktopViewerPanel()

      const enableCameraAndMotionButton = Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent?.includes('Enable camera and motion'),
      )

      expect(enableCameraAndMotionButton).toBeDefined()

      act(() => {
        enableCameraAndMotionButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await flushEffects()
      await flushEffects()

      expect(mockRequestOrientationPermission).toHaveBeenCalledTimes(1)
      expect(mockRequestRearCameraStream).toHaveBeenCalledTimes(1)
      expect(mockRouterReplace).toHaveBeenCalledWith(
        buildViewerHref({
          entry: 'live',
          location: 'granted',
          camera: 'granted',
          orientation: 'denied',
        }),
      )
      expect(container.textContent).toContain('Motion recovery')
      expect(container.textContent).toContain('Unable to retry motion permission right now.')

      const latestSettingsProps = () =>
        mockSettingsSheetProps.mock.calls.at(-1)?.[0] as
          | {
              onEnterDemoMode?: () => void
            }
          | undefined

      await act(async () => {
        latestSettingsProps()?.onEnterDemoMode?.()
      })
      await flushEffects()
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

  it('keeps motion recovery visible and syncs denied retry state to the route', async () => {
    mockRequestOrientationPermission.mockResolvedValueOnce('denied')

    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'granted',
      orientation: 'denied',
    })

    await openDesktopViewerPanel()

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

  it('shows the motion-disabled warning copy in live fallback overlays', async () => {
    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'granted',
      orientation: 'denied',
    })

    await openDesktopViewerPanel()

    expect(container.textContent).toContain('Motion is not enabled.')
    expect(container.textContent).toContain(
      'Sky elements will not appear in the right location until motion is enabled.',
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

    await openDesktopViewerPanel()

    expect(container.textContent).toContain('Relative sensor mode needs alignment.')
    expect(container.textContent).toMatch(
      /Center .* in the crosshair, then align before trusting label placement\./,
    )
    expect(container.querySelector('[data-testid="alignment-instructions-panel"]')).toBeNull()
    expect(container.textContent).toContain('Motion Relative event')
    expect(container.textContent).toContain('Sensor Calibrate')
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

    await openDesktopViewerPanel()

    expect(container.textContent).toContain('Motion Absolute sensor')
    expect(container.textContent).toContain('Sensor Absolute sensor')
    expect(container.textContent).not.toContain('Relative sensor mode needs alignment.')
  })

  it('renders development diagnostics from the selected provider state', async () => {
    let emitPose:
      | ((state: ReturnType<typeof createMockOrientationPoseUpdate>) => void)
      | null = null

    mockSubscribeToOrientationPose.mockImplementation((onPose: (state: unknown) => void) => {
      emitPose = onPose as (state: ReturnType<typeof createMockOrientationPoseUpdate>) => void
      return SENSOR_CONTROLLER
    })

    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'granted',
      orientation: 'granted',
    })
    await openDesktopViewerPanel()
    await flushEffects()
    await act(async () => {
      emitPose?.(
        createMockOrientationPoseUpdate({
          source: 'absolute-sensor',
          providerKind: 'sensor',
          absolute: true,
          calibrated: true,
        }),
      )
    })
    await flushEffects()
    await act(async () => {
      emitPose?.(
        createMockOrientationPoseUpdate({
          source: 'absolute-sensor',
          providerKind: 'sensor',
          absolute: true,
          calibrated: true,
        }),
      )
    })
    await flushEffects()

    const diagnostics = container.querySelector(
      '[data-testid="orientation-diagnostics"]',
    ) as HTMLElement | null

    expect(diagnostics).not.toBeNull()
    expect(diagnostics?.textContent).toContain('Orientation diagnostics')
    expect(diagnostics?.textContent).toContain('Selected source')
    expect(diagnostics?.textContent).toContain('absolute-sensor')
    expect(diagnostics?.textContent).toContain('Provider kind')
    expect(diagnostics?.textContent).toContain('sensor')
    expect(diagnostics?.textContent).toContain('Calibration active')
    expect(diagnostics?.textContent).toContain('yes')
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

  it('ingests successive live aircraft snapshots into the persistent tracker', async () => {
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
        trackDeg: 210,
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
        trackDeg: 214,
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

      expect(mockAircraftTracker.ingest).toHaveBeenCalledWith(firstSnapshot)

      const firstCall = mockResolveAircraftMotionObjects.mock.calls.at(-1)?.[0] as
        | { tracker?: unknown }
        | undefined

      expect(firstCall?.tracker).toBe(mockAircraftTracker)

      await act(async () => {
        vi.advanceTimersByTime(15_000)
      })
      await flushEffects()

      expect(mockAircraftTracker.ingest).toHaveBeenNthCalledWith(2, secondSnapshot)
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
        trackDeg: 210,
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

      expect(mockAircraftTracker.ingest).toHaveBeenCalledTimes(1)

      await act(async () => {
        vi.advanceTimersByTime(15_000)
      })
      await flushEffects()

      expect(mockAircraftTracker.ingest).toHaveBeenCalledTimes(1)
      expect(mockAircraftTracker.reset).toHaveBeenCalledTimes(1)
    } finally {
      restoreAnimationFrame()
    }
  })

  it('falls back to the standard high-quality cadence after a failed poll with a stale bucket timestamp', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-26T00:00:00.000Z'))
    writeViewerSettings({
      ...readViewerSettings(),
      motionQuality: 'high',
    })
    const restoreAnimationFrame = installAnimationFrameClock()
    const firstSnapshot = createAircraftSnapshot('2026-03-26T00:00:00.000Z', [])

    mockFetchAircraftSnapshot
      .mockResolvedValueOnce(firstSnapshot)
      .mockRejectedValueOnce(new Error('temporary outage'))
      .mockResolvedValue(firstSnapshot)

    try {
      await renderViewer({
        entry: 'live',
        location: 'granted',
        camera: 'granted',
        orientation: 'granted',
      })
      await flushEffects()

      expect(mockFetchAircraftSnapshot).toHaveBeenCalledTimes(1)

      await act(async () => {
        vi.advanceTimersByTime(10_500)
      })
      await flushEffects()

      expect(mockFetchAircraftSnapshot).toHaveBeenCalledTimes(2)

      await act(async () => {
        vi.advanceTimersByTime(500)
      })
      await flushEffects()

      expect(mockFetchAircraftSnapshot).toHaveBeenCalledTimes(2)

      await act(async () => {
        vi.advanceTimersByTime(10_000)
      })
      await flushEffects()

      expect(mockFetchAircraftSnapshot).toHaveBeenCalledTimes(3)
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
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-26T00:00:00.000Z'))

    const restoreAnimationFrame = installAnimationFrameClock()

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

    try {
      await renderViewer({
        entry: 'demo',
        location: 'unavailable',
        camera: 'unavailable',
        orientation: 'unavailable',
        demoScenarioId: 'tokyo-iss',
      })
      await flushEffects()
      await act(async () => {
        vi.advanceTimersByTime(16)
      })
      await flushEffects()

      const marker = container.querySelector(
        '[data-testid="sky-object-marker"][data-object-id="icao24-estui"]',
      ) as HTMLButtonElement | null

      expect(marker).not.toBeNull()
      expect(marker?.getAttribute('aria-label')).toContain('Aircraft Estimated')

      await act(async () => {
        marker?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        vi.advanceTimersByTime(16)
      })
      await flushEffects()

      expect(marker?.getAttribute('aria-pressed')).toBe('true')
      expect(container.textContent).toContain('Selected object')
      expect(container.textContent).toContain('Aircraft Estimated')
      expect(
        Array.from(container.querySelectorAll('span')).some(
          (element) => element.textContent?.trim() === 'Estimated',
        ),
      ).toBe(true)
    } finally {
      restoreAnimationFrame()
    }
  }, 10_000)

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
      await openDesktopViewerPanel()

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

    expect(SENSOR_CONTROLLER.setCalibration.mock.calls.length).toBe(calibrationCallsBefore + 1)
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

    expect(SENSOR_CONTROLLER.setCalibration.mock.calls.length).toBe(calibrationCallsBefore + 2)
    expect(readViewerSettings().poseCalibration.calibrated).toBe(false)
  })

  it('uses video-frame metadata when requestVideoFrameCallback is available', async () => {
    vi.useFakeTimers()

    const handles = new Map<number, number>()
    let nextHandle = 1
    const requestVideoFrameCallbackMock = vi.fn(
      (callback: (now: number, metadata: { width?: number; height?: number }) => void) => {
        const handle = nextHandle++
        const timeoutId = window.setTimeout(() => {
          handles.delete(handle)
          callback(Date.now(), { width: 1920, height: 1080 })
        }, 16)

        handles.set(handle, timeoutId)
        return handle
      },
    )
    const cancelVideoFrameCallbackMock = vi.fn((handle: number) => {
      const timeoutId = handles.get(handle)

      if (typeof timeoutId === 'number') {
        window.clearTimeout(timeoutId)
        handles.delete(handle)
      }
    })
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
      value: requestVideoFrameCallbackMock,
    })
    Object.defineProperty(HTMLVideoElement.prototype, 'cancelVideoFrameCallback', {
      configurable: true,
      value: cancelVideoFrameCallbackMock,
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
      expect(requestVideoFrameCallbackMock).toHaveBeenCalledTimes(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(16)
      })
      await flushEffects()

      expect(requestVideoFrameCallbackMock).toHaveBeenCalledTimes(2)

      await act(async () => {
        root.unmount()
      })
      rootMounted = false
      expect(cancelVideoFrameCallbackMock).toHaveBeenCalled()
    } finally {
      handles.forEach((timeoutId) => {
        window.clearTimeout(timeoutId)
      })
      handles.clear()
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

  it('surfaces relative sensor status and alignment-required messaging when calibration is still needed', async () => {
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

    await openDesktopViewerPanel()

    expect(container.textContent).toContain('Sensor Calibrate')
    expect(container.textContent).toContain('Motion Relative event')
    expect(container.textContent).toContain('Relative sensor mode needs alignment.')
  })

  it('keeps desktop chrome compact until the viewer panel is explicitly opened', async () => {
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
    const desktopActions = container.querySelector(
      '[data-testid="desktop-viewer-actions"]',
    ) as HTMLElement | null
    const desktopViewerPanel = container.querySelector(
      '[data-testid="desktop-viewer-panel"]',
    ) as HTMLElement | null
    const desktopNextAction = container.querySelector(
      '[data-testid="desktop-next-action"]',
    ) as HTMLElement | null
    const openViewerButton = container.querySelector(
      '[data-testid="desktop-open-viewer-action"]',
    ) as HTMLButtonElement | null
    const topWarningStack = container.querySelector(
      '[data-testid="viewer-top-warning-stack"]',
    ) as HTMLElement | null

    expect(desktopHeader).not.toBeNull()
    expect(desktopHeader?.textContent).toContain('SkyLens')
    expect(desktopHeader?.querySelector('[data-testid="settings-sheet"]')).not.toBeNull()
    expect(desktopNextAction?.textContent).toContain('Open the viewer details')
    expect(desktopNextAction?.textContent).toContain(
      'Inspect the current crosshair object, selected target, and fallback state without covering the stage.',
    )
    expect(openViewerButton?.textContent).toContain('Open viewer')
    expect(desktopActions?.textContent).not.toContain('Open viewer')
    expect(desktopActions?.textContent).toContain('Enable camera')
    expect(desktopActions?.textContent).toContain('Motion')
    expect(desktopActions?.textContent).toContain('Align')
    expect(topWarningStack).not.toBeNull()
    expect(topWarningStack?.className).toContain('hidden')
    expect(topWarningStack?.className).toContain('sm:flex')
    expect(desktopViewerPanel).toBeNull()

    await act(async () => {
      openViewerButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.querySelector('[data-testid="desktop-viewer-panel"]')?.textContent).toContain(
      'Viewer snapshot',
    )
    expect(container.querySelector('[data-testid="desktop-viewer-panel"]')?.textContent).toContain(
      'Privacy reassurance',
    )
  })

  it('uses hover for desktop summary focus without clearing explicit selection details', async () => {
    await renderViewer({
      entry: 'demo',
      location: 'unavailable',
      camera: 'unavailable',
      orientation: 'unavailable',
      demoScenarioId: 'sf-evening',
    })

    const markerButtons = Array.from(
      container.querySelectorAll('[data-testid="sky-object-marker"]'),
    ) as HTMLButtonElement[]
    const polarisButton = markerButtons.find((button) =>
      button.getAttribute('aria-label')?.includes('Polaris'),
    )
    const secondaryButton = markerButtons.find((button) => button !== polarisButton)
    const activeSummary = container.querySelector(
      '[data-testid="desktop-active-object-summary"]',
    ) as HTMLElement | null

    expect(polarisButton).toBeDefined()
    expect(secondaryButton).toBeDefined()

    await act(async () => {
      dispatchPointerEvent(polarisButton!, 'pointerover', {
        pointerId: 3,
        clientX: 120,
        clientY: 120,
      })
    })

    expect(activeSummary?.textContent).toContain('Polaris')

    await act(async () => {
      polarisButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.querySelector('[data-testid="desktop-viewer-panel"]')?.textContent).toContain(
      'Selected object',
    )
    expect(container.querySelector('[data-testid="desktop-viewer-panel"]')?.textContent).toContain(
      'Polaris',
    )

    const secondaryLabel = extractMarkerLabel(secondaryButton!)

    await act(async () => {
      dispatchPointerEvent(secondaryButton!, 'pointerover', {
        pointerId: 4,
        clientX: 160,
        clientY: 120,
      })
    })

    expect(activeSummary?.textContent).toContain(secondaryLabel)
    expect(container.querySelector('[data-testid="desktop-viewer-panel"]')?.textContent).toContain(
      'Selected object',
    )
    expect(container.querySelector('[data-testid="desktop-viewer-panel"]')?.textContent).toContain(
      'Polaris',
    )

    await act(async () => {
      dispatchPointerEvent(secondaryButton!, 'pointerout', {
        pointerId: 4,
        clientX: 160,
        clientY: 120,
      })
    })

    expect(activeSummary?.textContent).toContain('Polaris')
  })

  it('disables the desktop Align action when manual pan is active', async () => {
    await renderViewer({
      entry: 'live',
      location: 'granted',
      camera: 'granted',
      orientation: 'denied',
    })

    const alignButton = container.querySelector(
      '[data-testid="desktop-align-action"]',
    ) as HTMLButtonElement | null

    expect(alignButton).not.toBeNull()
    expect(alignButton?.disabled).toBe(true)
    expect(alignButton?.textContent).toContain('Motion required')
  })

  async function renderViewer(initialState: ViewerRouteState) {
    await act(async () => {
      root.render(React.createElement(ViewerShell, { initialState }))
    })
    rootMounted = true

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
      await Promise.resolve()
    })
  }

  async function waitForMacrotask() {
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })
  }
})

function createMockOrientationPoseUpdate({
  source,
  providerKind,
  absolute,
  compassBacked = false,
  compassHeadingDeg,
  compassAccuracyDeg,
  calibrated = false,
  timestampMs = Date.UTC(2026, 2, 26, 0, 45, 6),
}: {
  source: 'absolute-sensor' | 'relative-sensor' | 'deviceorientation-absolute' | 'deviceorientation-relative'
  providerKind: 'sensor' | 'event'
  absolute: boolean
  compassBacked?: boolean
  compassHeadingDeg?: number
  compassAccuracyDeg?: number
  calibrated?: boolean
  timestampMs?: number
}) {
  return {
    pose: {
      yawDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
      quaternion: [0, 0, 0, 1],
      alignmentHealth: absolute ? 'good' : 'poor',
      mode: 'sensor' as const,
    },
    sample: {
      source,
      absolute,
      needsCalibration: !absolute && !calibrated,
      timestampMs,
      headingDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
      quaternion: [0, 0, 0, 1] as [number, number, number, number],
      rawQuaternion: [0, 0, 0, 1] as [number, number, number, number],
      rawSample: {
        source,
        providerKind,
        localFrame: providerKind === 'sensor' ? 'screen' : 'device',
        absolute,
        timestampMs,
        worldFromLocal: [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ] as [[number, number, number], [number, number, number], [number, number, number]],
        compassBacked,
        compassHeadingDeg,
        compassAccuracyDeg,
      },
      reportedCompassHeadingDeg: compassHeadingDeg,
      compassAccuracyDeg,
      compassBacked,
    },
    history: [],
    orientationSource: source,
    orientationAbsolute: absolute,
    orientationNeedsCalibration: !absolute && !calibrated,
    poseCalibration: {
      offsetQuaternion: [0, 0, 0, 1] as [number, number, number, number],
      calibrated,
      sourceAtCalibration: calibrated ? source : null,
      lastCalibratedAtMs: calibrated ? timestampMs : null,
    },
  }
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

function createAircraftSnapshot(
  fetchedAt: string,
  aircraft: Array<{
    id: string
    callsign?: string
    lat: number
    lon: number
    geoAltitudeM?: number
    velocityMps?: number
    trackDeg?: number
    azimuthDeg: number
    elevationDeg: number
    rangeKm: number
  }>,
) {
  return {
    fetchedAt,
    snapshotTimeS: Math.floor(Date.parse(fetchedAt) / 1_000),
    observer: {
      lat: LIVE_OBSERVER_FIXTURE.lat,
      lon: LIVE_OBSERVER_FIXTURE.lon,
      altMeters: LIVE_OBSERVER_FIXTURE.altMeters,
    },
    availability: 'available' as const,
    aircraft: aircraft.map(({ trackDeg, ...entry }) => ({
      ...entry,
      ...(typeof trackDeg === 'number' ? { trackDeg } : {}),
    })),
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

function extractMarkerLabel(button: HTMLButtonElement) {
  return (button.getAttribute('aria-label') ?? '').replace(
    / (Aircraft|Satellite|Sun|Moon|Planet|Star|Major star pattern)( .*)?$/,
    '',
  )
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
    handles.forEach((timeoutId) => {
      window.clearTimeout(timeoutId)
    })
    handles.clear()

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
