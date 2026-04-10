import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createAircraftTracker } from '../../lib/aircraft/tracker'
import type { AircraftApiResponse } from '../../lib/aircraft/contracts'
import type { ObserverState } from '../../lib/viewer/contracts'
import {
  resolveAircraftMotionObjects,
  resolveMovingSkyObjects,
  resolveSatelliteMotionObjects,
} from '../../lib/viewer/motion'

const ENABLED_LAYERS = {
  aircraft: true,
  satellites: true,
  planets: true,
  stars: true,
  constellations: true,
} as const

const stationsFixture = readFixture('stations.txt')

describe('viewer motion', () => {
  it('keeps the local satellite wrapper pinned to browser-safe dist entrypoints', () => {
    const wrapperSource = readFileSync(join(process.cwd(), 'lib/vendor/satellite.ts'), 'utf8')

    expect(wrapperSource).not.toContain("from 'satellite.js'")
    expect(wrapperSource).toContain("../../node_modules/satellite.js/dist/transforms.js")
    expect(wrapperSource).toContain("../../node_modules/satellite.js/dist/propagation.js")
    expect(wrapperSource).toContain("../../node_modules/satellite.js/dist/io.js")
    expect(wrapperSource).toContain("../../node_modules/satellite.js/dist/propagation/SatRec.js")
  })

  it('resolves tracker-driven aircraft with estimated motion metadata', () => {
    const tracker = createAircraftTracker()

    tracker.ingest(
      createAircraftResponse(
        '2026-03-26T00:00:00.000Z',
        [
          {
            id: 'icao24-est001',
            callsign: 'EST001',
            lat: 0,
            lon: 0,
            geoAltitudeM: 1000,
            velocityMps: 250,
            trackDeg: 90,
            verticalRateMps: 0,
            azimuthDeg: 0,
            elevationDeg: 45,
            rangeKm: 1.4,
          },
        ],
        {
          lat: 0,
          lon: 0,
          altMeters: 0,
        },
      ),
    )

    const [resolved] = resolveAircraftMotionObjects({
      tracker,
      timeMs: Date.parse('2026-03-26T00:00:04.000Z'),
      observer: {
        lat: 0,
        lon: 0,
        altMeters: 0,
      },
      enabledLayers: ENABLED_LAYERS,
    })

    expect(resolved.motionState).toBe('estimated')
    expect(resolved.confidence).toBe(1)
    expect(resolved.object.metadata).toMatchObject({
      motionState: 'estimated',
      motionOpacity: 1,
    })
  })

  it('uses deterministic satellite propagation with propagated confidence semantics', () => {
    const observer: ObserverState = {
      lat: 35.6762,
      lon: 139.6503,
      altMeters: 40,
      accuracyMeters: 1,
      timestampMs: Date.UTC(2026, 2, 26, 4, 10, 0),
      source: 'demo',
    }

    const [resolved] = resolveSatelliteMotionObjects({
      catalog: {
        fetchedAt: '2026-03-26T00:00:00.000Z',
        expiresAt: '2026-03-26T06:00:00.000Z',
        satellites: [buildFixtureSatellite(stationsFixture, 'stations', 0)],
      },
      observer,
      timeMs: observer.timestampMs,
      enabledLayers: ENABLED_LAYERS,
      likelyVisibleOnly: false,
      sunAltitudeDeg: -12,
    })

    expect(resolved.motionState).toBe('propagated')
    expect(resolved.confidence).toBe(1)
    expect(resolved.object).toMatchObject({
      id: '25544',
      label: 'ISS (ZARYA)',
      metadata: {
        detail: {
          noradId: 25544,
          isIss: true,
        },
      },
    })
  })

  it('resolves aircraft and satellites through the shared motion pipeline', () => {
    const observer: ObserverState = {
      lat: 35.6762,
      lon: 139.6503,
      altMeters: 40,
      accuracyMeters: 1,
      timestampMs: Date.parse('2026-03-26T04:10:05.000Z'),
      source: 'demo',
    }
    const tracker = createAircraftTracker()

    tracker.ingest(
      createAircraftResponse(
        '2026-03-26T04:10:00.000Z',
        [
          {
            id: 'icao24-alpha1',
            callsign: 'ALPHA1',
            lat: 35.71,
            lon: 139.68,
            geoAltitudeM: 5100,
            azimuthDeg: 18,
            elevationDeg: 28,
            rangeKm: 15.2,
          },
        ],
        {
          lat: observer.lat,
          lon: observer.lon,
          altMeters: observer.altMeters,
        },
      ),
    )

    const resolved = resolveMovingSkyObjects({
      observer,
      timeMs: observer.timestampMs,
      enabledLayers: ENABLED_LAYERS,
      likelyVisibleOnly: false,
      sunAltitudeDeg: -12,
      aircraftTracker: tracker,
      satelliteCatalog: {
        fetchedAt: '2026-03-26T00:00:00.000Z',
        expiresAt: '2026-03-26T06:00:00.000Z',
        satellites: [buildFixtureSatellite(stationsFixture, 'stations', 0)],
      },
    })

    expect(resolved.aircraft.map((object) => object.id)).toEqual(['icao24-alpha1'])
    expect(resolved.satellites.map((object) => object.id)).toEqual(['25544'])
  })
})

function readFixture(fileName: string) {
  return readFileSync(join(process.cwd(), 'tests/fixtures/tle', fileName), 'utf8').trim()
}

function buildFixtureSatellite(
  fixture: string,
  group: 'stations' | 'brightest',
  index: number,
) {
  const lines = fixture.split(/\r?\n/)
  const offset = index * 3
  const tle1 = lines[offset + 1]
  const noradId = Number.parseInt(tle1.trim().split(/\s+/)[1], 10)

  return {
    id: String(noradId),
    name: lines[offset].trim(),
    noradId,
    groups: [group],
    tle1: lines[offset + 1].trim(),
    tle2: lines[offset + 2].trim(),
    isIss: noradId === 25544,
  }
}

function createAircraftResponse(
  fetchedAt: string,
  aircraft: AircraftApiResponse['aircraft'],
  observer: AircraftApiResponse['observer'] = {
    lat: 37.7749,
    lon: -122.4194,
    altMeters: 15,
  },
): AircraftApiResponse {
  return {
    fetchedAt,
    snapshotTimeS: Math.floor(Date.parse(fetchedAt) / 1_000),
    observer,
    availability: 'available',
    aircraft,
  }
}
