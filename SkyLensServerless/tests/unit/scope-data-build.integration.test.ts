import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildScopeDataset } from '../../scripts/scope/build-core.mjs'
import {
  DEV_FALLBACK_SEED_COUNT,
  DEV_FALLBACK_TILE_FILE_CAP,
} from '../../scripts/scope/constants.mjs'

async function hashTree(root: string) {
  const hash = createHash('sha256')

  async function walk(currentPath: string) {
    const entries = (await fs.readdir(currentPath, { withFileTypes: true })).sort((left, right) =>
      left.name.localeCompare(right.name),
    )
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name)
      hash.update(entry.name)
      if (entry.isDirectory()) {
        await walk(entryPath)
        continue
      }
      hash.update(await fs.readFile(entryPath))
    }
  }

  await walk(root)
  return hash.digest('hex')
}

describe('scope data build integration', () => {
  it('builds the committed dev dataset deterministically', async () => {
    const datasetRoot = path.join(process.cwd(), 'public', 'data', 'scope', 'v1')
    const cacheRoot = path.join(process.cwd(), '.cache', 'scope-test-build')
    const stagingRoot = path.join(cacheRoot, 'staging')
    const reportPath = path.join(cacheRoot, 'report.json')

    await fs.rm(cacheRoot, { recursive: true, force: true })

    await buildScopeDataset({
      mode: 'dev',
      datasetRoot,
      stagingRoot,
      reportPath,
    })
    const firstHash = await hashTree(datasetRoot)

    await buildScopeDataset({
      mode: 'dev',
      datasetRoot,
      stagingRoot,
      reportPath,
    })
    const secondHash = await hashTree(datasetRoot)

    expect(firstHash).toBe(secondHash)

    const manifest = JSON.parse(await fs.readFile(path.join(datasetRoot, 'manifest.json'), 'utf8'))
    const binFileCount = await countBinFiles(datasetRoot)
    expect(manifest.kind).toBe('dev')
    expect(manifest.bands.map((band: { totalRows: number }) => band.totalRows)).toEqual([
      DEV_FALLBACK_SEED_COUNT,
      DEV_FALLBACK_SEED_COUNT * 2,
      DEV_FALLBACK_SEED_COUNT * 4,
      DEV_FALLBACK_SEED_COUNT * 6,
    ])
    expect(binFileCount).toBeLessThanOrEqual(DEV_FALLBACK_TILE_FILE_CAP)

    await fs.rm(cacheRoot, { recursive: true, force: true })
  })
})

async function countBinFiles(root: string) {
  let total = 0

  async function walk(currentPath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true })

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name)

      if (entry.isDirectory()) {
        await walk(entryPath)
        continue
      }

      if (entry.name.endsWith('.bin')) {
        total += 1
      }
    }
  }

  await walk(root)
  return total
}
