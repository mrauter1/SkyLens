import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRouterReplace, mockFetchHealthStatus } = vi.hoisted(() => ({
  mockRouterReplace: vi.fn(),
  mockFetchHealthStatus: vi.fn(),
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

vi.mock('../../lib/astronomy/celestial', () => ({
  isCelestialDaylightLabelSuppressed: (object: { metadata?: Record<string, unknown> }) =>
    object.metadata?.daylightLabelSuppressed === true,
  normalizeCelestialObjects: () => ({
    sunAltitudeDeg: -12,
    objects: [],
  }),
}))

vi.mock('../../lib/astronomy/stars', () => ({
  loadStarCatalog: () => [],
  normalizeVisibleStars: () => [],
}))

vi.mock('../../lib/astronomy/constellations', () => ({
  buildVisibleConstellations: () => ({
    objects: [],
    lineSegments: [],
  }),
}))

vi.mock('../../lib/aircraft/client', () => ({
  fetchAircraftSnapshot: vi.fn(),
  normalizeAircraftObjects: () => [],
  getAircraftAvailabilityMessage: () => null,
}))

vi.mock('../../lib/satellites/client', () => ({
  fetchSatelliteCatalog: vi.fn(),
  normalizeSatelliteObjects: () => [],
}))

vi.mock('../../lib/health/client', () => ({
  fetchHealthStatus: mockFetchHealthStatus,
}))

import { ViewerShell } from '../../components/viewer/viewer-shell'
import {
  SCOPE_LENS_DIAMETER_PCT_RANGE,
  VIEWER_SETTINGS_STORAGE_KEY,
  readViewerSettings,
  writeViewerSettings,
} from '../../lib/viewer/settings'

describe('ViewerShell settings integration', () => {
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
    mockFetchHealthStatus.mockReset()
    mockFetchHealthStatus.mockResolvedValue(createHealthResponse('empty'))
    window.localStorage.clear()
    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabledLayers: {
          aircraft: false,
          satellites: true,
          planets: true,
          stars: true,
          constellations: true,
        },
        likelyVisibleOnly: false,
        labelDisplayMode: 'on_objects',
        headingOffsetDeg: 7,
        pitchOffsetDeg: -3,
        verticalFovAdjustmentDeg: 6,
        onboardingCompleted: false,
      }),
    )
    stubCanvasContext()
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    window.localStorage.clear()
  })

  it('defaults missing motionQuality while preserving the rest of persisted settings', () => {
    expect(readViewerSettings()).toMatchObject({
      enabledLayers: {
        aircraft: false,
        satellites: true,
        planets: true,
        stars: true,
        constellations: true,
      },
      mainViewDeepStarsEnabled: true,
      likelyVisibleOnly: false,
      labelDisplayMode: 'on_objects',
      motionQuality: 'balanced',
      markerScale: 1,
      scopeLensDiameterPct: SCOPE_LENS_DIAMETER_PCT_RANGE.defaultValue,
      alignmentTargetPreference: null,
      verticalFovAdjustmentDeg: 6,
      scopeModeEnabled: false,
      mainViewOptics: {
        apertureMm: 40,
        magnificationX: 1,
      },
      scope: {
        verticalFovDeg: 10,
      },
      scopeOptics: {
        apertureMm: 120,
        magnificationX: 50,
        transparencyPct: 85,
      },
      onboardingCompleted: false,
    })
  })

  it('restores a persisted alignment target preference while keeping older payloads readable', () => {
    expect(readViewerSettings().alignmentTargetPreference).toBeNull()
    expect(readViewerSettings().mainViewDeepStarsEnabled).toBe(true)

    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabledLayers: {
          aircraft: false,
          satellites: true,
          planets: true,
          stars: true,
          constellations: true,
        },
        likelyVisibleOnly: false,
        labelDisplayMode: 'on_objects',
        motionQuality: 'balanced',
        alignmentTargetPreference: 'moon',
        verticalFovAdjustmentDeg: 6,
        onboardingCompleted: false,
      }),
    )

    expect(readViewerSettings().alignmentTargetPreference).toBe('moon')
  })

  it('reads and persists the main-view deep-stars toggle without breaking legacy payloads', () => {
    expect(readViewerSettings().mainViewDeepStarsEnabled).toBe(true)

    writeViewerSettings({
      ...readViewerSettings(),
      mainViewDeepStarsEnabled: false,
    })

    expect(readViewerSettings().mainViewDeepStarsEnabled).toBe(false)

    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabledLayers: {
          aircraft: false,
          satellites: true,
          planets: true,
          stars: true,
          constellations: true,
        },
        likelyVisibleOnly: false,
        labelDisplayMode: 'on_objects',
        verticalFovAdjustmentDeg: 6,
        onboardingCompleted: false,
      }),
    )

    expect(readViewerSettings().mainViewDeepStarsEnabled).toBe(true)
  })

  it('clamps persisted marker scale values into the supported 1x to 4x range', () => {
    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabledLayers: {
          aircraft: false,
          satellites: true,
          planets: true,
          stars: true,
          constellations: true,
        },
        likelyVisibleOnly: false,
        labelDisplayMode: 'on_objects',
        motionQuality: 'balanced',
        markerScale: 9,
        verticalFovAdjustmentDeg: 6,
        onboardingCompleted: false,
      }),
    )

    expect(readViewerSettings().markerScale).toBe(4)

    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabledLayers: {
          aircraft: false,
          satellites: true,
          planets: true,
          stars: true,
          constellations: true,
        },
        likelyVisibleOnly: false,
        labelDisplayMode: 'on_objects',
        motionQuality: 'balanced',
        markerScale: 0.4,
        verticalFovAdjustmentDeg: 6,
        onboardingCompleted: false,
      }),
    )

    expect(readViewerSettings().markerScale).toBe(1)
  })

  it('defaults, clamps, and persists scope lens diameter without breaking older payloads', () => {
    expect(readViewerSettings().scopeLensDiameterPct).toBe(
      SCOPE_LENS_DIAMETER_PCT_RANGE.defaultValue,
    )

    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabledLayers: {
          aircraft: false,
          satellites: true,
          planets: true,
          stars: true,
          constellations: true,
        },
        likelyVisibleOnly: false,
        labelDisplayMode: 'on_objects',
        motionQuality: 'balanced',
        scopeLensDiameterPct: 999,
        verticalFovAdjustmentDeg: 6,
        onboardingCompleted: false,
      }),
    )

    expect(readViewerSettings().scopeLensDiameterPct).toBe(
      SCOPE_LENS_DIAMETER_PCT_RANGE.max,
    )

    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabledLayers: {
          aircraft: false,
          satellites: true,
          planets: true,
          stars: true,
          constellations: true,
        },
        likelyVisibleOnly: false,
        labelDisplayMode: 'on_objects',
        motionQuality: 'balanced',
        scopeLensDiameterPct: 'bad',
        verticalFovAdjustmentDeg: 6,
        onboardingCompleted: false,
      }),
    )

    expect(readViewerSettings().scopeLensDiameterPct).toBe(
      SCOPE_LENS_DIAMETER_PCT_RANGE.defaultValue,
    )

    writeViewerSettings({
      ...readViewerSettings(),
      scopeLensDiameterPct: 24,
    })

    expect(readViewerSettings().scopeLensDiameterPct).toBe(
      SCOPE_LENS_DIAMETER_PCT_RANGE.min,
    )
    expect(
      JSON.parse(window.localStorage.getItem(VIEWER_SETTINGS_STORAGE_KEY) ?? 'null'),
    ).toMatchObject({
      scopeLensDiameterPct: SCOPE_LENS_DIAMETER_PCT_RANGE.min,
    })
  })

  it('defaults and clamps persisted scope settings without breaking older payloads', () => {
    expect(readViewerSettings().scopeModeEnabled).toBe(false)
    expect(readViewerSettings().mainViewOptics).toEqual({
      apertureMm: 40,
      magnificationX: 1,
    })
    expect(readViewerSettings().scope).toEqual({
      verticalFovDeg: 10,
    })
    expect(readViewerSettings().scopeOptics).toEqual({
      apertureMm: 120,
      magnificationX: 50,
      transparencyPct: 85,
    })

    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabledLayers: {
          aircraft: false,
          satellites: true,
          planets: true,
          stars: true,
          constellations: true,
        },
        likelyVisibleOnly: false,
        labelDisplayMode: 'on_objects',
        motionQuality: 'balanced',
        verticalFovAdjustmentDeg: 6,
        scopeModeEnabled: true,
        scopeOptics: {
          apertureMm: 9,
          magnificationX: 800,
          transparencyPct: Number.POSITIVE_INFINITY,
        },
        scope: {
          verticalFovDeg: 1.5,
        },
        onboardingCompleted: false,
      }),
    )

    expect(readViewerSettings().scopeModeEnabled).toBe(true)
    expect(readViewerSettings().scope).toEqual({
      verticalFovDeg: 3,
    })
    expect(readViewerSettings().scopeOptics).toEqual({
      apertureMm: 20,
      magnificationX: 300,
      transparencyPct: 85,
    })

    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabledLayers: {
          aircraft: false,
          satellites: true,
          planets: true,
          stars: true,
          constellations: true,
        },
        likelyVisibleOnly: false,
        labelDisplayMode: 'on_objects',
        motionQuality: 'balanced',
        verticalFovAdjustmentDeg: 6,
        scope: {
          enabled: true,
          verticalFovDeg: 22,
        },
        onboardingCompleted: false,
      }),
    )

    expect(readViewerSettings().scopeModeEnabled).toBe(true)
    expect(readViewerSettings().scope).toEqual({
      verticalFovDeg: 20,
    })

    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabledLayers: {
          aircraft: false,
          satellites: true,
          planets: true,
          stars: true,
          constellations: true,
        },
        likelyVisibleOnly: false,
        labelDisplayMode: 'on_objects',
        motionQuality: 'balanced',
        verticalFovAdjustmentDeg: 6,
        scope: {
          enabled: true,
        },
        onboardingCompleted: false,
      }),
    )

    expect(readViewerSettings().scopeModeEnabled).toBe(true)
    expect(readViewerSettings().scope).toEqual({
      verticalFovDeg: 10,
    })

    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabledLayers: {
          aircraft: false,
          satellites: true,
          planets: true,
          stars: true,
          constellations: true,
        },
        likelyVisibleOnly: false,
        labelDisplayMode: 'on_objects',
        motionQuality: 'balanced',
        verticalFovAdjustmentDeg: 6,
        scope: {
          verticalFovDeg: 12.5,
        },
        onboardingCompleted: false,
      }),
    )

    expect(readViewerSettings().scopeModeEnabled).toBe(false)
    expect(readViewerSettings().scope).toEqual({
      verticalFovDeg: 12.5,
    })
  })

  it('defaults invalid persisted main-view aperture values to 40mm without changing scope defaults', () => {
    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabledLayers: {
          aircraft: false,
          satellites: true,
          planets: true,
          stars: true,
          constellations: true,
        },
        likelyVisibleOnly: false,
        labelDisplayMode: 'on_objects',
        motionQuality: 'balanced',
        verticalFovAdjustmentDeg: 6,
        mainViewOptics: {
          apertureMm: Number.POSITIVE_INFINITY,
          magnificationX: 8,
        },
        onboardingCompleted: false,
      }),
    )

    expect(readViewerSettings().mainViewOptics).toEqual({
      apertureMm: 40,
      magnificationX: 1,
    })
    expect(readViewerSettings().scopeOptics).toEqual({
      apertureMm: 120,
      magnificationX: 50,
      transparencyPct: 85,
    })
  })

  it('preserves a valid persisted main-view aperture instead of replacing it with the 40mm default', () => {
    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabledLayers: {
          aircraft: false,
          satellites: true,
          planets: true,
          stars: true,
          constellations: true,
        },
        likelyVisibleOnly: false,
        labelDisplayMode: 'on_objects',
        motionQuality: 'balanced',
        verticalFovAdjustmentDeg: 6,
        mainViewOptics: {
          apertureMm: 180,
          magnificationX: 12,
        },
        scopeOptics: {
          apertureMm: 120,
          magnificationX: 50,
          transparencyPct: 85,
        },
        onboardingCompleted: false,
      }),
    )

    expect(readViewerSettings().mainViewOptics).toEqual({
      apertureMm: 180,
      magnificationX: 1,
    })
    expect(readViewerSettings().scopeOptics).toEqual({
      apertureMm: 120,
      magnificationX: 50,
      transparencyPct: 85,
    })
  })

  it('persists normal-view aperture independently from scope optics and keeps main-view magnification fixed at 1x', () => {
    writeViewerSettings({
      ...readViewerSettings(),
      mainViewOptics: {
        apertureMm: 18,
        magnificationX: 12,
      },
      scopeOptics: {
        apertureMm: 160,
        magnificationX: 75,
        transparencyPct: 85,
      },
    })

    const settings = readViewerSettings()
    const persisted = JSON.parse(
      window.localStorage.getItem(VIEWER_SETTINGS_STORAGE_KEY) ?? 'null',
    ) as {
      mainViewOptics: {
        apertureMm: number
        magnificationX: number
      }
      scopeOptics: {
        apertureMm: number
        magnificationX: number
      }
    }

    expect(settings.mainViewOptics).toEqual({
      apertureMm: 20,
      magnificationX: 1,
    })
    expect(settings.scopeOptics).toEqual({
      apertureMm: 160,
      magnificationX: 75,
      transparencyPct: 85,
    })
    expect(persisted.mainViewOptics).toEqual({
      apertureMm: 20,
      magnificationX: 1,
    })
    expect(persisted.scopeOptics).toMatchObject({
      apertureMm: 160,
      magnificationX: 75,
    })
  })

  it('prefers canonical scopeModeEnabled over legacy scope.enabled when both are present', () => {
    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabledLayers: {
          aircraft: false,
          satellites: true,
          planets: true,
          stars: true,
          constellations: true,
        },
        likelyVisibleOnly: false,
        labelDisplayMode: 'on_objects',
        motionQuality: 'balanced',
        verticalFovAdjustmentDeg: 6,
        scopeModeEnabled: false,
        scope: {
          enabled: true,
          verticalFovDeg: 12,
        },
        onboardingCompleted: false,
      }),
    )

    const settings = readViewerSettings()

    expect(settings.scopeModeEnabled).toBe(false)
    expect(settings.scope.verticalFovDeg).toBe(12)
  })

  it('prefers canonical magnification over legacy scope vertical FOV when both are present', () => {
    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabledLayers: {
          aircraft: false,
          satellites: true,
          planets: true,
          stars: true,
          constellations: true,
        },
        likelyVisibleOnly: false,
        labelDisplayMode: 'on_objects',
        motionQuality: 'balanced',
        verticalFovAdjustmentDeg: 6,
        scope: {
          verticalFovDeg: 20,
        },
        scopeOptics: {
          apertureMm: 120,
          magnificationX: 100,
          transparencyPct: 85,
        },
        onboardingCompleted: false,
      }),
    )

    const settings = readViewerSettings()

    expect(settings.scopeOptics.magnificationX).toBe(100)
    expect(settings.scope.verticalFovDeg).toBe(5)
  })

  it('writes the compatibility scope FOV from canonical magnification', () => {
    const defaults = readViewerSettings()

    writeViewerSettings({
      ...defaults,
      scope: {
        verticalFovDeg: 20,
      },
      scopeOptics: {
        ...defaults.scopeOptics,
        magnificationX: 100,
      },
    })

    const persistedRawValue = window.localStorage.getItem(VIEWER_SETTINGS_STORAGE_KEY)

    expect(persistedRawValue).not.toBeNull()

    const persisted = JSON.parse(persistedRawValue as string) as {
      scope: {
        verticalFovDeg: number
      }
      scopeOptics: {
        magnificationX: number
      }
    }

    expect(persisted.scopeOptics.magnificationX).toBe(100)
    expect(persisted.scope.verticalFovDeg).toBe(5)
    expect(readViewerSettings().scope.verticalFovDeg).toBe(5)
  })

  it('sanitizes malformed persisted scope fields without discarding unrelated viewer settings', () => {
    window.localStorage.setItem(
      VIEWER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabledLayers: {
          aircraft: false,
          satellites: true,
          planets: true,
          stars: true,
          constellations: false,
        },
        likelyVisibleOnly: false,
        labelDisplayMode: 'top_list',
        motionQuality: 'high',
        verticalFovAdjustmentDeg: 6,
        scopeModeEnabled: 'true',
        scope: {
          enabled: true,
          verticalFovDeg: 'bad',
        },
        scopeOptics: {
          apertureMm: '120',
          magnificationX: null,
          transparencyPct: '75',
        },
        onboardingCompleted: false,
      }),
    )

    expect(readViewerSettings()).toMatchObject({
      enabledLayers: {
        aircraft: false,
        satellites: true,
        planets: true,
        stars: true,
        constellations: false,
      },
      likelyVisibleOnly: false,
      labelDisplayMode: 'top_list',
      motionQuality: 'high',
      verticalFovAdjustmentDeg: 6,
      scopeModeEnabled: true,
      scopeLensDiameterPct: 75,
      scope: {
        verticalFovDeg: 10,
      },
      scopeOptics: {
        apertureMm: 120,
        magnificationX: 50,
        transparencyPct: 75,
      },
    })
  })

  it('loads persisted settings, preserves offsets on recenter, and routes demo mode from the sheet', async () => {
    await act(async () => {
      root.render(
        React.createElement(ViewerShell, {
          initialState: {
            entry: 'demo',
            location: 'unavailable',
            camera: 'unavailable',
            orientation: 'unavailable',
          },
        }),
      )
    })

    await openDesktopViewerPanel()
    expect(container.textContent).toContain('FOV 56.0° vertical')

    const settingsButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Settings'),
    )

    expect(settingsButton).toBeDefined()

    await act(async () => {
      settingsButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const checkboxes = Array.from(
      container.querySelectorAll('input[type="checkbox"]'),
    ) as HTMLInputElement[]
    const planesToggle = checkboxes[0]
    const likelyVisibleToggle = checkboxes[6]

    expect(planesToggle.checked).toBe(false)
    expect(likelyVisibleToggle.checked).toBe(false)

    const alignmentButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Alignment'),
    )
    const recenterButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Recenter'),
    )
    const enterDemoModeButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Enter demo mode'),
    )

    expect(alignmentButton).toBeDefined()
    expect(recenterButton).toBeDefined()
    expect(enterDemoModeButton).toBeDefined()

    const fovSlider = container.querySelector(
      'input[aria-label="Field of view"]',
    ) as HTMLInputElement | null

    expect(fovSlider?.value).toBe('6')
    expect(
      (container.querySelector('input[aria-label="On objects"]') as HTMLInputElement | null)
        ?.checked,
    ).toBe(true)
    expect(
      (container.querySelector('input[aria-label="Balanced"]') as HTMLInputElement | null)
        ?.checked,
    ).toBe(true)

    await act(async () => {
      recenterButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(readViewerSettings()).toMatchObject({
      labelDisplayMode: 'on_objects',
      motionQuality: 'balanced',
      verticalFovAdjustmentDeg: 6,
    })
    expect(readViewerSettings().poseCalibration.calibrated).toBe(false)

    await act(async () => {
      enterDemoModeButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(mockRouterReplace).toHaveBeenCalledWith(
      expect.stringContaining('entry=demo'),
    )
    expect(readViewerSettings().onboardingCompleted).toBe(true)
  })

  it('reloads changed layer toggles and calibration values from persisted settings', async () => {
    await act(async () => {
      root.render(
        React.createElement(ViewerShell, {
          initialState: {
            entry: 'demo',
            location: 'unavailable',
            camera: 'unavailable',
            orientation: 'unavailable',
          },
        }),
      )
    })

    const settingsButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Settings'),
    )

    expect(settingsButton).toBeDefined()

    await act(async () => {
      settingsButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const checkboxes = Array.from(
      container.querySelectorAll('input[type="checkbox"]'),
    ) as HTMLInputElement[]
    const planesToggle = checkboxes[0]
    const satellitesToggle = checkboxes[1]
    const likelyVisibleToggle = checkboxes[6]

    const alignmentButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Alignment'),
    )

    expect(alignmentButton).toBeDefined()

    const fovSlider = container.querySelector(
      'input[aria-label="Field of view"]',
    ) as HTMLInputElement | null
    const topListRadio = container.querySelector(
      'input[aria-label="Top list"]',
    ) as HTMLInputElement | null
    const highMotionQualityRadio = container.querySelector(
      'input[aria-label="High"]',
    ) as HTMLInputElement | null

    expect(planesToggle.checked).toBe(false)
    expect(satellitesToggle.checked).toBe(true)
    expect(likelyVisibleToggle.checked).toBe(false)
    expect(fovSlider?.value).toBe('6')

    await act(async () => {
      planesToggle.click()
      satellitesToggle.click()
      likelyVisibleToggle.click()
      topListRadio?.click()
      highMotionQualityRadio?.click()
      setInputValue(fovSlider!, '-4')
    })

    expect(readViewerSettings()).toMatchObject({
      enabledLayers: {
        aircraft: true,
        satellites: false,
        planets: true,
        stars: true,
        constellations: true,
      },
      likelyVisibleOnly: true,
      labelDisplayMode: 'top_list',
      motionQuality: 'high',
      verticalFovAdjustmentDeg: -4,
    })
    expect(readViewerSettings().poseCalibration.calibrated).toBe(false)

    await act(async () => {
      root.unmount()
    })

    root = createRoot(container)

    await act(async () => {
      root.render(
        React.createElement(ViewerShell, {
          initialState: {
            entry: 'demo',
            location: 'unavailable',
            camera: 'unavailable',
            orientation: 'unavailable',
          },
        }),
      )
    })

    await openDesktopViewerPanel()
    expect(container.textContent).toContain('FOV 46.0° vertical')

    const reloadedSettingsButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Settings'),
    )

    expect(reloadedSettingsButton).toBeDefined()

    await act(async () => {
      reloadedSettingsButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const reloadedCheckboxes = Array.from(
      container.querySelectorAll('input[type="checkbox"]'),
    ) as HTMLInputElement[]

    expect(reloadedCheckboxes[0].checked).toBe(true)
    expect(reloadedCheckboxes[1].checked).toBe(false)
    expect(reloadedCheckboxes[5].checked).toBe(true)

    const reloadedAlignmentButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Alignment'),
    )

    expect(reloadedAlignmentButton).toBeDefined()

    const reloadedFovSlider = container.querySelector(
      'input[aria-label="Field of view"]',
    ) as HTMLInputElement | null

    expect(reloadedFovSlider?.value).toBe('-4')
    expect(
      (container.querySelector('input[aria-label="Top list"]') as HTMLInputElement | null)
        ?.checked,
    ).toBe(true)
    expect(
      (container.querySelector('input[aria-label="High"]') as HTMLInputElement | null)?.checked,
    ).toBe(true)
  })

  it('keeps desktop scope quick actions synchronized with persisted settings sheet controls', async () => {
    await act(async () => {
      root.render(
        React.createElement(ViewerShell, {
          initialState: {
            entry: 'demo',
            location: 'unavailable',
            camera: 'unavailable',
            orientation: 'unavailable',
          },
        }),
      )
    })

    const desktopScopeAction = container.querySelector(
      '[data-testid="desktop-scope-action"]',
    ) as HTMLButtonElement | null

    expect(desktopScopeAction).not.toBeNull()
    expect(desktopScopeAction?.getAttribute('aria-pressed')).toBe('false')

    await act(async () => {
      desktopScopeAction?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(readViewerSettings().scopeModeEnabled).toBe(true)
    expect(readViewerSettings().scope).toEqual({
      verticalFovDeg: 10,
    })

    const settingsButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Settings'),
    )

    expect(settingsButton).toBeDefined()

    await act(async () => {
      settingsButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const scopeToggle = container.querySelector(
      'input[aria-label="Scope mode"]',
    ) as HTMLInputElement | null
    const telescopeDiameterSlider = container.querySelector(
      'input[aria-label="Telescope diameter"]',
    ) as HTMLInputElement | null

    expect(scopeToggle?.checked).toBe(true)
    expect(container.querySelector('input[aria-label="Scope field of view"]')).toBeNull()
    expect(telescopeDiameterSlider?.value).toBe('75')

    await act(async () => {
      scopeToggle?.click()
    })

    expect(readViewerSettings().scopeModeEnabled).toBe(false)
    expect(readViewerSettings().scope).toEqual({
      verticalFovDeg: 10,
    })

    expect(
      (container.querySelector('[data-testid="desktop-scope-action"]') as HTMLButtonElement | null)
        ?.getAttribute('aria-pressed'),
    ).toBe('false')
    expect(container.querySelector('[data-testid="desktop-scope-action"]')?.textContent).toContain(
      '10° lens',
    )

    await act(async () => {
      setInputValue(telescopeDiameterSlider!, '90')
    })

    expect(readViewerSettings().scopeLensDiameterPct).toBe(90)
  })

  it.each([
    ['stale', 'Using stale satellite cache'],
    ['expired', 'Satellite cache expired'],
  ] as const)(
    'surfaces %s satellite cache health inside the real settings sheet',
    async (status, expectedLabel) => {
      mockFetchHealthStatus.mockResolvedValueOnce(createHealthResponse(status))

      await act(async () => {
        root.render(
          React.createElement(ViewerShell, {
            initialState: {
              entry: 'demo',
              location: 'unavailable',
              camera: 'unavailable',
              orientation: 'unavailable',
            },
          }),
        )
      })
      await flushEffects()

      const settingsButton = Array.from(container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('Settings'),
      )

      expect(settingsButton).toBeDefined()

      await act(async () => {
        settingsButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      expect(mockFetchHealthStatus).toHaveBeenCalledTimes(1)
      expect(container.textContent).toContain(expectedLabel)
    },
  )
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

async function flushEffects() {
  await act(async () => {
    await Promise.resolve()
  })

  await act(async () => {
    await Promise.resolve()
  })
}

async function openDesktopViewerPanel() {
  const openViewerButton = document.querySelector(
    '[data-testid="desktop-open-viewer-action"]',
  ) as HTMLButtonElement | null

  await act(async () => {
    openViewerButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await flushEffects()
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

function createHealthResponse(status: 'empty' | 'stale' | 'expired') {
  return {
    app: {
      status: 'ok',
    },
    tleCache:
      status === 'empty'
        ? {
            status: 'empty',
          }
        : {
            status,
            fetchedAt: '2026-03-26T00:00:00.000Z',
            expiresAt: '2026-03-26T06:00:00.000Z',
          },
  }
}
