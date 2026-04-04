import { describe, expect, it } from 'vitest'

import {
  clampDecDeg,
  compareNormalizedScopeStars,
  getBandsForMagnitude,
  getTileIndices,
  normalizeRaDeg,
} from '../../lib/scope-data/tiles.mjs'
import { SCOPE_BAND_DEFINITIONS } from '../../lib/scope-data/contracts.mjs'

describe('scope-data tiling', () => {
  it('normalizes RA and clamps Dec to the runtime bounds', () => {
    expect(normalizeRaDeg(-0.5)).toBe(359.5)
    expect(normalizeRaDeg(360.5)).toBe(0.5)
    expect(clampDecDeg(-93)).toBe(-90)
    expect(clampDecDeg(94)).toBe(90)
  })

  it('assigns rows to cumulative magnitude bands', () => {
    expect(getBandsForMagnitude(6.4).map((band) => band.bandDir)).toEqual([
      'mag6p5',
      'mag8p0',
      'mag9p5',
      'mag10p5',
    ])
    expect(getBandsForMagnitude(8.2).map((band) => band.bandDir)).toEqual([
      'mag9p5',
      'mag10p5',
    ])
  })

  it('computes exact tile indices from normalized RA and shifted Dec', () => {
    expect(
      getTileIndices(
        { raDeg: -0.5, decDeg: 89.9 },
        SCOPE_BAND_DEFINITIONS[0]
      )
    ).toEqual({
      raIndex: 3,
      decIndex: 3,
    })
    expect(
      getTileIndices(
        { raDeg: 359.99, decDeg: -90 },
        SCOPE_BAND_DEFINITIONS[3]
      )
    ).toEqual({
      raIndex: 31,
      decIndex: 0,
    })
  })

  it('sorts rows deterministically by vMag, decDeg, raDeg, and sourceId', () => {
    const rows = [
      { vMag: 8, decDeg: 5, raDeg: 2, sourceId: 'TYC:2-1-1' },
      { vMag: 8, decDeg: 5, raDeg: 1, sourceId: 'TYC:1-1-1' },
      { vMag: 7, decDeg: 50, raDeg: 200, sourceId: 'TYC:3-1-1' },
      { vMag: 8, decDeg: 4, raDeg: 10, sourceId: 'TYC:4-1-1' },
    ]

    rows.sort(compareNormalizedScopeStars)

    expect(rows.map((row) => row.sourceId)).toEqual([
      'TYC:3-1-1',
      'TYC:4-1-1',
      'TYC:1-1-1',
      'TYC:2-1-1',
    ])
  })
})
