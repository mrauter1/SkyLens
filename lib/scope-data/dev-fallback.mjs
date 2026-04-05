import { normalizeScopeDisplayName } from './names.mjs'
import { getBandsForMagnitude } from './tiles.mjs'

export const DEV_SYNTHETIC_OFFSETS_DEG = Object.freeze([
  Object.freeze([0.08, 0.03]),
  Object.freeze([-0.09, 0.05]),
  Object.freeze([0.04, -0.11]),
  Object.freeze([-0.05, -0.08]),
  Object.freeze([0.12, -0.02]),
  Object.freeze([-0.13, 0.01]),
])

export const DEV_SYNTHETIC_MAGS = Object.freeze([6.4, 7.6, 8.4, 9.2, 10.0, 10.5])

function wrap360(value) {
  return ((value % 360) + 360) % 360
}

function clampDevDec(value) {
  return Math.min(89.9, Math.max(-89.9, value))
}

export function buildDevSyntheticRows(seedStars) {
  return seedStars.flatMap((star) =>
    DEV_SYNTHETIC_OFFSETS_DEG.map(([raOffsetDeg, decOffsetDeg], syntheticIndex) => ({
      sourceId: `DEV:${star.id}:${syntheticIndex}`,
      hipId: undefined,
      raDeg: wrap360(Number(star.raDeg) + raOffsetDeg),
      decDeg: clampDevDec(Number(star.decDeg) + decOffsetDeg),
      pmRaMasPerYear: 0,
      pmDecMasPerYear: 0,
      vMag: DEV_SYNTHETIC_MAGS[syntheticIndex],
      bMinusV: 0,
      displayName:
        syntheticIndex === 5
          ? normalizeScopeDisplayName(star.name)
          : undefined,
    }))
  )
}

export function getDevFallbackBandCoverage(rows) {
  return rows.reduce(
    (coverage, row) => {
      for (const band of getBandsForMagnitude(row.vMag)) {
        coverage[band.bandDir] += 1
      }

      return coverage
    },
    {
      mag6p5: 0,
      mag8p0: 0,
      mag9p5: 0,
      mag10p5: 0,
    }
  )
}
