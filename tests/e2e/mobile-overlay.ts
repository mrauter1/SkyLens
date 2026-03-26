import { expect, type Page } from '@playwright/test'

export async function ensureMobileViewerOverlayOpen(page: Page) {
  const overlay = page.getByTestId('mobile-viewer-overlay')

  if (await overlay.isVisible()) {
    return
  }

  const trigger = page.getByTestId('mobile-viewer-overlay-trigger')

  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(overlay).toBeVisible()
}
