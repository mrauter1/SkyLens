import { getPublicConfig, type PublicConfig } from '../config'
import type {
  ScopeBandDefinition,
  ScopeBandIndex,
  ScopeCatalogManifest,
  ScopeDecodedTileRow,
  ScopeNameTable,
} from './contracts'
import {
  decodeScopeTileRows,
  isScopeBandIndex,
  isScopeManifest,
  isScopeNameTable,
} from './decode'

type ScopeFetch = typeof fetch
type ScopeDataConfig = PublicConfig['scopeData']
type ScopeCatalogSource = {
  id: 'remote' | 'local'
  root: string
}

const manifestPromises = new Map<string, Promise<ScopeCatalogManifest>>()
const manifestCache = new Map<string, ScopeCatalogManifest>()
const namesPromises = new Map<string, Promise<ScopeNameTable>>()
const namesCache = new Map<string, ScopeNameTable>()
const bandIndexPromises = new Map<string, Promise<ScopeBandIndex>>()
const bandIndexCache = new Map<string, ScopeBandIndex>()
const tilePromises = new Map<string, Promise<ScopeDecodedTileRow[]>>()
const tileCache = new Map<string, ScopeDecodedTileRow[]>()

export function resolveScopeCatalogUrl(relativePath: string, sourceRoot: string) {
  return `${sourceRoot.replace(/\/+$/u, '')}/${relativePath.replace(/^\/+/u, '')}`
}

export function resolveScopeCatalogSources(
  scopeData: ScopeDataConfig = getPublicConfig().scopeData,
): ScopeCatalogSource[] {
  const sources: ScopeCatalogSource[] = []

  if (scopeData.remoteEnabled && scopeData.remoteBaseUrl) {
    sources.push({
      id: 'remote',
      root: scopeData.remoteBaseUrl,
    })
  }

  sources.push({
    id: 'local',
    root: scopeData.localBasePath,
  })

  return sources
}

export async function loadScopeManifest(
  fetcher: ScopeFetch = fetch,
  scopeData: ScopeDataConfig = getPublicConfig().scopeData,
) {
  let lastError: unknown = null

  for (const source of resolveScopeCatalogSources(scopeData)) {
    const cached = manifestCache.get(source.root)

    if (cached) {
      return cached
    }

    let pending = manifestPromises.get(source.root)

    if (!pending) {
      pending = (async () => {
        const manifest = await fetchScopeJson(resolveScopeCatalogUrl('manifest.json', source.root), fetcher)

        if (!isScopeManifest(manifest)) {
          throw new Error('scope-manifest-invalid')
        }

        manifestCache.set(source.root, manifest)
        return manifest
      })().catch((error) => {
        manifestPromises.delete(source.root)
        throw error
      })
      manifestPromises.set(source.root, pending)
    }

    try {
      return await pending
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('scope-manifest-unavailable')
}

export async function loadScopeNamesTable(
  manifest: ScopeCatalogManifest,
  fetcher: ScopeFetch = fetch,
  scopeData: ScopeDataConfig = getPublicConfig().scopeData,
) {
  let lastError: unknown = null

  for (const source of resolveScopeCatalogSources(scopeData)) {
    const cached = namesCache.get(source.root)

    if (cached) {
      return cached
    }

    let pending = namesPromises.get(source.root)

    if (!pending) {
      pending = (async () => {
        const table = await fetchScopeJson(resolveScopeCatalogUrl(manifest.namesPath, source.root), fetcher)

        if (!isScopeNameTable(table)) {
          throw new Error('scope-names-invalid')
        }

        namesCache.set(source.root, table)
        return table
      })().catch((error) => {
        namesPromises.delete(source.root)
        throw error
      })
      namesPromises.set(source.root, pending)
    }

    try {
      return await pending
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('scope-names-unavailable')
}

export async function loadScopeBandIndex(
  manifest: ScopeCatalogManifest,
  bandDir: ScopeBandDefinition['bandDir'],
  fetcher: ScopeFetch = fetch,
  scopeData: ScopeDataConfig = getPublicConfig().scopeData,
) {
  const band = manifest.bands.find((candidate) => candidate.bandDir === bandDir)

  if (!band) {
    throw new Error(`scope-band-missing:${bandDir}`)
  }

  let lastError: unknown = null

  for (const source of resolveScopeCatalogSources(scopeData)) {
    const cacheKey = `${source.root}:${bandDir}`
    const cached = bandIndexCache.get(cacheKey)

    if (cached) {
      return cached
    }

    let pending = bandIndexPromises.get(cacheKey)

    if (!pending) {
      pending = (async () => {
        const index = await fetchScopeJson(resolveScopeCatalogUrl(band.indexPath, source.root), fetcher)

        if (!isScopeBandIndex(index)) {
          throw new Error(`scope-band-index-invalid:${bandDir}`)
        }

        bandIndexCache.set(cacheKey, index)
        return index
      })().catch((error) => {
        bandIndexPromises.delete(cacheKey)
        throw error
      })
      bandIndexPromises.set(cacheKey, pending)
    }

    try {
      return await pending
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`scope-band-index-unavailable:${bandDir}`)
}

export async function loadScopeTileRows(
  bandDir: ScopeBandDefinition['bandDir'],
  tileFile: string,
  fetcher: ScopeFetch = fetch,
  scopeData: ScopeDataConfig = getPublicConfig().scopeData,
) {
  let lastError: unknown = null

  for (const source of resolveScopeCatalogSources(scopeData)) {
    const cacheKey = `${source.root}:${bandDir}:${tileFile}`
    const cached = tileCache.get(cacheKey)

    if (cached) {
      return cached
    }

    let pending = tilePromises.get(cacheKey)

    if (!pending) {
      pending = (async () => {
        const response = await fetcher(resolveScopeCatalogUrl(`${bandDir}/${tileFile}`, source.root))

        if (!response.ok) {
          throw new Error(`scope-fetch-failed:${bandDir}/${tileFile}`)
        }

        const rows = decodeScopeTileRows(await response.arrayBuffer())
        tileCache.set(cacheKey, rows)
        return rows
      })().catch((error) => {
        tilePromises.delete(cacheKey)
        throw error
      })
      tilePromises.set(cacheKey, pending)
    }

    try {
      return await pending
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`scope-tile-unavailable:${bandDir}/${tileFile}`)
}

export function createScopeRequestTracker() {
  let latestGeneration = 0

  return {
    begin() {
      latestGeneration += 1
      return latestGeneration
    },
    invalidate() {
      latestGeneration += 1
    },
    isCurrent(generation: number) {
      return generation === latestGeneration
    },
  }
}

export function resetScopeCatalogSessionCacheForTests() {
  manifestPromises.clear()
  manifestCache.clear()
  namesPromises.clear()
  namesCache.clear()
  bandIndexPromises.clear()
  bandIndexCache.clear()
  tilePromises.clear()
  tileCache.clear()
}

async function fetchScopeJson(url: string, fetcher: ScopeFetch) {
  const response = await fetcher(url)

  if (!response.ok) {
    throw new Error(`scope-fetch-failed:${url}`)
  }

  return response.json()
}
