import { expect, test } from '@playwright/test'

import { ensureMobileViewerOverlayOpen } from './mobile-overlay'

test('location denial enters the blocking fallback state', async ({ page }) => {
  await page.goto(
    '/view?entry=live&location=denied&camera=unavailable&orientation=unavailable',
  )
  await ensureMobileViewerOverlayOpen(page)
  const mobileOverlay = page.getByTestId('mobile-viewer-overlay')

  await expect(
    mobileOverlay.getByRole('heading', {
      name: 'SkyLens needs your location to know what is above you.',
    }),
  ).toBeVisible()
  await expect(mobileOverlay.getByRole('button', { name: 'Retry permissions' })).toBeVisible()
  await expect(mobileOverlay.getByRole('link', { name: 'Try demo mode' })).toBeVisible()
})

test('bare /view stays blocked until a verified permission state exists', async ({
  page,
}) => {
  await page.goto('/view')
  await ensureMobileViewerOverlayOpen(page)
  const mobileOverlay = page.getByTestId('mobile-viewer-overlay')

  await expect(
    mobileOverlay.getByRole('heading', { name: 'Start SkyLens to continue.' }),
  ).toBeVisible()
  await expect(mobileOverlay.getByText('Location: Pending')).toBeVisible()
  await expect(mobileOverlay.getByRole('button', { name: 'Retry permissions' })).toBeVisible()
})

test('partial live state still blocks until the full payload is present', async ({
  page,
}) => {
  await page.goto('/view?entry=live&location=granted')
  await ensureMobileViewerOverlayOpen(page)
  const mobileOverlay = page.getByTestId('mobile-viewer-overlay')

  await expect(
    mobileOverlay.getByRole('heading', { name: 'Start SkyLens to continue.' }),
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
    mobileOverlay.getByRole('heading', { name: 'Non-camera fallback' }),
  ).toBeVisible()
  await expect(mobileOverlay.getByText('Motion: Settling')).toBeVisible()
})

test('orientation denial enters the manual-pan fallback shell', async ({ page }) => {
  await page.goto('/view?entry=live&location=granted&camera=granted&orientation=denied')
  await ensureMobileViewerOverlayOpen(page)
  const mobileOverlay = page.getByTestId('mobile-viewer-overlay')

  await expect(mobileOverlay.getByText('Motion access is off.')).toBeVisible()
  await expect(
    mobileOverlay.getByRole('heading', { name: 'Manual pan fallback' }),
  ).toBeVisible()
  await expect(mobileOverlay.getByText('Camera: Ready')).toBeVisible()
})
