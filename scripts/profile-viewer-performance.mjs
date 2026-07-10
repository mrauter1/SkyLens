import { access, writeFile } from 'node:fs/promises'

import { chromium } from '@playwright/test'

const DEFAULT_LIVE_URL = 'https://skylens-serverless-static.onrender.com'
const STABLE_CHROME_PATHS = [
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]
const SETTINGS_KEY_V1 = 'skylens-serverless.viewer-settings.v1'
const SETTINGS_KEY_V2 = 'skylens-serverless.viewer-settings.v2'
const PRODUCTION_SCOPE_DATA_PATTERN =
  'https://pub-566fb74233f3432ba4d47900577e552e.r2.dev/**'
const DEFAULT_CASES = ['default', 'high-deep-stars', 'low-safe']

const CASES = {
  landing: {
    path: '/',
    settleOn: 'main',
  },
  'landing-to-live': {
    path: '/',
    settleOn: 'main',
    navigationAction: 'Open live viewer',
    navigationSettleOn: '[data-testid="desktop-viewer-header"]',
  },
  'landing-to-demo': {
    path: '/',
    settleOn: 'main',
    navigationAction: 'Try demo mode',
    navigationSettleOn: '[data-testid="desktop-viewer-header"]',
  },
  'live-pre-observer': {
    path: '/view',
    settleOn: '[data-testid="desktop-viewer-header"]',
  },
  default: {
    path: '/view?entry=demo&demoScenario=sf-evening',
    settleOn: '[data-testid="desktop-viewer-header"]',
    interactions: true,
  },
  'high-deep-stars': {
    path: '/view?entry=demo&demoScenario=sf-evening',
    settleOn: '[data-testid="desktop-viewer-header"]',
    settings: {
      motionQuality: 'high',
      mainViewDeepStarsEnabled: true,
      scopeModeEnabled: false,
      labelDisplayMode: 'center_only',
      onboardingCompleted: true,
    },
    interactions: true,
  },
  'low-safe': {
    path: '/view?entry=demo&demoScenario=sf-evening',
    settleOn: '[data-testid="desktop-viewer-header"]',
    settings: {
      motionQuality: 'low',
      mainViewDeepStarsEnabled: false,
      scopeModeEnabled: false,
      labelDisplayMode: 'center_only',
      onboardingCompleted: true,
    },
    interactions: true,
  },
  'persisted-worst-case': {
    path: '/view?entry=demo&demoScenario=sf-evening',
    settleOn: '[data-testid="desktop-viewer-header"]',
    legacySettingsOnly: true,
    settings: {
      motionQuality: 'high',
      mainViewDeepStarsEnabled: true,
      scopeModeEnabled: true,
      labelDisplayMode: 'on_objects',
      onboardingCompleted: true,
    },
    interactions: true,
  },
  'reduced-motion': {
    path: '/view?entry=demo&demoScenario=sf-evening',
    settleOn: '[data-testid="desktop-viewer-header"]',
    reducedMotion: 'reduce',
    settings: {
      motionQuality: 'high',
      mainViewDeepStarsEnabled: true,
      scopeModeEnabled: false,
      labelDisplayMode: 'center_only',
      onboardingCompleted: true,
    },
    interactions: true,
  },
  'background-resume': {
    path: '/view?entry=demo&demoScenario=sf-evening',
    settleOn: '[data-testid="desktop-viewer-header"]',
    settings: {
      motionQuality: 'high',
      mainViewDeepStarsEnabled: true,
      scopeModeEnabled: false,
      labelDisplayMode: 'center_only',
      onboardingCompleted: true,
    },
    backgroundResume: true,
    interactions: true,
  },
}

const BUDGETS = {
  default: {
    normal: { taskPercent: 10, interactionMs: 100, eventLoopP95Ms: 25 },
    throttled: { taskPercent: 30, interactionMs: 250, eventLoopP95Ms: 75 },
  },
  'high-deep-stars': {
    normal: { taskPercent: 25, interactionMs: 100, eventLoopP95Ms: 25 },
    throttled: { taskPercent: 60, interactionMs: 250, eventLoopP95Ms: 75 },
  },
  'low-safe': {
    normal: { taskPercent: 5, interactionMs: 100, eventLoopP95Ms: 25 },
    throttled: { taskPercent: 15, interactionMs: 250, eventLoopP95Ms: 75 },
  },
  'persisted-worst-case': {
    normal: { taskPercent: 5, interactionMs: 100, eventLoopP95Ms: 25 },
    throttled: { taskPercent: 15, interactionMs: 250, eventLoopP95Ms: 75 },
  },
  'reduced-motion': {
    normal: { taskPercent: 25, interactionMs: 100, eventLoopP95Ms: 25 },
    throttled: { taskPercent: 60, interactionMs: 250, eventLoopP95Ms: 75 },
  },
  'background-resume': {
    normal: { taskPercent: 25, interactionMs: 100, eventLoopP95Ms: 25 },
    throttled: { taskPercent: 60, interactionMs: 250, eventLoopP95Ms: 75 },
  },
}

export function parseArguments(argv) {
  const options = {
    baseUrl: DEFAULT_LIVE_URL,
    browser: 'stable',
    cases: DEFAULT_CASES,
    durationMs: 10_000,
    settleMs: 5_000,
    cpuThrottle: 1,
    assert: false,
    output: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const [inlineKey, inlineValue] = argument.split('=', 2)
    const readValue = () => inlineValue ?? argv[++index]

    switch (inlineKey) {
      case '--url':
        options.baseUrl = readValue()
        break
      case '--browser':
        options.browser = readValue()
        break
      case '--cases':
        options.cases = readValue().split(',').filter(Boolean)
        break
      case '--duration-ms':
        options.durationMs = Number(readValue())
        break
      case '--settle-ms':
        options.settleMs = Number(readValue())
        break
      case '--cpu-throttle':
        options.cpuThrottle = Number(readValue())
        break
      case '--output':
        options.output = readValue()
        break
      case '--assert':
        options.assert = true
        break
      default:
        throw new Error(`Unknown performance option: ${argument}`)
    }
  }

  if (!Number.isFinite(options.durationMs) || options.durationMs < 1_000) {
    throw new Error('--duration-ms must be at least 1000')
  }
  if (!Number.isFinite(options.settleMs) || options.settleMs < 0) {
    throw new Error('--settle-ms must be zero or greater')
  }
  if (!Number.isFinite(options.cpuThrottle) || options.cpuThrottle < 1) {
    throw new Error('--cpu-throttle must be one or greater')
  }
  for (const caseName of options.cases) {
    if (!CASES[caseName]) {
      throw new Error(`Unknown performance case: ${caseName}`)
    }
  }

  return options
}

async function findStableChrome() {
  for (const candidate of STABLE_CHROME_PATHS) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Try the next supported installation path.
    }
  }
  return null
}

async function launchBrowser(preference) {
  if (preference === 'chromium') {
    return {
      browser: await chromium.launch({ headless: true }),
      browserLabel: 'playwright-chromium',
    }
  }

  const stableChromePath = await findStableChrome()
  if (stableChromePath) {
    return {
      browser: await chromium.launch({
        headless: true,
        executablePath: stableChromePath,
      }),
      browserLabel: `stable-chrome:${stableChromePath}`,
    }
  }

  if (preference === 'stable-only') {
    throw new Error('Stable Google Chrome was requested but was not found.')
  }

  return {
    browser: await chromium.launch({ headless: true }),
    browserLabel: 'playwright-chromium-fallback',
  }
}

function metricsByName(payload) {
  return Object.fromEntries(payload.metrics.map((metric) => [metric.name, metric.value]))
}

function percentile(values, fraction) {
  if (values.length === 0) {
    return 0
  }
  const ordered = [...values].sort((left, right) => left - right)
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))]
}

function round(value, digits = 1) {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function resolveUrl(baseUrl, path) {
  return new URL(path, `${baseUrl.replace(/\/$/, '')}/`).href
}

async function measureDomInteraction(page, actionSelector, expectedSelector) {
  return page.evaluate(
    ({ actionSelector: action, expectedSelector: expected }) =>
      new Promise((resolve, reject) => {
        const actionElement = document.querySelector(action)
        if (!(actionElement instanceof HTMLElement)) {
          reject(new Error(`Performance action was not found: ${action}`))
          return
        }

        const isExpectedVisible = () => {
          const expectedElement = document.querySelector(expected)
          if (!(expectedElement instanceof HTMLElement)) {
            return false
          }
          const style = getComputedStyle(expectedElement)
          return style.display !== 'none' && style.visibility !== 'hidden'
        }
        let finished = false
        const startedAt = performance.now()
        const finish = () => {
          if (finished) {
            return
          }
          finished = true
          observer.disconnect()
          window.clearTimeout(timeoutId)
          requestAnimationFrame(() => resolve(performance.now() - startedAt))
        }
        const observer = new MutationObserver(() => {
          if (isExpectedVisible()) {
            finish()
          }
        })
        const timeoutId = window.setTimeout(() => {
          observer.disconnect()
          reject(new Error(`Performance result was not visible: ${expected}`))
        }, 5_000)

        observer.observe(document.body, {
          attributes: true,
          childList: true,
          subtree: true,
        })
        actionElement.click()
        if (isExpectedVisible()) {
          finish()
        }
      }),
    { actionSelector, expectedSelector },
  )
}

async function measureCheckboxInteraction(page, selector) {
  return page.evaluate(
    (checkboxSelector) =>
      new Promise((resolve, reject) => {
        const checkbox = document.querySelector(checkboxSelector)
        if (!(checkbox instanceof HTMLInputElement)) {
          reject(new Error(`Performance checkbox was not found: ${checkboxSelector}`))
          return
        }

        const initialValue = checkbox.checked
        const startedAt = performance.now()
        checkbox.click()
        requestAnimationFrame(() => {
          if (checkbox.checked === initialValue) {
            reject(new Error(`Performance checkbox did not update: ${checkboxSelector}`))
            return
          }
          resolve(performance.now() - startedAt)
        })
      }),
    selector,
  )
}

async function measureViewerInteractions(page) {
  const timings = {}
  const detailsAction = page.getByTestId('desktop-open-viewer-action')

  if (await detailsAction.isVisible().catch(() => false)) {
    timings.skyDetailsMs = round(
      await measureDomInteraction(
        page,
        '[data-testid="desktop-open-viewer-action"]',
        '[data-testid="desktop-viewer-panel"]',
      ),
    )
    await detailsAction.click()
  }

  const settingsAction = page
    .getByTestId('desktop-viewer-header')
    .getByRole('button', { name: 'Settings' })
  if (await settingsAction.isVisible().catch(() => false)) {
    timings.settingsMs = round(
      await measureDomInteraction(
        page,
        '[data-focus-surface="desktop-settings-trigger"]',
        '[data-testid="settings-sheet-panel"]',
      ),
    )
    timings.toggleMs = round(
      await measureCheckboxInteraction(page, 'input[aria-label="Constellations"]'),
    )
    await page.getByTestId('settings-sheet-panel').getByRole('button', { name: 'Close' }).click()
  }

  const homeAction = page.getByTestId('viewer-home-action')
  if (await homeAction.isVisible().catch(() => false)) {
    timings.homeMs = round(
      await measureDomInteraction(
        page,
        '[data-testid="viewer-home-action"]',
        '[data-testid="viewer-home-action"][data-navigation-pending="true"]',
      ),
    )
    await page.waitForURL((url) => url.pathname === '/')
  }

  return timings
}

async function runCase(browser, options, caseName) {
  const definition = CASES[caseName]
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    reducedMotion: definition.reducedMotion ?? 'no-preference',
  })
  const page = await context.newPage()
  const requestFailures = []
  const pageErrors = []
  const consoleErrors = []
  const httpErrors = []
  const r2RequestUrls = []
  const backgroundLifecycleTransitions = ['active']

  if (['127.0.0.1', 'localhost'].includes(new URL(options.baseUrl).hostname)) {
    await page.route(PRODUCTION_SCOPE_DATA_PATTERN, async (route) => {
      const response = await fetch(route.request().url())
      await route.fulfill({
        status: response.status,
        body: Buffer.from(await response.arrayBuffer()),
        headers: {
          'access-control-allow-origin': '*',
          'cache-control': response.headers.get('cache-control') ?? 'public, max-age=3600',
          'content-type': response.headers.get('content-type') ?? 'application/octet-stream',
        },
      })
    })
  }

  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText ?? 'unknown'
    requestFailures.push({
      url: request.url(),
      errorText,
      expectedPrefetchCancellation: errorText === 'net::ERR_ABORTED',
    })
  })
  page.on('request', (request) => {
    if (request.url().includes('r2.dev')) {
      r2RequestUrls.push(request.url())
    }
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      httpErrors.push({
        status: response.status(),
        url: response.url(),
      })
    }
  })

  await page.addInitScript(
    ({ settings, legacySettingsOnly, settingsKeyV1, settingsKeyV2 }) => {
      globalThis.__skylensPerformance = {
        longTasks: [],
        visibilityTransitions: [document.visibilityState],
      }
      document.addEventListener('visibilitychange', () => {
        globalThis.__skylensPerformance.visibilityTransitions.push(document.visibilityState)
      })
      if (typeof PerformanceObserver === 'function') {
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              globalThis.__skylensPerformance.longTasks.push({
                startTime: entry.startTime,
                duration: entry.duration,
              })
            }
          })
          observer.observe({ entryTypes: ['longtask'] })
        } catch {
          // Long-task observation is optional in browsers that do not expose it.
        }
      }

      if (settings) {
        const value = JSON.stringify(settings)
        localStorage.setItem(settingsKeyV1, value)
        if (!legacySettingsOnly) {
          localStorage.setItem(settingsKeyV2, value)
        }
      }
    },
    {
      settings: definition.settings ?? null,
      legacySettingsOnly: definition.legacySettingsOnly ?? false,
      settingsKeyV1: SETTINGS_KEY_V1,
      settingsKeyV2: SETTINGS_KEY_V2,
    },
  )

  const cdp = await context.newCDPSession(page)
  await cdp.send('Performance.enable')
  if (options.cpuThrottle > 1) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: options.cpuThrottle })
  }

  const navigationStartedAt = Date.now()
  const response = await page.goto(resolveUrl(options.baseUrl, definition.path), {
    waitUntil: 'networkidle',
    timeout: 45_000,
  })
  const navigationMs = Date.now() - navigationStartedAt
  await page.locator(definition.settleOn).first().waitFor({ state: 'visible' })
  let routeNavigationMs = null

  if (definition.navigationAction) {
    const routeNavigationStartedAt = Date.now()
    await page.getByRole('link', { name: definition.navigationAction }).click()
    await page.locator(definition.navigationSettleOn).first().waitFor({ state: 'visible' })
    routeNavigationMs = Date.now() - routeNavigationStartedAt
  }

  const onboardingAction = page.getByRole('button', { name: 'Got it' })
  if (await onboardingAction.isVisible().catch(() => false)) {
    await onboardingAction.click()
  }
  if (
    definition.settings?.mainViewDeepStarsEnabled &&
    !definition.legacySettingsOnly
  ) {
    await page.waitForFunction(
      () =>
        performance
          .getEntriesByType('resource')
          .some((entry) => entry.name.includes('r2.dev')),
      undefined,
      { timeout: 20_000 },
    )
    await page.waitForLoadState('networkidle')
  }
  await page.waitForTimeout(options.settleMs)
  if (definition.backgroundResume) {
    await cdp.send('Page.setWebLifecycleState', { state: 'frozen' })
    backgroundLifecycleTransitions.push('frozen')
    await new Promise((resolve) => setTimeout(resolve, 1_500))
    await cdp.send('Page.setWebLifecycleState', { state: 'active' })
    backgroundLifecycleTransitions.push('active')
    await page.waitForFunction(() => document.visibilityState === 'visible')
    await page.waitForTimeout(250)
  }
  await cdp.send('HeapProfiler.collectGarbage')
  await page.evaluate(() => {
    if (globalThis.__skylensPerformance) {
      globalThis.__skylensPerformance.longTasks = []
    }
  })

  const startMetrics = metricsByName(await cdp.send('Performance.getMetrics'))
  const eventLoopDelays = []
  const sampleIntervalMs = Math.min(1_000, Math.max(100, Math.floor(options.durationMs / 10)))
  const measurementStartedAt = Date.now()

  while (Date.now() - measurementStartedAt < options.durationMs) {
    const delay = await page.evaluate(async () => {
      const startedAt = performance.now()
      await new Promise((resolve) => setTimeout(resolve, 0))
      return performance.now() - startedAt
    })
    eventLoopDelays.push(delay)
    await page.waitForTimeout(sampleIntervalMs)
  }

  const measuredDurationMs = Date.now() - measurementStartedAt
  const endMetrics = metricsByName(await cdp.send('Performance.getMetrics'))
  const browserState = await page.evaluate(() => {
    const diagnostics = globalThis.__skylensPerformance ?? { longTasks: [] }
    const r2ResourceUrls = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => name.includes('r2.dev'))
    const uniqueR2ResourceUrls = [...new Set(r2ResourceUrls)]
    return {
      longTasks: diagnostics.longTasks,
      resourceCount: performance.getEntriesByType('resource').length,
      r2ResourceCount: r2ResourceUrls.length,
      uniqueR2ResourceCount: uniqueR2ResourceUrls.length,
      duplicateR2ResourceCount: r2ResourceUrls.length - uniqueR2ResourceUrls.length,
      r2ResourceUrls: uniqueR2ResourceUrls,
      visibilityTransitions: diagnostics.visibilityTransitions,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      visibilityState: document.visibilityState,
    }
  })
  browserState.r2RequestCount = r2RequestUrls.length
  browserState.uniqueR2RequestCount = new Set(r2RequestUrls).size
  browserState.duplicateR2RequestCount =
    r2RequestUrls.length - browserState.uniqueR2RequestCount
  browserState.backgroundLifecycleTransitions = backgroundLifecycleTransitions
  await cdp.send('HeapProfiler.collectGarbage')
  const postGarbageCollectionMetrics = metricsByName(
    await cdp.send('Performance.getMetrics'),
  )
  const interactionTimings = definition.interactions
    ? await measureViewerInteractions(page)
    : {}

  const taskDurationSeconds = endMetrics.TaskDuration - startMetrics.TaskDuration
  const scriptDurationSeconds = endMetrics.ScriptDuration - startMetrics.ScriptDuration
  const result = {
    caseName,
    status: response?.status() ?? null,
    navigationMs,
    routeNavigationMs,
    measuredDurationMs,
    taskPercent: round((taskDurationSeconds * 100_000) / measuredDurationMs),
    scriptPercent: round((scriptDurationSeconds * 100_000) / measuredDurationMs),
    stylePercent: round(
      ((endMetrics.RecalcStyleDuration - startMetrics.RecalcStyleDuration) * 100_000) /
        measuredDurationMs,
    ),
    layoutPercent: round(
      ((endMetrics.LayoutDuration - startMetrics.LayoutDuration) * 100_000) /
        measuredDurationMs,
    ),
    heapStartMb: round(startMetrics.JSHeapUsedSize / 1_048_576),
    heapUsedMb: round(postGarbageCollectionMetrics.JSHeapUsedSize / 1_048_576),
    heapGrowthPercent: round(
      startMetrics.JSHeapUsedSize > 0
        ? ((postGarbageCollectionMetrics.JSHeapUsedSize - startMetrics.JSHeapUsedSize) * 100) /
            startMetrics.JSHeapUsedSize
        : 0,
    ),
    eventLoopP95Ms: round(percentile(eventLoopDelays, 0.95)),
    eventLoopMaxMs: round(Math.max(0, ...eventLoopDelays)),
    longTasksOver100Ms: browserState.longTasks.filter((task) => task.duration > 100).length,
    longestTaskMs: round(
      Math.max(0, ...browserState.longTasks.map((task) => task.duration)),
    ),
    interactionTimings,
    browserState,
    pageErrors,
    consoleErrors,
    httpErrors,
    requestFailures,
  }

  await context.close()
  return result
}

function getBudgetFailures(results, cpuThrottle, durationMs) {
  const mode = cpuThrottle > 1 ? 'throttled' : 'normal'
  const failures = []

  for (const result of results) {
    const budget = BUDGETS[result.caseName]?.[mode]
    if (budget && result.taskPercent > budget.taskPercent) {
      failures.push(
        `${result.caseName}: TaskDuration ${result.taskPercent}% exceeds ${budget.taskPercent}%`,
      )
    }
    if (budget && result.eventLoopP95Ms > budget.eventLoopP95Ms) {
      failures.push(
        `${result.caseName}: event-loop p95 ${result.eventLoopP95Ms}ms exceeds ${budget.eventLoopP95Ms}ms`,
      )
    }
    for (const [interaction, interactionDurationMs] of Object.entries(result.interactionTimings)) {
      if (budget && interactionDurationMs > budget.interactionMs) {
        failures.push(
          `${result.caseName}: ${interaction} ${interactionDurationMs}ms exceeds ${budget.interactionMs}ms`,
        )
      }
    }
    if (result.longTasksOver100Ms > 0) {
      failures.push(`${result.caseName}: ${result.longTasksOver100Ms} long tasks exceeded 100ms`)
    }
    if (result.pageErrors.length > 0 || result.consoleErrors.length > 0) {
      failures.push(`${result.caseName}: page or console errors were observed`)
    }
    if (result.httpErrors.length > 0 || (result.status !== null && result.status >= 400)) {
      failures.push(`${result.caseName}: HTTP errors were observed`)
    }
    const routeNavigationBudgetMs = cpuThrottle > 1 ? 2_500 : 1_000
    if (
      result.routeNavigationMs !== null &&
      result.routeNavigationMs > routeNavigationBudgetMs
    ) {
      failures.push(
        `${result.caseName}: route navigation ${result.routeNavigationMs}ms exceeds ${routeNavigationBudgetMs}ms`,
      )
    }
    if (result.browserState.scrollWidth > result.browserState.clientWidth + 1) {
      failures.push(`${result.caseName}: document overflow was observed`)
    }
    if (result.requestFailures.some((failure) => !failure.expectedPrefetchCancellation)) {
      failures.push(`${result.caseName}: unexpected request failures were observed`)
    }
    if (result.browserState.duplicateR2RequestCount > 0) {
      failures.push(`${result.caseName}: unchanged R2 resources were requested more than once`)
    }
    if (
      result.caseName === 'background-resume' &&
      result.browserState.backgroundLifecycleTransitions.join(',') !== 'active,frozen,active'
    ) {
      failures.push('background-resume: frozen/active lifecycle transition was not observed')
    }
    if (durationMs >= 60_000 && result.heapGrowthPercent > 20) {
      failures.push(
        `${result.caseName}: heap grew ${result.heapGrowthPercent}% during the soak (limit 20%)`,
      )
    }
  }

  const defaultResult = results.find((result) => result.caseName === 'default')
  const safeResult = results.find((result) => result.caseName === 'low-safe')
  if (
    defaultResult &&
    safeResult &&
    defaultResult.taskPercent > safeResult.taskPercent * 2
  ) {
    failures.push(
      `default: TaskDuration ${defaultResult.taskPercent}% exceeds twice the Low safe baseline ${safeResult.taskPercent}%`,
    )
  }

  return failures
}

function printResults(report) {
  console.log(
    `SkyLens viewer performance: ${report.browserLabel}; ${report.cpuThrottle}x CPU; ${report.baseUrl}`,
  )
  console.table(
    report.results.map((result) => ({
      case: result.caseName,
      status: result.status,
      navigationMs: result.navigationMs,
      routeNavigationMs: result.routeNavigationMs,
      taskPercent: result.taskPercent,
      scriptPercent: result.scriptPercent,
      eventLoopP95Ms: result.eventLoopP95Ms,
      longestTaskMs: result.longestTaskMs,
      interactionMaxMs: Math.max(0, ...Object.values(result.interactionTimings)),
      heapMb: result.heapUsedMb,
      heapGrowthPercent: result.heapGrowthPercent,
      r2Requests: result.browserState.r2RequestCount,
    })),
  )
  if (report.failures.length > 0) {
    console.error('Performance budget failures:')
    for (const failure of report.failures) {
      console.error(`- ${failure}`)
    }
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const { browser, browserLabel } = await launchBrowser(options.browser)
  const results = []

  try {
    for (const caseName of options.cases) {
      results.push(await runCase(browser, options, caseName))
    }
  } finally {
    await browser.close()
  }

  const failures = getBudgetFailures(results, options.cpuThrottle, options.durationMs)
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: options.baseUrl,
    browserLabel,
    cpuThrottle: options.cpuThrottle,
    durationMs: options.durationMs,
    results,
    failures,
  }

  printResults(report)
  if (options.output) {
    await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  }
  if (options.assert && failures.length > 0) {
    process.exitCode = 1
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main()
}
