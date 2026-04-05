import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  SCOPE_REQUIRED_TYCHO2_FILES,
} from '../../lib/scope-data/contracts.mjs'
import { parseDownloadCommandArgs } from '../../lib/scope-data/cli.mjs'
import {
  ScopeSourceDownloadError,
  downloadScopeSource,
  formatScopeSourceDownloadSummary,
} from '../../lib/scope-data/download.mjs'

const ALL_REQUIRED_FILES = [...SCOPE_REQUIRED_TYCHO2_FILES]
const BASE_ONE = 'https://source-one.test/catalog/'
const BASE_TWO = 'https://source-two.test/catalog/'

const tempDirs = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(
    tempDirs.splice(0).map((dirPath) =>
      rm(dirPath, { recursive: true, force: true })
    )
  )
})

async function createTempDest() {
  const dest = await mkdtemp(path.join(tmpdir(), 'scope-download-'))
  tempDirs.push(dest)
  return dest
}

function createMockFetch(baseContentByUrl) {
  return vi.fn(async (input) => {
    const url = String(input)
    const response = baseContentByUrl.get(url)

    if (!response) {
      return new Response('missing', { status: 404 })
    }

    return response
  })
}

function createReadmeResponse(label) {
  return new Response(`Tycho-2 ${label}\n`, { status: 200 })
}

function createGzipResponse(label) {
  return new Response(gzipSync(`record:${label}\n`), { status: 200 })
}

async function writeValidCachedFiles(dest, { includeExpanded = true, label = 'cache' } = {}) {
  await mkdir(path.join(dest, 'raw'), { recursive: true })
  await writeFile(path.join(dest, 'raw', 'ReadMe'), `Tycho-2 ${label}\n`)

  if (includeExpanded) {
    await mkdir(path.join(dest, 'expanded'), { recursive: true })
  }

  await Promise.all(
    ALL_REQUIRED_FILES.filter((fileName) => fileName.endsWith('.gz')).map(
      async (fileName) => {
        const rawBuffer = gzipSync(`record:${label}:${fileName}\n`)
        await writeFile(path.join(dest, 'raw', fileName), rawBuffer)

        if (includeExpanded) {
          await writeFile(
            path.join(dest, 'expanded', fileName.slice(0, -3)),
            `record:${label}:${fileName}\n`
          )
        }
      }
    )
  )
}

describe('scope-data downloader', () => {
  it('uses environment base URLs unless CLI overrides replace them in caller order', () => {
    const previousEnv = process.env.SKYLENS_SCOPE_SOURCE_BASE_URLS
    process.env.SKYLENS_SCOPE_SOURCE_BASE_URLS = `${BASE_TWO}, ${BASE_ONE}`

    try {
      expect(parseDownloadCommandArgs([]).baseUrls).toEqual([BASE_TWO, BASE_ONE])
      expect(
        parseDownloadCommandArgs([
          '--base-url',
          BASE_ONE,
          '--base-url',
          BASE_TWO,
        ]).baseUrls
      ).toEqual([BASE_ONE, BASE_TWO])
    } finally {
      if (previousEnv === undefined) {
        delete process.env.SKYLENS_SCOPE_SOURCE_BASE_URLS
      } else {
        process.env.SKYLENS_SCOPE_SOURCE_BASE_URLS = previousEnv
      }
    }
  })

  it('downloads pending files in caller-provided candidate order and falls back when needed', async () => {
    const dest = await createTempDest()
    const responseMap = new Map()

    for (const fileName of ALL_REQUIRED_FILES) {
      if (fileName === 'ReadMe') {
        responseMap.set(`${BASE_ONE}${fileName}`, createReadmeResponse('base-one'))
        continue
      }

      if (Number(fileName.slice(9, 11)) % 2 === 1) {
        responseMap.set(`${BASE_ONE}${fileName}`, createGzipResponse(`base-one:${fileName}`))
      } else {
        responseMap.set(`${BASE_TWO}${fileName}`, createGzipResponse(`base-two:${fileName}`))
      }
    }

    const fetchMock = createMockFetch(responseMap)
    const result = await downloadScopeSource({
      baseUrls: [BASE_ONE, BASE_TWO],
      dest,
      force: false,
      expand: true,
      timeoutMs: 1_000,
      fetchImpl: fetchMock,
    })

    expect(result.success).toBe(true)
    expect(result.finalCandidateUsed).toBe(BASE_TWO)
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      ...ALL_REQUIRED_FILES.map((fileName) => `${BASE_ONE}${fileName}`),
      ...ALL_REQUIRED_FILES
        .filter((fileName) => fileName.endsWith('.gz') && Number(fileName.slice(9, 11)) % 2 === 0)
        .map((fileName) => `${BASE_TWO}${fileName}`),
    ])
    expect(formatScopeSourceDownloadSummary(result)).toContain(`Final candidate used: ${BASE_TWO}`)
    expect((await readFile(path.join(dest, 'raw', 'tyc2.dat.00.gz'))).length).toBeGreaterThan(0)
    expect(
      await readFile(path.join(dest, 'expanded', 'tyc2.dat.00'), 'utf8')
    ).toContain('record:base-two:tyc2.dat.00.gz')
  })

  it('skips already valid cached files when not forced', async () => {
    const dest = await createTempDest()
    await writeValidCachedFiles(dest)

    const fetchMock = vi.fn()
    const result = await downloadScopeSource({
      baseUrls: [BASE_ONE],
      dest,
      force: false,
      expand: true,
      timeoutMs: 1_000,
      fetchImpl: fetchMock,
    })

    expect(result.files.every((entry) => entry.status === 'skipped')).toBe(true)
    expect(result.finalCandidateUsed).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('re-downloads valid cached files when forced', async () => {
    const dest = await createTempDest()
    await writeValidCachedFiles(dest, { label: 'stale' })

    const responseMap = new Map(
      ALL_REQUIRED_FILES.map((fileName) => [
        `${BASE_ONE}${fileName}`,
        fileName === 'ReadMe'
          ? createReadmeResponse('fresh')
          : createGzipResponse(`fresh:${fileName}`),
      ])
    )
    const fetchMock = createMockFetch(responseMap)

    const result = await downloadScopeSource({
      baseUrls: [BASE_ONE],
      dest,
      force: true,
      expand: true,
      timeoutMs: 1_000,
      fetchImpl: fetchMock,
    })

    expect(fetchMock).toHaveBeenCalledTimes(ALL_REQUIRED_FILES.length)
    expect(result.files.find((entry) => entry.fileName === 'ReadMe')?.status).toBe('downloaded')
    expect(
      await readFile(path.join(dest, 'expanded', 'tyc2.dat.00'), 'utf8')
    ).toContain('record:fresh:tyc2.dat.00.gz')
  })

  it('expands cached gzip files locally without re-downloading when raw cache is already valid', async () => {
    const dest = await createTempDest()
    await writeValidCachedFiles(dest, { includeExpanded: false, label: 'cache-only' })

    const fetchMock = vi.fn()
    const result = await downloadScopeSource({
      baseUrls: [BASE_ONE],
      dest,
      force: false,
      expand: true,
      timeoutMs: 1_000,
      fetchImpl: fetchMock,
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.files.find((entry) => entry.fileName === 'ReadMe')?.status).toBe('skipped')
    expect(
      result.files
        .filter((entry) => entry.fileName.endsWith('.gz'))
        .every((entry) => entry.status === 'expanded-from-cache')
    ).toBe(true)
    expect(
      await readFile(path.join(dest, 'expanded', 'tyc2.dat.19'), 'utf8')
    ).toContain('record:cache-only:tyc2.dat.19.gz')
  })

  it('fails when any required file remains missing after all candidates are exhausted', async () => {
    const dest = await createTempDest()
    const responseMap = new Map(
      ALL_REQUIRED_FILES
        .filter((fileName) => fileName !== 'tyc2.dat.19.gz')
        .map((fileName) => [
          `${BASE_ONE}${fileName}`,
          fileName === 'ReadMe'
            ? createReadmeResponse('partial')
            : createGzipResponse(`partial:${fileName}`),
        ])
    )
    const fetchMock = createMockFetch(responseMap)

    const failure = await downloadScopeSource({
      baseUrls: [BASE_ONE],
      dest,
      force: false,
      expand: true,
      timeoutMs: 1_000,
      fetchImpl: fetchMock,
    }).catch((error) => error)

    expect(failure).toBeInstanceOf(ScopeSourceDownloadError)
    expect(failure.result.missingFiles).toEqual(['tyc2.dat.19.gz'])
    expect(failure.summaryText).toContain('tyc2.dat.19.gz: failed')
    expect(fetchMock).toHaveBeenCalledTimes(ALL_REQUIRED_FILES.length)
  })
})
