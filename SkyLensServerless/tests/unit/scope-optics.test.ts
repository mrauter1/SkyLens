import { describe, expect, it } from 'vitest'

import {
  SCOPE_APPARENT_FIELD_DEG_RANGE,
  SCOPE_OPTICS_RANGES,
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
