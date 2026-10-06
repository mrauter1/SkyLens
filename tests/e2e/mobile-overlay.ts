import { expect, type Page } from '@playwright/test'

type InteriorBackdropOptions = {
  backdropTestId: string
  panelTestId: string
}

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

export async function clickInteriorBackdropAbovePanel(
  page: Page,
  { backdropTestId, panelTestId }: InteriorBackdropOptions,
) {
  const backdrop = page.getByTestId(backdropTestId)
  const panel = page.getByTestId(panelTestId)

  await expect(backdrop).toBeVisible()
  await expect(panel).toBeVisible()

  const [frameBox, panelBox] = await Promise.all([
    panel.locator('..').boundingBox(),
    panel.boundingBox(),
  ])

  expect(frameBox).not.toBeNull()
  expect(panelBox).not.toBeNull()

  const x = panelBox!.x + panelBox!.width / 2
  const availableHeight = panelBox!.y - frameBox!.y

  // Stay inside the transparent frame: shell padding already worked before the fix.
  expect(availableHeight).toBeGreaterThan(8)

  const y = frameBox!.y + availableHeight / 2
  const hitTestId = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('data-testid'),
    { x, y },
  )

  expect(hitTestId).toBe(backdropTestId)
  await page.mouse.click(x, y)
}
