import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildScopeDataset } from '../../lib/scope-data/build.mjs'
import { ScopeBuildReportSchema } from '../../lib/scope-data/contracts.mjs'
import {
  getScopeBuildReportPath,
  getScopeDatasetRoot,
  REPO_ROOT,
} from '../../lib/scope-data/paths.mjs'
import { verifyScopeDataset } from '../../lib/scope-data/verify.mjs'

async function readTree(root: string, relativeDir = '.') {
  const entries = await readdir(path.join(root, relativeDir), { withFileTypes: true })
  const files = new Map<string, Buffer>()

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = path.join(relativeDir, entry.name)

    if (entry.isDirectory()) {
      for (const [childPath, contents] of await readTree(root, relativePath)) {
        files.set(childPath, contents)
      }
      continue
    }

    files.set(relativePath, await readFile(path.join(root, relativePath)))
  }

  return files
}

describe('scope-data build integration', () => {
  it('builds the dev dataset offline and reproduces identical bytes on repeat builds', async () => {
    const firstBuild = await buildScopeDataset({ mode: 'dev' })
    const datasetRoot = getScopeDatasetRoot(REPO_ROOT)
    const reportPath = getScopeBuildReportPath(REPO_ROOT)
    const firstFiles = await readTree(datasetRoot)
    const firstReportBytes = await readFile(reportPath)
    const firstReport = ScopeBuildReportSchema.parse(
      JSON.parse(firstReportBytes.toString('utf8'))
    )
    const verified = await verifyScopeDataset({
      datasetRoot,
      kind: 'dev',
    })

    const secondBuild = await buildScopeDataset({ mode: 'dev' })
    const secondFiles = await readTree(datasetRoot)
    const secondReportBytes = await readFile(reportPath)
    const secondReport = ScopeBuildReportSchema.parse(
      JSON.parse(secondReportBytes.toString('utf8'))
    )

    expect(firstBuild.kind).toBe('dev')
    expect(secondBuild.kind).toBe('dev')
    expect(verified.bands.every((band) => band.totalRows > 0)).toBe(true)
    expect(verified.referencedNameCount).toBeGreaterThan(0)
    expect(firstReport.mode).toBe('dev')
    expect(firstReport.sourceCatalog).toBe('dev-synthetic-from-stars-200')
    expect(firstReport.bands.every((band) => band.totalRows > 0)).toBe(true)
    expect([...firstFiles.keys()]).toEqual([...secondFiles.keys()])
    expect(secondReportBytes.equals(firstReportBytes)).toBe(true)
    expect(secondReport).toEqual(firstReport)

    for (const [relativePath, firstContents] of firstFiles) {
      expect(secondFiles.get(relativePath)?.equals(firstContents)).toBe(true)
    }
  })

  it('falls back to the deterministic dev dataset when prod mode has no expanded Tycho-2 cache', async () => {
    const result = await buildScopeDataset({ mode: 'prod' })
    const datasetRoot = getScopeDatasetRoot(REPO_ROOT)
    const verified = await verifyScopeDataset({
      datasetRoot,
      kind: 'dev',
    })

    expect(result.kind).toBe('dev')
    expect(result.usedFallbackBecauseSourceMissing).toBe(true)
    expect(result.manifest.kind).toBe('dev')
    expect(result.manifest.sourceCatalog).toBe('dev-synthetic-from-stars-200')
    expect(verified.referencedNameCount).toBeGreaterThan(0)
    expect(verified.bands.find((band) => band.bandDir === 'mag10p5')?.totalRows).toBeGreaterThan(
      verified.bands.find((band) => band.bandDir === 'mag6p5')?.totalRows ?? 0
    )
  })
})
