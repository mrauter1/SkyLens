import { describe, expect, it } from 'vitest'

import {
  MAIN_VIEW_DEEP_STAR_GOVERNOR_LIMITING_MAGNITUDE_THRESHOLDS,
  MAIN_VIEW_DEEP_STAR_STARTUP_VISIBLE_COUNT_BAND,
  MAIN_VIEW_OPTICS_RANGES,
  SCOPE_APPARENT_FIELD_DEG_RANGE,
  SCOPE_OPTICS_RANGES,
  computeScopeDeepStarCoreRadiusPx,
  computeScopeDeepStarEmergenceAlpha,
  computeScopeLimitingMagnitude,
  computeScopeRenderProfile,
  getDefaultMainViewOptics,
  getMainViewDeepStarBand,
  magnificationToMainViewVerticalFovDeg,
  magnificationToScopeVerticalFovDeg,
  normalizeMainViewOptics,
  normalizeScopeOptics,
  passesScopeLimitingMagnitude,
  resolveMainViewDeepStarGovernor,
  scopeVerticalFovDegToMagnificationX,
} from '../../lib/viewer/scope-optics'

const SCOPE_LIMITING_MAGNITUDE_ANCHOR_LOW = {
  apertureMm: 40,
  magnitude: 3,
} as const
const SCOPE_LIMITING_MAGNITUDE_ANCHOR_HIGH = {
  apertureMm: 240,
  magnitude: 10,
} as const
const SCOPE_LIMITING_MAGNITUDE_MAX = 15.5
const SCOPE_LIMITING_MAGNITUDE_SLOPE =
  (SCOPE_LIMITING_MAGNITUDE_ANCHOR_HIGH.magnitude -
    SCOPE_LIMITING_MAGNITUDE_ANCHOR_LOW.magnitude) /
  (SCOPE_LIMITING_MAGNITUDE_ANCHOR_HIGH.apertureMm -
    SCOPE_LIMITING_MAGNITUDE_ANCHOR_LOW.apertureMm)

function getAltitudePenaltyForTest(altitudeDeg: number) {
  const zenithDistanceDeg = Math.min(Math.max(90 - altitudeDeg, 0), 80)
  const airmass = 1 / Math.cos((zenithDistanceDeg * Math.PI) / 180)

  return 0.22 * (airmass - 1)
}

function getExpectedScopeLimitingMagnitudeForTest(apertureMm: number, altitudeDeg: number) {
  const base =
    SCOPE_LIMITING_MAGNITUDE_ANCHOR_LOW.magnitude +
    (apertureMm - SCOPE_LIMITING_MAGNITUDE_ANCHOR_LOW.apertureMm) *
      SCOPE_LIMITING_MAGNITUDE_SLOPE

  return Math.min(base - getAltitudePenaltyForTest(altitudeDeg), SCOPE_LIMITING_MAGNITUDE_MAX)
}

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

  it('derives the deep-star render limit from the anchored aperture-altitude line', () => {
    const apertureMm = 20
    const altitudeDeg = -90
    const expectedLimitMag = getExpectedScopeLimitingMagnitudeForTest(apertureMm, altitudeDeg)
    const renderProfile = computeScopeRenderProfile({
      magnitude: 6,
      altitudeDeg,
      optics: {
        apertureMm,
        magnificationX: 50,
        transparencyPct: 85,
      },
    })
    const limitingMagnitude = computeScopeLimitingMagnitude({
      apertureMm,
      magnificationX: 50,
      transparencyPct: 85,
      altitudeDeg,
    })

    expect(limitingMagnitude).toBeCloseTo(expectedLimitMag)
    expect(renderProfile.effectiveLimitMag).toBeCloseTo(expectedLimitMag)
  })

  it('keeps the helper and render profile aligned across anchor and edge apertures', () => {
    const cases = [
      { apertureMm: 20, expectedAtZenith: 2.3 },
      { apertureMm: 40, expectedAtZenith: 3 },
      { apertureMm: 240, expectedAtZenith: 10 },
      { apertureMm: 400, expectedAtZenith: 15.5 },
    ]

    for (const { apertureMm, expectedAtZenith } of cases) {
      const limitingMagnitude = computeScopeLimitingMagnitude({
        apertureMm,
        magnificationX: 50,
        transparencyPct: 85,
        altitudeDeg: 90,
      })
      const renderProfile = computeScopeRenderProfile({
        magnitude: 6,
        altitudeDeg: 90,
        optics: {
          apertureMm,
          magnificationX: 50,
          transparencyPct: 85,
        },
      })

      expect(limitingMagnitude).toBeCloseTo(expectedAtZenith)
      expect(limitingMagnitude).toBeCloseTo(
        getExpectedScopeLimitingMagnitudeForTest(apertureMm, 90),
      )
      expect(renderProfile.effectiveLimitMag).toBeCloseTo(expectedAtZenith)
    }
  })

  it('brightens the render profile and limiting magnitude under stronger aperture and better altitude', () => {
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
        magnificationX: 20,
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

  it('keeps deep-star emergence unchanged when magnification changes at fixed aperture', () => {
    const lowMagnificationLimit = computeScopeLimitingMagnitude({
      apertureMm: 160,
      magnificationX: 10,
      transparencyPct: 40,
      altitudeDeg: 45,
    })
    const highMagnificationLimit = computeScopeLimitingMagnitude({
      apertureMm: 160,
      magnificationX: 200,
      transparencyPct: 95,
      altitudeDeg: 45,
    })
    const lowMagnificationProfile = computeScopeRenderProfile({
      magnitude: 7.8,
      altitudeDeg: 45,
      optics: {
        apertureMm: 160,
        magnificationX: 10,
        transparencyPct: 40,
      },
    })
    const highMagnificationProfile = computeScopeRenderProfile({
      magnitude: 7.8,
      altitudeDeg: 45,
      optics: {
        apertureMm: 160,
        magnificationX: 200,
        transparencyPct: 95,
      },
    })

    expect(highMagnificationLimit).toBe(lowMagnificationLimit)
    expect(highMagnificationProfile.effectiveLimitMag).toBe(lowMagnificationProfile.effectiveLimitMag)
    expect(highMagnificationProfile.intensity).toBeCloseTo(lowMagnificationProfile.intensity)
    expect(highMagnificationProfile.haloPx).toBeCloseTo(lowMagnificationProfile.haloPx)
  })

  it('retains threshold stars monotonically as aperture and altitude improve', () => {
    const magnitude = 5.7

    expect(
      passesScopeLimitingMagnitude({
        magnitude,
        altitudeDeg: 18,
        optics: {
          apertureMm: 20,
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
          apertureMm: 160,
          magnificationX: 50,
          transparencyPct: 40,
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

  it('normalizes main-view optics defaults and maps 1.0x to the base viewer fov', () => {
    expect(getDefaultMainViewOptics()).toEqual({
      apertureMm: MAIN_VIEW_OPTICS_RANGES.apertureMm.defaultValue,
      magnificationX: MAIN_VIEW_OPTICS_RANGES.magnificationX.defaultValue,
    })
    expect(
      normalizeMainViewOptics({
        apertureMm: 12,
        magnificationX: Number.POSITIVE_INFINITY,
      }),
    ).toEqual({
      apertureMm: MAIN_VIEW_OPTICS_RANGES.apertureMm.min,
      magnificationX: MAIN_VIEW_OPTICS_RANGES.magnificationX.defaultValue,
    })
    expect(magnificationToMainViewVerticalFovDeg(1, 50)).toBe(50)
    expect(magnificationToMainViewVerticalFovDeg(0.25, 50)).toBe(179)
    expect(magnificationToMainViewVerticalFovDeg(2, 50)).toBe(25)
  })

  it('applies main-view deep-star governor precedence before tier selection', () => {
    expect(
      resolveMainViewDeepStarGovernor({
        hasObserver: false,
        starsLayerEnabled: true,
        daylightSuppressed: false,
        mainViewDeepStarsEnabled: false,
        apertureMm: 120,
        magnificationX: 12,
      }),
    ).toMatchObject({
      enabled: false,
      tier: 'off',
      decisionSource: 'no-observer',
      transitionReason: 'observer-missing',
    })

    expect(
      resolveMainViewDeepStarGovernor({
        hasObserver: true,
        starsLayerEnabled: false,
        daylightSuppressed: true,
        mainViewDeepStarsEnabled: false,
        apertureMm: 120,
        magnificationX: 12,
      }),
    ).toMatchObject({
      enabled: false,
      tier: 'off',
      decisionSource: 'stars-layer-disabled',
      transitionReason: 'stars-layer-disabled',
    })

    expect(
      resolveMainViewDeepStarGovernor({
        hasObserver: true,
        starsLayerEnabled: true,
        daylightSuppressed: true,
        mainViewDeepStarsEnabled: false,
        apertureMm: 120,
        magnificationX: 12,
      }),
    ).toMatchObject({
      enabled: false,
      tier: 'off',
      decisionSource: 'daylight-suppressed',
      transitionReason: 'daylight-suppressed',
    })

    expect(
      resolveMainViewDeepStarGovernor({
        hasObserver: true,
        starsLayerEnabled: true,
        daylightSuppressed: false,
        mainViewDeepStarsEnabled: false,
        apertureMm: 120,
        magnificationX: 12,
      }),
    ).toMatchObject({
      enabled: false,
      tier: 'off',
      decisionSource: 'main-view-setting-disabled',
      transitionReason: 'main-view-setting-disabled',
    })
  })

  it('uses deterministic thresholds and hysteresis for main-view deep-star tier transitions', () => {
    const baseline = resolveMainViewDeepStarGovernor({
      hasObserver: true,
      starsLayerEnabled: true,
      daylightSuppressed: false,
      mainViewDeepStarsEnabled: true,
      apertureMm: 140,
      magnificationX: 1,
    })
    const standardHeld = resolveMainViewDeepStarGovernor({
      hasObserver: true,
      starsLayerEnabled: true,
      daylightSuppressed: false,
      mainViewDeepStarsEnabled: true,
      apertureMm: 132,
      magnificationX: 1,
      previousTier: 'standard',
      previousTransitionReason: 'magnification-promoted-standard',
    })
    const standardDropped = resolveMainViewDeepStarGovernor({
      hasObserver: true,
      starsLayerEnabled: true,
      daylightSuppressed: false,
      mainViewDeepStarsEnabled: true,
      apertureMm: 124,
      magnificationX: 1,
      previousTier: 'standard',
      previousTransitionReason: 'magnification-promoted-standard',
    })
    const detailed = resolveMainViewDeepStarGovernor({
      hasObserver: true,
      starsLayerEnabled: true,
      daylightSuppressed: false,
      mainViewDeepStarsEnabled: true,
      apertureMm: 200,
      magnificationX: 1,
      previousTier: 'standard',
      previousTransitionReason: 'magnification-promoted-standard',
    })
    const precisionHeld = resolveMainViewDeepStarGovernor({
      hasObserver: true,
      starsLayerEnabled: true,
      daylightSuppressed: false,
      mainViewDeepStarsEnabled: true,
      apertureMm: 241,
      magnificationX: 1,
      previousTier: 'precision',
      previousTransitionReason: 'magnification-promoted-precision',
    })
    const precisionDropped = resolveMainViewDeepStarGovernor({
      hasObserver: true,
      starsLayerEnabled: true,
      daylightSuppressed: false,
      mainViewDeepStarsEnabled: true,
      apertureMm: 239,
      magnificationX: 1,
      previousTier: 'precision',
      previousTransitionReason: 'magnification-promoted-precision',
    })

    expect(baseline).toMatchObject({
      enabled: true,
      tier: 'standard',
      band: getMainViewDeepStarBand('standard'),
      decisionSource: 'governor',
      transitionReason: 'initial-baseline',
    })
    expect(standardHeld.tier).toBe('standard')
    expect(standardHeld.transitionReason).toBe('magnification-promoted-standard')
    expect(standardDropped.tier).toBe('baseline')
    expect(standardDropped.transitionReason).toBe('magnification-demoted-baseline')
    expect(detailed.tier).toBe('detailed')
    expect(detailed.transitionReason).toBe('magnification-promoted-detailed')
    expect(precisionHeld.tier).toBe('precision')
    expect(precisionHeld.transitionReason).toBe('magnification-promoted-precision')
    expect(precisionDropped.tier).toBe('detailed')
    expect(precisionDropped.transitionReason).toBe('magnification-demoted-detailed')
  })

  it('keeps the startup main-view visible deep-star count inside the documented conservative band', () => {
    const startupOptics = getDefaultMainViewOptics()
    const startupGovernor = resolveMainViewDeepStarGovernor({
      hasObserver: true,
      starsLayerEnabled: true,
      daylightSuppressed: false,
      mainViewDeepStarsEnabled: true,
      apertureMm: startupOptics.apertureMm,
      magnificationX: startupOptics.magnificationX,
    })
    const startupFixtureMagnitudes = [2.2, 2.6, 3.1, 3.4, 4.2]
    const visibleStartupCount = startupFixtureMagnitudes
      .filter((magnitude) => magnitude <= (startupGovernor.band?.maxMagnitude ?? 0))
      .filter((magnitude) => {
        const renderProfile = computeScopeRenderProfile({
          magnitude,
          altitudeDeg: 45,
          optics: startupOptics,
        })

        return computeScopeDeepStarEmergenceAlpha(renderProfile.effectiveLimitMag - magnitude) > 0
      }).length

    expect(startupGovernor.tier).toBe('baseline')
    expect(startupGovernor.band).toEqual(getMainViewDeepStarBand('baseline'))
    expect(visibleStartupCount).toBeGreaterThanOrEqual(
      MAIN_VIEW_DEEP_STAR_STARTUP_VISIBLE_COUNT_BAND.min,
    )
    expect(visibleStartupCount).toBeLessThanOrEqual(
      MAIN_VIEW_DEEP_STAR_STARTUP_VISIBLE_COUNT_BAND.max,
    )
    expect(visibleStartupCount).toBe(3)
  })

  it('promotes main-view deep-star bands from aperture-driven limiting magnitude even at fixed 1x', () => {
    const baseline = resolveMainViewDeepStarGovernor({
      hasObserver: true,
      starsLayerEnabled: true,
      daylightSuppressed: false,
      mainViewDeepStarsEnabled: true,
      apertureMm: 40,
      magnificationX: 1,
    })
    const detailed = resolveMainViewDeepStarGovernor({
      hasObserver: true,
      starsLayerEnabled: true,
      daylightSuppressed: false,
      mainViewDeepStarsEnabled: true,
      apertureMm: 240,
      magnificationX: 1,
      previousTier: baseline.tier,
    })
    const precision = resolveMainViewDeepStarGovernor({
      hasObserver: true,
      starsLayerEnabled: true,
      daylightSuppressed: false,
      mainViewDeepStarsEnabled: true,
      apertureMm: 400,
      magnificationX: 1,
      previousTier: detailed.tier,
    })

    expect(baseline.band?.maxMagnitude).toBeLessThanOrEqual(
      MAIN_VIEW_DEEP_STAR_GOVERNOR_LIMITING_MAGNITUDE_THRESHOLDS.standard.enter,
    )
    expect(detailed.tier).toBe('detailed')
    expect(detailed.band).toEqual(getMainViewDeepStarBand('detailed'))
    expect(precision.tier).toBe('precision')
    expect(precision.band).toEqual(getMainViewDeepStarBand('precision'))
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
