import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRouterReplace } = vi.hoisted(() => ({
  mockRouterReplace: vi.fn(),
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

import { ViewerShell } from '../../components/viewer/viewer-shell'
import {
  normalizeScopeOpticsSettings,
  SCOPE_OPTICS_RANGES,
  VIEWER_SETTINGS_STORAGE_KEY,
  readViewerSettings,
  writeViewerSettings,
} from '../../lib/viewer/settings'

describe('ViewerShell settings integration', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>

  beforeAll(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true
  })

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mockRouterReplace.mockReset()
    fetchMock = vi.fn().mockResolvedValue(createHealthResponse('empty'))
    vi.stubGlobal('fetch', fetchMock)
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
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    window.localStorage.clear()
    vi.unstubAllGlobals()
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
      likelyVisibleOnly: false,
      scopeModeEnabled: false,
      scopeOptics: {
        apertureMm: 100,
        magnificationX: 40,
        transparencyPct: 80,
      },
      labelDisplayMode: 'on_objects',
      motionQuality: 'balanced',
      markerScale: 1,
      alignmentTargetPreference: null,
      verticalFovAdjustmentDeg: 6,
      onboardingCompleted: false,
    })
  })

  it('restores a persisted alignment target preference while keeping older payloads readable', () => {
    expect(readViewerSettings().alignmentTargetPreference).toBeNull()

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

  it('defaults missing nested scope optics fields while preserving provided values', () => {
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
        scopeModeEnabled: true,
        scopeOptics: {
          apertureMm: 180,
        },
        labelDisplayMode: 'on_objects',
        motionQuality: 'balanced',
        verticalFovAdjustmentDeg: 6,
        onboardingCompleted: false,
      }),
    )

    expect(readViewerSettings()).toMatchObject({
      scopeModeEnabled: true,
      scopeOptics: {
        apertureMm: 180,
        magnificationX: 40,
        transparencyPct: 80,
      },
    })
  })

  it('clamps persisted scope optics values into the supported ranges', () => {
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
        scopeModeEnabled: true,
        scopeOptics: {
          apertureMm: 900,
          magnificationX: 4,
          transparencyPct: 5,
        },
        labelDisplayMode: 'on_objects',
        motionQuality: 'balanced',
        verticalFovAdjustmentDeg: 6,
        onboardingCompleted: false,
      }),
    )

    expect(readViewerSettings()).toMatchObject({
      scopeModeEnabled: true,
      scopeOptics: {
        apertureMm: SCOPE_OPTICS_RANGES.apertureMm.max,
        magnificationX: SCOPE_OPTICS_RANGES.magnificationX.min,
        transparencyPct: SCOPE_OPTICS_RANGES.transparencyPct.min,
      },
    })
  })

  it('reuses the shared scope optics ranges for direct normalization', () => {
    expect(
      normalizeScopeOpticsSettings({
        apertureMm: Number.NEGATIVE_INFINITY,
        magnificationX: 999,
        transparencyPct: 5,
      }),
    ).toEqual({
      apertureMm: 100,
      magnificationX: SCOPE_OPTICS_RANGES.magnificationX.max,
      transparencyPct: SCOPE_OPTICS_RANGES.transparencyPct.min,
    })
  })

  it('round-trips nested scope optics settings through persisted storage', () => {
    writeViewerSettings({
      ...readViewerSettings(),
      scopeModeEnabled: true,
      scopeOptics: {
        apertureMm: 155,
        magnificationX: 95,
        transparencyPct: 65,
      },
    })

    expect(
      JSON.parse(window.localStorage.getItem(VIEWER_SETTINGS_STORAGE_KEY) ?? 'null'),
    ).toMatchObject({
      scopeModeEnabled: true,
      scopeOptics: {
        apertureMm: 155,
        magnificationX: 95,
        transparencyPct: 65,
      },
    })
    expect(readViewerSettings()).toMatchObject({
      scopeModeEnabled: true,
      scopeOptics: {
        apertureMm: 155,
        magnificationX: 95,
        transparencyPct: 65,
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

    expect(container.textContent).toContain('FOV 56° vertical')

    const settingsButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Settings'),
    )

    expect(settingsButton).toBeDefined()

    await act(async () => {
      settingsButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const planesToggle = container.querySelector(
      'input[aria-label="Planes"]',
    ) as HTMLInputElement | null
    const likelyVisibleToggle = findToggleByLabelText(container, 'Likely visible only')

    expect(planesToggle?.checked).toBe(false)
    expect(likelyVisibleToggle?.checked).toBe(false)

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

    const planesToggle = container.querySelector(
      'input[aria-label="Planes"]',
    ) as HTMLInputElement | null
    const satellitesToggle = container.querySelector(
      'input[aria-label="Satellites"]',
    ) as HTMLInputElement | null
    const likelyVisibleToggle = findToggleByLabelText(container, 'Likely visible only')

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

    expect(planesToggle?.checked).toBe(false)
    expect(satellitesToggle?.checked).toBe(true)
    expect(likelyVisibleToggle?.checked).toBe(false)
    expect(fovSlider?.value).toBe('6')

    await act(async () => {
      planesToggle?.click()
      satellitesToggle?.click()
      likelyVisibleToggle?.click()
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

    expect(container.textContent).toContain('FOV 46° vertical')

    const reloadedSettingsButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Settings'),
    )

    expect(reloadedSettingsButton).toBeDefined()

    await act(async () => {
      reloadedSettingsButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const reloadedPlanesToggle = container.querySelector(
      'input[aria-label="Planes"]',
    ) as HTMLInputElement | null
    const reloadedSatellitesToggle = container.querySelector(
      'input[aria-label="Satellites"]',
    ) as HTMLInputElement | null
    const reloadedLikelyVisibleToggle = findToggleByLabelText(
      container,
      'Likely visible only',
    )

    expect(reloadedPlanesToggle?.checked).toBe(true)
    expect(reloadedSatellitesToggle?.checked).toBe(false)
    expect(reloadedLikelyVisibleToggle?.checked).toBe(true)

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

  it('persists scope settings and marker scale through the real settings sheet', async () => {
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

    const scopeModeToggle = container.querySelector(
      'input[aria-label="Scope mode"]',
    ) as HTMLInputElement | null
    const transparencySlider = container.querySelector(
      'input[aria-label="Transparency"]',
    ) as HTMLInputElement | null
    const markerScaleSlider = container.querySelector(
      'input[aria-label="Marker scale"]',
    ) as HTMLInputElement | null

    expect(scopeModeToggle?.checked).toBe(false)
    expect(transparencySlider?.value).toBe('80')
    expect(markerScaleSlider?.value).toBe('1')

    await act(async () => {
      scopeModeToggle?.click()
      setInputValue(transparencySlider!, '91')
      setInputValue(markerScaleSlider!, '3.2')
    })

    expect(readViewerSettings()).toMatchObject({
      scopeModeEnabled: true,
      scopeOptics: {
        apertureMm: 100,
        magnificationX: 40,
        transparencyPct: 91,
      },
      markerScale: 3.2,
    })

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

    const reloadedSettingsButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Settings'),
    )

    expect(reloadedSettingsButton).toBeDefined()

    await act(async () => {
      reloadedSettingsButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(
      (container.querySelector('input[aria-label="Scope mode"]') as HTMLInputElement | null)
        ?.checked,
    ).toBe(true)
    expect(
      (container.querySelector('input[aria-label="Transparency"]') as HTMLInputElement | null)
        ?.value,
    ).toBe('91')
    expect(
      (container.querySelector('input[aria-label="Marker scale"]') as HTMLInputElement | null)
        ?.value,
    ).toBe('3.2')
  })

  it.each([
    ['stale', 'Using stale satellite cache'],
    ['expired', 'Satellite cache expired'],
  ] as const)(
    'surfaces %s satellite cache health inside the real settings sheet',
    async (status, expectedLabel) => {
      fetchMock.mockResolvedValueOnce(createHealthResponse(status))

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

      expect(fetchMock).toHaveBeenCalledWith('/api/health', {
        cache: 'no-store',
      })
      expect(container.textContent).toContain(expectedLabel)
    },
  )
})

async function flushEffects() {
  await act(async () => {
    await Promise.resolve()
  })

  await act(async () => {
    await Promise.resolve()
  })
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

function findToggleByLabelText(root: ParentNode, labelText: string) {
  return Array.from(root.querySelectorAll('label input[type="checkbox"]')).find(
    (input) => input.parentElement?.textContent?.includes(labelText) === true,
  ) as HTMLInputElement | undefined
}

function createHealthResponse(status: 'empty' | 'stale' | 'expired') {
  const base = {
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

  return new Response(JSON.stringify(base), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
