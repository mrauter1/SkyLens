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
  const mainApertureSlider = page.getByTestId('mobile-scope-aperture-slider')
  const mainMagnificationSlider = page.getByTestId('mobile-scope-magnification-slider')

  await expect(mainApertureSlider).toHaveValue('120')
  await expect(mainMagnificationSlider).toHaveValue('1')
  await mainApertureSlider.evaluate((element) => {
    const input = element as HTMLInputElement
    input.value = '180'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await mainMagnificationSlider.evaluate((element) => {
    const input = element as HTMLInputElement
    input.value = '2'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(mainApertureSlider).toHaveValue('180')
  await expect(mainMagnificationSlider).toHaveValue('2')

  await mobileOverlay.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('checkbox', { name: 'Scope mode' }).click()
  await expect(page.getByTestId('scope-lens-overlay')).toBeVisible()

  const scopeApertureSlider = page.getByTestId('mobile-scope-aperture-slider')
  const scopeMagnificationSlider = page.getByTestId('mobile-scope-magnification-slider')

  await expect(scopeApertureSlider).toHaveValue('120')
  await expect(scopeMagnificationSlider).toHaveValue('50')
  await scopeApertureSlider.evaluate((element) => {
    const input = element as HTMLInputElement
    input.value = '240'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await scopeMagnificationSlider.evaluate((element) => {
    const input = element as HTMLInputElement
    input.value = '75'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(scopeApertureSlider).toHaveValue('240')
  await expect(scopeMagnificationSlider).toHaveValue('75')

  await page.reload()
  await ensureMobileViewerOverlayOpen(page)

  await expect(page.getByTestId('mobile-scope-aperture-slider')).toHaveValue('240')
  await expect(page.getByTestId('mobile-scope-magnification-slider')).toHaveValue('75')
  await page.getByTestId('mobile-viewer-overlay').getByRole('button', { name: 'Settings' }).click()
  const scopeToggle = page.getByRole('dialog', { name: 'Settings' }).getByRole('checkbox', {
    name: 'Scope mode',
  })
  await expect(scopeToggle).toBeChecked()
  await scopeToggle.click()
  await expect(page.getByTestId('scope-lens-overlay')).toHaveCount(0)
  await expect(page.getByTestId('mobile-scope-aperture-slider')).toHaveValue('120')
  await expect(page.getByTestId('mobile-scope-magnification-slider')).toHaveValue('1')

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

  await scrollRegion.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })

  await expect(mobileOverlay.getByText('Privacy reassurance')).toBeInViewport()
})

test('desktop viewer keeps actions visible and opens the compact viewer panel on demand', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto(SF_DEMO_ROUTE)

  const desktopHeader = page.getByTestId('desktop-viewer-header')
  const desktopNextAction = page.getByTestId('desktop-next-action')
  const openViewerAction = page.getByTestId('desktop-open-viewer-action')
  const desktopViewerPanel = page.getByTestId('desktop-viewer-panel')

  await expect(desktopHeader).toBeVisible()
  await expect(desktopNextAction).toContainText('Open the viewer details')
  await expect(desktopNextAction).toContainText('Open viewer')
  await expect(page.getByTestId('desktop-viewer-actions')).not.toContainText('Open viewer')
  await expect(page.getByTestId('desktop-viewer-actions')).toContainText('Enable camera')
  await expect(page.getByTestId('desktop-viewer-actions')).toContainText('Motion')
  await expect(page.getByTestId('desktop-viewer-actions')).toContainText('Align')
  await expect(desktopViewerPanel).toHaveCount(0)

  await openViewerAction.click()

  await expect(desktopViewerPanel).toBeVisible()
  await expect(desktopViewerPanel.getByText('Viewer snapshot')).toBeVisible()
  await expect(desktopViewerPanel.getByText('Privacy reassurance')).toBeVisible()
})
