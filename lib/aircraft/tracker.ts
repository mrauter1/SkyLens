import type { AircraftApiAircraft, AircraftApiResponse } from './contracts'

export const TRACK_HISTORY_LIMIT = 12
export const TRACK_ESTIMATION_WINDOW = 6
export const TRACK_HISTORY_MAX_AGE_MS = 120_000
export const STALE_AFTER_MS = 20_000
export const DROP_AFTER_MS = 30_000
export const MAX_PREDICTION_MS = 15_000
export const TURN_ENTER_THRESHOLD_DEG_PER_S = 0.8
export const TURN_EXIT_THRESHOLD_DEG_PER_S = 0.3
export const TRAIL_HISTORY_WINDOW_MS = 40_000
export const TRAIL_FUTURE_WINDOW_MS = 6_000
export const TRAIL_STEP_MS = 1_000

const EARTH_RADIUS_METERS = 6_371_000
const REPORTED_BLEND_WEIGHT = 0.7
const OBSERVED_BLEND_WEIGHT = 0.3
const LIVE_MOTION_WINDOW_MS = 1_000

type AircraftHistorySample = {
  aircraft: AircraftApiAircraft
  snapshotTimeMs: number
  fetchedAtMs: number
  timePositionMs?: number
  anchorTimeMs: number
  altitudeMeters: number
}

type TrackRecord = {
  samples: AircraftHistorySample[]
  isTurning: boolean
  enterTurnCount: number
  exitTurnCount: number
}

type Observer = AircraftApiResponse['observer']

type ObservedKinematics = {
  speedMps?: number
  trackDeg?: number
  verticalRateMps?: number
  turnRateDegPerS?: number
}

export type AircraftMotionState = 'live' | 'estimated' | 'stale'

export type ResolvedTrackedAircraft = AircraftApiAircraft & {
  motionOpacity: number
  motionState: AircraftMotionState
}

export type AircraftTrailPoint = {
  timestampMs: number
  lat: number
  lon: number
  altitudeMeters: number
  azimuthDeg: number
  elevationDeg: number
  rangeKm: number
}

export interface AircraftTracker {
  ingest(snapshot: AircraftApiResponse): void
  resolve(params: { observer: Observer; nowMs: number }): ResolvedTrackedAircraft[]
  getTrail(params: { id: string; observer: Observer; nowMs: number }): AircraftTrailPoint[]
  prune(nowMs: number): void
  reset(): void
}

export function createAircraftTracker(): AircraftTracker {
  const tracks = new Map<string, TrackRecord>()

  return {
    ingest(snapshot) {
      const fetchedAtMs = Date.parse(snapshot.fetchedAt)
      const snapshotTimeMs = snapshot.snapshotTimeS * 1_000

      for (const aircraft of snapshot.aircraft) {
        const altitudeMeters = aircraft.geoAltitudeM ?? aircraft.baroAltitudeM

        if (typeof altitudeMeters !== 'number') {
          continue
        }

        const sample: AircraftHistorySample = {
          aircraft,
          snapshotTimeMs,
          fetchedAtMs,
          ...(typeof aircraft.timePositionS === 'number'
            ? { timePositionMs: aircraft.timePositionS * 1_000 }
            : {}),
          anchorTimeMs:
            typeof aircraft.timePositionS === 'number'
              ? aircraft.timePositionS * 1_000
              : snapshotTimeMs,
          altitudeMeters,
        }
        const record = tracks.get(aircraft.id) ?? createTrackRecord()
        const existingIndex = record.samples.findIndex(
          (entry) => entry.anchorTimeMs === sample.anchorTimeMs,
        )

        if (existingIndex >= 0) {
          record.samples.splice(existingIndex, 1, sample)
        } else {
          record.samples.push(sample)
          record.samples.sort((left, right) => left.anchorTimeMs - right.anchorTimeMs)
        }

        trimTrackSamples(record.samples, snapshotTimeMs)
        updateTurnState(record)
        tracks.set(aircraft.id, record)
      }

      pruneTracks(tracks, snapshotTimeMs)
    },

    resolve({ observer, nowMs }) {
      pruneTracks(tracks, nowMs)

      return [...tracks.values()]
        .map((record) => resolveTrack(record, observer, nowMs))
        .filter((aircraft): aircraft is ResolvedTrackedAircraft => aircraft !== null)
        .sort((left, right) => left.rangeKm - right.rangeKm || left.id.localeCompare(right.id))
    },

    getTrail({ id, observer, nowMs }) {
      pruneTracks(tracks, nowMs)

      const record = tracks.get(id)

      if (!record || record.samples.length === 0) {
        return []
      }

      const latestSample = record.samples[record.samples.length - 1]
      const startMs = Math.max(
        nowMs - TRAIL_HISTORY_WINDOW_MS,
        latestSample.anchorTimeMs - TRACK_HISTORY_MAX_AGE_MS,
      )
      const endMs = nowMs + TRAIL_FUTURE_WINDOW_MS
      const timestamps = new Set<number>()

      for (
        let timestampMs = Math.floor(startMs / TRAIL_STEP_MS) * TRAIL_STEP_MS;
        timestampMs <= endMs;
        timestampMs += TRAIL_STEP_MS
      ) {
        timestamps.add(timestampMs)
      }

      timestamps.add(nowMs)
      timestamps.add(latestSample.anchorTimeMs)

      return [...timestamps]
        .sort((left, right) => left - right)
        .map((timestampMs) => resolveTrailPoint(record, observer, nowMs, timestampMs))
        .filter((point): point is AircraftTrailPoint => point !== null)
    },

    prune(nowMs) {
      pruneTracks(tracks, nowMs)
    },

    reset() {
      tracks.clear()
    },
  }
}

function createTrackRecord(): TrackRecord {
  return {
    samples: [],
    isTurning: false,
    enterTurnCount: 0,
    exitTurnCount: 0,
  }
}

function resolveTrack(
  record: TrackRecord,
  observer: Observer,
  nowMs: number,
): ResolvedTrackedAircraft | null {
  const latestSample = record.samples[record.samples.length - 1]

  if (!latestSample) {
    return null
  }

  const ageMs = Math.max(0, nowMs - latestSample.anchorTimeMs)

  if (ageMs >= DROP_AFTER_MS) {
    return null
  }

  const observed = estimateObservedKinematics(record.samples)
  const blendedSpeedMps = blendLinearValue(
    latestSample.aircraft.velocityMps,
    observed.speedMps,
    REPORTED_BLEND_WEIGHT,
    OBSERVED_BLEND_WEIGHT,
  )
  const blendedTrackDeg = blendAngleValue(
    latestSample.aircraft.trackDeg,
    observed.trackDeg,
    REPORTED_BLEND_WEIGHT,
    OBSERVED_BLEND_WEIGHT,
  )
  const blendedVerticalRateMps = blendLinearValue(
    latestSample.aircraft.verticalRateMps,
    observed.verticalRateMps,
    REPORTED_BLEND_WEIGHT,
    OBSERVED_BLEND_WEIGHT,
  )
  const turnRateDegPerS =
    record.isTurning && typeof observed.turnRateDegPerS === 'number'
      ? observed.turnRateDegPerS
      : 0
  const projected = projectTrackState({
    sample: latestSample,
    nowMs,
    speedMps: blendedSpeedMps,
    trackDeg: blendedTrackDeg,
    verticalRateMps: blendedVerticalRateMps,
    turnRateDegPerS,
    isTurning: record.isTurning,
  })
  const relativePose = getRelativePose({
    observer,
    lat: projected.lat,
    lon: projected.lon,
    altitudeMeters: projected.altitudeMeters,
  })
  const motionOpacity = getMotionOpacity(ageMs)
  const didPredict =
    projected.horizonMs > LIVE_MOTION_WINDOW_MS &&
    ((typeof blendedSpeedMps === 'number' && typeof blendedTrackDeg === 'number') ||
      typeof blendedVerticalRateMps === 'number')

  return {
    ...latestSample.aircraft,
    lat: roundCoordinate(projected.lat),
    lon: roundCoordinate(projected.lon),
    ...(typeof latestSample.aircraft.geoAltitudeM === 'number'
      ? { geoAltitudeM: Math.round(projected.altitudeMeters) }
      : {}),
    ...(typeof latestSample.aircraft.baroAltitudeM === 'number'
      ? { baroAltitudeM: Math.round(projected.altitudeMeters) }
      : {}),
    ...(typeof blendedSpeedMps === 'number' ? { velocityMps: roundDecimal(blendedSpeedMps, 1) } : {}),
    ...(typeof projected.trackDeg === 'number'
      ? { trackDeg: normalizeDegrees(roundDecimal(projected.trackDeg, 1)) }
      : {}),
    ...(typeof blendedVerticalRateMps === 'number'
      ? { verticalRateMps: roundDecimal(blendedVerticalRateMps, 1) }
      : {}),
    azimuthDeg: roundAngle(relativePose.azimuthDeg),
    elevationDeg: roundAngle(relativePose.elevationDeg),
    rangeKm: roundRange(relativePose.rangeKm),
    motionOpacity: Number(motionOpacity.toFixed(3)),
    motionState: ageMs > STALE_AFTER_MS ? 'stale' : didPredict ? 'estimated' : 'live',
  }
}

function resolveTrailPoint(
  record: TrackRecord,
  observer: Observer,
  nowMs: number,
  timestampMs: number,
): AircraftTrailPoint | null {
  const latestSample = record.samples[record.samples.length - 1]

  if (!latestSample) {
    return null
  }

  const altitudeMeters = resolveTrailAltitude(record.samples, latestSample, timestampMs)
  const position = resolveTrailPosition(record, timestampMs)
  const ageMs = Math.max(0, nowMs - Math.min(timestampMs, latestSample.anchorTimeMs))

  if (ageMs >= DROP_AFTER_MS && timestampMs >= nowMs) {
    return null
  }

  const relativePose = getRelativePose({
    observer,
    lat: position.lat,
    lon: position.lon,
    altitudeMeters,
  })

  return {
    timestampMs,
    lat: roundCoordinate(position.lat),
    lon: roundCoordinate(position.lon),
    altitudeMeters: Math.round(altitudeMeters),
    azimuthDeg: roundAngle(relativePose.azimuthDeg),
    elevationDeg: roundAngle(relativePose.elevationDeg),
    rangeKm: roundRange(relativePose.rangeKm),
  }
}

function resolveTrailPosition(record: TrackRecord, timestampMs: number) {
  const latestSample = record.samples[record.samples.length - 1]

  if (!latestSample || timestampMs >= latestSample.anchorTimeMs) {
    const observed = estimateObservedKinematics(record.samples)
    const projected = projectTrackState({
      sample: latestSample,
      nowMs: timestampMs,
      speedMps: blendLinearValue(
        latestSample?.aircraft.velocityMps,
        observed.speedMps,
        REPORTED_BLEND_WEIGHT,
        OBSERVED_BLEND_WEIGHT,
      ),
      trackDeg: blendAngleValue(
        latestSample?.aircraft.trackDeg,
        observed.trackDeg,
        REPORTED_BLEND_WEIGHT,
        OBSERVED_BLEND_WEIGHT,
      ),
      verticalRateMps: blendLinearValue(
        latestSample?.aircraft.verticalRateMps,
        observed.verticalRateMps,
        REPORTED_BLEND_WEIGHT,
        OBSERVED_BLEND_WEIGHT,
      ),
      turnRateDegPerS:
        record.isTurning && typeof observed.turnRateDegPerS === 'number'
          ? observed.turnRateDegPerS
          : 0,
      isTurning: record.isTurning,
    })

    return {
      lat: projected.lat,
      lon: projected.lon,
    }
  }

  if (timestampMs <= record.samples[0].anchorTimeMs) {
    return {
      lat: record.samples[0].aircraft.lat,
      lon: record.samples[0].aircraft.lon,
    }
  }

  const nextIndex = record.samples.findIndex((sample) => sample.anchorTimeMs >= timestampMs)

  if (nextIndex <= 0) {
    return {
      lat: latestSample.aircraft.lat,
      lon: latestSample.aircraft.lon,
    }
  }

  const previousSample = record.samples[nextIndex - 1]
  const nextSample = record.samples[nextIndex]
  const durationMs = nextSample.anchorTimeMs - previousSample.anchorTimeMs

  if (durationMs <= 0) {
    return {
      lat: nextSample.aircraft.lat,
      lon: nextSample.aircraft.lon,
    }
  }

  const progress = clampNumber((timestampMs - previousSample.anchorTimeMs) / durationMs, 0, 1)

  return {
    lat: roundCoordinate(interpolateNumber(previousSample.aircraft.lat, nextSample.aircraft.lat, progress)),
    lon: roundCoordinate(
      interpolateLongitude(previousSample.aircraft.lon, nextSample.aircraft.lon, progress),
    ),
  }
}

function resolveTrailAltitude(
  samples: AircraftHistorySample[],
  latestSample: AircraftHistorySample,
  timestampMs: number,
) {
  if (timestampMs >= latestSample.anchorTimeMs) {
    const horizonMs = clampNumber(timestampMs - latestSample.anchorTimeMs, 0, MAX_PREDICTION_MS)
    return Math.max(
      0,
      latestSample.altitudeMeters +
        (latestSample.aircraft.verticalRateMps ?? 0) * (horizonMs / 1_000),
    )
  }

  if (timestampMs <= samples[0].anchorTimeMs) {
    return samples[0].altitudeMeters
  }

  const nextIndex = samples.findIndex((sample) => sample.anchorTimeMs >= timestampMs)

  if (nextIndex <= 0) {
    return latestSample.altitudeMeters
  }

  const previousSample = samples[nextIndex - 1]
  const nextSample = samples[nextIndex]
  const durationMs = nextSample.anchorTimeMs - previousSample.anchorTimeMs

  if (durationMs <= 0) {
    return nextSample.altitudeMeters
  }

  const progress = clampNumber((timestampMs - previousSample.anchorTimeMs) / durationMs, 0, 1)

  return interpolateNumber(previousSample.altitudeMeters, nextSample.altitudeMeters, progress)
}

function projectTrackState({
  sample,
  nowMs,
  speedMps,
  trackDeg,
  verticalRateMps,
  turnRateDegPerS,
  isTurning,
}: {
  sample?: AircraftHistorySample
  nowMs: number
  speedMps?: number
  trackDeg?: number
  verticalRateMps?: number
  turnRateDegPerS: number
  isTurning: boolean
}) {
  if (!sample) {
    return {
      lat: 0,
      lon: 0,
      altitudeMeters: 0,
      trackDeg,
      horizonMs: 0,
    }
  }

  const horizonMs = clampNumber(nowMs - sample.anchorTimeMs, 0, MAX_PREDICTION_MS)
  const horizonSeconds = horizonMs / 1_000
  const altitudeMeters = Math.max(
    0,
    sample.altitudeMeters + (verticalRateMps ?? 0) * horizonSeconds,
  )

  if (
    horizonMs <= 0 ||
    typeof speedMps !== 'number' ||
    typeof trackDeg !== 'number' ||
    speedMps <= 0
  ) {
    return {
      lat: sample.aircraft.lat,
      lon: sample.aircraft.lon,
      altitudeMeters,
      trackDeg,
      horizonMs,
    }
  }

  const theta = degreesToRadians(trackDeg)
  const omega = degreesToRadians(turnRateDegPerS)
  let eastMeters = 0
  let northMeters = 0
  let nextTrackDeg = trackDeg

  if (isTurning && Math.abs(omega) > 1e-6) {
    eastMeters = (speedMps / omega) * (Math.cos(theta) - Math.cos(theta + omega * horizonSeconds))
    northMeters = (speedMps / omega) * (Math.sin(theta + omega * horizonSeconds) - Math.sin(theta))
    nextTrackDeg = normalizeDegrees(trackDeg + turnRateDegPerS * horizonSeconds)
  } else {
    eastMeters = speedMps * horizonSeconds * Math.sin(theta)
    northMeters = speedMps * horizonSeconds * Math.cos(theta)
  }

  const projected = projectFromLocalOffset({
    lat: sample.aircraft.lat,
    lon: sample.aircraft.lon,
    eastMeters,
    northMeters,
  })

  return {
    lat: projected.lat,
    lon: projected.lon,
    altitudeMeters,
    trackDeg: nextTrackDeg,
    horizonMs,
  }
}

function estimateObservedKinematics(samples: AircraftHistorySample[]): ObservedKinematics {
  const recentSamples = samples.slice(-TRACK_ESTIMATION_WINDOW)

  if (recentSamples.length < 2) {
    return {}
  }

  const intervalVectors = buildObservedIntervals(recentSamples)

  if (intervalVectors.length === 0) {
    return {}
  }

  let eastSum = 0
  let northSum = 0
  let verticalRateSum = 0
  let weightSum = 0

  intervalVectors.forEach((vector, index) => {
    const weight = index + 1
    eastSum += vector.eastMps * weight
    northSum += vector.northMps * weight
    verticalRateSum += vector.verticalRateMps * weight
    weightSum += weight
  })

  const averageEastMps = eastSum / weightSum
  const averageNorthMps = northSum / weightSum
  const speedMps = Math.hypot(averageEastMps, averageNorthMps)
  const turnRateDegPerS = estimateObservedTurnRate(intervalVectors)

  return {
    ...(speedMps > 0.01 ? { speedMps } : {}),
    ...(speedMps > 0.01 ? { trackDeg: vectorToTrackDeg(averageEastMps, averageNorthMps) } : {}),
    verticalRateMps: verticalRateSum / weightSum,
    ...(typeof turnRateDegPerS === 'number' ? { turnRateDegPerS } : {}),
  }
}

function buildObservedIntervals(samples: AircraftHistorySample[]) {
  const origin = samples[samples.length - 1].aircraft
  const intervalVectors: Array<{
    eastMps: number
    northMps: number
    verticalRateMps: number
    trackDeg?: number
    dtSeconds: number
    endTimeMs: number
  }> = []

  for (let index = 1; index < samples.length; index += 1) {
    const previousSample = samples[index - 1]
    const nextSample = samples[index]
    const dtSeconds = (nextSample.anchorTimeMs - previousSample.anchorTimeMs) / 1_000

    if (dtSeconds <= 0) {
      continue
    }

    const previousPoint = projectToLocalPlane(origin, previousSample.aircraft)
    const nextPoint = projectToLocalPlane(origin, nextSample.aircraft)
    const eastMps = (nextPoint.eastMeters - previousPoint.eastMeters) / dtSeconds
    const northMps = (nextPoint.northMeters - previousPoint.northMeters) / dtSeconds
    const speedMps = Math.hypot(eastMps, northMps)

    intervalVectors.push({
      eastMps,
      northMps,
      verticalRateMps: (nextSample.altitudeMeters - previousSample.altitudeMeters) / dtSeconds,
      ...(speedMps > 0.01 ? { trackDeg: vectorToTrackDeg(eastMps, northMps) } : {}),
      dtSeconds,
      endTimeMs: nextSample.anchorTimeMs,
    })
  }

  return intervalVectors
}

function estimateObservedTurnRate(
  intervalVectors: Array<{
    trackDeg?: number
    dtSeconds: number
    endTimeMs: number
  }>,
) {
  const turnRates = getObservedTurnRates(intervalVectors)

  if (turnRates.length === 0) {
    return undefined
  }

  let weightedRate = 0
  let weightSum = 0

  turnRates.forEach((rate, index) => {
    const weight = index + 1
    weightedRate += rate * weight
    weightSum += weight
  })

  return weightedRate / weightSum
}

function getObservedTurnRates(
  intervalVectors: Array<{
    trackDeg?: number
    dtSeconds: number
    endTimeMs: number
  }>,
) {
  const turnRates: number[] = []

  for (let index = 1; index < intervalVectors.length; index += 1) {
    const previous = intervalVectors[index - 1]
    const current = intervalVectors[index]

    if (typeof previous.trackDeg !== 'number' || typeof current.trackDeg !== 'number') {
      continue
    }

    const dtSeconds = Math.max(0.001, (current.endTimeMs - previous.endTimeMs) / 1_000)
    turnRates.push(shortestAngleDeltaDeg(previous.trackDeg, current.trackDeg) / dtSeconds)
  }

  return turnRates
}

function updateTurnState(record: TrackRecord) {
  const recentSamples = record.samples.slice(-TRACK_ESTIMATION_WINDOW)

  if (recentSamples.length < 3) {
    return
  }

  const latestTurnRateDegPerS = getObservedTurnRates(buildObservedIntervals(recentSamples)).at(-1)

  if (typeof latestTurnRateDegPerS !== 'number') {
    return
  }

  const absoluteTurnRate = Math.abs(latestTurnRateDegPerS)

  if (absoluteTurnRate > TURN_ENTER_THRESHOLD_DEG_PER_S) {
    record.enterTurnCount += 1
    record.exitTurnCount = 0

    if (record.enterTurnCount >= 2) {
      record.isTurning = true
    }

    return
  }

  if (absoluteTurnRate < TURN_EXIT_THRESHOLD_DEG_PER_S) {
    record.exitTurnCount += 1
    record.enterTurnCount = 0

    if (record.exitTurnCount >= 2) {
      record.isTurning = false
    }

    return
  }

  record.enterTurnCount = 0
  record.exitTurnCount = 0
}

function trimTrackSamples(samples: AircraftHistorySample[], nowMs: number) {
  const minTimeMs = nowMs - TRACK_HISTORY_MAX_AGE_MS
  const keptSamples = samples.filter((sample) => sample.anchorTimeMs >= minTimeMs)

  samples.splice(0, samples.length, ...keptSamples.slice(-TRACK_HISTORY_LIMIT))
}

function pruneTracks(tracks: Map<string, TrackRecord>, nowMs: number) {
  for (const [id, record] of tracks.entries()) {
    trimTrackSamples(record.samples, nowMs)
    const latestSample = record.samples[record.samples.length - 1]

    if (!latestSample || nowMs - latestSample.anchorTimeMs >= DROP_AFTER_MS) {
      tracks.delete(id)
    }
  }
}

function getRelativePose({
  observer,
  lat,
  lon,
  altitudeMeters,
}: {
  observer: Observer
  lat: number
  lon: number
  altitudeMeters: number
}) {
  const surfaceDistanceMeters = getSurfaceDistanceMeters(observer, { lat, lon })
  const altitudeDeltaMeters = altitudeMeters - observer.altMeters

  return {
    azimuthDeg: getBearingDeg(observer, { lat, lon }),
    elevationDeg: radiansToDegrees(Math.atan2(altitudeDeltaMeters, surfaceDistanceMeters)),
    rangeKm: Math.sqrt(surfaceDistanceMeters ** 2 + altitudeDeltaMeters ** 2) / 1_000,
  }
}

function getMotionOpacity(ageMs: number) {
  if (ageMs <= STALE_AFTER_MS) {
    return 1
  }

  return 1 - clampNumber((ageMs - STALE_AFTER_MS) / (DROP_AFTER_MS - STALE_AFTER_MS), 0, 1)
}

function projectToLocalPlane(
  origin: Pick<AircraftApiAircraft, 'lat' | 'lon'>,
  point: Pick<AircraftApiAircraft, 'lat' | 'lon'>,
) {
  const deltaLatRad = degreesToRadians(point.lat - origin.lat)
  const deltaLonRad = degreesToRadians(normalizeLongitude(point.lon - origin.lon))
  const cosLat = Math.max(Math.cos(degreesToRadians(origin.lat)), 0.01)

  return {
    eastMeters: deltaLonRad * EARTH_RADIUS_METERS * cosLat,
    northMeters: deltaLatRad * EARTH_RADIUS_METERS,
  }
}

function projectFromLocalOffset({
  lat,
  lon,
  eastMeters,
  northMeters,
}: {
  lat: number
  lon: number
  eastMeters: number
  northMeters: number
}) {
  const nextLat = lat + radiansToDegrees(northMeters / EARTH_RADIUS_METERS)
  const cosLat = Math.max(Math.cos(degreesToRadians(lat)), 0.01)
  const nextLon = normalizeLongitude(
    lon + radiansToDegrees(eastMeters / (EARTH_RADIUS_METERS * cosLat)),
  )

  return {
    lat: nextLat,
    lon: nextLon,
  }
}

function getSurfaceDistanceMeters(
  left: Pick<Observer, 'lat' | 'lon'>,
  right: Pick<AircraftApiAircraft, 'lat' | 'lon'>,
) {
  const lat1 = degreesToRadians(left.lat)
  const lat2 = degreesToRadians(right.lat)
  const deltaLat = degreesToRadians(right.lat - left.lat)
  const deltaLon = degreesToRadians(right.lon - left.lon)
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getBearingDeg(
  left: Pick<Observer, 'lat' | 'lon'>,
  right: Pick<AircraftApiAircraft, 'lat' | 'lon'>,
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

function vectorToTrackDeg(eastMps: number, northMps: number) {
  return normalizeDegrees(radiansToDegrees(Math.atan2(eastMps, northMps)))
}

function blendLinearValue(
  reported?: number,
  observed?: number,
  reportedWeight = REPORTED_BLEND_WEIGHT,
  observedWeight = OBSERVED_BLEND_WEIGHT,
) {
  if (typeof reported === 'number' && typeof observed === 'number') {
    return reported * reportedWeight + observed * observedWeight
  }

  return reported ?? observed
}

function blendAngleValue(
  reported?: number,
  observed?: number,
  reportedWeight = REPORTED_BLEND_WEIGHT,
  observedWeight = OBSERVED_BLEND_WEIGHT,
) {
  if (typeof reported === 'number' && typeof observed === 'number') {
    const x =
      Math.cos(degreesToRadians(reported)) * reportedWeight +
      Math.cos(degreesToRadians(observed)) * observedWeight
    const y =
      Math.sin(degreesToRadians(reported)) * reportedWeight +
      Math.sin(degreesToRadians(observed)) * observedWeight

    if (Math.abs(x) < 1e-6 && Math.abs(y) < 1e-6) {
      return reported
    }

    return normalizeDegrees(radiansToDegrees(Math.atan2(y, x)))
  }

  return reported ?? observed
}

function shortestAngleDeltaDeg(fromDeg: number, toDeg: number) {
  const delta = ((toDeg - fromDeg + 540) % 360) - 180
  return delta
}

function interpolateNumber(start: number, end: number, progress: number) {
  return start + (end - start) * progress
}

function interpolateLongitude(start: number, end: number, progress: number) {
  const delta = shortestAngleDeltaDeg(start, end)
  return normalizeLongitude(start + delta * progress)
}

function roundCoordinate(value: number) {
  return roundDecimal(value, 4)
}

function roundAngle(value: number) {
  return roundDecimal(value, 2)
}

function roundRange(value: number) {
  return roundDecimal(value, 1)
}

function roundDecimal(value: number, digits: number) {
  return Number(value.toFixed(digits))
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
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
