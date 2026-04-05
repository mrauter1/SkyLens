import {
  SCOPE_CATALOG_EPOCH,
  SCOPE_CATALOG_VERSION,
  SCOPE_DATASET_BANDS,
  SCOPE_ROW_FORMAT,
  SCOPE_TILE_ROW_BYTES,
  type ScopeBandIndex,
  type ScopeCatalogManifest,
  type ScopeDecodedTileRow,
  type ScopeNameTable,
} from './contracts'

export function decodeScopeTileRows(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)

  if (bytes.byteLength % SCOPE_TILE_ROW_BYTES !== 0) {
    throw new Error('scope-tile-row-length-invalid')
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const rows: ScopeDecodedTileRow[] = []

  for (let offset = 0; offset < bytes.byteLength; offset += SCOPE_TILE_ROW_BYTES) {
    rows.push({
      raDeg: view.getUint32(offset, true) / 1_000_000,
      decDeg: view.getInt32(offset + 4, true) / 1_000_000,
      pmRaMasPerYear: view.getInt16(offset + 8, true),
      pmDecMasPerYear: view.getInt16(offset + 10, true),
      vMag: view.getInt16(offset + 12, true) / 1000,
      bMinusV: view.getInt16(offset + 14, true) / 1000,
      nameId: view.getUint32(offset + 16, true),
    })
  }

  return rows
}

export function isScopeManifest(value: unknown): value is ScopeCatalogManifest {
  if (!value || typeof value !== 'object') {
    return false
  }

  const manifest = value as Record<string, unknown>

  return (
    manifest.version === SCOPE_CATALOG_VERSION &&
    (manifest.kind === 'dev' || manifest.kind === 'prod') &&
    (manifest.sourceCatalog === 'tycho2-main' ||
      manifest.sourceCatalog === 'dev-synthetic-from-stars-200') &&
    manifest.epoch === SCOPE_CATALOG_EPOCH &&
    manifest.rowFormat === SCOPE_ROW_FORMAT &&
    manifest.namesPath === 'names.json' &&
    Array.isArray(manifest.bands) &&
    manifest.bands.length === SCOPE_DATASET_BANDS.length
  )
}

export function isScopeBandIndex(value: unknown): value is ScopeBandIndex {
  if (!value || typeof value !== 'object') {
    return false
  }

  const index = value as Record<string, unknown>

  return (
    typeof index.bandDir === 'string' &&
    typeof index.maxMagnitude === 'number' &&
    typeof index.raStepDeg === 'number' &&
    typeof index.decStepDeg === 'number' &&
    Array.isArray(index.tiles)
  )
}

export function isScopeNameTable(value: unknown): value is ScopeNameTable {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  return Object.entries(value).every(([key, candidate]) => {
    return /^\d+$/.test(key) && key !== '0' && typeof candidate === 'string'
  })
}
