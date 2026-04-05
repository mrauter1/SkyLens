import { createGunzip } from 'node:zlib'
import { createReadStream, createWriteStream, promises as fs } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

import {
  DEFAULT_SCOPE_NAMES_DATASET_URL,
  DEFAULT_SOURCE_BASE_URLS,
  REQUIRED_PRODUCTION_FILES,
} from './constants.mjs'
import {
  OPTIONAL_PRODUCTION_NAMES_CACHE_PATH,
  OPTIONAL_PRODUCTION_NAMES_URL,
  SCOPE_SOURCE_CACHE_ROOT,
  TYCHO2_CACHE_ROOT,
} from './shared.mjs'

function parseBaseUrlOverrides(overrideBaseUrls = [], envValue = process.env.SKYLENS_SCOPE_SOURCE_BASE_URLS) {
  if (overrideBaseUrls.length > 0) {
    return overrideBaseUrls
  }
  if (envValue?.trim()) {
    return envValue
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  }
  return [...DEFAULT_SOURCE_BASE_URLS]
}

async function isNonEmptyFile(targetPath) {
  try {
    const stat = await fs.stat(targetPath)
    return stat.isFile() && stat.size > 0
  } catch {
    return false
  }
}

async function validateExpandedFile(targetPath) {
  if (!(await isNonEmptyFile(targetPath))) {
    return false
  }
  const content = await fs.readFile(targetPath, 'utf8')
  return content.trim().length > 0
}

async function validateGzipPair(targetPath) {
  if (!(await isNonEmptyFile(targetPath))) {
    return false
  }

  const expandedPath = targetPath.replace(/\.gz$/, '')
  if (!(await validateExpandedFile(expandedPath))) {
    return false
  }

  try {
    const buffer = await fs.readFile(targetPath)
    const inflated = await new Promise((resolve, reject) => {
      import('node:zlib').then(({ gunzip }) => {
        gunzip(buffer, (error, result) => {
          if (error) {
            reject(error)
            return
          }
          resolve(result)
        })
      }, reject)
    })
    return String(inflated).trim().length > 0
  } catch {
    return false
  }
}

async function ensureExpandedPair(gzipPath) {
  const expandedPath = gzipPath.replace(/\.gz$/, '')
  await fs.mkdir(path.dirname(expandedPath), { recursive: true })
  await pipeline(
    createReadStream(gzipPath),
    createGunzip(),
    createWriteStream(expandedPath),
  )
  return expandedPath
}

async function downloadFile(url, destinationPath) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'SkyLensServerless scope downloader',
    },
  })
  if (!response.ok || !response.body) {
    throw new Error(`scope-download-http-${response.status}`)
  }

  await fs.mkdir(path.dirname(destinationPath), { recursive: true })
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destinationPath))
}

async function isCachedFileValid(cachePath) {
  if (cachePath.endsWith('.gz')) {
    return validateGzipPair(cachePath)
  }
  return isNonEmptyFile(cachePath)
}

async function fetchOptionalPublishedNames(url = OPTIONAL_PRODUCTION_NAMES_URL || DEFAULT_SCOPE_NAMES_DATASET_URL) {
  if (!url) {
    return {
      downloaded: false,
      path: OPTIONAL_PRODUCTION_NAMES_CACHE_PATH,
    }
  }

  try {
    await downloadFile(url, OPTIONAL_PRODUCTION_NAMES_CACHE_PATH)
    return {
      downloaded: true,
      path: OPTIONAL_PRODUCTION_NAMES_CACHE_PATH,
    }
  } catch {
    return {
      downloaded: false,
      path: OPTIONAL_PRODUCTION_NAMES_CACHE_PATH,
    }
  }
}

export async function downloadScopeSource({
  baseUrls = [],
  force = false,
} = {}) {
  const resolvedBaseUrls = parseBaseUrlOverrides(baseUrls)
  await fs.mkdir(SCOPE_SOURCE_CACHE_ROOT, { recursive: true })
  await fs.mkdir(TYCHO2_CACHE_ROOT, { recursive: true })

  let selectedBaseUrl = null
  const summary = new Map(
    REQUIRED_PRODUCTION_FILES.map((file) => [file, { status: 'missing', sourceUrl: null }]),
  )

  for (const baseUrl of resolvedBaseUrls) {
    let missingFiles = []

    for (const filename of REQUIRED_PRODUCTION_FILES) {
      const cachePath = path.join(TYCHO2_CACHE_ROOT, filename)
      const valid = !force && (await isCachedFileValid(cachePath))

      if (valid) {
        summary.set(filename, { status: 'cached', sourceUrl: null })
        continue
      }

      try {
        await downloadFile(new URL(filename, baseUrl).toString(), cachePath)
        if (filename.endsWith('.gz')) {
          await ensureExpandedPair(cachePath)
        }
        summary.set(filename, {
          status: 'downloaded',
          sourceUrl: new URL(filename, baseUrl).toString(),
        })
      } catch {
        summary.set(filename, {
          status: 'failed',
          sourceUrl: new URL(filename, baseUrl).toString(),
        })
      }
    }

    missingFiles = []
    for (const filename of REQUIRED_PRODUCTION_FILES) {
      const cachePath = path.join(TYCHO2_CACHE_ROOT, filename)
      if (!(await isCachedFileValid(cachePath))) {
        missingFiles.push(filename)
      }
    }

    if (missingFiles.length === 0) {
      selectedBaseUrl = baseUrl
      break
    }
  }

  await fetchOptionalPublishedNames()

  const missingFiles = []
  for (const filename of REQUIRED_PRODUCTION_FILES) {
    const cachePath = path.join(TYCHO2_CACHE_ROOT, filename)
    if (!(await isCachedFileValid(cachePath))) {
      missingFiles.push(filename)
    }
  }

  if (missingFiles.length > 0) {
    throw new Error(`scope-download-incomplete:${missingFiles.join(',')}`)
  }

  return {
    baseUrls: resolvedBaseUrls,
    selectedBaseUrl,
    summary: [...summary.entries()].map(([file, result]) => ({ file, ...result })),
  }
}

export { parseBaseUrlOverrides }
