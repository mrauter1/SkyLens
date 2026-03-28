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
