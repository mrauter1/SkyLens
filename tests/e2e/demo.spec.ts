import { expect, test } from '@playwright/test'

import { ensureMobileViewerOverlayOpen } from './mobile-overlay'

const SF_DEMO_ROUTE =
  '/view?entry=demo&location=unavailable&camera=unavailable&orientation=unavailable&demoScenario=sf-evening'

test('demo mode renders deterministic labels and opens a detail card', async ({ page }) => {
  await page.goto(SF_DEMO_ROUTE)
  await ensureMobileViewerOverlayOpen(page)
  const mobileOverlay = page.getByTestId('mobile-viewer-overlay')
  const overlayCloseButton = mobileOverlay.getByRole('button', { name: 'Close' })

  await expect(mobileOverlay.getByText('Demo mode is active.')).toBeVisible()
  await overlayCloseButton.click()
  await expect(mobileOverlay).toHaveCount(0)

  const skyLabel = page.getByRole('button', { name: /Polaris Star/i }).first()
  const stage = page.getByLabel('Sky viewer stage')

  await stage.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')

  await expect(skyLabel).toBeVisible()
  await skyLabel.click({ force: true })
  await ensureMobileViewerOverlayOpen(page)

  await expect(mobileOverlay.getByText('Selected object')).toBeVisible()
  await expect(mobileOverlay.getByText('Magnitude')).toBeVisible()
  await expect(mobileOverlay.getByText('Elevation')).toBeVisible()
})

test('settings persist layer toggles in demo mode', async ({ page }) => {
  await page.goto(SF_DEMO_ROUTE)

  await ensureMobileViewerOverlayOpen(page)
  const mobileOverlay = page.getByTestId('mobile-viewer-overlay')

  await mobileOverlay.getByRole('button', { name: 'Settings' }).click()

  const settingsDialog = page.getByRole('dialog', { name: 'Settings' })
  const planesToggle = settingsDialog.getByRole('checkbox', { name: 'Planes' })

  await expect(planesToggle).toBeChecked()
  await planesToggle.focus()
  await page.keyboard.press('Space')
  await expect(planesToggle).not.toBeChecked()
  await page.reload()
  await ensureMobileViewerOverlayOpen(page)
  await page.getByTestId('mobile-viewer-overlay').getByRole('button', { name: 'Settings' }).click()

  await expect(page.getByRole('dialog', { name: 'Settings' }).getByRole('checkbox', { name: 'Planes' })).not.toBeChecked()

  await page.evaluate(() => {
    window.localStorage.clear()
  })
})

test('scope mode enables and persists across reload in demo mode', async ({ page }) => {
  await page.goto(SF_DEMO_ROUTE)
  await ensureMobileViewerOverlayOpen(page)

  const mobileOverlay = page.getByTestId('mobile-viewer-overlay')

  await mobileOverlay.getByRole('button', { name: 'Settings' }).click()

  const settingsDialog = page.getByRole('dialog', { name: 'Settings' })
  const scopeToggle = settingsDialog.getByRole('checkbox', { name: 'Scope mode' })

  await expect(scopeToggle).toBeVisible()
  await expect(scopeToggle).not.toBeChecked()
  await expect(page.getByTestId('scope-lens-overlay')).toHaveCount(0)

  await scopeToggle.click()

  await expect(scopeToggle).toBeChecked()
  await expect(page.getByTestId('scope-lens-overlay')).toBeVisible()

  await page.reload()
  await ensureMobileViewerOverlayOpen(page)
  await page.getByTestId('mobile-viewer-overlay').getByRole('button', { name: 'Settings' }).click()

  await expect(page.getByRole('dialog', { name: 'Settings' }).getByRole('checkbox', { name: 'Scope mode' })).toBeChecked()
  await expect(page.getByTestId('scope-lens-overlay')).toBeVisible()

  await page.evaluate(() => {
    window.localStorage.clear()
  })
})

test('main-view optics reset on reload while scope optics stay persisted', async ({ page }) => {
  await page.goto(SF_DEMO_ROUTE)
  await ensureMobileViewerOverlayOpen(page)

  const mobileOverlay = page.getByTestId('mobile-viewer-overlay')
  await mobileOverlay.getByRole('button', { name: 'Close' }).click()
  const mainApertureSlider = page.getByTestId('mobile-scope-aperture-slider')
  const mainMagnificationSlider = page.getByTestId('mobile-scope-magnification-slider')

  await expect(mainApertureSlider).toHaveValue('40')
  await expect(mainMagnificationSlider).toHaveCount(0)
  await mainApertureSlider.evaluate((element) => {
    const input = element as HTMLInputElement
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '90')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(mainApertureSlider).toHaveValue('90')

  await ensureMobileViewerOverlayOpen(page)
  await mobileOverlay.getByRole('button', { name: 'Settings' }).click()
  const settingsDialog = page.getByRole('dialog', { name: 'Settings' })
  await settingsDialog.getByRole('checkbox', { name: 'Scope mode' }).click()
  await expect(page.getByTestId('scope-lens-overlay')).toBeVisible()
  await settingsDialog.getByRole('button', { name: 'Close' }).click()
  await mobileOverlay.getByRole('button', { name: 'Close' }).click()

  const scopeApertureSlider = page.getByTestId('mobile-scope-aperture-slider')
  const scopeMagnificationSlider = page.getByTestId('mobile-scope-magnification-slider')

  await expect(scopeApertureSlider).toHaveValue('120')
  await expect(scopeMagnificationSlider).toHaveValue('50')
  await scopeApertureSlider.evaluate((element) => {
    const input = element as HTMLInputElement
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '240')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await scopeMagnificationSlider.evaluate((element) => {
    const input = element as HTMLInputElement
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '75')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(scopeApertureSlider).toHaveValue('240')
  await expect(scopeMagnificationSlider).toHaveValue('75')

  await page.reload()
  await ensureMobileViewerOverlayOpen(page)
  await page.getByTestId('mobile-viewer-overlay').getByRole('button', { name: 'Close' }).click()

  await expect(page.getByTestId('mobile-scope-aperture-slider')).toHaveValue('240')
  await expect(page.getByTestId('mobile-scope-magnification-slider')).toHaveValue('75')
  await ensureMobileViewerOverlayOpen(page)
  await page.getByTestId('mobile-viewer-overlay').getByRole('button', { name: 'Settings' }).click()
  const scopeToggle = page.getByRole('dialog', { name: 'Settings' }).getByRole('checkbox', {
    name: 'Scope mode',
  })
  await expect(scopeToggle).toBeChecked()
  await scopeToggle.click()
  await expect(page.getByTestId('scope-lens-overlay')).toHaveCount(0)
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Close' }).click()
  await page.getByTestId('mobile-viewer-overlay').getByRole('button', { name: 'Close' }).click()
  await expect(page.getByTestId('mobile-scope-aperture-slider')).toHaveValue('90')
  await expect(page.getByTestId('mobile-scope-magnification-slider')).toHaveCount(0)

  await page.evaluate(() => {
    window.localStorage.clear()
  })
})

test('settings sheet closes from its backdrop and restores focus to Settings', async ({ page }) => {
  await page.goto(SF_DEMO_ROUTE)

  await ensureMobileViewerOverlayOpen(page)
  const mobileOverlay = page.getByTestId('mobile-viewer-overlay')
  const settingsTrigger = mobileOverlay.getByRole('button', { name: 'Settings' })

  await settingsTrigger.click()

  const settingsDialog = page.getByRole('dialog', { name: 'Settings' })

  await expect(settingsDialog).toBeVisible()
  await page.getByTestId('settings-sheet-backdrop').click({ position: { x: 8, y: 8 } })
  await expect(settingsDialog).toHaveCount(0)
  await expect(settingsTrigger).toBeFocused()
})

test('mobile overlay opens from the trigger and closes from the backdrop only', async ({
  page,
}) => {
  await page.goto(SF_DEMO_ROUTE)

  const trigger = page.getByTestId('mobile-viewer-overlay-trigger')
  const mobileOverlay = page.getByTestId('mobile-viewer-overlay')

  await expect(trigger).toBeVisible()
  await expect(mobileOverlay).toHaveCount(0)

  await trigger.click()
  await expect(mobileOverlay).toBeVisible()

  await mobileOverlay.getByText('Privacy reassurance').click()
  await expect(mobileOverlay).toBeVisible()

  await page.getByTestId('mobile-viewer-overlay-backdrop').click({
    position: { x: 8, y: 8 },
  })
  await expect(page.getByTestId('mobile-viewer-overlay')).toHaveCount(0)
  await expect(trigger).toBeVisible()
  await expect(trigger).toBeFocused()
})

test('mobile overlay keeps lower sections reachable on a short viewport', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 520 })
  await page.goto(SF_DEMO_ROUTE)

  await ensureMobileViewerOverlayOpen(page)

  const scrollRegion = page.getByTestId('mobile-viewer-overlay-scroll-region')
  const mobileOverlay = page.getByTestId('mobile-viewer-overlay')

  await expect(scrollRegion).toBeVisible()
  expect(
    await scrollRegion.evaluate((element) => element.scrollHeight > element.clientHeight),
  ).toBe(true)

  const privacyHeading = mobileOverlay.getByText('Privacy reassurance')
  await privacyHeading.scrollIntoViewIfNeeded()
  await expect(privacyHeading).toBeInViewport()
})
