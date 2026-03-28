import type { AircraftApiResponse } from '../aircraft/contracts'
import type { TleApiResponse } from '../satellites/contracts'
import type { ObserverState } from '../viewer/contracts'

export type DemoScenarioId = 'sf-evening' | 'ny-day' | 'tokyo-iss'

export interface DemoScenario {
  id: DemoScenarioId
  label: string
  description: string
  observer: ObserverState
  initialPitchDeg: number
  aircraftSnapshot: AircraftApiResponse
  satelliteCatalog: TleApiResponse | null
}

export const DEFAULT_DEMO_SCENARIO_ID: DemoScenarioId = 'sf-evening'

const SF_EVENING_OBSERVER: ObserverState = {
  lat: 37.7749,
  lon: -122.4194,
  altMeters: 16,
  accuracyMeters: 8,
  timestampMs: 1774483200000,
  source: 'demo',
}

const NY_DAY_OBSERVER: ObserverState = {
  lat: 40.7128,
  lon: -74.006,
  altMeters: 10,
  accuracyMeters: 8,
  timestampMs: 1774526400000,
  source: 'demo',
}

const TOKYO_ISS_OBSERVER: ObserverState = {
  lat: 35.6762,
  lon: 139.6503,
  altMeters: 40,
  accuracyMeters: 1,
  timestampMs: Date.UTC(2026, 2, 26, 4, 10, 0),
  source: 'demo',
}

const TOKYO_STATIONS_CATALOG: TleApiResponse = {
  fetchedAt: '2026-03-26T00:00:00.000Z',
  expiresAt: '2026-03-26T06:00:00.000Z',
  satellites: [
    {
      id: '25544',
      name: 'ISS (ZARYA)',
      noradId: 25544,
      groups: ['iss', 'stations'],
      tle1: '1 25544U 98067A   26084.84151545  .00012012  00000+0  22938-3 0  9995',
      tle2: '2 25544  51.6341 352.5134 0006235 232.7336 127.3084 15.48540672558833',
      isIss: true,
    },
    {
      id: '36086',
      name: 'POISK',
      noradId: 36086,
      groups: ['stations'],
      tle1: '1 36086U 09060A   26084.84151545  .00012012  00000+0  22938-3 0  9993',
      tle2: '2 36086  51.6341 352.5134 0006235 232.7336 127.3084 15.48540672558612',
      isIss: false,
    },
    {
      id: '48274',
      name: 'CSS (TIANHE)',
      noradId: 48274,
      groups: ['stations'],
      tle1: '1 48274U 21035A   26084.83710235  .00022588  00000+0  25952-3 0  9995',
      tle2: '2 48274  41.4667 109.8475 0004448  22.3282 337.7750 15.61486977280138',
      isIss: false,
    },
  ],
}

function createAircraftSnapshot(
  observer: ObserverState,
  aircraft: AircraftApiResponse['aircraft'],
): AircraftApiResponse {
  return {
    fetchedAt: new Date(observer.timestampMs).toISOString(),
    snapshotTimeS: Math.floor(observer.timestampMs / 1000),
    observer: {
      lat: observer.lat,
      lon: observer.lon,
      altMeters: observer.altMeters,
    },
    availability: 'available',
    aircraft,
  }
}

export const DEMO_SCENARIOS: Record<DemoScenarioId, DemoScenario> = {
  'sf-evening': {
    id: 'sf-evening',
    label: 'San Francisco - Clear evening',
    description: 'Bundled dusk observer with bright planets, stars, and two seeded flights.',
    observer: SF_EVENING_OBSERVER,
    initialPitchDeg: 16,
    aircraftSnapshot: createAircraftSnapshot(SF_EVENING_OBSERVER, [
      {
        id: 'icao24-a1b2c3',
        callsign: 'UAL123',
        originCountry: 'United States',
        lat: 37.98,
        lon: -122.1,
        geoAltitudeM: 10668,
        baroAltitudeM: 10620,
        velocityMps: 240,
        trackDeg: 132,
        verticalRateMps: 0,
        azimuthDeg: 0,
        elevationDeg: 32,
        rangeKm: 31.8,
      },
      {
        id: 'icao24-d4e5f6',
        callsign: 'ACA902',
        originCountry: 'Canada',
        lat: 37.81,
        lon: -122.25,
        geoAltitudeM: 5100,
        baroAltitudeM: 5000,
        velocityMps: 200,
        trackDeg: 210,
        verticalRateMps: -3,
        azimuthDeg: 18,
        elevationDeg: 28,
        rangeKm: 15.2,
      },
    ]),
    satelliteCatalog: null,
  },
  'ny-day': {
    id: 'ny-day',
    label: 'New York - Busy daylight sky',
    description: 'Daytime demo with seeded aircraft and the daylight simplification rules active.',
    observer: NY_DAY_OBSERVER,
    initialPitchDeg: 10,
    aircraftSnapshot: createAircraftSnapshot(NY_DAY_OBSERVER, [
      {
        id: 'icao24-aa11bb',
        callsign: 'DAL451',
        originCountry: 'United States',
        lat: 40.91,
        lon: -73.76,
        geoAltitudeM: 9144,
        baroAltitudeM: 9000,
        velocityMps: 225,
        trackDeg: 205,
        verticalRateMps: 0,
        azimuthDeg: 47.8,
        elevationDeg: 12.6,
        rangeKm: 27.1,
      },
      {
        id: 'icao24-cc22dd',
        callsign: 'JBU220',
        originCountry: 'United States',
        lat: 40.63,
        lon: -73.77,
        geoAltitudeM: 3658,
        baroAltitudeM: 3500,
        velocityMps: 165,
        trackDeg: 58,
        verticalRateMps: 5,
        azimuthDeg: 118.3,
        elevationDeg: 6.9,
        rangeKm: 18.4,
      },
      {
        id: 'icao24-ee33ff',
        callsign: 'AAL100',
        originCountry: 'United States',
        lat: 40.84,
        lon: -74.18,
        geoAltitudeM: 7925,
        baroAltitudeM: 7800,
        velocityMps: 210,
        trackDeg: 12,
        verticalRateMps: -1,
        azimuthDeg: 311.5,
        elevationDeg: 14.2,
        rangeKm: 23.7,
      },
    ]),
    satelliteCatalog: null,
  },
  'tokyo-iss': {
    id: 'tokyo-iss',
    label: 'Tokyo - Night with ISS pass',
    description: 'Night sky bundle with a deterministic ISS pass and no live network dependency.',
    observer: TOKYO_ISS_OBSERVER,
    initialPitchDeg: 18,
    aircraftSnapshot: createAircraftSnapshot(TOKYO_ISS_OBSERVER, []),
    satelliteCatalog: TOKYO_STATIONS_CATALOG,
  },
}

export function getDemoScenario(id = DEFAULT_DEMO_SCENARIO_ID): DemoScenario {
  return DEMO_SCENARIOS[isDemoScenarioId(id) ? id : DEFAULT_DEMO_SCENARIO_ID]
}

export function listDemoScenarios(): DemoScenario[] {
  return [
    DEMO_SCENARIOS['sf-evening'],
    DEMO_SCENARIOS['ny-day'],
    DEMO_SCENARIOS['tokyo-iss'],
  ]
}

export function getDemoAircraftSnapshotAtTime(
  scenario: DemoScenario,
  timeMs: number,
): AircraftApiResponse {
  const baseSnapshot = scenario.aircraftSnapshot
  const effectiveTimeMs = Math.max(timeMs, baseSnapshot.snapshotTimeS * 1_000)

  return {
    fetchedAt: new Date(effectiveTimeMs).toISOString(),
    snapshotTimeS: Math.floor(effectiveTimeMs / 1_000),
    observer: baseSnapshot.observer,
    availability: baseSnapshot.availability,
    aircraft: baseSnapshot.aircraft.map((aircraft) =>
      projectDemoAircraft({
        aircraft,
        observer: baseSnapshot.observer,
        elapsedMs: effectiveTimeMs - baseSnapshot.snapshotTimeS * 1_000,
      }),
    ),
  }
}

export function isDemoScenarioId(value: string | null | undefined): value is DemoScenarioId {
  return value === 'sf-evening' || value === 'ny-day' || value === 'tokyo-iss'
}

function projectDemoAircraft({
  aircraft,
  observer,
  elapsedMs,
}: {
  aircraft: AircraftApiResponse['aircraft'][number]
  observer: AircraftApiResponse['observer']
  elapsedMs: number
}) {
  const elapsedSeconds = Math.max(0, elapsedMs) / 1_000
  const altitudeMeters = Math.max(
    0,
    (aircraft.geoAltitudeM ?? aircraft.baroAltitudeM ?? 0) +
      (aircraft.verticalRateMps ?? 0) * elapsedSeconds,
  )
  const projectedPosition =
    typeof aircraft.velocityMps === 'number' &&
    typeof aircraft.trackDeg === 'number' &&
    aircraft.velocityMps > 0
      ? projectPosition({
          lat: aircraft.lat,
          lon: aircraft.lon,
          trackDeg: aircraft.trackDeg,
          distanceMeters: aircraft.velocityMps * elapsedSeconds,
        })
      : { lat: aircraft.lat, lon: aircraft.lon }
  const relativePose = getRelativePose({
    observer,
    aircraftLat: projectedPosition.lat,
    aircraftLon: projectedPosition.lon,
    altitudeMeters,
  })

  return {
    ...aircraft,
    lat: roundCoordinate(projectedPosition.lat),
    lon: roundCoordinate(projectedPosition.lon),
    ...(typeof aircraft.geoAltitudeM === 'number' ? { geoAltitudeM: Math.round(altitudeMeters) } : {}),
    ...(typeof aircraft.baroAltitudeM === 'number' ? { baroAltitudeM: Math.round(altitudeMeters) } : {}),
    azimuthDeg: roundAngle(relativePose.azimuthDeg),
    elevationDeg: roundAngle(relativePose.elevationDeg),
    rangeKm: roundRange(relativePose.rangeKm),
  }
}

function getRelativePose({
  observer,
  aircraftLat,
  aircraftLon,
  altitudeMeters,
}: {
  observer: AircraftApiResponse['observer']
  aircraftLat: number
  aircraftLon: number
  altitudeMeters: number
}) {
  const surfaceDistanceMeters = getSurfaceDistanceMeters(
    { lat: observer.lat, lon: observer.lon },
    { lat: aircraftLat, lon: aircraftLon },
  )
  const altitudeDeltaMeters = altitudeMeters - observer.altMeters

  return {
    azimuthDeg: getBearingDeg(observer, { lat: aircraftLat, lon: aircraftLon }),
    elevationDeg: radiansToDegrees(Math.atan2(altitudeDeltaMeters, surfaceDistanceMeters)),
    rangeKm: Math.sqrt(surfaceDistanceMeters ** 2 + altitudeDeltaMeters ** 2) / 1_000,
  }
}

function projectPosition({
  lat,
  lon,
  trackDeg,
  distanceMeters,
}: {
  lat: number
  lon: number
  trackDeg: number
  distanceMeters: number
}) {
  const angularDistance = distanceMeters / 6_371_000
  const headingRad = degreesToRadians(trackDeg)
  const latRad = degreesToRadians(lat)
  const lonRad = degreesToRadians(lon)
  const nextLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(headingRad),
  )
  const nextLonRad =
    lonRad +
    Math.atan2(
      Math.sin(headingRad) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(nextLatRad),
    )

  return {
    lat: radiansToDegrees(nextLatRad),
    lon: normalizeLongitude(radiansToDegrees(nextLonRad)),
  }
}

function getSurfaceDistanceMeters(
  left: { lat: number; lon: number },
  right: { lat: number; lon: number },
) {
  const lat1 = degreesToRadians(left.lat)
  const lat2 = degreesToRadians(right.lat)
  const deltaLat = degreesToRadians(right.lat - left.lat)
  const deltaLon = degreesToRadians(right.lon - left.lon)
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2

  return 2 * 6_371_000 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getBearingDeg(
  left: { lat: number; lon: number },
  right: { lat: number; lon: number },
) {
  const lat1 = degreesToRadians(left.lat)
  const lat2 = degreesToRadians(right.lat)
  const deltaLon = degreesToRadians(right.lon - left.lon)
  const y = Math.sin(deltaLon) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon)

  return normalizeDegrees(radiansToDegrees(Math.atan2(y, x)))
}

function roundCoordinate(value: number) {
  return Number(value.toFixed(4))
}

function roundAngle(value: number) {
  return Number(value.toFixed(2))
}

function roundRange(value: number) {
  return Number(value.toFixed(1))
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI
}

function normalizeDegrees(value: number) {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function normalizeLongitude(value: number) {
  if (value < -180) {
    return value + 360
  }

  if (value > 180) {
    return value - 360
  }

  return value
}
