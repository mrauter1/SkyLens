import { expect, test } from '@playwright/test'

test('landing page shows shell copy and demo entry', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'SkyLens' })).toBeVisible()
  await expect(
    page.getByText("Point your phone at the sky and see what's above you."),
  ).toBeVisible()
  await expect(page.getByText('Camera stays on your device.')).toBeVisible()
  await expect(
    page.getByText(
      'Location is used only to calculate what is above you right now.',
    ),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start SkyLens' })).toBeVisible()

  const demoLink = page.getByRole('link', { name: 'Try demo mode' })
  const demoHref = await demoLink.getAttribute('href')

  expect(demoHref).toMatch(/\/view\?entry=demo/)
  await page.goto(demoHref!)

  await expect(page).toHaveURL(/\/view\?entry=demo/)
  await expect(page.getByText('Demo mode is active.')).toBeVisible()
})
