import { expect, test } from '@playwright/test'

test('embedded validation page delegates the required permissions to the live viewer iframe', async ({
  page,
}) => {
  const response = await page.goto('/embed-validation')

  expect(response).not.toBeNull()
  expect(response?.headers()['permissions-policy']).toBe(
    'camera=(self), geolocation=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self)',
  )

  const iframe = page.getByTestId('viewer-embed-frame')

  await expect(iframe).toHaveAttribute(
    'allow',
    'camera; geolocation; accelerometer; gyroscope; magnetometer',
  )

  const viewerFrame = page.frameLocator('[data-testid="viewer-embed-frame"]')

  await expect(viewerFrame.getByLabel('Sky viewer stage')).toBeVisible()
  await expect(viewerFrame.getByTestId('mobile-viewer-overlay-trigger')).toBeVisible()
})
