import { expect, test } from '@playwright/test'

import { ensureMobileViewerOverlayOpen } from './mobile-overlay'

test('landing page shows shell copy and demo entry', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'SkyLens' })).toBeVisible()
  await expect(
    page.getByText("Point your phone at the sky and see what's above you."),
  ).toBeVisible()
  await expect(page.getByText('Camera stays on your device.')).toBeVisible()
  await expect(
    page.getByText(
      'Approximate location-based aircraft queries go directly from your browser to OpenSky.',
    ),
  ).toBeVisible()
  await expect(
    page.getByText(
      'Live satellite catalogs are fetched directly from CelesTrak.',
    ),
  ).toBeVisible()
  await expect(page.getByText('Use the live viewer on your phone.')).toBeVisible()
  await expect(page.getByText('Privacy and fallback notes')).toBeVisible()
  await expect(page.getByText('Permission order')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open live viewer' })).toBeVisible()

  const demoLink = page.getByRole('link', { name: 'Try demo mode' })
  const demoHref = await demoLink.getAttribute('href')

  expect(demoHref).toMatch(/\/view\?entry=demo/)
  await page.goto(demoHref!)
  await ensureMobileViewerOverlayOpen(page)
  const mobileOverlay = page.getByTestId('mobile-viewer-overlay')

  await expect(page).toHaveURL(/\/view\?entry=demo/)
  await expect(mobileOverlay.getByText('Demo mode is active.')).toBeVisible()
})
