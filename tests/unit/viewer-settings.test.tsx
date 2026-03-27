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
  VIEWER_SETTINGS_STORAGE_KEY,
  readViewerSettings,
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

    const checkboxes = Array.from(
      container.querySelectorAll('input[type="checkbox"]'),
    ) as HTMLInputElement[]
    const planesToggle = checkboxes[0]
    const likelyVisibleToggle = checkboxes[5]

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

    await act(async () => {
      alignmentButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const fovSlider = container.querySelector(
      'input[aria-label="Field of view"]',
    ) as HTMLInputElement | null

    expect(fovSlider?.value).toBe('6')
    expect(container.textContent).toContain('North marker')
    expect(
      (container.querySelector('input[aria-label="On objects"]') as HTMLInputElement | null)
        ?.checked,
    ).toBe(true)

    await act(async () => {
      recenterButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(readViewerSettings()).toMatchObject({
      labelDisplayMode: 'on_objects',
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
    const likelyVisibleToggle = checkboxes[5]

    const alignmentButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Alignment'),
    )

    expect(alignmentButton).toBeDefined()

    await act(async () => {
      alignmentButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const fovSlider = container.querySelector(
      'input[aria-label="Field of view"]',
    ) as HTMLInputElement | null
    const nudgeLeftButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Nudge left'),
    )
    const topListRadio = container.querySelector(
      'input[aria-label="Top list"]',
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
      nudgeLeftButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
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

    await act(async () => {
      reloadedAlignmentButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const reloadedFovSlider = container.querySelector(
      'input[aria-label="Field of view"]',
    ) as HTMLInputElement | null

    expect(reloadedFovSlider?.value).toBe('-4')
    expect(container.textContent).toContain('North marker')
    expect(
      (container.querySelector('input[aria-label="Top list"]') as HTMLInputElement | null)
        ?.checked,
    ).toBe(true)
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

function createHealthResponse(status: 'empty' | 'stale' | 'expired') {
  const base = {
    app: {
      status: 'ok',
    },
    aircraftCache: {
      status: 'empty',
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
