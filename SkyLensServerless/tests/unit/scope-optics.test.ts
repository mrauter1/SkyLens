import { describe, expect, it } from 'vitest'

import {
  SCOPE_OPTICS_RANGES,
  computeScopeLimitingMagnitude,
  computeScopeRenderProfile,
  normalizeScopeOptics,
} from '../../lib/viewer/scope-optics'

describe('scope optics helpers', () => {
  it('normalizes malformed optics inputs to finite shared-range defaults', () => {
    const optics = normalizeScopeOptics({
      apertureMm: Number.NaN,
      magnificationX: Number.POSITIVE_INFINITY,
      transparencyPct: 'bad' as unknown as number,
    })

    expect(optics).toEqual({
      apertureMm: SCOPE_OPTICS_RANGES.apertureMm.defaultValue,
      magnificationX: SCOPE_OPTICS_RANGES.magnificationX.defaultValue,
      transparencyPct: SCOPE_OPTICS_RANGES.transparencyPct.defaultValue,
    })
  })

  it('keeps limiting magnitude and render profile outputs finite for malformed values', () => {
    const effectiveLimitMag = computeScopeLimitingMagnitude({
      apertureMm: Number.NaN,
      magnificationX: Number.POSITIVE_INFINITY,
      transparencyPct: Number.NEGATIVE_INFINITY,
      altitudeDeg: Number.NaN,
    })
    const renderProfile = computeScopeRenderProfile({
      magnitude: Number.NaN,
      altitudeDeg: Number.NaN,
      optics: {
        apertureMm: Number.NaN,
        magnificationX: Number.POSITIVE_INFINITY,
        transparencyPct: Number.NEGATIVE_INFINITY,
      },
    })

    expect(Number.isFinite(effectiveLimitMag)).toBe(true)
    expect(Object.values(renderProfile).every((value) => Number.isFinite(value))).toBe(true)
  })

  it('brightens the render profile and limiting magnitude under stronger optics and better conditions', () => {
    const dimProfile = computeScopeRenderProfile({
      magnitude: 8,
      altitudeDeg: 18,
      optics: {
        apertureMm: 60,
        magnificationX: 20,
        transparencyPct: 45,
      },
    })
    const brightProfile = computeScopeRenderProfile({
      magnitude: 8,
      altitudeDeg: 60,
      optics: {
        apertureMm: 240,
        magnificationX: 120,
        transparencyPct: 95,
      },
    })
    const dimLimit = computeScopeLimitingMagnitude({
      apertureMm: 60,
      magnificationX: 20,
      transparencyPct: 45,
      altitudeDeg: 18,
    })
    const brightLimit = computeScopeLimitingMagnitude({
      apertureMm: 240,
      magnificationX: 120,
      transparencyPct: 95,
      altitudeDeg: 60,
    })

    expect(brightLimit).toBeGreaterThan(dimLimit)
    expect(brightProfile.intensity).toBeGreaterThan(dimProfile.intensity)
    expect(brightProfile.haloPx).toBeGreaterThan(dimProfile.haloPx)
  })
})
