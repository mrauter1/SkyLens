import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'

import { SCOPE_REQUIRED_TYCHO2_FILES } from './contracts.mjs'

function isGzipFile(fileName) {
  return fileName.endsWith('.gz')
}

function getExpandedFileName(fileName) {
  return fileName.slice(0, -3)
}

function getDownloadLayout(destRoot, fileName) {
  const rawPath = path.join(destRoot, 'raw', fileName)
  const expandedPath = isGzipFile(fileName)
    ? path.join(destRoot, 'expanded', getExpandedFileName(fileName))
    : undefined

  return {
    rawPath,
    expandedPath,
  }
}

function hasNonEmptyText(buffer) {
  return buffer.toString('utf8').trim().length > 0
}

async function readBufferIfPresent(filePath) {
  try {
    return await readFile(filePath)
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return undefined
    }

    throw error
  }
}

function validateRawBuffer(fileName, rawBuffer) {
  if (!rawBuffer || rawBuffer.length === 0) {
    return {
      rawValid: false,
      decompressedBuffer: undefined,
      rawError: 'raw file is missing or empty',
    }
  }

  if (!isGzipFile(fileName)) {
    return {
      rawValid: true,
      decompressedBuffer: undefined,
      rawError: undefined,
    }
  }

  try {
    return {
      rawValid: true,
      decompressedBuffer: gunzipSync(rawBuffer),
      rawError: undefined,
    }
  } catch (error) {
    return {
      rawValid: false,
      decompressedBuffer: undefined,
      rawError: `raw gzip is invalid: ${error.message}`,
    }
  }
}

async function inspectCachedFile({ fileName, destRoot, expand }) {
  const { rawPath, expandedPath } = getDownloadLayout(destRoot, fileName)
  const rawBuffer = await readBufferIfPresent(rawPath)
  const rawState = validateRawBuffer(fileName, rawBuffer)

  if (!expand || !isGzipFile(fileName)) {
    return {
      rawPath,
      expandedPath,
      rawValid: rawState.rawValid,
      expandedValid: true,
      decompressedBuffer: rawState.decompressedBuffer,
      valid: rawState.rawValid,
      reason: rawState.rawError,
    }
  }

  const expandedBuffer = await readBufferIfPresent(expandedPath)
  const expandedValid =
    Boolean(expandedBuffer) &&
    expandedBuffer.length > 0 &&
    hasNonEmptyText(expandedBuffer)

  return {
    rawPath,
    expandedPath,
    rawValid: rawState.rawValid,
    expandedValid,
    decompressedBuffer: rawState.decompressedBuffer,
    valid: rawState.rawValid && expandedValid,
    reason: rawState.rawValid
      ? 'expanded file is missing or empty'
      : rawState.rawError,
  }
}

async function ensureExpandedFile(expandedPath, decompressedBuffer) {
  if (!decompressedBuffer || !hasNonEmptyText(decompressedBuffer)) {
    throw new Error('expanded file content is empty')
  }

  await mkdir(path.dirname(expandedPath), { recursive: true })
  await writeFile(expandedPath, decompressedBuffer)
}

async function writeDownloadedFile({ fileName, destRoot, rawBuffer, expand }) {
  const { rawPath, expandedPath } = getDownloadLayout(destRoot, fileName)

  await mkdir(path.dirname(rawPath), { recursive: true })
  await writeFile(rawPath, rawBuffer)

  if (!expand || !isGzipFile(fileName)) {
    return {
      rawPath,
      expandedPath,
    }
  }

  const decompressedBuffer = validateRawBuffer(fileName, rawBuffer).decompressedBuffer
  await ensureExpandedFile(expandedPath, decompressedBuffer)

  return {
    rawPath,
    expandedPath,
  }
}

async function fetchFileBuffer({ fetchImpl, sourceUrl, timeoutMs }) {
  const response = await fetchImpl(sourceUrl, {
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const rawBuffer = Buffer.from(await response.arrayBuffer())

  if (rawBuffer.length === 0) {
    throw new Error('response body was empty')
  }

  return rawBuffer
}

function createResultEntry(fileName, destRoot) {
  const { rawPath, expandedPath } = getDownloadLayout(destRoot, fileName)

  return {
    fileName,
    rawPath,
    expandedPath,
    status: 'pending',
    sourceUrl: undefined,
    candidateBaseUrl: undefined,
    lastError: undefined,
  }
}

function getPendingFiles(fileResults) {
  return fileResults
    .filter((entry) => entry.status === 'pending')
    .map((entry) => entry.fileName)
}

export function formatScopeSourceDownloadSummary(result) {
  const summaryLines = [
    'Scope source download summary:',
    ...result.files.map((entry) => {
      const detail =
        entry.status === 'failed' && entry.lastError
          ? ` (${entry.lastError})`
          : entry.candidateBaseUrl
            ? ` (${entry.candidateBaseUrl})`
            : ''

      return `- ${entry.fileName}: ${entry.status}${detail}`
    }),
    `Final candidate used: ${
      result.finalCandidateUsed ?? (result.usedCacheOnly ? 'cache-only' : 'none')
    }`,
  ]

  if (!result.success) {
    summaryLines.push(`Missing files: ${result.missingFiles.join(', ')}`)
  }

  return summaryLines.join('\n')
}

export class ScopeSourceDownloadError extends Error {
  constructor(message, result) {
    super(message)
    this.name = 'ScopeSourceDownloadError'
    this.result = result
    this.summaryText = formatScopeSourceDownloadSummary(result)
  }
}

export async function downloadScopeSource({
  baseUrls,
  dest,
  force,
  expand,
  timeoutMs,
  fetchImpl = fetch,
}) {
  if (!Array.isArray(baseUrls) || baseUrls.length === 0) {
    throw new Error('At least one source base URL is required')
  }

  const fileResults = SCOPE_REQUIRED_TYCHO2_FILES.map((fileName) =>
    createResultEntry(fileName, dest)
  )
  let finalCandidateUsed = null

  for (const entry of fileResults) {
    if (force) {
      continue
    }

    const cached = await inspectCachedFile({
      fileName: entry.fileName,
      destRoot: dest,
      expand,
    })

    if (cached.valid) {
      entry.status = 'skipped'
      continue
    }

    if (expand && isGzipFile(entry.fileName) && cached.rawValid) {
      try {
        await ensureExpandedFile(entry.expandedPath, cached.decompressedBuffer)
        entry.status = 'expanded-from-cache'
      } catch (error) {
        entry.lastError = error.message
      }
    }
  }

  for (const baseUrl of baseUrls) {
    const pendingFiles = getPendingFiles(fileResults)

    if (pendingFiles.length === 0) {
      break
    }

    for (const fileName of pendingFiles) {
      const entry = fileResults.find((candidate) => candidate.fileName === fileName)
      const sourceUrl = `${baseUrl}${fileName}`

      try {
        const rawBuffer = await fetchFileBuffer({
          fetchImpl,
          sourceUrl,
          timeoutMs,
        })
        const rawState = validateRawBuffer(fileName, rawBuffer)

        if (!rawState.rawValid) {
          throw new Error(rawState.rawError)
        }

        await writeDownloadedFile({
          fileName,
          destRoot: dest,
          rawBuffer,
          expand,
        })

        entry.status =
          expand && isGzipFile(fileName)
            ? 'downloaded-and-expanded'
            : 'downloaded'
        entry.sourceUrl = sourceUrl
        entry.candidateBaseUrl = baseUrl
        entry.lastError = undefined
        finalCandidateUsed = baseUrl
      } catch (error) {
        entry.lastError = `failed from ${sourceUrl}: ${error.message}`
      }
    }
  }

  const missingFiles = []

  for (const entry of fileResults) {
    const cached = await inspectCachedFile({
      fileName: entry.fileName,
      destRoot: dest,
      expand,
    })

    if (cached.valid) {
      continue
    }

    entry.status = 'failed'
    entry.lastError = entry.lastError ?? cached.reason
    missingFiles.push(entry.fileName)
  }

  const result = {
    success: missingFiles.length === 0,
    dest,
    force,
    expand,
    timeoutMs,
    finalCandidateUsed,
    usedCacheOnly:
      finalCandidateUsed === null &&
      fileResults.every((entry) =>
        ['skipped', 'expanded-from-cache'].includes(entry.status)
      ),
    missingFiles,
    files: fileResults,
  }

  if (!result.success) {
    throw new ScopeSourceDownloadError(
      `Required source files remain missing after exhausting ${baseUrls.length} candidate base URL(s).`,
      result
    )
  }

  return result
}
