import {
  SCOPE_DATASET_VERSION,
  SCOPE_EPOCH,
  SCOPE_INDEX_FILENAME,
  SCOPE_NAMES_FILENAME,
  SCOPE_ROW_FORMAT,
  ScopeBandIndexSchema,
  ScopeBuildReportSchema,
  ScopeCatalogManifestBandSchema,
  ScopeCatalogManifestSchema,
  ScopeNameTableSchema,
} from './contracts.mjs'

export function serializeDeterministicJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function sortBandIndexTiles(tiles) {
  return [...tiles].sort((left, right) => {
    if (left.decIndex !== right.decIndex) {
      return left.decIndex - right.decIndex
    }

    return left.raIndex - right.raIndex
  })
}

export function createScopeManifestBand({ bandDir, maxMagnitude, raStepDeg, decStepDeg, totalRows, namedRows }) {
  return ScopeCatalogManifestBandSchema.parse({
    bandDir,
    maxMagnitude,
    raStepDeg,
    decStepDeg,
    indexPath: `${bandDir}/${SCOPE_INDEX_FILENAME}`,
    totalRows,
    namedRows,
  })
}

export function createScopeCatalogManifest({ kind, sourceCatalog, bands }) {
  return ScopeCatalogManifestSchema.parse({
    version: SCOPE_DATASET_VERSION,
    kind,
    sourceCatalog,
    epoch: SCOPE_EPOCH,
    rowFormat: SCOPE_ROW_FORMAT,
    namesPath: SCOPE_NAMES_FILENAME,
    bands,
  })
}

export function createScopeBandIndex({ bandDir, maxMagnitude, raStepDeg, decStepDeg, tiles }) {
  return ScopeBandIndexSchema.parse({
    bandDir,
    maxMagnitude,
    raStepDeg,
    decStepDeg,
    tiles: sortBandIndexTiles(tiles),
  })
}

export function createScopeNameTable(entries) {
  const sortedEntries = [...entries].sort(
    ([leftKey], [rightKey]) => Number(leftKey) - Number(rightKey)
  )

  return ScopeNameTableSchema.parse(Object.fromEntries(sortedEntries))
}

export function createScopeBuildReport({
  mode,
  sourceCatalog,
  rawFiles,
  parsedRows,
  droppedRows,
  names,
  bands,
}) {
  return ScopeBuildReportSchema.parse({
    version: SCOPE_DATASET_VERSION,
    mode,
    sourceCatalog,
    rawFiles,
    parsedRows,
    droppedRows,
    names,
    bands,
  })
}
