import { expect, test, type Page } from '@playwright/test'

import { ensureMobileViewerOverlayOpen } from './mobile-overlay'

test('location denial keeps the viewer open with manual observer fallback', async ({ page }) => {
  await page.goto(
    '/view?entry=live&location=denied&camera=granted&orientation=granted',
  )
  await ensureMobileViewerOverlayOpen(page)
  const mobileOverlay = page.getByTestId('mobile-viewer-overlay')

  await expect(
    mobileOverlay.getByRole('heading', { name: 'Manual observer needed' }),
  ).toBeVisible()
  await expect(mobileOverlay.getByText('Manual observer', { exact: true })).toBeVisible()
  await expect(mobileOverlay.getByRole('button', { name: 'Retry location' })).toBeVisible()
  await expect(mobileOverlay.getByText('Camera: Off')).toBeVisible()
  await expect(mobileOverlay.getByText('Motion: AR off')).toBeVisible()
})

test('bare /view defaults to free-navigation until Enable AR is pressed', async ({
  page,
}) => {
  await page.goto('/view')
  await ensureMobileViewerOverlayOpen(page)
  const mobileOverlay = page.getByTestId('mobile-viewer-overlay')

  await expect(
    mobileOverlay.getByRole('heading', { name: 'Manual observer needed' }),
  ).toBeVisible()
  await expect(mobileOverlay.getByText('Location: Pending')).toBeVisible()
  await expect(page.getByTestId('desktop-enable-ar-action')).toHaveCount(1)
})

test('partial live state keeps Enable AR visible without auto-starting AR', async ({
  page,
}) => {
  await page.goto('/view?entry=live&location=granted')
  await ensureMobileViewerOverlayOpen(page)
  const mobileOverlay = page.getByTestId('mobile-viewer-overlay')

  await expect(
    mobileOverlay.getByRole('heading', { name: 'Manual observer needed' }),
  ).toBeVisible()
  await expect(mobileOverlay.getByText('Camera: Pending')).toBeVisible()
  await expect(mobileOverlay.getByText('Motion: AR off')).toBeVisible()
  await expect(page.getByTestId('desktop-enable-ar-action')).toHaveCount(1)
})

test('camera denial enters the non-camera fallback shell', async ({ page }) => {
  await page.goto('/view?entry=live&location=granted&camera=denied&orientation=granted')
  await ensureMobileViewerOverlayOpen(page)
  const mobileOverlay = page.getByTestId('mobile-viewer-overlay')

  await expect(mobileOverlay.getByText('Camera access is off.')).toBeVisible()
  await expect(
    mobileOverlay.getByRole('heading', { name: 'Manual observer needed' }),
  ).toBeVisible()
  await expect(mobileOverlay.getByText('Camera: Denied')).toBeVisible()
  await expect(mobileOverlay.getByText('Motion: AR off')).toBeVisible()
})

test('orientation denial enters the manual-pan fallback shell', async ({ page }) => {
  await page.goto('/view?entry=live&location=granted&camera=granted&orientation=denied')
  await ensureMobileViewerOverlayOpen(page)
  const mobileOverlay = page.getByTestId('mobile-viewer-overlay')

  await expect(mobileOverlay.getByText('Motion is not enabled.')).toBeVisible()
  await expect(
    mobileOverlay.getByRole('heading', { name: 'Manual observer needed' }),
  ).toBeVisible()
  await expect(mobileOverlay.getByText('Camera: Off')).toBeVisible()
  await expect(mobileOverlay.getByText('Motion: AR off')).toBeVisible()
  await expect(mobileOverlay.getByRole('button', { name: 'Enable motion' })).toBeVisible()
})

test('manual-pan fallback still enables scope mode from mobile quick actions', async ({
  page,
}) => {
  await page.goto('/view?entry=live&location=granted&camera=granted&orientation=denied')
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

  await page.evaluate(() => {
    window.localStorage.clear()
  })
})

test('disabling AR returns the mobile surface to free-navigation', async ({ page }) => {
  await page.goto('/view?entry=live&location=granted&camera=granted&orientation=granted')

  const arToggle = page.getByTestId('mobile-permission-action')

  await expect(arToggle).toHaveText('Enable AR')
  await arToggle.click()
  await expect(arToggle).toHaveText('Disable AR')
  await arToggle.click()

  await expect(arToggle).toHaveText('Enable AR')
  await expect(page.getByText('AR disabled')).toBeVisible()
  await expect(page.getByTestId('mobile-scope-action')).toBeVisible()
})

test('compact alignment panel keeps lower controls reachable on a short viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 520 })
  await page.goto('/view?entry=live&location=granted&camera=granted&orientation=granted')
  await enableArFromMobile(page)

  const alignButton = page.getByTestId('mobile-align-action')

  await expect(alignButton).toBeVisible()
  await alignButton.click()

  const alignmentShell = page.getByTestId('mobile-alignment-overlay-shell')
  const alignmentScrollRegion = page.getByTestId('mobile-alignment-overlay-scroll-region')
  const alignmentPanel = alignmentScrollRegion.getByTestId('alignment-instructions-panel')
  const lowestNudgeControl = alignmentPanel.getByRole('button', { name: 'Nudge down' })

  await expect(alignmentShell).toBeVisible()
  await expect(alignmentPanel).toBeVisible()
  await expect(
    page
      .getByTestId('mobile-viewer-quick-actions')
      .getByTestId('alignment-instructions-panel'),
  ).toHaveCount(0)
  expect(
    await alignmentScrollRegion.evaluate((element) => element.scrollHeight > element.clientHeight),
  ).toBe(true)

  await alignmentScrollRegion.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })

  await expect(lowestNudgeControl).toBeInViewport()
})

test('alignment instructions close from the backdrop and restore focus to Align', async ({
  page,
}) => {
  await page.goto('/view?entry=live&location=granted&camera=granted&orientation=granted')
  await enableArFromMobile(page)

  const alignButton = page.getByTestId('mobile-align-action')

  await expect(alignButton).toBeVisible()
  await alignButton.click()

  const alignmentShell = page.getByTestId('mobile-alignment-overlay-shell')

  await expect(alignmentShell).toBeVisible()
  await page.getByTestId('mobile-alignment-overlay-backdrop').click({
    position: { x: 8, y: 8 },
  })
  await expect(alignmentShell).toHaveCount(0)
  await expect(alignButton).toBeFocused()
})

async function enableArFromMobile(page: Page) {
  const arToggle = page.getByTestId('mobile-permission-action')

  await expect(arToggle).toHaveText('Enable AR')
  await arToggle.click()
  await expect(arToggle).toHaveText('Disable AR')
}
