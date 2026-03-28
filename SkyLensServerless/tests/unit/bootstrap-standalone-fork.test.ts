import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import nextConfig from '../../next.config'
import packageJson from '../../package.json'
import playwrightConfig from '../../playwright.config'
import { VIEWER_SETTINGS_STORAGE_KEY } from '../../lib/viewer/settings'

const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(TEST_DIR, '../..')
const RUNTIME_SOURCE_DIRS = ['app', 'components', 'lib'] as const
const IMPORT_PATTERNS = [
  /(?:import|export)\s+(?:[^'"]*?\sfrom\s*)?['"]([^'"]+)['"]/g,
  /import\(\s*['"]([^'"]+)['"]\s*\)/g,
] as const

describe('SkyLensServerless bootstrap contract', () => {
  it('uses fork-local package identity and scripts', () => {
    expect(packageJson.name).toBe('skylens-serverless')
    expect(packageJson.scripts).toMatchObject({
      dev: 'next dev',
      build: 'next build',
      start: 'node scripts/serve-export.mjs',
      test: 'vitest run',
      'test:e2e': 'playwright test',
    })
  })

  it('keeps the static export preview script repo-local', () => {
    const previewScript = readFileSync(resolve(PROJECT_ROOT, 'scripts/serve-export.mjs'), 'utf8')

    expect(previewScript).not.toContain(' as const')
    expect(previewScript).toContain("resolve(outDir, '_headers')")
  })

  it('keeps fork-local config isolated from the root app workspace', () => {
    expect(nextConfig.turbopack?.root).toBe(PROJECT_ROOT)
    expect(playwrightConfig.use?.baseURL).toBe('http://127.0.0.1:3100')
    expect(playwrightConfig.webServer).toMatchObject({
      command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
      url: 'http://127.0.0.1:3100',
    })
    expect(VIEWER_SETTINGS_STORAGE_KEY).toBe(
      'skylens-serverless.viewer-settings.v1',
    )
  })

  it('keeps runtime source imports inside the fork root', () => {
    const violations: string[] = []

    for (const directory of RUNTIME_SOURCE_DIRS) {
      for (const filePath of listSourceFiles(resolve(PROJECT_ROOT, directory))) {
        const source = readFileSync(filePath, 'utf8')

        if (source.includes('/workspace/SkyLens')) {
          violations.push(`${relativeFromProjectRoot(filePath)} contains an absolute repo path`)
        }

        for (const specifier of collectImportSpecifiers(source)) {
          if (!specifier.startsWith('.')) {
            continue
          }

          const resolvedImportPath = resolve(dirname(filePath), specifier)

          if (!isWithinProjectRoot(resolvedImportPath)) {
            violations.push(
              `${relativeFromProjectRoot(filePath)} resolves ${specifier} outside SkyLensServerless`,
            )
          }
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('removes fork-local app route handlers for config, tle, and health', () => {
    expect(listSourceFiles(resolve(PROJECT_ROOT, 'app'))).not.toEqual(
      expect.arrayContaining([
        resolve(PROJECT_ROOT, 'app/api/config/route.ts'),
        resolve(PROJECT_ROOT, 'app/api/health/route.ts'),
        resolve(PROJECT_ROOT, 'app/api/tle/route.ts'),
      ]),
    )
  })
})

function listSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true })

  return entries.flatMap((entry) => {
    const entryPath = resolve(directory, entry.name)

    if (entry.isDirectory()) {
      return listSourceFiles(entryPath)
    }

    if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) {
      return []
    }

    return [entryPath]
  })
}

function collectImportSpecifiers(source: string): string[] {
  const specifiers: string[] = []

  for (const pattern of IMPORT_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      specifiers.push(match[1])
    }
  }

  return specifiers
}

function isWithinProjectRoot(candidatePath: string) {
  return (
    candidatePath === PROJECT_ROOT ||
    candidatePath.startsWith(`${PROJECT_ROOT}${sep}`)
  )
}

function relativeFromProjectRoot(filePath: string) {
  return filePath.slice(PROJECT_ROOT.length + 1)
}
