import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'

import {
  SCOPE_BAND_DEFINITIONS,
  SCOPE_MANIFEST_FILENAME,
  SCOPE_MAX_MAGNITUDE,
  SCOPE_REQUIRED_TYCHO2_FILES,
} from './contracts.mjs'
import { buildDevSyntheticRows } from './dev-fallback.mjs'
import {
  createScopeBandIndex,
  createScopeBuildReport,
  createScopeCatalogManifest,
  createScopeManifestBand,
  serializeDeterministicJson,
} from './json.mjs'
import {
  buildBrightStarHipNameMap,
  buildHygProperNameMap,
  buildScopeNameTable,
  parseHygProperNamesCsv,
  parseScopeNameOverridesCsv,
  resolveScopeDisplayName,
} from './names.mjs'
import {
  getBrightStarsCatalogPath,
  getHygProperNamesPath,
  getScopeBuildReportPath,
  getScopeBuildStagingRoot,
  getScopeDatasetRoot,
  getScopeNameOverridesPath,
  getTycho2ExpandedRoot,
  getTycho2RawRoot,
  REPO_ROOT,
} from './paths.mjs'
import {
  compareNormalizedScopeStars,
  encodeScopeStarRow,
  getBandsForMagnitude,
  getTileFileName,
  getTileIndices,
} from './tiles.mjs'
import { parseTycho2ExpandedCatalog } from './tycho2.mjs'
import { verifyScopeDataset } from './verify.mjs'

async function pathExists(targetPath) {
  try {
    await stat(targetPath)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false
    }

    throw error
  }
}

async function readJsonArray(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

async function loadNameOverrides() {
  const overridePath = getScopeNameOverridesPath(REPO_ROOT)

  if (!(await pathExists(overridePath))) {
    return []
  }

  return parseScopeNameOverridesCsv(await readFile(overridePath, 'utf8'))
}

async function loadHygProperNameMap() {
  const hygPath = getHygProperNamesPath(REPO_ROOT)

  if (!(await pathExists(hygPath))) {
    return new Map()
  }

  const rows = parseHygProperNamesCsv(await readFile(hygPath, 'utf8'))
  return buildHygProperNameMap(rows)
}

async function countPresentRawFiles() {
  const rawRoot = getTycho2RawRoot(REPO_ROOT)

  if (!(await pathExists(rawRoot))) {
    return 0
  }

  const entries = await readdir(rawRoot)
  return SCOPE_REQUIRED_TYCHO2_FILES.filter((fileName) => entries.includes(fileName)).length
}

async function getBuildInput(mode) {
  const brightStars = await readJsonArray(getBrightStarsCatalogPath(REPO_ROOT))
  const brightStarHipNameMap = buildBrightStarHipNameMap(brightStars)
  const hygProperNameMap = await loadHygProperNameMap()
  const nameOverrides = await loadNameOverrides()
  const presentRawFiles = await countPresentRawFiles()

  if (mode === 'dev') {
    return {
      kind: 'dev',
      sourceCatalog: 'dev-synthetic-from-stars-200',
      rows: buildDevSyntheticRows(brightStars),
      droppedRows: {
        invalidLength: 0,
        missingRa: 0,
        missingDec: 0,
        missingPhotometry: 0,
        invalidDerivedPhotometry: 0,
        pflagX: 0,
        tooFaint: 0,
      },
      rawFiles: {
        required: SCOPE_REQUIRED_TYCHO2_FILES.length,
        present: presentRawFiles,
      },
      brightStarHipNameMap,
      hygProperNameMap,
      nameOverrides,
    }
  }

  const expandedRoot = getTycho2ExpandedRoot(REPO_ROOT)

  if (!(await pathExists(expandedRoot))) {
    return {
      kind: 'dev',
      sourceCatalog: 'dev-synthetic-from-stars-200',
      rows: buildDevSyntheticRows(brightStars),
      droppedRows: {
        invalidLength: 0,
        missingRa: 0,
        missingDec: 0,
        missingPhotometry: 0,
        invalidDerivedPhotometry: 0,
        pflagX: 0,
        tooFaint: 0,
      },
      rawFiles: {
        required: SCOPE_REQUIRED_TYCHO2_FILES.length,
        present: presentRawFiles,
      },
      brightStarHipNameMap,
      hygProperNameMap,
      nameOverrides,
      usedFallbackBecauseSourceMissing: true,
    }
  }

  let parsedCatalog

  try {
    parsedCatalog = await parseTycho2ExpandedCatalog(expandedRoot)
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('Production build requires expanded Tycho-2 files:')
    ) {
      return {
        kind: 'dev',
        sourceCatalog: 'dev-synthetic-from-stars-200',
        rows: buildDevSyntheticRows(brightStars),
        droppedRows: {
          invalidLength: 0,
          missingRa: 0,
          missingDec: 0,
          missingPhotometry: 0,
          invalidDerivedPhotometry: 0,
          pflagX: 0,
          tooFaint: 0,
        },
        rawFiles: {
          required: SCOPE_REQUIRED_TYCHO2_FILES.length,
          present: presentRawFiles,
        },
        brightStarHipNameMap,
        hygProperNameMap,
        nameOverrides,
        usedFallbackBecauseSourceMissing: true,
      }
    }

    throw error
  }

  return {
    kind: 'prod',
    sourceCatalog: 'tycho2-main',
    rows: parsedCatalog.rows,
    droppedRows: parsedCatalog.droppedRows,
    rawFiles: {
      required: SCOPE_REQUIRED_TYCHO2_FILES.length,
      present: presentRawFiles,
    },
    brightStarHipNameMap,
    hygProperNameMap,
    nameOverrides,
  }
}

function createBandBuckets() {
  return new Map(
    SCOPE_BAND_DEFINITIONS.map((band) => [
      band.bandDir,
      {
        definition: band,
        tiles: new Map(),
      },
    ])
  )
}

function addRowToBandTile(bandState, row) {
  const tileIndices = getTileIndices(row, bandState.definition)
  const tileFile = getTileFileName(tileIndices.raIndex, tileIndices.decIndex)
  const tileKey = `${tileIndices.raIndex}:${tileIndices.decIndex}`

  if (!bandState.tiles.has(tileKey)) {
    bandState.tiles.set(tileKey, {
      ...tileIndices,
      file: tileFile,
      rows: [],
    })
  }

  bandState.tiles.get(tileKey).rows.push(row)
}

function buildEmittedRows(baseRows) {
  const { nameTable, nameIdByValue } = buildScopeNameTable(
    baseRows.map((row) => row.displayName)
  )
  const emittedRows = baseRows.map((row) => ({
    ...row,
    nameId: row.displayName ? nameIdByValue.get(row.displayName) ?? 0 : 0,
  }))

  return {
    emittedRows,
    nameTable,
    uniqueNameCount: Object.keys(nameTable).length,
  }
}

function applyResolvedNames(rows, brightStarHipNameMap, hygProperNameMap, nameOverrides) {
  return rows.map((row) => ({
    ...row,
    displayName: resolveScopeDisplayName({
      row,
      brightStarHipNameMap,
      hygProperNameMap,
      nameOverrides,
    }) ?? row.displayName,
  }))
}

async function writeStageOutput({ stageRoot, emittedRows, kind, sourceCatalog }) {
  await rm(stageRoot, { recursive: true, force: true })
  await mkdir(stageRoot, { recursive: true })

  const {
    emittedRows: rowsWithNames,
    nameTable,
    uniqueNameCount,
  } = buildEmittedRows(emittedRows)
  const bandStates = createBandBuckets()

  for (const row of rowsWithNames) {
    if (!Number.isFinite(row.vMag) || row.vMag > SCOPE_MAX_MAGNITUDE) {
      continue
    }

    for (const band of getBandsForMagnitude(row.vMag)) {
      addRowToBandTile(bandStates.get(band.bandDir), row)
    }
  }

  const manifestBands = []
  const reportBands = []

  await writeFile(
    path.join(stageRoot, 'names.json'),
    serializeDeterministicJson(nameTable)
  )

  for (const bandDefinition of SCOPE_BAND_DEFINITIONS) {
    const bandState = bandStates.get(bandDefinition.bandDir)
    const bandDir = path.join(stageRoot, bandDefinition.bandDir)
    const tiles = [...bandState.tiles.values()]
      .map((tile) => ({
        ...tile,
        rows: [...tile.rows].sort(compareNormalizedScopeStars),
      }))
      .sort((left, right) =>
        left.decIndex === right.decIndex
          ? left.raIndex - right.raIndex
          : left.decIndex - right.decIndex
      )

    await mkdir(bandDir, { recursive: true })

    let totalRows = 0
    let namedRowsForBand = 0

    for (const tile of tiles) {
      const tilePath = path.join(bandDir, tile.file)
      const tileBuffer = Buffer.concat(tile.rows.map((row) => encodeScopeStarRow(row)))

      totalRows += tile.rows.length
      namedRowsForBand += tile.rows.filter((row) => row.nameId > 0).length

      await writeFile(tilePath, tileBuffer)
    }

    const index = createScopeBandIndex({
      ...bandDefinition,
      tiles: tiles.map((tile) => ({
        raIndex: tile.raIndex,
        decIndex: tile.decIndex,
        file: tile.file,
        count: tile.rows.length,
      })),
    })

    await writeFile(
      path.join(bandDir, 'index.json'),
      serializeDeterministicJson(index)
    )

    manifestBands.push(
      createScopeManifestBand({
        ...bandDefinition,
        totalRows,
        namedRows: namedRowsForBand,
      })
    )
    reportBands.push({
      bandDir: bandDefinition.bandDir,
      totalRows,
      namedRows: namedRowsForBand,
      tiles: tiles.length,
    })
  }

  const manifest = createScopeCatalogManifest({
    kind,
    sourceCatalog,
    bands: manifestBands,
  })

  await writeFile(
    path.join(stageRoot, SCOPE_MANIFEST_FILENAME),
    serializeDeterministicJson(manifest)
  )

  return {
    manifest,
    nameTable,
    uniqueNameCount,
    reportBands,
  }
}

async function writeBuildReport(report) {
  const reportPath = getScopeBuildReportPath(REPO_ROOT)

  await mkdir(path.dirname(reportPath), { recursive: true })
  await writeFile(reportPath, serializeDeterministicJson(report))
}

async function replaceDatasetAtomically(stageRoot, datasetRoot) {
  const datasetParent = path.dirname(datasetRoot)
  const backupRoot = path.join(path.dirname(stageRoot), 'backup-v1')

  await mkdir(datasetParent, { recursive: true })
  await rm(backupRoot, { recursive: true, force: true })

  const hadExistingDataset = await pathExists(datasetRoot)

  if (hadExistingDataset) {
    await rename(datasetRoot, backupRoot)
  }

  try {
    await rename(stageRoot, datasetRoot)
    await rm(backupRoot, { recursive: true, force: true })
  } catch (error) {
    if (hadExistingDataset && (await pathExists(backupRoot))) {
      await rm(datasetRoot, { recursive: true, force: true })
      await rename(backupRoot, datasetRoot)
    }

    throw error
  }
}

export async function buildScopeDataset({ mode }) {
  const buildInput = await getBuildInput(mode)
  const namedRows = applyResolvedNames(
    buildInput.rows,
    buildInput.brightStarHipNameMap,
    buildInput.hygProperNameMap,
    buildInput.nameOverrides
  )
  const stageRoot = getScopeBuildStagingRoot(REPO_ROOT)
  const stageResult = await writeStageOutput({
    stageRoot,
    emittedRows: namedRows,
    kind: buildInput.kind,
    sourceCatalog: buildInput.sourceCatalog,
  })

  const verification = await verifyScopeDataset({
    datasetRoot: stageRoot,
    kind: buildInput.kind,
  })
  const report = createScopeBuildReport({
    mode: buildInput.kind,
    sourceCatalog: buildInput.sourceCatalog,
    rawFiles: buildInput.rawFiles,
    parsedRows: buildInput.rows.length,
    droppedRows: buildInput.droppedRows,
    names: {
      unique: stageResult.uniqueNameCount,
      emittedRows: stageResult.reportBands.reduce(
        (sum, band) => sum + band.namedRows,
        0
      ),
    },
    bands: stageResult.reportBands,
  })

  await writeBuildReport(report)
  const datasetRoot = getScopeDatasetRoot(REPO_ROOT)
  await replaceDatasetAtomically(stageRoot, datasetRoot)

  return {
    ...verification,
    datasetRoot,
    report,
    usedFallbackBecauseSourceMissing:
      buildInput.usedFallbackBecauseSourceMissing ?? false,
  }
}
