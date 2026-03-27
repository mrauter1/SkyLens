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
    const onAlignCalibration = vi.fn()
    const onFineAdjustCalibration = vi.fn()
    const onAlignmentTargetPreferenceChange = vi.fn()
    const onLabelDisplayModeChange = vi.fn()
    const onMotionQualityChange = vi.fn()

    await act(async () => {
      root.render(
        React.createElement(SettingsSheet, {
          onEnterDemoMode: vi.fn(),
          onFixAlignment,
          onAlignCalibration,
          onAlignmentTargetPreferenceChange,
          onFineAdjustCalibration,
          onRecenter: vi.fn(),
          canFixAlignment: true,
          canAlignCalibration: true,
          canRecenter: true,
          calibrationTargetLabel: 'Venus',
          calibrationTargetDescription: 'Center Venus in the reticle, then align.',
          calibrationStatus: 'Relative sensors need Venus before labels can lock.',
          calibrationInstructions: [
            'Choose Sun or Moon as your preferred target. SkyLens is currently resolved to Venus.',
            'Center Venus in the reticle.',
            'Tap Align to lock labels to Venus.',
            'If labels still drift, use the manual nudges to fine-adjust alignment.',
          ],
          alignmentTargetPreference: 'sun',
          alignmentTargetAvailability: {
            sun: true,
            moon: true,
          },
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

    await act(async () => {
      fixAlignmentButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const alignButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Align to Venus'),
    )
    const nudgeRightButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Nudge right'),
    )
    const moonTargetButton = container.querySelector(
      'button[aria-label="Use Moon for alignment"]',
    ) as HTMLButtonElement | null

    expect(onFixAlignment).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Venus')
    expect(container.textContent).toContain('Relative sensors need Venus before labels can lock.')
    expect(container.textContent).toContain('Alignment steps')
    expect(container.textContent).toContain(
      'Choose Sun or Moon as your preferred target. SkyLens is currently resolved to Venus.',
    )
    expect(
      (container.querySelector('input[aria-label="Center only"]') as HTMLInputElement | null)
        ?.checked,
    ).toBe(true)

    await act(async () => {
      moonTargetButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      alignButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      nudgeRightButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onAlignmentTargetPreferenceChange).toHaveBeenCalledWith('moon')
    expect(onAlignCalibration).toHaveBeenCalledTimes(1)
    expect(onFineAdjustCalibration).toHaveBeenCalledWith({
      axis: 'yaw',
      deltaDeg: 0.75,
    })

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
  })

  it('keeps unavailable targets selectable while showing fallback copy', async () => {
    const onAlignmentTargetPreferenceChange = vi.fn()

    await act(async () => {
      root.render(
        React.createElement(SettingsSheet, {
          onEnterDemoMode: vi.fn(),
          onFixAlignment: vi.fn(),
          onAlignmentTargetPreferenceChange,
          onRecenter: vi.fn(),
          canFixAlignment: true,
          canRecenter: true,
          calibrationTargetLabel: 'Sun',
          calibrationStatus: 'Relative sensors need Sun before labels can lock.',
          alignmentTargetPreference: 'moon',
          alignmentTargetAvailability: {
            sun: true,
            moon: false,
          },
          alignmentTargetFallbackLabel: 'Sun',
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

    const moonTargetButton = container.querySelector(
      'button[aria-label="Use Moon for alignment"]',
    ) as HTMLButtonElement | null

    expect(moonTargetButton?.disabled).toBe(false)
    expect(container.textContent).toContain(
      'Moon is unavailable. SkyLens will use Sun if you align now.',
    )

    await act(async () => {
      moonTargetButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onAlignmentTargetPreferenceChange).toHaveBeenCalledWith('moon')
  })

  it('surfaces the shared align blocker copy when live motion data is not ready', async () => {
    await act(async () => {
      root.render(
        React.createElement(SettingsSheet, {
          onEnterDemoMode: vi.fn(),
          onFixAlignment: vi.fn(),
          onAlignCalibration: vi.fn(),
          onRecenter: vi.fn(),
          canFixAlignment: true,
          canAlignCalibration: false,
          canRecenter: true,
          calibrationTargetLabel: 'Moon',
          calibrationStatus: 'Relative sensors need Moon before labels can lock.',
          alignmentTargetPreference: 'moon',
          alignmentTargetAvailability: {
            sun: true,
            moon: true,
          },
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

    expect(container.textContent).toContain(
      'Align stays disabled until live motion data is ready. SkyLens will keep Moon as the next target.',
    )
    expect(container.textContent).toContain('Waiting for motion sample')
  })

  it('surfaces the mode blocker copy when live sensor alignment is unavailable in the current mode', async () => {
    await act(async () => {
      root.render(
        React.createElement(SettingsSheet, {
          onEnterDemoMode: vi.fn(),
          onFixAlignment: vi.fn(),
          onAlignCalibration: vi.fn(),
          onRecenter: vi.fn(),
          canFixAlignment: false,
          canAlignCalibration: false,
          canRecenter: true,
          calibrationTargetLabel: 'North marker',
          calibrationStatus: 'Absolute sensors are active, but manual alignment is still available.',
          alignmentTargetPreference: 'sun',
          alignmentTargetAvailability: {
            sun: false,
            moon: false,
          },
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

    const alignButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Waiting for motion sample'),
    ) as HTMLButtonElement | undefined

    expect(container.textContent).toContain(
      'Live sensor alignment is unavailable in the current mode. Manual nudges and field-of-view calibration are still available.',
    )
    expect(alignButton?.disabled).toBe(true)
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
