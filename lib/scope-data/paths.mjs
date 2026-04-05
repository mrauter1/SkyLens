import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  SCOPE_BRIGHT_STARS_RELATIVE_PATH,
  SCOPE_BUILD_CACHE_RELATIVE_ROOT,
  SCOPE_BUILD_REPORT_RELATIVE_PATH,
  SCOPE_BUILD_STAGING_RELATIVE_ROOT,
  SCOPE_DATASET_RELATIVE_ROOT,
  SCOPE_HYG_PROPER_NAMES_RELATIVE_PATH,
  SCOPE_INDEX_FILENAME,
  SCOPE_MANIFEST_FILENAME,
  SCOPE_NAME_OVERRIDES_RELATIVE_PATH,
  SCOPE_NAMES_FILENAME,
  SCOPE_SOURCE_CACHE_RELATIVE_ROOT,
  SCOPE_TYCHO2_EXPANDED_RELATIVE_ROOT,
  SCOPE_TYCHO2_RAW_RELATIVE_ROOT,
  SCOPE_TYCHO2_RELATIVE_ROOT,
} from './contracts.mjs'

const THIS_FILE = fileURLToPath(import.meta.url)
const THIS_DIR = path.dirname(THIS_FILE)

export const REPO_ROOT = path.resolve(THIS_DIR, '../..')

export function resolveFromRepoRoot(...segments) {
  return path.join(REPO_ROOT, ...segments)
}

export function getScopeDatasetRoot(baseDir = REPO_ROOT) {
  return path.join(baseDir, SCOPE_DATASET_RELATIVE_ROOT)
}

export function getScopeDatasetManifestPath(baseDir = REPO_ROOT) {
  return path.join(getScopeDatasetRoot(baseDir), SCOPE_MANIFEST_FILENAME)
}

export function getScopeDatasetNamesPath(baseDir = REPO_ROOT) {
  return path.join(getScopeDatasetRoot(baseDir), SCOPE_NAMES_FILENAME)
}

export function getScopeBandDirectoryPath(bandDir, baseDir = REPO_ROOT) {
  return path.join(getScopeDatasetRoot(baseDir), bandDir)
}

export function getScopeBandIndexPath(bandDir, baseDir = REPO_ROOT) {
  return path.join(getScopeBandDirectoryPath(bandDir, baseDir), SCOPE_INDEX_FILENAME)
}

export function getScopeBandTilePath(bandDir, fileName, baseDir = REPO_ROOT) {
  return path.join(getScopeBandDirectoryPath(bandDir, baseDir), fileName)
}

export function getScopeSourceCacheRoot(baseDir = REPO_ROOT) {
  return path.join(baseDir, SCOPE_SOURCE_CACHE_RELATIVE_ROOT)
}

export function getTycho2Root(baseDir = REPO_ROOT) {
  return path.join(baseDir, SCOPE_TYCHO2_RELATIVE_ROOT)
}

export function getTycho2RawRoot(baseDir = REPO_ROOT) {
  return path.join(baseDir, SCOPE_TYCHO2_RAW_RELATIVE_ROOT)
}

export function getTycho2ExpandedRoot(baseDir = REPO_ROOT) {
  return path.join(baseDir, SCOPE_TYCHO2_EXPANDED_RELATIVE_ROOT)
}

export function getScopeBuildCacheRoot(baseDir = REPO_ROOT) {
  return path.join(baseDir, SCOPE_BUILD_CACHE_RELATIVE_ROOT)
}

export function getScopeBuildStagingRoot(baseDir = REPO_ROOT) {
  return path.join(baseDir, SCOPE_BUILD_STAGING_RELATIVE_ROOT)
}

export function getScopeBuildReportPath(baseDir = REPO_ROOT) {
  return path.join(baseDir, SCOPE_BUILD_REPORT_RELATIVE_PATH)
}

export function getScopeNameOverridesPath(baseDir = REPO_ROOT) {
  return path.join(baseDir, SCOPE_NAME_OVERRIDES_RELATIVE_PATH)
}

export function getBrightStarsCatalogPath(baseDir = REPO_ROOT) {
  return path.join(baseDir, SCOPE_BRIGHT_STARS_RELATIVE_PATH)
}

export function getHygProperNamesPath(baseDir = REPO_ROOT) {
  return path.join(baseDir, SCOPE_HYG_PROPER_NAMES_RELATIVE_PATH)
}
