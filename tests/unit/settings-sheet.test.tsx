import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { SettingsSheet } from '../../components/settings/settings-sheet'

describe('SettingsSheet', () => {
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
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('renders subtle aircraft availability messaging inside the sheet', async () => {
    const onFixAlignment = vi.fn()
    const onLabelDisplayModeChange = vi.fn()
    const onMotionQualityChange = vi.fn()

    await act(async () => {
      root.render(
        React.createElement(SettingsSheet, {
          onEnterDemoMode: vi.fn(),
          onFixAlignment,
          onRecenter: vi.fn(),
          canFixAlignment: true,
          canRecenter: true,
          layers: {
            aircraft: true,
            satellites: true,
            planets: true,
            stars: true,
            constellations: true,
          },
          layerAvailabilityLabels: {
            aircraft: 'Live aircraft temporarily unavailable',
          },
          likelyVisibleOnly: true,
          labelDisplayMode: 'center_only',
          motionQuality: 'balanced',
          onLayerToggle: vi.fn(),
          onLikelyVisibleOnlyChange: vi.fn(),
          onLabelDisplayModeChange,
          onMotionQualityChange,
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

    expect(container.textContent).toContain('Planes')
    expect(container.textContent).toContain('Live aircraft temporarily unavailable')

    const fixAlignmentButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Alignment'),
    )

    expect(fixAlignmentButton).toBeDefined()

    expect(
      (container.querySelector('input[aria-label="Center only"]') as HTMLInputElement | null)
        ?.checked,
    ).toBe(true)

    const topListRadio = container.querySelector(
      'input[aria-label="Top list"]',
    ) as HTMLInputElement | null

    await act(async () => {
      topListRadio?.click()
    })

    expect(onLabelDisplayModeChange).toHaveBeenCalledWith('top_list')

    const highQualityRadio = container.querySelector(
      'input[aria-label="High"]',
    ) as HTMLInputElement | null

    await act(async () => {
      highQualityRadio?.click()
    })

    expect(onMotionQualityChange).toHaveBeenCalledWith('high')

    await act(async () => {
      fixAlignmentButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onFixAlignment).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('uses a fixed shell with an internal scroll region when open', async () => {
    await act(async () => {
      root.render(
        React.createElement(SettingsSheet, {
          onEnterDemoMode: vi.fn(),
          onFixAlignment: vi.fn(),
          onRecenter: vi.fn(),
          canFixAlignment: true,
          canRecenter: true,
          layers: {
            aircraft: true,
            satellites: true,
            planets: true,
            stars: true,
            constellations: true,
          },
          likelyVisibleOnly: true,
          labelDisplayMode: 'center_only',
          motionQuality: 'balanced',
          onLayerToggle: vi.fn(),
          onLikelyVisibleOnlyChange: vi.fn(),
          onLabelDisplayModeChange: vi.fn(),
          onMotionQualityChange: vi.fn(),
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

    const shell = container.querySelector(
      '[data-testid="settings-sheet-shell"]',
    ) as HTMLElement | null
    const panel = container.querySelector(
      '[data-testid="settings-sheet-panel"]',
    ) as HTMLElement | null
    const scrollRegion = container.querySelector(
      '[data-testid="settings-sheet-scroll-region"]',
    ) as HTMLElement | null

    expect(shell).not.toBeNull()
    expect(shell?.className).toContain('fixed')
    expect(shell?.className).toContain('pt-[calc(1rem+env(safe-area-inset-top))]')
    expect(shell?.className).toContain('pb-[calc(1rem+env(safe-area-inset-bottom))]')
    expect(panel?.className).toContain('flex')
    expect(panel?.className).toContain('max-h-full')
    expect(panel?.className).toContain('overflow-hidden')
    expect(panel?.style.maxHeight).toBe(
      'calc(100dvh - (2rem + env(safe-area-inset-top) + env(safe-area-inset-bottom)))',
    )
    expect(scrollRegion?.className).toContain('flex-1')
    expect(scrollRegion?.className).toContain('overflow-y-auto')
    expect(scrollRegion?.className).toContain('overscroll-contain')
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('delegates alignment to the viewer-owned opener and closes the sheet', async () => {
    const onFixAlignment = vi.fn()
    await act(async () => {
      root.render(
        React.createElement(SettingsSheet, {
          onEnterDemoMode: vi.fn(),
          onFixAlignment,
          onRecenter: vi.fn(),
          canFixAlignment: true,
          canRecenter: true,
          layers: {
            aircraft: true,
            satellites: true,
            planets: true,
            stars: true,
            constellations: true,
          },
          likelyVisibleOnly: true,
          labelDisplayMode: 'center_only',
          onLayerToggle: vi.fn(),
          onLikelyVisibleOnlyChange: vi.fn(),
          onLabelDisplayModeChange: vi.fn(),
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

    const alignmentButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Alignment'),
    )

    expect(alignmentButton).toBeDefined()

    await act(async () => {
      alignmentButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onFixAlignment).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('disables the alignment launcher when live alignment is unavailable in the current mode', async () => {
    await act(async () => {
      root.render(
        React.createElement(SettingsSheet, {
          onEnterDemoMode: vi.fn(),
          onFixAlignment: vi.fn(),
          onRecenter: vi.fn(),
          canFixAlignment: false,
          canRecenter: true,
          layers: {
            aircraft: true,
            satellites: true,
            planets: true,
            stars: true,
            constellations: true,
          },
          likelyVisibleOnly: true,
          labelDisplayMode: 'center_only',
          motionQuality: 'balanced',
          onLayerToggle: vi.fn(),
          onLikelyVisibleOnlyChange: vi.fn(),
          onLabelDisplayModeChange: vi.fn(),
          onMotionQualityChange: vi.fn(),
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

    const alignmentButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Alignment'),
    )

    expect(alignmentButton).toBeDefined()

    await act(async () => {
      alignmentButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect((alignmentButton as HTMLButtonElement | undefined)?.disabled).toBe(true)
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('traps focus and exposes demo scenario switching controls when open', async () => {
    const onDemoScenarioSelect = vi.fn()

    await act(async () => {
      root.render(
        React.createElement(SettingsSheet, {
          onEnterDemoMode: vi.fn(),
          onDemoScenarioSelect,
          onFixAlignment: vi.fn(),
          onRecenter: vi.fn(),
          canFixAlignment: true,
          canRecenter: true,
          layers: {
            aircraft: true,
            satellites: true,
            planets: true,
            stars: true,
            constellations: true,
          },
          likelyVisibleOnly: true,
          labelDisplayMode: 'center_only',
          motionQuality: 'balanced',
          demoScenarioId: 'sf-evening',
          demoScenarioOptions: [
            { id: 'sf-evening', label: 'San Francisco - Clear evening' },
            { id: 'ny-day', label: 'New York - Busy daylight sky' },
            { id: 'tokyo-iss', label: 'Tokyo - Night with ISS pass' },
          ],
          onLayerToggle: vi.fn(),
          onLikelyVisibleOnlyChange: vi.fn(),
          onLabelDisplayModeChange: vi.fn(),
          onMotionQualityChange: vi.fn(),
        }),
      )
    })

    const buttons = Array.from(container.querySelectorAll('button'))
    const settingsButton = buttons.find((button) => button.textContent?.includes('Settings'))

    expect(settingsButton).toBeDefined()

    await act(async () => {
      settingsButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const closeButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Close'),
    )
    const enterDemoButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Enter demo mode'),
    )
    const tokyoButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Tokyo - Night with ISS pass'),
    )

    expect(document.activeElement).toBe(closeButton)
    expect(tokyoButton).toBeDefined()

    await act(async () => {
      closeButton!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Tab',
          bubbles: true,
          cancelable: true,
          shiftKey: true,
        }),
      )
    })

    expect(document.activeElement).toBe(enterDemoButton)

    await act(async () => {
      tokyoButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onDemoScenarioSelect).toHaveBeenCalledWith('tokyo-iss')
  })

  it('closes on Escape and returns focus to the settings trigger', async () => {
    await act(async () => {
      root.render(
        React.createElement(SettingsSheet, {
          onEnterDemoMode: vi.fn(),
          onFixAlignment: vi.fn(),
          onRecenter: vi.fn(),
          canFixAlignment: true,
          canRecenter: true,
          layers: {
            aircraft: true,
            satellites: true,
            planets: true,
            stars: true,
            constellations: true,
          },
          likelyVisibleOnly: true,
          labelDisplayMode: 'center_only',
          motionQuality: 'balanced',
          onLayerToggle: vi.fn(),
          onLikelyVisibleOnlyChange: vi.fn(),
          onLabelDisplayModeChange: vi.fn(),
          onMotionQualityChange: vi.fn(),
        }),
      )
    })

    const settingsButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Settings'),
    )

    expect(settingsButton).toBeDefined()

    settingsButton!.focus()
    expect(document.activeElement).toBe(settingsButton)

    await act(async () => {
      settingsButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const panel = container.querySelector('[role="dialog"]') as HTMLElement | null

    expect(panel).not.toBeNull()
    expect(document.activeElement?.textContent).toContain('Close')

    await act(async () => {
      panel!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }),
      )
    })

    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(settingsButton)
    expect(settingsButton?.getAttribute('aria-expanded')).toBe('false')
  })
})
