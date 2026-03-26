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
    const onHeadingOffsetChange = vi.fn()

    await act(async () => {
      root.render(
        React.createElement(SettingsSheet, {
          onEnterDemoMode: vi.fn(),
          onFixAlignment,
          onRecenter: vi.fn(),
          canFixAlignment: true,
          canRecenter: true,
          headingOffsetDeg: 4,
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
          onLayerToggle: vi.fn(),
          onLikelyVisibleOnlyChange: vi.fn(),
          onHeadingOffsetChange,
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
      button.textContent?.includes('Fix alignment'),
    )

    expect(fixAlignmentButton).toBeDefined()

    await act(async () => {
      fixAlignmentButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const headingSlider = container.querySelector(
      'input[aria-label="Heading nudge"]',
    ) as HTMLInputElement | null

    expect(onFixAlignment).toHaveBeenCalledTimes(1)
    expect(headingSlider?.value).toBe('4')

    await act(async () => {
      setInputValue(headingSlider!, '6')
    })

    expect(onHeadingOffsetChange).toHaveBeenCalledWith(6)
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
          demoScenarioId: 'sf-evening',
          demoScenarioOptions: [
            { id: 'sf-evening', label: 'San Francisco - Clear evening' },
            { id: 'ny-day', label: 'New York - Busy daylight sky' },
            { id: 'tokyo-iss', label: 'Tokyo - Night with ISS pass' },
          ],
          onLayerToggle: vi.fn(),
          onLikelyVisibleOnlyChange: vi.fn(),
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
          onLayerToggle: vi.fn(),
          onLikelyVisibleOnlyChange: vi.fn(),
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

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set

  valueSetter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}
