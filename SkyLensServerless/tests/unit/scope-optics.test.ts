import { describe, expect, it } from 'vitest'

import {
  SCOPE_APPARENT_FIELD_DEG_RANGE,
  SCOPE_OPTICS_RANGES,
  computeScopeDeepStarCoreRadiusPx,
  computeScopeDeepStarEmergenceAlpha,
  computeScopeLimitingMagnitude,
  computeScopeRenderProfile,
  magnificationToScopeVerticalFovDeg,
  normalizeScopeOptics,
  passesScopeLimitingMagnitude,
  scopeVerticalFovDegToMagnificationX,
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
    expect(computeScopeDeepStarEmergenceAlpha(Number.NaN)).toBe(0)
    expect(computeScopeDeepStarCoreRadiusPx(Number.NaN)).toBe(1)
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

  it('retains threshold stars monotonically as aperture, transparency, and altitude improve', () => {
    const magnitude = 6.15

    expect(
      passesScopeLimitingMagnitude({
        magnitude,
        altitudeDeg: 18,
        optics: {
          apertureMm: 40,
          magnificationX: 50,
          transparencyPct: 40,
        },
      }),
    ).toBe(false)
    expect(
      passesScopeLimitingMagnitude({
        magnitude,
        altitudeDeg: 18,
        optics: {
          apertureMm: 240,
          magnificationX: 50,
          transparencyPct: 40,
        },
      }),
    ).toBe(true)
    expect(
      passesScopeLimitingMagnitude({
        magnitude,
        altitudeDeg: 18,
        optics: {
          apertureMm: 120,
          magnificationX: 50,
          transparencyPct: 85,
        },
      }),
    ).toBe(true)
    expect(
      passesScopeLimitingMagnitude({
        magnitude,
        altitudeDeg: 60,
        optics: {
          apertureMm: 120,
          magnificationX: 50,
          transparencyPct: 40,
        },
      }),
    ).toBe(true)
  })

  it('progressively emerges deep stars with a monotonic smooth alpha curve', () => {
    const deltas = [-1, -0.35, -0.2, 0, 0.35, 0.75, 1.5]
    const alphas = deltas.map((delta) => computeScopeDeepStarEmergenceAlpha(delta))

    expect(alphas[0]).toBe(0)
    expect(alphas[1]).toBe(0)
    expect(alphas[3]).toBeGreaterThan(0)
    expect(alphas[3]).toBeLessThan(1)
    expect(alphas[5]).toBe(1)
    expect(alphas[6]).toBe(1)

    for (let index = 1; index < alphas.length; index += 1) {
      expect(alphas[index]).toBeGreaterThanOrEqual(alphas[index - 1])
    }

    expect(computeScopeDeepStarEmergenceAlpha(-0.3501)).toBe(0)
    expect(computeScopeDeepStarEmergenceAlpha(-0.3499)).toBeGreaterThan(0)
    expect(computeScopeDeepStarEmergenceAlpha(0.7499)).toBeLessThan(1)
    expect(computeScopeDeepStarEmergenceAlpha(0.7501)).toBe(1)
  })

  it('maps deep-star core radius from magnitude without aperture coupling', () => {
    const brightRadius = computeScopeDeepStarCoreRadiusPx(1.5)
    const midRadius = computeScopeDeepStarCoreRadiusPx(6)
    const faintRadius = computeScopeDeepStarCoreRadiusPx(10.5)
    const sampledMagnitudes = [-4, 1.5, 3, 6, 8, 10.5, 18]
    const sampledRadii = sampledMagnitudes.map((magnitude) =>
      computeScopeDeepStarCoreRadiusPx(magnitude),
    )

    expect(brightRadius).toBe(2.5)
    expect(faintRadius).toBe(1)
    expect(midRadius).toBeGreaterThan(faintRadius)
    expect(midRadius).toBeLessThan(brightRadius)
    expect(computeScopeDeepStarCoreRadiusPx(-4)).toBe(2.5)
    expect(computeScopeDeepStarCoreRadiusPx(18)).toBe(1)

    for (let index = 1; index < sampledRadii.length; index += 1) {
      expect(sampledRadii[index]).toBeLessThanOrEqual(sampledRadii[index - 1])
    }

    for (const radius of sampledRadii) {
      expect(radius).toBeGreaterThanOrEqual(1)
      expect(radius).toBeLessThanOrEqual(2.5)
    }
  })

  it('derives a deterministic, finite, and monotonically narrower scope FOV from magnification', () => {
    const wideFovDeg = magnificationToScopeVerticalFovDeg(10)
    const defaultFovDeg = magnificationToScopeVerticalFovDeg(50)
    const narrowFovDeg = magnificationToScopeVerticalFovDeg(100)
    const clampedNarrowFovDeg = magnificationToScopeVerticalFovDeg(300)
    const malformedFovDeg = magnificationToScopeVerticalFovDeg(Number.NaN, Number.POSITIVE_INFINITY)

    expect(wideFovDeg).toBe(20)
    expect(defaultFovDeg).toBe(10)
    expect(narrowFovDeg).toBe(5)
    expect(clampedNarrowFovDeg).toBe(3)
    expect(wideFovDeg).toBeGreaterThan(defaultFovDeg)
    expect(defaultFovDeg).toBeGreaterThan(narrowFovDeg)
    expect(narrowFovDeg).toBeGreaterThanOrEqual(clampedNarrowFovDeg)
    expect(malformedFovDeg).toBe(10)
    expect(Number.isFinite(malformedFovDeg)).toBe(true)
  })

  it('round-trips the shared default apparent-field conversion for legacy scope FOV migration', () => {
    expect(SCOPE_APPARENT_FIELD_DEG_RANGE.defaultValue).toBe(500)

    const migratedMagnificationX = scopeVerticalFovDegToMagnificationX(12.5)

    expect(migratedMagnificationX).toBe(40)
    expect(magnificationToScopeVerticalFovDeg(migratedMagnificationX)).toBe(12.5)
    expect(scopeVerticalFovDegToMagnificationX(Number.NaN, Number.POSITIVE_INFINITY)).toBe(
      SCOPE_OPTICS_RANGES.magnificationX.defaultValue,
    )
  })
})
