import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DEFAULT_SCOPE_NAMES_DATASET_URL,
  SCOPE_DATASET_BANDS,
} from './constants.mjs'

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url))

export const REPO_ROOT = path.resolve(SCRIPTS_DIR, '..', '..')
export const PUBLIC_SCOPE_ROOT = path.join(
  REPO_ROOT,
  'public',
  'data',
  'scope',
  'v1',
)
export const OUT_SCOPE_ROOT = path.join(REPO_ROOT, 'out', 'data', 'scope', 'v1')
export const SCOPE_SOURCE_CACHE_ROOT = path.join(REPO_ROOT, '.cache', 'scope-source')
export const TYCHO2_CACHE_ROOT = path.join(SCOPE_SOURCE_CACHE_ROOT, 'tycho2')
export const SCOPE_BUILD_CACHE_ROOT = path.join(REPO_ROOT, '.cache', 'scope-build')
export const SCOPE_STAGING_ROOT = path.join(SCOPE_BUILD_CACHE_ROOT, 'staging-v1')
export const SCOPE_REPORT_PATH = path.join(SCOPE_BUILD_CACHE_ROOT, 'report.json')
export const BRIGHT_STAR_SOURCE_PATH = path.join(
  REPO_ROOT,
  'public',
  'data',
  'stars_200.json',
)
export const NAME_OVERRIDE_PATH = path.join(
  REPO_ROOT,
  'data',
  'scope-source',
  'name-overrides.csv',
)
export const OPTIONAL_PRODUCTION_NAMES_CACHE_PATH = path.join(
  SCOPE_SOURCE_CACHE_ROOT,
  'published',
  'names.json',
)
export const OPTIONAL_PRODUCTION_NAMES_URL =
  process.env.SKYLENS_SCOPE_OPTIONAL_NAMES_URL?.trim() || DEFAULT_SCOPE_NAMES_DATASET_URL

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

export function wrapRaDeg(value) {
  return ((value % 360) + 360) % 360
}

export function normalizeDecDeg(value) {
  return clamp(value, -90, 90)
}

export function normalizeName(value) {
  const normalized = String(value)
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized.length > 0 ? normalized : null
}

export async function fileExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

export async function readJsonFile(targetPath) {
  return JSON.parse(await fs.readFile(targetPath, 'utf8'))
}

export function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

export async function writeJsonFile(targetPath, value) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, serializeJson(value), 'utf8')
}

export async function ensureCleanDirectory(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true })
  await fs.mkdir(targetPath, { recursive: true })
}

export function compareUtf16(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

export function roundToMilli(value) {
  return Math.round(value * 1000) / 1000
}

export function createDatasetBandIndex(raDeg, decDeg, band) {
  const normalizedRaDeg = wrapRaDeg(raDeg)
  const raIndex = Math.floor(normalizedRaDeg / band.raStepDeg)
  const shiftedDec = Math.min(179.999999, Math.max(0, decDeg + 90))
  const decIndex = Math.floor(shiftedDec / band.decStepDeg)

  return {
    raIndex,
    decIndex,
    file: `r${raIndex}_d${decIndex}.bin`,
  }
}

export function getBandDefinitions() {
  return SCOPE_DATASET_BANDS
}

export async function replaceDirectoryAtomically(stagingPath, finalPath) {
  const backupPath = `${finalPath}.backup`

  await fs.mkdir(path.dirname(finalPath), { recursive: true })
  await fs.rm(backupPath, { recursive: true, force: true })

  try {
    await fs.rename(finalPath, backupPath)
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      throw error
    }
  }

  try {
    await fs.rm(finalPath, { recursive: true, force: true })
    await fs.rename(stagingPath, finalPath)
    await fs.rm(backupPath, { recursive: true, force: true })
  } catch (error) {
    try {
      await fs.rm(finalPath, { recursive: true, force: true })
      await fs.rename(backupPath, finalPath)
    } catch {
      // Ignore backup restore failures so the original error is surfaced.
    }
    throw error
  }
}

export function isValidBandDir(value) {
  return getBandDefinitions().some((band) => band.bandDir === value)
}
