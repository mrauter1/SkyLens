import { expect, type Page } from '@playwright/test'

export async function ensureMobileViewerOverlayOpen(page: Page) {
  await dismissViewerOnboarding(page)
  const overlay = page.getByTestId('mobile-viewer-overlay')

  if (await overlay.isVisible()) {
    return
  }

  const trigger = page.getByTestId('mobile-viewer-overlay-trigger')

  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(overlay).toBeVisible()
}

export async function dismissViewerOnboarding(page: Page) {
  await expect(page.locator('main[data-viewer-settings-hydrated="true"]')).toBeVisible()
  const onboarding = page.getByTestId('viewer-onboarding')

  if (await onboarding.isVisible()) {
    await onboarding.getByRole('button', { name: 'Got it' }).click({ force: true })
    await expect(onboarding).toHaveCount(0)
  }
}
