import { expect, test } from '@playwright/test'

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
  await expect(mobileOverlay.getByText('Camera: Ready')).toBeVisible()
  await expect(mobileOverlay.getByText('Sensor: Absolute')).toBeVisible()
})

test('bare /view stays blocked until a verified permission state exists', async ({
  page,
}) => {
  await page.goto('/view')
  await ensureMobileViewerOverlayOpen(page)
  const mobileOverlay = page.getByTestId('mobile-viewer-overlay')

  await expect(
    mobileOverlay.getByRole('heading', { name: 'Start AR from this viewer.' }),
  ).toBeVisible()
  await expect(mobileOverlay.getByText('Location: Pending')).toBeVisible()
  await expect(mobileOverlay.getByRole('button', { name: 'Start AR' })).toBeVisible()
})

test('partial live state still blocks until the full payload is present', async ({
  page,
}) => {
  await page.goto('/view?entry=live&location=granted')
  await ensureMobileViewerOverlayOpen(page)
  const mobileOverlay = page.getByTestId('mobile-viewer-overlay')

  await expect(
    mobileOverlay.getByRole('heading', { name: 'Start AR from this viewer.' }),
  ).toBeVisible()
  await expect(mobileOverlay.getByText('Camera: Pending')).toBeVisible()
  await expect(mobileOverlay.getByText('Motion: Pending')).toBeVisible()
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
  await expect(mobileOverlay.getByText('Motion: Settling')).toBeVisible()
})

test('orientation denial enters the manual-pan fallback shell', async ({ page }) => {
  await page.goto('/view?entry=live&location=granted&camera=granted&orientation=denied')
  await ensureMobileViewerOverlayOpen(page)
  const mobileOverlay = page.getByTestId('mobile-viewer-overlay')

  await expect(mobileOverlay.getByText('Motion is not enabled.')).toBeVisible()
  await expect(
    mobileOverlay.getByRole('heading', { name: 'Manual observer needed' }),
  ).toBeVisible()
  await expect(mobileOverlay.getByText('Camera: Ready')).toBeVisible()
  await expect(mobileOverlay.getByText('Motion: Manual pan')).toBeVisible()
  await expect(mobileOverlay.getByRole('button', { name: 'Enable motion' })).toBeVisible()
})

test('compact alignment panel keeps lower controls reachable on a short viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 520 })
  await page.goto('/view?entry=live&location=granted&camera=granted&orientation=granted')

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
