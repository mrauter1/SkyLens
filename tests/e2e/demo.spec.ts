import { expect, test } from '@playwright/test'

import { ensureMobileViewerOverlayOpen } from './mobile-overlay'

const SF_DEMO_ROUTE =
  '/view?entry=demo&location=unavailable&camera=unavailable&orientation=unavailable&demoScenario=sf-evening'

test('demo mode renders deterministic labels and opens a detail card', async ({ page }) => {
  await page.goto(SF_DEMO_ROUTE)
  await ensureMobileViewerOverlayOpen(page)
  const mobileOverlay = page.getByTestId('mobile-viewer-overlay')

  await expect(mobileOverlay.getByText('Demo mode is active.')).toBeVisible()

  const aircraftLabel = page.getByRole('button', { name: /UAL123/i }).first()
  const stage = page.getByLabel('Sky viewer stage')

  await stage.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')

  await expect(aircraftLabel).toBeVisible()
  await aircraftLabel.click()

  await expect(mobileOverlay.getByText('Selected object')).toBeVisible()
  await expect(mobileOverlay.getByText('Altitude')).toBeVisible()
  await expect(mobileOverlay.getByText('Range')).toBeVisible()
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

  await page.getByTestId('mobile-viewer-overlay-backdrop').click()
  await expect(page.getByTestId('mobile-viewer-overlay')).toHaveCount(0)
  await expect(trigger).toBeVisible()
})
