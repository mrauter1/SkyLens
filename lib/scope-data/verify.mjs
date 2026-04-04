import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import {
  SCOPE_BAND_DEFINITIONS,
  SCOPE_INDEX_FILENAME,
  SCOPE_MANIFEST_FILENAME,
  SCOPE_NAMES_FILENAME,
  SCOPE_ROW_SIZE_BYTES,
  ScopeBandIndexSchema,
  ScopeCatalogManifestSchema,
  ScopeNameTableSchema,
} from './contracts.mjs'
import { normalizeScopeDisplayName } from './names.mjs'
import {
  getBrightStarsCatalogPath,
  REPO_ROOT,
} from './paths.mjs'
import { decodeScopeStarTile } from './tiles.mjs'

function readJsonFile(filePath, schema) {
  return readFile(filePath, 'utf8').then((text) => schema.parse(JSON.parse(text)))
}

function extractJsonObjectKeys(rawText) {
  const keys = []
  const matcher = /"(\d+)":/g

  for (const match of rawText.matchAll(matcher)) {
    keys.push(match[1])
  }

  return keys
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function readNamesTable(datasetRoot) {
  const namesPath = path.join(datasetRoot, SCOPE_NAMES_FILENAME)
  const rawText = await readFile(namesPath, 'utf8')
  const names = ScopeNameTableSchema.parse(JSON.parse(rawText))
  const orderedKeys = extractJsonObjectKeys(rawText)
  const parsedKeys = Object.keys(names)

  assert(
    orderedKeys.length === parsedKeys.length,
    'names.json keys could not be reconciled from the raw file'
  )

  for (let index = 0; index < orderedKeys.length; index += 1) {
    assert(
      orderedKeys[index] === parsedKeys[index],
      'names.json keys must be serialized in ascending numeric order'
    )
  }

  for (const [key, value] of Object.entries(names)) {
    assert(key !== '0', 'names.json must not contain key "0"')
    assert(
      normalizeScopeDisplayName(value) === value,
      `names.json value for key ${key} must already be normalized`
    )
  }

  return names
}

async function getSeedHasAnyName() {
  const seedStars = JSON.parse(await readFile(getBrightStarsCatalogPath(REPO_ROOT), 'utf8'))

  return seedStars.some((star) => Boolean(normalizeScopeDisplayName(star?.name)))
}

export async function verifyScopeDataset({
  datasetRoot,
  kind = 'auto',
}) {
  const manifestPath = path.join(datasetRoot, SCOPE_MANIFEST_FILENAME)
  const manifest = await readJsonFile(manifestPath, ScopeCatalogManifestSchema)
  const effectiveKind = kind === 'auto' ? manifest.kind : kind

  assert(
    manifest.rowFormat === 'scope-star-v2-le',
    'manifest rowFormat must be scope-star-v2-le'
  )
  assert(
    manifest.namesPath === SCOPE_NAMES_FILENAME,
    `manifest namesPath must be ${SCOPE_NAMES_FILENAME}`
  )

  const names = await readNamesTable(datasetRoot)
  const nameIdsReferenced = new Set()
  const bands = []

  for (const bandDefinition of SCOPE_BAND_DEFINITIONS) {
    const bandDirPath = path.join(datasetRoot, bandDefinition.bandDir)
    const indexPath = path.join(bandDirPath, SCOPE_INDEX_FILENAME)

    await stat(bandDirPath)
    const index = await readJsonFile(indexPath, ScopeBandIndexSchema)
    const expectedManifestBand = manifest.bands.find(
      (band) => band.bandDir === bandDefinition.bandDir
    )

    assert(
      expectedManifestBand,
      `manifest is missing band entry for ${bandDefinition.bandDir}`
    )

    const actualTileFiles = (await readdir(bandDirPath))
      .filter((fileName) => fileName.endsWith('.bin'))
      .sort()
    const indexedTileFiles = index.tiles.map((tile) => tile.file).sort()

    assert(
      JSON.stringify(actualTileFiles) === JSON.stringify(indexedTileFiles),
      `band ${bandDefinition.bandDir} has tile files that do not match index.json`
    )

    let totalRows = 0
    let namedRows = 0

    for (const tile of index.tiles) {
      const tilePath = path.join(bandDirPath, tile.file)
      const tileBuffer = await readFile(tilePath)

      assert(
        tileBuffer.length % SCOPE_ROW_SIZE_BYTES === 0,
        `tile ${index.bandDir}/${tile.file} length must be divisible by ${SCOPE_ROW_SIZE_BYTES}`
      )

      const rows = decodeScopeStarTile(tileBuffer)

      assert(
        rows.length === tile.count,
        `tile ${index.bandDir}/${tile.file} expected ${tile.count} rows but decoded ${rows.length}`
      )

      for (const row of rows) {
        assert(Number.isFinite(row.raDeg), 'tile row raDeg must be finite')
        assert(Number.isFinite(row.decDeg), 'tile row decDeg must be finite')
        assert(Number.isFinite(row.vMag), 'tile row vMag must be finite')
        assert(Number.isFinite(row.bMinusV), 'tile row bMinusV must be finite')
        assert(row.raDeg >= 0 && row.raDeg < 360, 'tile row raDeg out of bounds')
        assert(row.decDeg >= -90 && row.decDeg <= 90, 'tile row decDeg out of bounds')
        assert(
          row.bMinusV >= -1 && row.bMinusV <= 4,
          'tile row bMinusV out of bounds'
        )
        assert(row.vMag >= 0 && row.vMag <= 10.5, 'tile row vMag out of bounds')
        assert(row.nameId >= 0, 'tile row nameId must be >= 0')

        if (row.nameId > 0) {
          assert(
            Object.prototype.hasOwnProperty.call(names, String(row.nameId)),
            `tile row references unknown nameId ${row.nameId}`
          )
          namedRows += 1
          nameIdsReferenced.add(String(row.nameId))
        }

        if (effectiveKind === 'dev') {
          assert(row.pmRaMasPerYear === 0, 'dev dataset pmRaMasPerYear must be zero')
          assert(row.pmDecMasPerYear === 0, 'dev dataset pmDecMasPerYear must be zero')
          assert(row.bMinusV === 0, 'dev dataset bMinusV must be zero')
        }
      }

      totalRows += rows.length
    }

    assert(
      expectedManifestBand.totalRows === totalRows,
      `manifest totalRows mismatch for ${bandDefinition.bandDir}`
    )
    assert(
      expectedManifestBand.namedRows === namedRows,
      `manifest namedRows mismatch for ${bandDefinition.bandDir}`
    )

    bands.push({
      bandDir: bandDefinition.bandDir,
      totalRows,
      namedRows,
      tiles: index.tiles.length,
    })
  }

  const orphanNames = Object.keys(names).filter((key) => !nameIdsReferenced.has(key))
  assert(orphanNames.length === 0, `names.json contains orphan ids: ${orphanNames.join(', ')}`)

  if (effectiveKind === 'dev') {
    const hasAnySeedName = await getSeedHasAnyName()
    const mag6p5 = bands.find((band) => band.bandDir === 'mag6p5')
    const mag10p5 = bands.find((band) => band.bandDir === 'mag10p5')

    assert(mag6p5 && mag6p5.totalRows > 0, 'dev dataset must emit at least one mag6p5 row')
    assert(
      mag10p5 && mag10p5.totalRows > mag6p5.totalRows,
      'dev dataset mag10p5 totalRows must exceed mag6p5 totalRows'
    )

    if (hasAnySeedName) {
      assert(
        nameIdsReferenced.size > 0,
        'dev dataset must emit at least one named row when stars_200.json contains names'
      )
    }
  }

  return {
    datasetRoot: path.resolve(datasetRoot),
    kind: effectiveKind,
    manifest,
    namesCount: Object.keys(names).length,
    referencedNameCount: nameIdsReferenced.size,
    bands,
  }
}
