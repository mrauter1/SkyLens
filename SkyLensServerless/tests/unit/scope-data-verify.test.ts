import { promises as fs } from 'node:fs'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildScopeDataset } from '../../scripts/scope/build-core.mjs'
import { verifyScopeDataset } from '../../scripts/scope/verify-core.mjs'

describe('scope data verify', () => {
  const cacheRoot = path.join(process.cwd(), '.cache', 'scope-test-verify')
  const datasetRoot = path.join(cacheRoot, 'dataset')
  const stagingRoot = path.join(cacheRoot, 'staging')
  const reportPath = path.join(cacheRoot, 'report.json')

  beforeAll(async () => {
    await fs.rm(cacheRoot, { recursive: true, force: true })
    await buildScopeDataset({
      mode: 'dev',
      datasetRoot,
      stagingRoot,
      reportPath,
    })
  })

  afterAll(async () => {
    await fs.rm(cacheRoot, { recursive: true, force: true })
  })

  it('accepts a valid dev dataset', async () => {
    const result = await verifyScopeDataset({
      datasetRoot,
      kind: 'dev',
    })

    expect(result.manifest.kind).toBe('dev')
  })

  it('fails when a referenced name id cannot be resolved', async () => {
    const index = JSON.parse(
      await fs.readFile(path.join(datasetRoot, 'mag10p5', 'index.json'), 'utf8'),
    )
    const tilePath = path.join(datasetRoot, 'mag10p5', index.tiles[0].file)
    const buffer = await fs.readFile(tilePath)
    buffer.writeUInt32LE(999999, 16)
    await fs.writeFile(tilePath, buffer)

    await expect(
      verifyScopeDataset({
        datasetRoot,
        kind: 'dev',
      }),
    ).rejects.toThrow('scope-row-name-id-unresolved')
  })

  it('fails when names.json contains an orphaned emitted name entry', async () => {
    await buildScopeDataset({
      mode: 'dev',
      datasetRoot,
      stagingRoot,
      reportPath,
    })

    const namesPath = path.join(datasetRoot, 'names.json')
    const names = JSON.parse(await fs.readFile(namesPath, 'utf8'))
    names['999999'] = 'Orphan Scope Name'
    await fs.writeFile(namesPath, `${JSON.stringify(names, null, 2)}\n`, 'utf8')

    await expect(
      verifyScopeDataset({
        datasetRoot,
        kind: 'dev',
      }),
    ).rejects.toThrow('scope-name-orphan-detected')
  })
})
