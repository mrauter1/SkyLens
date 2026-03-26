import { expect, test } from '@playwright/test'

const SF_DEMO_ROUTE =
  '/view?entry=demo&location=unavailable&camera=unavailable&orientation=unavailable&demoScenario=sf-evening'

test('demo mode renders deterministic labels and opens a detail card', async ({ page }) => {
  await page.goto(SF_DEMO_ROUTE)

  await expect(page.getByText('Demo mode is active.')).toBeVisible()

  const aircraftLabel = page.getByRole('button', { name: /UAL123/i }).first()
  const stage = page.getByLabel('Sky viewer stage')

  await stage.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')

  await expect(aircraftLabel).toBeVisible()
  await aircraftLabel.click()

  await expect(page.getByText('Selected object')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Close' })).toBeVisible()
  await expect(page.getByText('Altitude')).toBeVisible()
  await expect(page.getByText('Range')).toBeVisible()
})

test('settings persist layer toggles in demo mode', async ({ page }) => {
  await page.goto(SF_DEMO_ROUTE)

  await page.getByRole('button', { name: 'Settings' }).click()
  const planesToggle = page.getByRole('checkbox', { name: 'Planes' })

  await expect(planesToggle).toBeChecked()
  await planesToggle.uncheck()
  await page.reload()
  await page.getByRole('button', { name: 'Settings' }).click()

  await expect(page.getByRole('checkbox', { name: 'Planes' })).not.toBeChecked()
})
