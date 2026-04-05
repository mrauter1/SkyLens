import {
  HorizonFromVector,
  MakeTime,
  Observer,
  RotateVector,
  Rotation_EQJ_HOR,
  Rotation_HOR_EQJ,
  SphereFromVector,
  Spherical,
  VectorFromHorizon,
  VectorFromSphere,
} from 'astronomy-engine'

import type { ObserverState } from '../viewer/contracts'

import type { ScopeDecodedTileRow } from './contracts'

export function getObservationJulianYear(timeMs: number) {
  return 2000 + MakeTime(new Date(timeMs)).ut / 365.25
}

export function applyScopeProperMotion(
  star: Pick<
    ScopeDecodedTileRow,
    'raDeg' | 'decDeg' | 'pmRaMasPerYear' | 'pmDecMasPerYear'
  >,
  observationJulianYear: number,
) {
  const yearsFromJ2000 = observationJulianYear - 2000.0

  return {
    raDeg: normalizeRaDeg(
      star.raDeg + (star.pmRaMasPerYear / 1000 / 3600) * yearsFromJ2000,
    ),
    decDeg: clampNumber(
      star.decDeg + (star.pmDecMasPerYear / 1000 / 3600) * yearsFromJ2000,
      -90,
      90,
    ),
  }
}

export function convertScopeEquatorialToHorizontal(
  {
    raDeg,
    decDeg,
  }: {
    raDeg: number
    decDeg: number
  },
  observer: ObserverState,
  timeMs: number,
) {
  const time = new Date(timeMs)
  const astronomyObserver = new Observer(observer.lat, observer.lon, observer.altMeters)
  const rotation = Rotation_EQJ_HOR(time, astronomyObserver)
  const equatorial = VectorFromSphere(new Spherical(decDeg, normalizeRaDeg(raDeg), 1), time)
  const horizontal = RotateVector(rotation, equatorial)
  const horizon = HorizonFromVector(horizontal, 'normal')

  return {
    azimuthDeg: normalizeRaDeg(horizon.lon),
    elevationDeg: horizon.lat,
  }
}

export function convertScopeHorizontalToEquatorial(
  {
    azimuthDeg,
    elevationDeg,
  }: {
    azimuthDeg: number
    elevationDeg: number
  },
  observer: ObserverState,
  timeMs: number,
) {
  const time = new Date(timeMs)
  const astronomyObserver = new Observer(observer.lat, observer.lon, observer.altMeters)
  const rotation = Rotation_HOR_EQJ(time, astronomyObserver)
  const horizontal = VectorFromHorizon(
    new Spherical(elevationDeg, normalizeRaDeg(azimuthDeg), 1),
    time,
    'normal',
  )
  const equatorial = RotateVector(rotation, horizontal)
  const sphere = SphereFromVector(equatorial)

  return {
    raDeg: normalizeRaDeg(sphere.lon),
    decDeg: clampNumber(sphere.lat, -90, 90),
  }
}

function normalizeRaDeg(value: number) {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
