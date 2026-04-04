import { describe, expect, it } from 'vitest'

import {
  buildDevSyntheticRows,
  DEV_SYNTHETIC_MAGS,
  DEV_SYNTHETIC_OFFSETS_DEG,
  getDevFallbackBandCoverage,
} from '../../lib/scope-data/dev-fallback.mjs'

describe('scope-data dev fallback', () => {
  it('emits the exact synthetic offsets and magnitudes', () => {
    const rows = buildDevSyntheticRows([
      {
        id: 'hip-32349',
        name: ' Sirius ',
        raDeg: 101.2872,
        decDeg: -16.7161,
      },
    ])

    expect(rows).toHaveLength(6)
    expect(rows.map((row) => row.vMag)).toEqual(DEV_SYNTHETIC_MAGS)
    const coordinates = rows.map((row) => [row.raDeg, row.decDeg])

    expect(coordinates[0][0]).toBeCloseTo(101.3672, 6)
    expect(coordinates[0][1]).toBeCloseTo(-16.6861, 6)
    expect(coordinates[1][0]).toBeCloseTo(101.1972, 6)
    expect(coordinates[1][1]).toBeCloseTo(-16.6661, 6)
    expect(coordinates[2][0]).toBeCloseTo(101.3272, 6)
    expect(coordinates[2][1]).toBeCloseTo(-16.8261, 6)
    expect(coordinates[3][0]).toBeCloseTo(101.2372, 6)
    expect(coordinates[3][1]).toBeCloseTo(-16.7961, 6)
    expect(coordinates[4][0]).toBeCloseTo(101.4072, 6)
    expect(coordinates[4][1]).toBeCloseTo(-16.7361, 6)
    expect(coordinates[5][0]).toBeCloseTo(101.1572, 6)
    expect(coordinates[5][1]).toBeCloseTo(-16.7061, 6)
    expect(DEV_SYNTHETIC_OFFSETS_DEG).toHaveLength(6)
  })

  it('assigns names only on synthetic index 5 and keeps PM/color at zero', () => {
    const rows = buildDevSyntheticRows([
      {
        id: 'hip-32349',
        name: ' Sirius ',
        raDeg: 101.2872,
        decDeg: -16.7161,
      },
    ])

    expect(rows.slice(0, 5).every((row) => row.displayName === undefined)).toBe(true)
    expect(rows[5].displayName).toBe('Sirius')
    expect(rows.every((row) => row.pmRaMasPerYear === 0)).toBe(true)
    expect(rows.every((row) => row.pmDecMasPerYear === 0)).toBe(true)
    expect(rows.every((row) => row.bMinusV === 0)).toBe(true)
  })

  it('guarantees a non-empty mag6p5 band and clamps extreme coordinates', () => {
    const rows = buildDevSyntheticRows([
      {
        id: 'hip-1',
        name: '',
        raDeg: 359.95,
        decDeg: 89.95,
      },
    ])

    expect(rows[0].raDeg).toBeCloseTo(0.03, 6)
    expect(rows[0].decDeg).toBe(89.9)
    expect(rows[5].raDeg).toBeCloseTo(359.82, 6)
    expect(rows[5].decDeg).toBe(89.9)
    expect(getDevFallbackBandCoverage(rows).mag6p5).toBeGreaterThan(0)
  })
})
