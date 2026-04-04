import { z } from 'zod'

export const SCOPE_DATASET_VERSION = 1
export const SCOPE_DATASET_KIND_VALUES = Object.freeze(['dev', 'prod'])
export const SCOPE_SOURCE_CATALOG_VALUES = Object.freeze([
  'tycho2-main',
  'dev-synthetic-from-stars-200',
])
export const SCOPE_EPOCH = 'J2000'
export const SCOPE_ROW_FORMAT = 'scope-star-v2-le'
export const SCOPE_ROW_SIZE_BYTES = 20
export const SCOPE_NAMES_FILENAME = 'names.json'
export const SCOPE_MANIFEST_FILENAME = 'manifest.json'
export const SCOPE_INDEX_FILENAME = 'index.json'
export const SCOPE_DATASET_RELATIVE_ROOT = 'public/data/scope/v1'
export const SCOPE_SOURCE_CACHE_RELATIVE_ROOT = '.cache/scope-source'
export const SCOPE_BUILD_CACHE_RELATIVE_ROOT = '.cache/scope-build'
export const SCOPE_BUILD_STAGING_RELATIVE_ROOT = '.cache/scope-build/staging-v1'
export const SCOPE_BUILD_REPORT_RELATIVE_PATH = '.cache/scope-build/report.json'
export const SCOPE_NAME_OVERRIDES_RELATIVE_PATH =
  'data/scope-source/name-overrides.csv'
export const SCOPE_BRIGHT_STARS_RELATIVE_PATH = 'public/data/stars_200.json'
export const SCOPE_TYCHO2_RELATIVE_ROOT = '.cache/scope-source/tycho2'
export const SCOPE_TYCHO2_RAW_RELATIVE_ROOT = '.cache/scope-source/tycho2/raw'
export const SCOPE_TYCHO2_EXPANDED_RELATIVE_ROOT =
  '.cache/scope-source/tycho2/expanded'
export const SCOPE_DEFAULT_TIMEOUT_MS = 30_000
export const SCOPE_MAX_MAGNITUDE = 10.5

export const SCOPE_REQUIRED_TYCHO2_FILES = Object.freeze([
  'ReadMe',
  'tyc2.dat.00.gz',
  'tyc2.dat.01.gz',
  'tyc2.dat.02.gz',
  'tyc2.dat.03.gz',
  'tyc2.dat.04.gz',
  'tyc2.dat.05.gz',
  'tyc2.dat.06.gz',
  'tyc2.dat.07.gz',
  'tyc2.dat.08.gz',
  'tyc2.dat.09.gz',
  'tyc2.dat.10.gz',
  'tyc2.dat.11.gz',
  'tyc2.dat.12.gz',
  'tyc2.dat.13.gz',
  'tyc2.dat.14.gz',
  'tyc2.dat.15.gz',
  'tyc2.dat.16.gz',
  'tyc2.dat.17.gz',
  'tyc2.dat.18.gz',
  'tyc2.dat.19.gz',
])

export const SCOPE_DEFAULT_SOURCE_BASE_URLS = Object.freeze([
  'https://cdsarc.cds.unistra.fr/ftp/cats/I/259/',
  'https://vizier.cfa.harvard.edu/vizier/ftp/cats/I/259/',
])

export const SCOPE_BAND_DEFINITIONS = Object.freeze([
  Object.freeze({
    bandDir: 'mag6p5',
    maxMagnitude: 6.5,
    raStepDeg: 90.0,
    decStepDeg: 45.0,
  }),
  Object.freeze({
    bandDir: 'mag8p0',
    maxMagnitude: 8.0,
    raStepDeg: 45.0,
    decStepDeg: 30.0,
  }),
  Object.freeze({
    bandDir: 'mag9p5',
    maxMagnitude: 9.5,
    raStepDeg: 22.5,
    decStepDeg: 22.5,
  }),
  Object.freeze({
    bandDir: 'mag10p5',
    maxMagnitude: 10.5,
    raStepDeg: 11.25,
    decStepDeg: 11.25,
  }),
])

export const SCOPE_BAND_DIRECTORY_NAMES = Object.freeze(
  SCOPE_BAND_DEFINITIONS.map((band) => band.bandDir)
)

function createStrictObject(shape) {
  return z.object(shape).strict()
}

function createExactBandShape(band) {
  return {
    bandDir: z.literal(band.bandDir),
    maxMagnitude: z.literal(band.maxMagnitude),
    raStepDeg: z.literal(band.raStepDeg),
    decStepDeg: z.literal(band.decStepDeg),
  }
}

export const ScopeDatasetKindSchema = z.enum(SCOPE_DATASET_KIND_VALUES)
export const ScopeSourceCatalogSchema = z.enum(SCOPE_SOURCE_CATALOG_VALUES)
export const ScopeBandDirSchema = z.enum(SCOPE_BAND_DIRECTORY_NAMES)
export const ScopeBandMagnitudeSchema = z.union([
  z.literal(6.5),
  z.literal(8.0),
  z.literal(9.5),
  z.literal(10.5),
])

const scopeCatalogManifestBandSchemas = SCOPE_BAND_DEFINITIONS.map((band) =>
  createStrictObject({
    ...createExactBandShape(band),
    indexPath: z.literal(`${band.bandDir}/${SCOPE_INDEX_FILENAME}`),
    totalRows: z.number().int().nonnegative(),
    namedRows: z.number().int().nonnegative(),
  })
)

export const ScopeCatalogManifestBandSchema = z.discriminatedUnion(
  'bandDir',
  scopeCatalogManifestBandSchemas
)

export const ScopeCatalogManifestSchema = createStrictObject({
  version: z.literal(SCOPE_DATASET_VERSION),
  kind: ScopeDatasetKindSchema,
  sourceCatalog: ScopeSourceCatalogSchema,
  epoch: z.literal(SCOPE_EPOCH),
  rowFormat: z.literal(SCOPE_ROW_FORMAT),
  namesPath: z.literal(SCOPE_NAMES_FILENAME),
  bands: z.tuple(scopeCatalogManifestBandSchemas),
})

export const ScopeBandIndexTileSchema = createStrictObject({
  raIndex: z.number().int().nonnegative(),
  decIndex: z.number().int().nonnegative(),
  file: z.string().min(1),
  count: z.number().int().positive(),
})

const scopeBandIndexSchemas = SCOPE_BAND_DEFINITIONS.map((band) =>
  createStrictObject({
    ...createExactBandShape(band),
    tiles: z.array(ScopeBandIndexTileSchema),
  })
)

export const ScopeBandIndexSchema = z.discriminatedUnion(
  'bandDir',
  scopeBandIndexSchemas
)

export const ScopeNameTableSchema = z.record(
  z.string().regex(/^[1-9]\d*$/),
  z.string().min(1)
)

export const ScopeDroppedRowsSchema = createStrictObject({
  invalidLength: z.number().int().nonnegative(),
  missingRa: z.number().int().nonnegative(),
  missingDec: z.number().int().nonnegative(),
  missingPhotometry: z.number().int().nonnegative(),
  invalidDerivedPhotometry: z.number().int().nonnegative(),
  pflagX: z.number().int().nonnegative(),
  tooFaint: z.number().int().nonnegative(),
})

const scopeBuildReportBandSchemas = SCOPE_BAND_DEFINITIONS.map((band) =>
  createStrictObject({
    bandDir: z.literal(band.bandDir),
    totalRows: z.number().int().nonnegative(),
    namedRows: z.number().int().nonnegative(),
    tiles: z.number().int().nonnegative(),
  })
)

export const ScopeBuildReportBandSchema = z.discriminatedUnion(
  'bandDir',
  scopeBuildReportBandSchemas
)

export const ScopeBuildReportSchema = createStrictObject({
  version: z.literal(SCOPE_DATASET_VERSION),
  mode: ScopeDatasetKindSchema,
  sourceCatalog: ScopeSourceCatalogSchema,
  rawFiles: createStrictObject({
    required: z.number().int().nonnegative(),
    present: z.number().int().nonnegative(),
  }),
  parsedRows: z.number().int().nonnegative(),
  droppedRows: ScopeDroppedRowsSchema,
  names: createStrictObject({
    unique: z.number().int().nonnegative(),
    emittedRows: z.number().int().nonnegative(),
  }),
  bands: z.tuple(scopeBuildReportBandSchemas),
})

export function getScopeBandDefinitionByDir(bandDir) {
  const match = SCOPE_BAND_DEFINITIONS.find((band) => band.bandDir === bandDir)

  if (!match) {
    throw new Error(`Unknown scope band directory: ${bandDir}`)
  }

  return match
}

export function getScopeBandDefinitionForMagnitude(vMag) {
  if (!Number.isFinite(vMag)) {
    throw new Error(`Magnitude must be finite. Received: ${vMag}`)
  }

  const match = SCOPE_BAND_DEFINITIONS.find(
    (band) => vMag <= band.maxMagnitude
  )

  if (!match) {
    throw new Error(`No scope band definition accepts magnitude ${vMag}`)
  }

  return match
}
