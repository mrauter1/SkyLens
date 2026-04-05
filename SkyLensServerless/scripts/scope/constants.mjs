export const SCOPE_CATALOG_VERSION = 1
export const SCOPE_CATALOG_EPOCH = 'J2000'
export const SCOPE_ROW_FORMAT = 'scope-star-v2-le'
export const SCOPE_TILE_ROW_BYTES = 20
export const SCOPE_DATASET_VERSION_DIR = 'v1'
export const DEFAULT_SCOPE_NAMES_DATASET_URL =
  'https://pub-566fb74233f3432ba4d47900577e552e.r2.dev/scope/v1/names.json'

export const DEFAULT_SOURCE_BASE_URLS = Object.freeze([
  'https://cdsarc.cds.unistra.fr/ftp/cats/I/259/',
  'https://vizier.cfa.harvard.edu/vizier/ftp/cats/I/259/',
])

export const REQUIRED_PRODUCTION_FILES = Object.freeze([
  'ReadMe',
  ...Array.from({ length: 20 }, (_, index) => `tyc2.dat.${String(index).padStart(2, '0')}.gz`),
])

export const SCOPE_DATASET_BANDS = Object.freeze([
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

export const DEV_SYNTHETIC_OFFSETS_DEG = Object.freeze([
  [0.08, 0.03],
  [-0.09, 0.05],
  [0.04, -0.11],
  [-0.05, -0.08],
  [0.12, -0.02],
  [-0.13, 0.01],
])

export const DEV_SYNTHETIC_MAGS = Object.freeze([6.4, 7.6, 8.4, 9.2, 10.0, 10.5])
export const DEV_FALLBACK_SEED_IDS = Object.freeze([
  'hip-11767',
  'hip-7588',
  'hip-24608',
  'hip-24436',
  'hip-32349',
  'hip-30438',
  'hip-69673',
  'hip-72607',
  'hip-71683',
  'hip-68702',
  'hip-91262',
  'hip-97649',
])
export const DEV_FALLBACK_SEED_COUNT = DEV_FALLBACK_SEED_IDS.length
export const DEV_FALLBACK_TILE_FILE_CAP = 45

export const RUNTIME_FIELD_BOUNDS = Object.freeze({
  raMicroDeg: { min: 0, maxExclusive: 360_000_000 },
  decMicroDeg: { min: -90_000_000, max: 90_000_000 },
  pmMasPerYear: { min: -32768, max: 32767 },
  vMagMilli: { min: 0, max: 10500 },
  bMinusVMilli: { min: -1000, max: 4000 },
})
