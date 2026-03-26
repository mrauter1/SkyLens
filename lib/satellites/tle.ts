import { z } from 'zod'

import { createMemoryCache, type CacheEntry } from '../cache'
import type { CacheHealth } from '../health/contracts'
import type { SatelliteGroupId, TleApiResponse, TleSatellite } from './contracts'
import { TleApiResponseSchema, TleSatelliteSchema } from './contracts'

const TLE_CACHE_KEY = 'tle:catalog'
const REFRESH_WINDOW_MS = 6 * 60 * 60 * 1000
const STALE_WINDOW_MS = 24 * 60 * 60 * 1000
const ISS_NORAD_ID = 25544

const tleCache = createMemoryCache<{ satellites: TleSatellite[] }>()

const TleRecordSchema = z.object({
  name: z.string().min(1),
  tle1: z.string().min(1),
  tle2: z.string().min(1),
})

const TLE_GROUP_SOURCES: ReadonlyArray<{
  groupId: SatelliteGroupId
  url: string
}> = [
  {
    groupId: 'iss',
    url: 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=tle',
  },
  {
    groupId: 'stations',
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle',
  },
  {
    groupId: 'brightest',
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle',
  },
] as const

export async function getTleApiResponse(
  fetchImpl: typeof fetch = fetch,
  now = new Date(),
): Promise<TleApiResponse> {
  const cachedEntry = tleCache.get(TLE_CACHE_KEY)

  if (cachedEntry && Date.parse(cachedEntry.expiresAt) > now.getTime()) {
    return TleApiResponseSchema.parse({
      fetchedAt: cachedEntry.fetchedAt,
      expiresAt: cachedEntry.expiresAt,
      satellites: cachedEntry.value.satellites,
    })
  }

  try {
    const satellites = await fetchSatelliteCatalog(fetchImpl)
    const entry = createFreshEntry(satellites, now)

    tleCache.set(TLE_CACHE_KEY, entry)

    return TleApiResponseSchema.parse({
      fetchedAt: entry.fetchedAt,
      expiresAt: entry.expiresAt,
      satellites: entry.value.satellites,
    })
  } catch {
    if (cachedEntry && isWithinStaleWindow(cachedEntry, now)) {
      return TleApiResponseSchema.parse({
        fetchedAt: cachedEntry.fetchedAt,
        expiresAt: cachedEntry.expiresAt,
        stale: true,
        satellites: cachedEntry.value.satellites,
      })
    }

    throw new Error('TLE data unavailable.')
  }
}

export function resetTleCacheForTests() {
  tleCache.clear()
}

export function getTleCacheHealth(now = new Date()): CacheHealth {
  const cachedEntry = tleCache.get(TLE_CACHE_KEY)

  if (!cachedEntry) {
    return {
      status: 'empty',
    }
  }

  if (Date.parse(cachedEntry.expiresAt) > now.getTime()) {
    return {
      status: 'fresh',
      fetchedAt: cachedEntry.fetchedAt,
      expiresAt: cachedEntry.expiresAt,
    }
  }

  if (isWithinStaleWindow(cachedEntry, now)) {
    return {
      status: 'stale',
      fetchedAt: cachedEntry.fetchedAt,
      expiresAt: cachedEntry.expiresAt,
    }
  }

  return {
    status: 'expired',
    fetchedAt: cachedEntry.fetchedAt,
    expiresAt: cachedEntry.expiresAt,
  }
}

async function fetchSatelliteCatalog(fetchImpl: typeof fetch) {
  const groupResponses = await Promise.all(
    TLE_GROUP_SOURCES.map(async ({ groupId, url }) => {
      const response = await fetchImpl(url, {
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(`TLE upstream failed for ${groupId}.`)
      }

      const text = await response.text()

      return parseTleGroup(text, groupId)
    }),
  )

  return deduplicateSatellites(groupResponses.flat())
}

function parseTleGroup(text: string, groupId: SatelliteGroupId) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)

  if (lines.length === 0 || lines.length % 3 !== 0) {
    throw new Error(`Unexpected TLE record count for ${groupId}.`)
  }

  const satellites: TleSatellite[] = []

  for (let index = 0; index < lines.length; index += 3) {
    const record = TleRecordSchema.parse({
      name: lines[index]?.trim(),
      tle1: lines[index + 1]?.trim(),
      tle2: lines[index + 2]?.trim(),
    })

    const noradId = extractNoradId(record.tle1, record.tle2)

    satellites.push(
      TleSatelliteSchema.parse({
        id: String(noradId),
        name: record.name,
        noradId,
        groups: [groupId],
        tle1: record.tle1,
        tle2: record.tle2,
        isIss: noradId === ISS_NORAD_ID,
      }),
    )
  }

  return satellites
}

function extractNoradId(tle1: string, tle2: string) {
  const line1Match = /^1\s+(\d{1,5})/.exec(tle1)
  const line2Match = /^2\s+(\d{1,5})/.exec(tle2)

  if (!line1Match || !line2Match) {
    throw new Error('Malformed TLE line.')
  }

  if (line1Match[1] !== line2Match[1]) {
    throw new Error('Mismatched NORAD ids in TLE lines.')
  }

  return Number.parseInt(line1Match[1], 10)
}

function deduplicateSatellites(satellites: readonly TleSatellite[]) {
  const entries = new Map<number, TleSatellite>()

  for (const satellite of satellites) {
    const existing = entries.get(satellite.noradId)

    if (!existing) {
      entries.set(satellite.noradId, satellite)
      continue
    }

    const groups = Array.from(new Set([...existing.groups, ...satellite.groups]))

    entries.set(satellite.noradId, {
      ...existing,
      groups,
      isIss: existing.isIss || satellite.isIss,
    })
  }

  return Array.from(entries.values()).sort((left, right) => left.noradId - right.noradId)
}

function createFreshEntry(
  satellites: TleSatellite[],
  now: Date,
): CacheEntry<{ satellites: TleSatellite[] }> {
  return {
    value: {
      satellites,
    },
    fetchedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + REFRESH_WINDOW_MS).toISOString(),
  }
}

function isWithinStaleWindow(
  entry: CacheEntry<{ satellites: TleSatellite[] }>,
  now: Date,
) {
  return now.getTime() <= Date.parse(entry.expiresAt) + STALE_WINDOW_MS
}
