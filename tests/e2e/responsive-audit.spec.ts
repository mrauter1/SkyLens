import { expect, test } from '@playwright/test'

const COMPACT_PROJECTS = new Set(['mobile-small', 'tablet-portrait', 'pixel-7'])

test('audited viewport uses the intended shell without document overflow', async ({ page }, testInfo) => {
  await page.goto('/view?entry=demo&demoScenario=tokyo-iss')

  const compactExpected = COMPACT_PROJECTS.has(testInfo.project.name)
  const compactTrigger = page.getByTestId('mobile-viewer-overlay-trigger')
  const desktopHeader = page.getByTestId('desktop-viewer-header')

  if (compactExpected) {
    await expect(compactTrigger).toBeVisible()
    await expect(desktopHeader).toBeHidden()
  } else {
    await expect(desktopHeader).toBeVisible()
    await expect(compactTrigger).toBeHidden()
  }

  const overflow = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }))

  expect(overflow.width).toBeLessThanOrEqual(overflow.viewport + 1)
})

test('Settings remains inside the dynamic viewport and its final action is reachable', async ({
  page,
}, testInfo) => {
  await page.goto('/view?entry=demo&demoScenario=tokyo-iss')

  if (COMPACT_PROJECTS.has(testInfo.project.name)) {
    await page.getByTestId('mobile-viewer-overlay-trigger').click()
    await page.getByTestId('mobile-viewer-overlay').getByRole('button', { name: 'Settings' }).click()
  } else {
    await page.getByTestId('desktop-viewer-header').getByRole('button', { name: 'Settings' }).click()
  }

  const panel = page.getByTestId('settings-sheet-panel')
  const finalAction = panel.getByRole('button', { name: 'Replay viewer guide' })

  await expect(panel).toBeVisible()
  const box = await panel.boundingBox()
  const viewport = page.viewportSize()

  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1)

  await finalAction.scrollIntoViewIfNeeded()
  await expect(finalAction).toBeInViewport()
})

test('small landing privacy heading and PWA badge do not overlap', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-small', '360 px regression')

  await page.goto('/')

  const heading = page.getByText('Privacy and fallback notes', { exact: true })
  const badge = page.getByText('PWA ready', { exact: true })
  const headingBox = await heading.boundingBox()
  const badgeBox = await badge.boundingBox()

  expect(headingBox).not.toBeNull()
  expect(badgeBox).not.toBeNull()
  const overlaps = !(
    headingBox!.x + headingBox!.width <= badgeBox!.x ||
    badgeBox!.x + badgeBox!.width <= headingBox!.x ||
    headingBox!.y + headingBox!.height <= badgeBox!.y ||
    badgeBox!.y + badgeBox!.height <= headingBox!.y
  )

  expect(overlaps).toBe(false)
})

test('360 px viewer header preserves its title and actions', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-small', '360 px regression')

  await page.goto('/view?entry=demo&demoScenario=tokyo-iss')
  await page.getByTestId('mobile-viewer-overlay-trigger').click()

  const header = page.getByTestId('mobile-viewer-header')

  await expect(header.getByText('SkyLens', { exact: true })).toBeVisible()
  await expect(header.getByText('Demo viewer', { exact: true })).toBeVisible()
  await expect(page.getByTestId('mobile-viewer-overlay').getByRole('button', { name: 'Settings' })).toBeVisible()
  await expect(page.getByTestId('mobile-viewer-overlay').getByRole('button', { name: 'Close' })).toBeVisible()
})

test('desktop details action opens the user-facing viewer panel', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop regression')

  await page.goto('/view?entry=demo&demoScenario=sf-evening')

  const header = page.getByTestId('desktop-viewer-header')
  const actions = page.getByTestId('desktop-viewer-actions')
  const detailsAction = page.getByTestId('desktop-open-viewer-action')
  const panel = page.getByTestId('desktop-viewer-panel')

  await expect(header).toBeVisible()
  await expect(actions).toContainText('Sky details')
  await expect(panel).toHaveCount(0)
  await detailsAction.click()
  await expect(panel).toBeVisible()
  await expect(panel.getByText('Viewer snapshot')).toBeVisible()
  await expect(panel.getByText('Privacy reassurance')).toBeVisible()
})
