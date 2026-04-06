import { describe, expect, it } from 'vitest'

import { DEFAULT_SCOPE_OPTICS_SETTINGS } from '../../lib/viewer/settings'
import {
  computeLimitingMagnitude,
  computeStarPhotometry,
  isStarVisibleWithScopeOptics,
} from '../../lib/viewer/scope-optics'

describe('scope optics helpers', () => {
  it('returns stable limiting magnitude and photometry values for the default optics', () => {
    expect(computeLimitingMagnitude(DEFAULT_SCOPE_OPTICS_SETTINGS, 45)).toBeCloseTo(
      6.719491013676308,
      10,
    )

    expect(computeStarPhotometry(6, DEFAULT_SCOPE_OPTICS_SETTINGS, 45)).toEqual({
      displayIntensity: expect.closeTo(0.8767323602154009, 10),
      corePx: expect.closeTo(1.9559220132746087, 10),
      haloPx: expect.closeTo(5.188614713546071, 10),
    })
  })

  it('improves limiting magnitude monotonically with aperture, magnification, transparency, and altitude', () => {
    const lowPower = { apertureMm: 50, magnificationX: 10, transparencyPct: 40 }
    const midPower = { apertureMm: 100, magnificationX: 40, transparencyPct: 80 }
    const highPower = { apertureMm: 200, magnificationX: 80, transparencyPct: 100 }

    expect(computeLimitingMagnitude(midPower, 45)).toBeGreaterThan(
      computeLimitingMagnitude(lowPower, 45),
    )
    expect(computeLimitingMagnitude(highPower, 45)).toBeGreaterThan(
      computeLimitingMagnitude(midPower, 45),
    )
    expect(computeLimitingMagnitude(midPower, 75)).toBeGreaterThan(
      computeLimitingMagnitude(midPower, 20),
    )
  })

  it('filters stars against the computed limiting magnitude', () => {
    const optics = { apertureMm: 80, magnificationX: 20, transparencyPct: 60 }
    const limit = computeLimitingMagnitude(optics, 35)

    expect(isStarVisibleWithScopeOptics(limit, optics, 35)).toBe(true)
    expect(isStarVisibleWithScopeOptics(limit + 0.01, optics, 35)).toBe(false)
  })

  it('dims photometry for fainter stars and poorer conditions while keeping magnification growth compact', () => {
    const bright = computeStarPhotometry(2, DEFAULT_SCOPE_OPTICS_SETTINGS, 60)
    const faint = computeStarPhotometry(7, DEFAULT_SCOPE_OPTICS_SETTINGS, 60)
    const murky = computeStarPhotometry(
      6,
      { ...DEFAULT_SCOPE_OPTICS_SETTINGS, transparencyPct: 40 },
      25,
    )
    const clear = computeStarPhotometry(6, DEFAULT_SCOPE_OPTICS_SETTINGS, 60)
    const lowMag = computeStarPhotometry(6, DEFAULT_SCOPE_OPTICS_SETTINGS, 45)
    const highMag = computeStarPhotometry(
      6,
      { ...DEFAULT_SCOPE_OPTICS_SETTINGS, magnificationX: 400 },
      45,
    )

    expect(bright.displayIntensity).toBeGreaterThan(faint.displayIntensity)
    expect(bright.corePx).toBeGreaterThan(faint.corePx)
    expect(murky.displayIntensity).toBeLessThan(clear.displayIntensity)
    expect(murky.haloPx).toBeLessThan(clear.haloPx)
    expect(highMag.corePx).toBeGreaterThan(lowMag.corePx)
    expect(highMag.corePx).toBeLessThan(lowMag.corePx * 1.1)
  })
})
