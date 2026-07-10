import { describe, expect, it, vi } from 'vitest'

// @ts-expect-error Runtime-tested script module has no TypeScript declaration file.
import { ensureLocalScopeDataset } from '../../scripts/ensure-scope-dataset.mjs'

describe('scope dataset preflight', () => {
  it('preserves any complete local dataset without rebuilding it', async () => {
    const manifest = { kind: 'prod' }
    const verifyDataset = vi.fn().mockResolvedValue({ manifest })
    const buildDataset = vi.fn()

    await expect(
      ensureLocalScopeDataset({
        datasetRoot: '/tmp/scope-data',
        verifyDataset,
        buildDataset,
      }),
    ).resolves.toEqual({
      action: 'verified',
      datasetRoot: '/tmp/scope-data',
      manifest,
    })
    expect(verifyDataset).toHaveBeenCalledWith({
      datasetRoot: '/tmp/scope-data',
      kind: 'auto',
    })
    expect(buildDataset).not.toHaveBeenCalled()
  })

  it('generates the deterministic development fallback when local tiles are incomplete', async () => {
    const manifest = { kind: 'dev' }
    const verifyDataset = vi.fn().mockRejectedValue(new Error('scope-tile-missing'))
    const buildDataset = vi.fn().mockResolvedValue({ manifest })

    await expect(
      ensureLocalScopeDataset({
        datasetRoot: '/tmp/scope-data',
        verifyDataset,
        buildDataset,
      }),
    ).resolves.toEqual({
      action: 'generated',
      datasetRoot: '/tmp/scope-data',
      manifest,
    })
    expect(buildDataset).toHaveBeenCalledWith({
      mode: 'dev',
      datasetRoot: '/tmp/scope-data',
      mirrorDatasetRoots: [],
    })
  })
})
