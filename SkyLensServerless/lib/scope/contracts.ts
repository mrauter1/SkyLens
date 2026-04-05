export interface ScopeBandDefinition {
  bandDir: 'mag6p5' | 'mag8p0' | 'mag9p5' | 'mag10p5'
  maxMagnitude: 6.5 | 8.0 | 9.5 | 10.5
  raStepDeg: number
  decStepDeg: number
}

export interface ScopeBandIndexTile {
  raIndex: number
  decIndex: number
  file: string
  count: number
}

export interface ScopeBandIndex {
  bandDir: ScopeBandDefinition['bandDir']
  maxMagnitude: ScopeBandDefinition['maxMagnitude']
  raStepDeg: number
  decStepDeg: number
  tiles: ScopeBandIndexTile[]
}

export interface ScopeCatalogManifestBand extends ScopeBandDefinition {
  indexPath: string
  totalRows: number
  namedRows: number
}

export interface ScopeCatalogManifest {
  version: 1
  kind: 'dev' | 'prod'
  sourceCatalog: 'tycho2-main' | 'dev-synthetic-from-stars-200'
  epoch: 'J2000'
  rowFormat: 'scope-star-v2-le'
  namesPath: 'names.json'
  bands: ScopeCatalogManifestBand[]
}

export type ScopeNameTable = Record<string, string>

export interface ScopeDecodedTileRow {
  raDeg: number
  decDeg: number
  pmRaMasPerYear: number
  pmDecMasPerYear: number
  vMag: number
  bMinusV: number
  nameId: number
}

export const SCOPE_CATALOG_VERSION = 1 as const
export const SCOPE_CATALOG_EPOCH = 'J2000' as const
export const SCOPE_ROW_FORMAT = 'scope-star-v2-le' as const
export const SCOPE_TILE_ROW_BYTES = 20 as const
export const SCOPE_DATASET_BANDS: readonly ScopeBandDefinition[] = Object.freeze([
  {
    bandDir: 'mag6p5',
    maxMagnitude: 6.5,
    raStepDeg: 90,
    decStepDeg: 45,
  },
  {
    bandDir: 'mag8p0',
    maxMagnitude: 8.0,
    raStepDeg: 45,
    decStepDeg: 30,
  },
  {
    bandDir: 'mag9p5',
    maxMagnitude: 9.5,
    raStepDeg: 22.5,
    decStepDeg: 22.5,
  },
  {
    bandDir: 'mag10p5',
    maxMagnitude: 10.5,
    raStepDeg: 11.25,
    decStepDeg: 11.25,
  },
])

