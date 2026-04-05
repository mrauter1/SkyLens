import { promises as fs } from 'node:fs'
import path from 'node:path'

import {
  RUNTIME_FIELD_BOUNDS,
  SCOPE_CATALOG_EPOCH,
  SCOPE_CATALOG_VERSION,
  SCOPE_DATASET_BANDS,
  SCOPE_ROW_FORMAT,
  SCOPE_TILE_ROW_BYTES,
} from './constants.mjs'
import {
  BRIGHT_STAR_SOURCE_PATH,
  compareUtf16,
  normalizeName,
  PUBLIC_SCOPE_ROOT,
  readJsonFile,
} from './shared.mjs'

export function decodeTileRows(buffer) {
  if (buffer.byteLength % SCOPE_TILE_ROW_BYTES !== 0) {
    throw new Error('scope-tile-row-length-invalid')
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const rows = []

  for (let offset = 0; offset < buffer.byteLength; offset += SCOPE_TILE_ROW_BYTES) {
    rows.push({
      raMicroDeg: view.getUint32(offset, true),
      decMicroDeg: view.getInt32(offset + 4, true),
      pmRaMasPerYear: view.getInt16(offset + 8, true),
      pmDecMasPerYear: view.getInt16(offset + 10, true),
      vMagMilli: view.getInt16(offset + 12, true),
      bMinusVMilli: view.getInt16(offset + 14, true),
      nameId: view.getUint32(offset + 16, true),
    })
  }

  return rows
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function verifyManifest(manifest) {
  assert(manifest.version === SCOPE_CATALOG_VERSION, 'scope-manifest-version-invalid')
  assert(manifest.kind === 'dev' || manifest.kind === 'prod', 'scope-manifest-kind-invalid')
  assert(
    manifest.sourceCatalog === 'tycho2-main' ||
      manifest.sourceCatalog === 'dev-synthetic-from-stars-200',
    'scope-manifest-source-catalog-invalid',
  )
  assert(manifest.epoch === SCOPE_CATALOG_EPOCH, 'scope-manifest-epoch-invalid')
  assert(manifest.rowFormat === SCOPE_ROW_FORMAT, 'scope-manifest-row-format-invalid')
  assert(manifest.namesPath === 'names.json', 'scope-manifest-names-path-invalid')
  assert(Array.isArray(manifest.bands), 'scope-manifest-bands-invalid')
  assert(
    manifest.bands.length === SCOPE_DATASET_BANDS.length,
    'scope-manifest-band-count-invalid',
  )

  for (let index = 0; index < SCOPE_DATASET_BANDS.length; index += 1) {
    const expected = SCOPE_DATASET_BANDS[index]
    const band = manifest.bands[index]
    assert(band.bandDir === expected.bandDir, 'scope-manifest-band-order-invalid')
    assert(band.maxMagnitude === expected.maxMagnitude, 'scope-manifest-band-max-invalid')
    assert(band.raStepDeg === expected.raStepDeg, 'scope-manifest-band-ra-step-invalid')
    assert(band.decStepDeg === expected.decStepDeg, 'scope-manifest-band-dec-step-invalid')
    assert(
      band.indexPath === `${expected.bandDir}/index.json`,
      'scope-manifest-band-index-path-invalid',
    )
    assert(Number.isInteger(band.totalRows) && band.totalRows >= 0, 'scope-manifest-total-invalid')
    assert(Number.isInteger(band.namedRows) && band.namedRows >= 0, 'scope-manifest-named-invalid')
  }
}

function verifyNamesTable(namesTable) {
  assert(namesTable && typeof namesTable === 'object' && !Array.isArray(namesTable), 'scope-names-schema-invalid')

  const keys = Object.keys(namesTable)
  const numericKeys = keys.map((key) => {
    assert(/^[1-9]\d*$/.test(key), 'scope-names-key-invalid')
    return Number.parseInt(key, 10)
  })

  for (let index = 1; index < numericKeys.length; index += 1) {
    assert(numericKeys[index - 1] < numericKeys[index], 'scope-names-order-invalid')
  }

  for (const key of keys) {
    const value = namesTable[key]
    assert(typeof value === 'string', 'scope-names-value-invalid')
    assert(normalizeName(value) === value, 'scope-names-normalization-invalid')
  }
}

async function hasBrightStarSeedNames() {
  const stars = await readJsonFile(BRIGHT_STAR_SOURCE_PATH)
  return stars.some((star) => normalizeName(star.name))
}

function verifyBandIndexSchema(index, band) {
  assert(index.bandDir === band.bandDir, 'scope-band-index-dir-invalid')
  assert(index.maxMagnitude === band.maxMagnitude, 'scope-band-index-max-invalid')
  assert(index.raStepDeg === band.raStepDeg, 'scope-band-index-ra-step-invalid')
  assert(index.decStepDeg === band.decStepDeg, 'scope-band-index-dec-step-invalid')
  assert(Array.isArray(index.tiles), 'scope-band-index-tiles-invalid')
  for (let tileIndex = 1; tileIndex < index.tiles.length; tileIndex += 1) {
    const previous = index.tiles[tileIndex - 1]
    const current = index.tiles[tileIndex]
    const previousKey = `${String(previous.decIndex).padStart(8, '0')}:${String(previous.raIndex).padStart(8, '0')}`
    const currentKey = `${String(current.decIndex).padStart(8, '0')}:${String(current.raIndex).padStart(8, '0')}`
    assert(previousKey <= currentKey, 'scope-band-index-tile-order-invalid')
  }
}

export async function verifyScopeDataset({
  datasetRoot = PUBLIC_SCOPE_ROOT,
  kind = 'auto',
} = {}) {
  const manifestPath = path.join(datasetRoot, 'manifest.json')
  const manifest = await readJsonFile(manifestPath)
  verifyManifest(manifest)

  const resolvedKind = kind === 'auto' ? manifest.kind : kind
  assert(resolvedKind === 'dev' || resolvedKind === 'prod', 'scope-verify-kind-invalid')

  const namesTable = await readJsonFile(path.join(datasetRoot, manifest.namesPath))
  verifyNamesTable(namesTable)

  const referencedNameIds = new Set()
  const aggregateByBand = new Map()

  for (const band of SCOPE_DATASET_BANDS) {
    const bandDirPath = path.join(datasetRoot, band.bandDir)
    const indexPath = path.join(bandDirPath, 'index.json')
    const index = await readJsonFile(indexPath)
    verifyBandIndexSchema(index, band)

    const listedFiles = new Set()
    let actualTotalRows = 0
    let actualNamedRows = 0

    for (const tile of index.tiles) {
      assert(Number.isInteger(tile.raIndex) && tile.raIndex >= 0, 'scope-tile-ra-index-invalid')
      assert(Number.isInteger(tile.decIndex) && tile.decIndex >= 0, 'scope-tile-dec-index-invalid')
      assert(tile.file === `r${tile.raIndex}_d${tile.decIndex}.bin`, 'scope-tile-filename-invalid')
      assert(Number.isInteger(tile.count) && tile.count > 0, 'scope-tile-count-invalid')

      const tilePath = path.join(bandDirPath, tile.file)
      listedFiles.add(tile.file)
      const buffer = await fs.readFile(tilePath)
      assert(buffer.byteLength % SCOPE_TILE_ROW_BYTES === 0, 'scope-tile-byte-length-invalid')

      const rows = decodeTileRows(buffer)
      assert(rows.length === tile.count, 'scope-tile-count-mismatch')

      for (const row of rows) {
        assert(
          row.raMicroDeg >= RUNTIME_FIELD_BOUNDS.raMicroDeg.min &&
            row.raMicroDeg < RUNTIME_FIELD_BOUNDS.raMicroDeg.maxExclusive,
          'scope-row-ra-out-of-bounds',
        )
        assert(
          row.decMicroDeg >= RUNTIME_FIELD_BOUNDS.decMicroDeg.min &&
            row.decMicroDeg <= RUNTIME_FIELD_BOUNDS.decMicroDeg.max,
          'scope-row-dec-out-of-bounds',
        )
        assert(
          row.pmRaMasPerYear >= RUNTIME_FIELD_BOUNDS.pmMasPerYear.min &&
            row.pmRaMasPerYear <= RUNTIME_FIELD_BOUNDS.pmMasPerYear.max,
          'scope-row-pmra-out-of-bounds',
        )
        assert(
          row.pmDecMasPerYear >= RUNTIME_FIELD_BOUNDS.pmMasPerYear.min &&
            row.pmDecMasPerYear <= RUNTIME_FIELD_BOUNDS.pmMasPerYear.max,
          'scope-row-pmdec-out-of-bounds',
        )
        assert(
          row.vMagMilli >= RUNTIME_FIELD_BOUNDS.vMagMilli.min &&
            row.vMagMilli <= RUNTIME_FIELD_BOUNDS.vMagMilli.max,
          'scope-row-vmag-out-of-bounds',
        )
        assert(
          row.bMinusVMilli >= RUNTIME_FIELD_BOUNDS.bMinusVMilli.min &&
            row.bMinusVMilli <= RUNTIME_FIELD_BOUNDS.bMinusVMilli.max,
          'scope-row-bminusv-out-of-bounds',
        )
        assert(row.nameId >= 0, 'scope-row-name-id-invalid')
        if (row.nameId > 0) {
          assert(Object.hasOwn(namesTable, String(row.nameId)), 'scope-row-name-id-unresolved')
          referencedNameIds.add(row.nameId)
          actualNamedRows += 1
        }
      }

      actualTotalRows += rows.length
    }

    const actualFiles = new Set(
      (await fs.readdir(bandDirPath)).filter((entry) => entry.endsWith('.bin')),
    )

    for (const listedFile of listedFiles) {
      assert(actualFiles.has(listedFile), 'scope-band-index-file-missing')
    }
    for (const actualFile of actualFiles) {
      assert(listedFiles.has(actualFile), 'scope-band-extra-bin-file')
    }

    aggregateByBand.set(band.bandDir, {
      totalRows: actualTotalRows,
      namedRows: actualNamedRows,
      tiles: index.tiles.length,
    })
  }

  for (const band of manifest.bands) {
    const aggregate = aggregateByBand.get(band.bandDir)
    assert(aggregate, 'scope-band-aggregate-missing')
    assert(aggregate.totalRows === band.totalRows, 'scope-manifest-total-mismatch')
    assert(aggregate.namedRows === band.namedRows, 'scope-manifest-named-mismatch')
  }

  const orphanIds = Object.keys(namesTable)
    .map((key) => Number.parseInt(key, 10))
    .filter((id) => !referencedNameIds.has(id))

  assert(orphanIds.length === 0, 'scope-name-orphan-detected')

  if (resolvedKind === 'dev') {
    const mag6Band = aggregateByBand.get('mag6p5')
    const mag10Band = aggregateByBand.get('mag10p5')
    assert(Boolean(mag6Band && mag6Band.totalRows > 0), 'scope-dev-mag6p5-empty')
    assert(
      Boolean(mag6Band && mag10Band && mag10Band.totalRows > mag6Band.totalRows),
      'scope-dev-depth-invariant-invalid',
    )

    let hasNamedRow = referencedNameIds.size > 0
    for (const band of SCOPE_DATASET_BANDS) {
      const index = await readJsonFile(path.join(datasetRoot, band.bandDir, 'index.json'))
      for (const tile of index.tiles) {
        const rows = decodeTileRows(
          await fs.readFile(path.join(datasetRoot, band.bandDir, tile.file)),
        )
        for (const row of rows) {
          assert(row.pmRaMasPerYear === 0, 'scope-dev-pmra-nonzero')
          assert(row.pmDecMasPerYear === 0, 'scope-dev-pmdec-nonzero')
          assert(row.bMinusVMilli === 0, 'scope-dev-bminusv-nonzero')
          if (row.nameId > 0) {
            hasNamedRow = true
          }
        }
      }
    }

    if (await hasBrightStarSeedNames()) {
      assert(hasNamedRow, 'scope-dev-named-row-missing')
    }
  }

  return {
    manifest,
    namesTable,
    referencedNameIds: [...referencedNameIds].sort((left, right) => left - right),
    orderedNames: Object.values(namesTable).sort(compareUtf16),
    aggregateByBand,
  }
}
