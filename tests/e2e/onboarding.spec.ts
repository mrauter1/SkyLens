import { expect, test } from '@playwright/test'

test('viewer onboarding completes, persists, and can be replayed from Settings', async ({ page }) => {
  await page.goto('/view?entry=demo&demoScenario=tokyo-iss')
  await expect(page.locator('main[data-viewer-settings-hydrated="true"]')).toBeVisible()

  const onboarding = page.getByTestId('viewer-onboarding')

  await expect(onboarding).toBeVisible()
  await expect(onboarding).toContainText('Point your phone, or drag the sky')
  await expect(onboarding).toContainText('Center an object')
  await expect(onboarding).toContainText('Open Sky details')
  await onboarding.getByRole('button', { name: 'Got it' }).click()
  await expect(onboarding).toHaveCount(0)

  await page.reload()
  await expect(onboarding).toHaveCount(0)

  await page.getByTestId('mobile-viewer-overlay-trigger').click()
  await page.getByTestId('mobile-viewer-overlay').getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', {
    name: 'Replay viewer guide',
  }).click()

  await expect(onboarding).toBeVisible()
})
