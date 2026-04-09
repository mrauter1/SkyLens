import { describe, expect, it } from 'vitest'

import {
  createAircraftTracker,
  DROP_AFTER_MS,
} from '../../lib/aircraft/tracker'
import type { AircraftApiResponse } from '../../lib/aircraft/contracts'

const OBSERVER: AircraftApiResponse['observer'] = {
  lat: 0,
  lon: 0,
  altMeters: 0,
}

describe('aircraft tracker', () => {
  it('predicts straight-line motion between polls', () => {
    const tracker = createAircraftTracker()

    tracker.ingest(
      createSnapshot(0, [
        createAircraft({
          id: 'icao24-alpha1',
          lat: 0,
          lon: 0,
          geoAltitudeM: 1000,
          velocityMps: 200,
          trackDeg: 90,
        }),
      ]),
    )

    const [resolved] = tracker.resolve({
      observer: OBSERVER,
      nowMs: 5_000,
    })

    expect(resolved.motionState).toBe('estimated')
    expect(resolved.lon).toBeGreaterThan(0.008)
    expect(resolved.trackDeg).toBeCloseTo(90, 1)
  })

  it('falls back to observed motion when reported kinematics are missing', () => {
    const tracker = createAircraftTracker()

    tracker.ingest(
      createSnapshot(0, [
        createAircraft({
          id: 'icao24-obsvd1',
          lat: 0,
          lon: 0,
          geoAltitudeM: 1000,
        }),
      ]),
    )
    tracker.ingest(
      createSnapshot(10, [
        createAircraft({
          id: 'icao24-obsvd1',
          lat: 0,
          lon: 0.01,
          geoAltitudeM: 1000,
        }),
      ]),
    )

    const [resolved] = tracker.resolve({
      observer: OBSERVER,
      nowMs: 15_000,
    })

    expect(resolved.motionState).toBe('estimated')
    expect(resolved.lon).toBeGreaterThan(0.01)
    expect(resolved.velocityMps ?? 0).toBeGreaterThan(0)
  })

  it('enters turn mode after sustained turn rates and exits after sustained straight segments', () => {
    const tracker = createAircraftTracker()

    for (const sample of [
      { timeS: 0, lat: 0, lon: 0 },
      { timeS: 10, lat: 0.009, lon: 0 },
      { timeS: 20, lat: 0.016, lon: 0.005 },
      { timeS: 30, lat: 0.019, lon: 0.015 },
    ]) {
      tracker.ingest(
        createSnapshot(sample.timeS, [
          createAircraft({
            id: 'icao24-turn01',
            lat: sample.lat,
            lon: sample.lon,
            geoAltitudeM: 1000,
          }),
        ]),
      )
    }

    const turningTrail = tracker.getTrail({
      id: 'icao24-turn01',
      observer: OBSERVER,
      nowMs: 35_000,
    })
    const turningHeadings = getSegmentHeadings(turningTrail.slice(-4))

    expect(turningHeadings[turningHeadings.length - 1]).not.toBeCloseTo(
      turningHeadings[0],
      1,
    )

    for (const sample of [
      { timeS: 40, lat: 0.022, lon: 0.02 },
      { timeS: 50, lat: 0.022, lon: 0.03 },
      { timeS: 60, lat: 0.022, lon: 0.04 },
    ]) {
      tracker.ingest(
        createSnapshot(sample.timeS, [
          createAircraft({
            id: 'icao24-turn01',
            lat: sample.lat,
            lon: sample.lon,
            geoAltitudeM: 1000,
          }),
        ]),
      )
    }

    const straightTrail = tracker.getTrail({
      id: 'icao24-turn01',
      observer: OBSERVER,
      nowMs: 65_000,
    })
    const straightHeadings = getSegmentHeadings(straightTrail.slice(-4))
    const straightHeadingSpread =
      Math.max(...straightHeadings) - Math.min(...straightHeadings)

    expect(straightHeadingSpread).toBeLessThan(3)
  })

  it('does not enter turn mode from a single sharp interval followed by straight motion', () => {
    const tracker = createAircraftTracker()

    for (const sample of [
      { timeS: 0, lat: 0, lon: 0 },
      { timeS: 10, lat: 0.009, lon: 0 },
      { timeS: 20, lat: 0.016, lon: 0.007 },
      { timeS: 30, lat: 0.016, lon: 0.017 },
      { timeS: 40, lat: 0.016, lon: 0.027 },
    ]) {
      tracker.ingest(
        createSnapshot(sample.timeS, [
          createAircraft({
            id: 'icao24-turn02',
            lat: sample.lat,
            lon: sample.lon,
            geoAltitudeM: 1000,
          }),
        ]),
      )
    }

    const trail = tracker.getTrail({
      id: 'icao24-turn02',
      observer: OBSERVER,
      nowMs: 45_000,
    })
    const recentHeadings = getSegmentHeadings(trail.slice(-4))
    const recentHeadingSpread = Math.max(...recentHeadings) - Math.min(...recentHeadings)

    expect(recentHeadingSpread).toBeLessThan(3)
  })

  it('fades stale aircraft and prunes dropped tracks', () => {
    const tracker = createAircraftTracker()

    tracker.ingest(
      createSnapshot(0, [
        createAircraft({
          id: 'icao24-stale1',
          lat: 0,
          lon: 0.01,
          geoAltitudeM: 1000,
          velocityMps: 200,
          trackDeg: 90,
        }),
      ]),
    )

    const [stale] = tracker.resolve({
      observer: OBSERVER,
      nowMs: 25_000,
    })

    expect(stale.motionState).toBe('stale')
    expect(stale.motionOpacity).toBeCloseTo(0.5, 2)

    tracker.prune(DROP_AFTER_MS + 1_000)

    expect(
      tracker.resolve({
        observer: OBSERVER,
        nowMs: DROP_AFTER_MS + 1_000,
      }),
    ).toEqual([])
  })

  it('returns curved trail samples for turning aircraft', () => {
    const tracker = createAircraftTracker()

    for (const sample of [
      { timeS: 0, lat: 0, lon: 0 },
      { timeS: 10, lat: 0.009, lon: 0 },
      { timeS: 20, lat: 0.016, lon: 0.005 },
      { timeS: 30, lat: 0.019, lon: 0.015 },
    ]) {
      tracker.ingest(
        createSnapshot(sample.timeS, [
          createAircraft({
            id: 'icao24-curve1',
            lat: sample.lat,
            lon: sample.lon,
            geoAltitudeM: 1000,
          }),
        ]),
      )
    }

    const trail = tracker.getTrail({
      id: 'icao24-curve1',
      observer: OBSERVER,
      nowMs: 35_000,
    })
    const headings = getSegmentHeadings(trail.slice(-5))

    expect(trail.length).toBeGreaterThanOrEqual(4)
    expect(Math.max(...headings) - Math.min(...headings)).toBeGreaterThan(5)
  })

  it('keeps tracks visible across a missed poll before fading them out', () => {
    const tracker = createAircraftTracker()

    tracker.ingest(
      createSnapshot(0, [
        createAircraft({
          id: 'icao24-miss01',
          lat: 0,
          lon: 0,
          geoAltitudeM: 1000,
          velocityMps: 180,
          trackDeg: 45,
        }),
      ]),
    )

    const [estimated] = tracker.resolve({
      observer: OBSERVER,
      nowMs: 12_000,
    })
    const [stale] = tracker.resolve({
      observer: OBSERVER,
      nowMs: 29_000,
    })

    expect(estimated.motionState).toBe('estimated')
    expect(stale.motionState).toBe('stale')
    expect(stale.motionOpacity).toBeGreaterThan(0)
  })
})

function createSnapshot(
  snapshotTimeS: number,
  aircraft: AircraftApiResponse['aircraft'],
): AircraftApiResponse {
  return {
    fetchedAt: new Date(snapshotTimeS * 1_000).toISOString(),
    snapshotTimeS,
    observer: OBSERVER,
    availability: 'available',
    aircraft,
  }
}

function createAircraft(
  overrides: Partial<AircraftApiResponse['aircraft'][number]> & { id: string; lat: number; lon: number },
): AircraftApiResponse['aircraft'][number] {
  const { id, lat, lon, ...rest } = overrides

  return {
    ...rest,
    id,
    lat,
    lon,
    geoAltitudeM: rest.geoAltitudeM ?? 1000,
    azimuthDeg: rest.azimuthDeg ?? 0,
    elevationDeg: rest.elevationDeg ?? 15,
    rangeKm: rest.rangeKm ?? 10,
  }
}

function getSegmentHeadings(points: Array<{ lat: number; lon: number }>) {
  const headings: number[] = []

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const next = points[index]
    const east = next.lon - previous.lon
    const north = next.lat - previous.lat

    headings.push((Math.atan2(east, north) * 180) / Math.PI)
  }

  return headings
}
