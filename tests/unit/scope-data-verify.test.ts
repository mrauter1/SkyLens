import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  SCOPE_BAND_DEFINITIONS,
  SCOPE_ROW_SIZE_BYTES,
} from '../../lib/scope-data/contracts.mjs'
import {
  createScopeBandIndex,
  createScopeCatalogManifest,
  createScopeManifestBand,
  serializeDeterministicJson,
} from '../../lib/scope-data/json.mjs'
import { encodeScopeStarRow } from '../../lib/scope-data/tiles.mjs'
import { verifyScopeDataset } from '../../lib/scope-data/verify.mjs'

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function createDatasetRoot(prefix: string) {
  const datasetRoot = await mkdtemp(path.join(os.tmpdir(), prefix))
  tempRoots.push(datasetRoot)

  await Promise.all(
    SCOPE_BAND_DEFINITIONS.map((band) =>
      mkdir(path.join(datasetRoot, band.bandDir), { recursive: true })
    )
  )

  return datasetRoot
}

async function writeValidDataset(datasetRoot: string) {
  const shallowRow = encodeScopeStarRow({
    raDeg: 101.3672,
    decDeg: -16.6861,
    pmRaMasPerYear: 0,
    pmDecMasPerYear: 0,
    vMag: 6.4,
    bMinusV: 0,
    nameId: 0,
  })
  const deepNamedRow = encodeScopeStarRow({
    raDeg: 101.1572,
    decDeg: -16.7061,
    pmRaMasPerYear: 0,
    pmDecMasPerYear: 0,
    vMag: 10.5,
    bMinusV: 0,
    nameId: 1,
  })
  const manifestBands = []

  for (const band of SCOPE_BAND_DEFINITIONS) {
    const bandRoot = path.join(datasetRoot, band.bandDir)
    const rows = band.bandDir === 'mag6p5' ? [shallowRow] : [shallowRow, deepNamedRow]
    const file = 'r0_d0.bin'

    await writeFile(path.join(bandRoot, file), Buffer.concat(rows))
    await writeFile(
      path.join(bandRoot, 'index.json'),
      serializeDeterministicJson(
        createScopeBandIndex({
          ...band,
          tiles: [{ raIndex: 0, decIndex: 0, file, count: rows.length }],
        })
      )
    )

    manifestBands.push(
      createScopeManifestBand({
        ...band,
        totalRows: rows.length,
        namedRows: rows.filter((row) => row.readUInt32LE(16) > 0).length,
      })
    )
  }

  await writeFile(
    path.join(datasetRoot, 'manifest.json'),
    serializeDeterministicJson(
      createScopeCatalogManifest({
        kind: 'dev',
        sourceCatalog: 'dev-synthetic-from-stars-200',
        bands: manifestBands,
      })
    )
  )
  await writeFile(
    path.join(datasetRoot, 'names.json'),
    serializeDeterministicJson({ '1': 'Sirius' })
  )
}

async function readJson(filePath: string) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

describe('scope-data verify', () => {
  it('verifies a valid dev dataset and reports aggregate counts', async () => {
    const datasetRoot = await createDatasetRoot('scope-verify-valid-')
    await writeValidDataset(datasetRoot)

    const result = await verifyScopeDataset({
      datasetRoot,
      kind: 'dev',
    })

    expect(result.kind).toBe('dev')
    expect(result.namesCount).toBe(1)
    expect(result.bands.find((band) => band.bandDir === 'mag6p5')?.totalRows).toBe(1)
    expect(result.bands.find((band) => band.bandDir === 'mag10p5')?.totalRows).toBe(2)
  })

  it('fails when a tile references an unknown nameId', async () => {
    const datasetRoot = await createDatasetRoot('scope-verify-nameid-')
    await writeValidDataset(datasetRoot)

    await writeFile(
      path.join(datasetRoot, 'mag10p5', 'r0_d0.bin'),
      Buffer.concat([
        encodeScopeStarRow({
          raDeg: 101.3672,
          decDeg: -16.6861,
          pmRaMasPerYear: 0,
          pmDecMasPerYear: 0,
          vMag: 6.4,
          bMinusV: 0,
          nameId: 0,
        }),
        encodeScopeStarRow({
          raDeg: 0,
          decDeg: 0,
          pmRaMasPerYear: 0,
          pmDecMasPerYear: 0,
          vMag: 10.5,
          bMinusV: 0,
          nameId: 2,
        }),
      ])
    )

    await expect(
      verifyScopeDataset({
        datasetRoot,
        kind: 'dev',
      })
    ).rejects.toThrow(/unknown nameId 2/)
  })

  it('fails when the manifest is invalid or band counts do not reconcile', async () => {
    const datasetRoot = await createDatasetRoot('scope-verify-manifest-')
    await writeValidDataset(datasetRoot)

    const manifestPath = path.join(datasetRoot, 'manifest.json')
    const manifest = await readJson(manifestPath)
    manifest.rowFormat = 'scope-star-v1-le'

    await writeFile(manifestPath, serializeDeterministicJson(manifest))
    await expect(
      verifyScopeDataset({
        datasetRoot,
        kind: 'dev',
      })
    ).rejects.toThrow(/rowFormat/)

    manifest.rowFormat = 'scope-star-v2-le'
    manifest.bands[3].totalRows = 999
    await writeFile(manifestPath, serializeDeterministicJson(manifest))

    await expect(
      verifyScopeDataset({
        datasetRoot,
        kind: 'dev',
      })
    ).rejects.toThrow(/manifest totalRows mismatch for mag10p5/)
  })

  it('fails when names.json is not already normalized and ordered', async () => {
    const datasetRoot = await createDatasetRoot('scope-verify-names-')
    await writeValidDataset(datasetRoot)

    await writeFile(
      path.join(datasetRoot, 'names.json'),
      '{\n  "2": "Sirius",\n  "1": "  Rigel  "\n}\n'
    )

    await expect(
      verifyScopeDataset({
        datasetRoot,
        kind: 'dev',
      })
    ).rejects.toThrow(/ascending numeric order|already be normalized/)
  })

  it('fails when names.json contains an orphan entry or an invalid tile length', async () => {
    const datasetRoot = await createDatasetRoot('scope-verify-orphan-')
    await writeValidDataset(datasetRoot)

    await writeFile(
      path.join(datasetRoot, 'names.json'),
      serializeDeterministicJson({ '1': 'Sirius', '2': 'Canopus' })
    )
    await expect(
      verifyScopeDataset({
        datasetRoot,
        kind: 'dev',
      })
    ).rejects.toThrow(/orphan ids: 2/)

    await writeFile(
      path.join(datasetRoot, 'names.json'),
      serializeDeterministicJson({ '1': 'Sirius' })
    )
    await writeFile(
      path.join(datasetRoot, 'mag10p5', 'r0_d0.bin'),
      Buffer.alloc(SCOPE_ROW_SIZE_BYTES + 1)
    )

    await expect(
      verifyScopeDataset({
        datasetRoot,
        kind: 'dev',
      })
    ).rejects.toThrow(/divisible by 20/)
  })

  it('fails when tile counts or dev invariants are broken', async () => {
    const datasetRoot = await createDatasetRoot('scope-verify-dev-')
    await writeValidDataset(datasetRoot)

    const indexPath = path.join(datasetRoot, 'mag10p5', 'index.json')
    const index = await readJson(indexPath)
    index.tiles[0].count = 1
    await writeFile(indexPath, serializeDeterministicJson(index))

    await expect(
      verifyScopeDataset({
        datasetRoot,
        kind: 'dev',
      })
    ).rejects.toThrow(/expected 1 rows but decoded 2/)

    index.tiles[0].count = 2
    await writeFile(indexPath, serializeDeterministicJson(index))
    await writeFile(
      path.join(datasetRoot, 'mag10p5', 'r0_d0.bin'),
      Buffer.concat([
        encodeScopeStarRow({
          raDeg: 101.3672,
          decDeg: -16.6861,
          pmRaMasPerYear: 0,
          pmDecMasPerYear: 0,
          vMag: 6.4,
          bMinusV: 0,
          nameId: 0,
        }),
        encodeScopeStarRow({
          raDeg: 101.1572,
          decDeg: -16.7061,
          pmRaMasPerYear: 1,
          pmDecMasPerYear: 0,
          vMag: 10.5,
          bMinusV: 0,
          nameId: 1,
        }),
      ])
    )

    await expect(
      verifyScopeDataset({
        datasetRoot,
        kind: 'dev',
      })
    ).rejects.toThrow(/pmRaMasPerYear must be zero/)
  })
})
