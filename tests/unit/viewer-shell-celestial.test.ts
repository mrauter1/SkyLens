import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewerRouteState } from '../../lib/permissions/coordinator'

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
    window.localStorage.clear()
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
    window.localStorage.clear()
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
    expect(container.textContent).toContain('Target North marker')
  })

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
  })

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

    expect(container.textContent).toContain('Target Sun')
    expect(latestSettingsProps()?.alignmentTargetAvailability).toEqual({
      sun: true,
      moon: false,
    })
    expect(latestSettingsProps()?.alignmentTargetFallbackLabel).toBe('Sun')
  })

  it('renders target-aware fallback instructions in the live alignment panel', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    })

    mockNormalizeCelestialObjects.mockReturnValue({
      sunAltitudeDeg: -12,
      objects: [
        {
          id: 'planet-venus',
          type: 'planet',
          label: 'Venus',
          azimuthDeg: 14,
          elevationDeg: 22,
          importance: 82,
          metadata: {
            detail: {
              typeLabel: 'Planet',
              elevationDeg: 22,
              azimuthDeg: 14,
              magnitude: -4.3,
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

    expect(container.textContent).toContain('Current target Venus')
    expect(container.textContent).toContain(
      'Moon is unavailable. SkyLens will use Venus if you align now.',
    )
    expect(container.textContent).toContain(
      'Center Venus in the crosshair, then press the middle of the screen to align.',
    )
    expect(container.textContent).not.toContain('Choose Sun or Moon as your preferred target.')
    expect(container.querySelector('[data-testid="alignment-instructions-panel"]')).not.toBeNull()
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
      'Center Moon in the crosshair, then press the middle of the screen to align.',
    )

    await act(async () => {
      sunButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flushEffects()

    expect(container.textContent).toContain('Current target Sun')
    expect(container.textContent).toContain(
      'Center Sun in the crosshair, then press the middle of the screen to align.',
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

  it('allows dim stars to shrink to 1 px without changing brighter star sizes or the non-star minimum at scale 1', async () => {
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

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
    })

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
  })

  it('applies the mobile marker scale slider live and persists the chosen scale', async () => {
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

    const slider = container.querySelector(
      '[data-testid="mobile-marker-scale-slider"]',
    ) as HTMLInputElement | null
    const sliderValue = container.querySelector(
      '[data-testid="mobile-marker-scale-value"]',
    ) as HTMLElement | null
    const dimStarMarker = container.querySelector(
      '[data-testid="sky-object-marker"][data-object-id="star-dim"]',
    ) as HTMLButtonElement | null

    expect(slider).not.toBeNull()
    expect(slider?.value).toBe('1')
    expect(sliderValue?.textContent).toContain('1.0x')
    expect(dimStarMarker).not.toBeNull()
    expect(getMarkerVisualSizePx(dimStarMarker!)).toBe(1)

    await act(async () => {
      setInputValue(slider!, '4')
    })
    await flushEffects()

    expect(slider?.value).toBe('4')
    expect(sliderValue?.textContent).toContain('4.0x')
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

    const reloadedSlider = container.querySelector(
      '[data-testid="mobile-marker-scale-slider"]',
    ) as HTMLInputElement | null
    const reloadedSliderValue = container.querySelector(
      '[data-testid="mobile-marker-scale-value"]',
    ) as HTMLElement | null
    const reloadedDimStarMarker = container.querySelector(
      '[data-testid="sky-object-marker"][data-object-id="star-dim"]',
    ) as HTMLButtonElement | null

    expect(reloadedSlider?.value).toBe('4')
    expect(reloadedSliderValue?.textContent).toContain('4.0x')
    expect(reloadedDimStarMarker).not.toBeNull()
    expect(getMarkerVisualSizePx(reloadedDimStarMarker!)).toBe(4)
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

  it('builds top-list mode from the full marker set instead of the suppressed on-object label set', async () => {
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

  it('renders a low-quality motion vector for a moving object as scene time advances', async () => {
    const timerHarness = installWindowTimerHarness()
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
  })

  it('renders a trail for balanced motion quality', async () => {
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

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
      demoScenarioId: 'tokyo-iss',
    })

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 150))
    })
    await flushEffects()

    expect(container.querySelector('[data-testid="motion-affordance-vector"]')).toBeNull()
    expect(container.querySelector('[data-testid="motion-affordance-trail"]')).not.toBeNull()
  })

  it('renders a trail for high motion quality', async () => {
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

    await renderViewer({
      entry: 'demo',
      location: 'granted',
      camera: 'denied',
      orientation: 'denied',
      demoScenarioId: 'tokyo-iss',
    })

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 150))
    })
    await flushEffects()

    expect(container.querySelector('[data-testid="motion-affordance-vector"]')).toBeNull()
    expect(container.querySelector('[data-testid="motion-affordance-trail"]')).not.toBeNull()
  })

  it('suppresses the trail polyline when prefers-reduced-motion is enabled', async () => {
    const timerHarness = installWindowTimerHarness()
    setMatchMediaMatches(true)

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
              headingCardinal: 'SE',
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
