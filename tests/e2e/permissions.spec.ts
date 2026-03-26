import { expect, test } from '@playwright/test'

test('location denial enters the blocking fallback state', async ({ page }) => {
  await page.goto(
    '/view?entry=live&location=denied&camera=unavailable&orientation=unavailable',
  )

  await expect(
    page.getByText('SkyLens needs your location to know what is above you.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry permissions' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Try demo mode' })).toBeVisible()
})

test('bare /view stays blocked until a verified permission state exists', async ({
  page,
}) => {
  await page.goto('/view')

  await expect(page.getByText('Start SkyLens to continue.')).toBeVisible()
  await expect(page.getByText('Location: Pending')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry permissions' })).toBeVisible()
})

test('partial live state still blocks until the full payload is present', async ({
  page,
}) => {
  await page.goto('/view?entry=live&location=granted')

  await expect(page.getByText('Start SkyLens to continue.')).toBeVisible()
  await expect(page.getByText('Camera: Pending')).toBeVisible()
  await expect(page.getByText('Motion: Pending')).toBeVisible()
})

test('camera denial enters the non-camera fallback shell', async ({ page }) => {
  await page.goto('/view?entry=live&location=granted&camera=denied&orientation=granted')

  await expect(page.getByText('Camera access is off.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Non-camera fallback' })).toBeVisible()
  await expect(page.getByText('Motion: Settling')).toBeVisible()
})

test('orientation denial enters the manual-pan fallback shell', async ({ page }) => {
  await page.goto('/view?entry=live&location=granted&camera=granted&orientation=denied')

  await expect(page.getByText('Motion access is off.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Manual pan fallback' })).toBeVisible()
  await expect(page.getByText('Camera: Ready')).toBeVisible()
})
