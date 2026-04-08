import {
  SCOPE_DATASET_BANDS,
  type ScopeBandDefinition,
} from '../scope/contracts'

export const SCOPE_OPTICS_RANGES = {
  apertureMm: {
    min: 20,
    max: 400,
    step: 5,
    defaultValue: 120,
  },
  magnificationX: {
    min: 10,
    max: 300,
    step: 5,
    defaultValue: 50,
  },
  transparencyPct: {
    min: 40,
    max: 100,
    step: 1,
    defaultValue: 85,
  },
} as const

export const MAIN_VIEW_OPTICS_RANGES = {
  apertureMm: {
    min: 20,
    max: 400,
    step: 5,
    defaultValue: 120,
  },
  magnificationX: {
    min: 0.25,
    max: 300,
    step: 0.25,
    defaultValue: 1,
  },
} as const

export const SCOPE_VERTICAL_FOV_RANGE = {
  min: 3,
  max: 20,
  defaultValue: 10,
} as const

export const SCOPE_APPARENT_FIELD_DEG_RANGE = {
  min: 10,
  max: 5_000,
  defaultValue:
    SCOPE_OPTICS_RANGES.magnificationX.defaultValue * SCOPE_VERTICAL_FOV_RANGE.defaultValue,
} as const

export type ScopeOptics = {
  apertureMm: number
  magnificationX: number
  transparencyPct: number
}

export type ActiveOptics = Pick<ScopeOptics, 'apertureMm' | 'magnificationX'>
export type MainViewOptics = ActiveOptics

export type ScopeRenderProfile = {
  effectiveLimitMag: number
  relativeFlux: number
  transmission: number
  opticsGain: number
  intensity: number
  corePx: number
  haloPx: number
}

export type MainViewDeepStarQualityTier = 'off' | 'baseline' | 'standard' | 'detailed' | 'precision'
export type MainViewDeepStarDecisionSource =
  | 'no-observer'
  | 'stars-layer-disabled'
  | 'daylight-suppressed'
  | 'main-view-setting-disabled'
  | 'governor'
export type MainViewDeepStarTransitionReason =
  | 'observer-missing'
  | 'stars-layer-disabled'
  | 'daylight-suppressed'
  | 'main-view-setting-disabled'
  | 'initial-baseline'
  | 'magnification-promoted-standard'
  | 'magnification-demoted-baseline'
  | 'magnification-promoted-detailed'
  | 'magnification-demoted-standard'
  | 'magnification-promoted-precision'
  | 'magnification-demoted-detailed'
export type MainViewDeepStarGovernorSnapshot = {
  enabled: boolean
  tier: MainViewDeepStarQualityTier
  band: ScopeBandDefinition | null
  decisionSource: MainViewDeepStarDecisionSource
  transitionReason: MainViewDeepStarTransitionReason
}

export const MAIN_VIEW_DEEP_STAR_GOVERNOR_MAGNIFICATION_THRESHOLDS = {
  standard: {
    enter: 1.5,
    exit: 1.25,
  },
  detailed: {
    enter: 3,
    exit: 2.5,
  },
  precision: {
    enter: 6,
    exit: 5,
  },
} as const

export const MAIN_VIEW_DEEP_STAR_STARTUP_VISIBLE_COUNT_BAND = {
  min: 2,
  max: 4,
} as const

const MAIN_VIEW_DEEP_STAR_TIER_BANDS: Record<
  Exclude<MainViewDeepStarQualityTier, 'off'>,
  ScopeBandDefinition
> = {
  baseline: SCOPE_DATASET_BANDS[0],
  standard: SCOPE_DATASET_BANDS[1],
  detailed: SCOPE_DATASET_BANDS[2],
  precision: SCOPE_DATASET_BANDS[3],
}

const DEEP_STAR_EMERGENCE_BAND = {
  start: -0.35,
  end: 0.75,
} as const

const DEEP_STAR_CORE_RADIUS_RANGE_PX = {
  min: 1,
  max: 2.5,
} as const

const DEEP_STAR_CORE_RADIUS_MAG_RANGE = {
  bright: 1.5,
  faint: 10.5,
} as const

const DEEP_STAR_CORE_RADIUS_CURVE = 0.85
const DEEP_STAR_EMERGENCE_CURVE = 1.35
const MAIN_VIEW_FIXED_MAGNIFICATION_X = MAIN_VIEW_OPTICS_RANGES.magnificationX.defaultValue

export function normalizeScopeOptics(
  scopeOptics: Partial<ScopeOptics> | null | undefined,
): ScopeOptics {
  return {
    apertureMm: normalizeScopeOpticsValue('apertureMm', scopeOptics?.apertureMm),
    magnificationX: normalizeScopeOpticsValue(
      'magnificationX',
      scopeOptics?.magnificationX,
    ),
    transparencyPct: normalizeScopeOpticsValue(
      'transparencyPct',
      scopeOptics?.transparencyPct,
    ),
  }
}

export function getDefaultMainViewOptics(): MainViewOptics {
  return {
    apertureMm: MAIN_VIEW_OPTICS_RANGES.apertureMm.defaultValue,
    magnificationX: MAIN_VIEW_FIXED_MAGNIFICATION_X,
  }
}

export function normalizeMainViewOptics(
  optics: Partial<MainViewOptics> | null | undefined,
): MainViewOptics {
  return {
    apertureMm: normalizeMainViewOpticsValue('apertureMm', optics?.apertureMm),
    magnificationX: MAIN_VIEW_FIXED_MAGNIFICATION_X,
  }
}

export function getMainViewDeepStarBand(
  tier: Exclude<MainViewDeepStarQualityTier, 'off'>,
) {
  return MAIN_VIEW_DEEP_STAR_TIER_BANDS[tier]
}

export function resolveMainViewDeepStarGovernor({
  hasObserver,
  starsLayerEnabled,
  daylightSuppressed,
  mainViewDeepStarsEnabled,
  magnificationX,
  previousTier,
  previousTransitionReason,
}: {
  hasObserver: boolean
  starsLayerEnabled: boolean
  daylightSuppressed: boolean
  mainViewDeepStarsEnabled: boolean
  magnificationX: number
  previousTier?: MainViewDeepStarQualityTier | null
  previousTransitionReason?: MainViewDeepStarTransitionReason | null
}): MainViewDeepStarGovernorSnapshot {
  if (!hasObserver) {
    return createMainViewDeepStarHardOffState('no-observer', 'observer-missing')
  }

  if (!starsLayerEnabled) {
    return createMainViewDeepStarHardOffState(
      'stars-layer-disabled',
      'stars-layer-disabled',
    )
  }

  if (daylightSuppressed) {
    return createMainViewDeepStarHardOffState(
      'daylight-suppressed',
      'daylight-suppressed',
    )
  }

  if (!mainViewDeepStarsEnabled) {
    return createMainViewDeepStarHardOffState(
      'main-view-setting-disabled',
      'main-view-setting-disabled',
    )
  }

  const safeMagnificationX = normalizeMainViewOpticsValue('magnificationX', magnificationX)
  const normalizedPreviousTier = normalizeMainViewDeepStarGovernorTier(previousTier)
  const nextTier = selectMainViewDeepStarGovernorTier({
    magnificationX: safeMagnificationX,
    previousTier: normalizedPreviousTier,
  })
  const transitionReason =
    getMainViewDeepStarTierTransitionReason(normalizedPreviousTier, nextTier) ??
    previousTransitionReason ??
    'initial-baseline'

  return {
    enabled: true,
    tier: nextTier,
    band: getMainViewDeepStarBand(nextTier),
    decisionSource: 'governor',
    transitionReason,
  }
}

export function normalizeScopeOpticsValue(
  key: keyof ScopeOptics,
  value: unknown,
) {
  const range = SCOPE_OPTICS_RANGES[key]
  const parsedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value)
        : Number.NaN

  if (!Number.isFinite(parsedValue)) {
    return range.defaultValue
  }

  return clamp(parsedValue, range.min, range.max)
}

export function normalizeMainViewOpticsValue(
  key: keyof MainViewOptics,
  value: unknown,
) {
  const range = MAIN_VIEW_OPTICS_RANGES[key]
  const parsedValue = parseFiniteNumber(value)

  if (!Number.isFinite(parsedValue)) {
    return range.defaultValue
  }

  return clamp(parsedValue, range.min, range.max)
}

export function normalizeScopeVerticalFovDeg(value: unknown) {
  const parsedValue = parseFiniteNumber(value)

  if (!Number.isFinite(parsedValue)) {
    return SCOPE_VERTICAL_FOV_RANGE.defaultValue
  }

  return clamp(parsedValue, SCOPE_VERTICAL_FOV_RANGE.min, SCOPE_VERTICAL_FOV_RANGE.max)
}

export function magnificationToScopeVerticalFovDeg(
  magnificationX: unknown,
  apparentFieldDeg: unknown = SCOPE_APPARENT_FIELD_DEG_RANGE.defaultValue,
) {
  const safeMagnificationX = normalizeScopeOpticsValue('magnificationX', magnificationX)
  const safeApparentFieldDeg = normalizeScopeApparentFieldDeg(apparentFieldDeg)

  return normalizeScopeVerticalFovDeg(safeApparentFieldDeg / safeMagnificationX)
}

export function magnificationToMainViewVerticalFovDeg(
  magnificationX: unknown,
  baseVerticalFovDeg: unknown,
) {
  const safeMagnificationX = normalizeMainViewOpticsValue('magnificationX', magnificationX)
  const safeBaseVerticalFovDeg = normalizeProfileVerticalFovDeg(baseVerticalFovDeg)

  return normalizeProfileVerticalFovDeg(safeBaseVerticalFovDeg / safeMagnificationX)
}

export function scopeVerticalFovDegToMagnificationX(
  scopeVerticalFovDeg: unknown,
  apparentFieldDeg: unknown = SCOPE_APPARENT_FIELD_DEG_RANGE.defaultValue,
) {
  const safeScopeVerticalFovDeg = normalizeScopeVerticalFovDeg(scopeVerticalFovDeg)
  const safeApparentFieldDeg = normalizeScopeApparentFieldDeg(apparentFieldDeg)

  return normalizeScopeOpticsValue(
    'magnificationX',
    safeApparentFieldDeg / safeScopeVerticalFovDeg,
  )
}

export function computeScopeLimitingMagnitude({
  apertureMm,
  magnificationX: _magnificationX,
  transparencyPct: _transparencyPct,
  altitudeDeg,
}: ScopeOptics & {
  altitudeDeg: unknown
}) {
  void _magnificationX
  void _transparencyPct
  const optics = normalizeScopeOptics({
    apertureMm,
    magnificationX: _magnificationX,
    transparencyPct: _transparencyPct,
  })
  const safeAltitudeDeg = normalizeAltitudeDeg(altitudeDeg)
  const base = 2.7 + 2.0 * Math.log10(optics.apertureMm)
  const altitudePenalty = getAltitudePenalty(safeAltitudeDeg)

  return clamp(base - altitudePenalty, 3, 15.5)
}

export function passesScopeLimitingMagnitude({
  magnitude,
  altitudeDeg,
  optics,
}: {
  magnitude: unknown
  altitudeDeg: unknown
  optics: Partial<ScopeOptics> | null | undefined
}) {
  const safeMagnitude = normalizeMagnitude(magnitude)

  if (safeMagnitude === null) {
    return false
  }

  return (
    safeMagnitude <=
    computeScopeLimitingMagnitude({
      ...normalizeScopeOptics(optics),
      altitudeDeg,
    })
  )
}

export function computeScopeRenderProfile({
  magnitude,
  altitudeDeg,
  optics,
}: {
  magnitude: unknown
  altitudeDeg: unknown
  optics: Partial<ScopeOptics> | null | undefined
}): ScopeRenderProfile {
  const normalizedOptics = normalizeScopeOptics(optics)
  const safeMagnitude = normalizeMagnitude(magnitude) ?? 12
  const safeAltitudeDeg = normalizeAltitudeDeg(altitudeDeg)
  const effectiveLimitMag = computeScopeLimitingMagnitude({
    ...normalizedOptics,
    altitudeDeg: safeAltitudeDeg,
  })
  const relativeFlux = clamp(
    Math.pow(10, -0.4 * (safeMagnitude - 6)),
    0.0003,
    250,
  )
  const altitudePenalty = getAltitudePenalty(safeAltitudeDeg)
  const transmission = clamp(
    Math.max(0.24, 1 - altitudePenalty / 2.4),
    0.18,
    1,
  )
  const apertureGain = clamp(
    0.62 + Math.log10(normalizedOptics.apertureMm / 40 + 1) * 0.95,
    0.72,
    1.7,
  )
  const opticsGain = clamp(apertureGain, 0.8, 1.95)
  const nearLimitBoost = clamp((effectiveLimitMag - safeMagnitude + 1.4) / 3.2, 0.24, 1.45)
  const intensity = clamp(
    Math.pow(relativeFlux * transmission * opticsGain * nearLimitBoost, 0.26),
    0.16,
    1,
  )
  const corePx = clamp(0.95 + intensity * 1.65, 1, 2.6)
  const haloPx = clamp(corePx + 0.85 + intensity * 2.25, 2.1, 5.9)

  return {
    effectiveLimitMag,
    relativeFlux,
    transmission,
    opticsGain,
    intensity,
    corePx,
    haloPx,
  }
}

export function computeScopeDeepStarEmergenceAlpha(deltaMag: unknown) {
  if (typeof deltaMag !== 'number' || !Number.isFinite(deltaMag)) {
    return 0
  }

  const emergenceRange =
    DEEP_STAR_EMERGENCE_BAND.end - DEEP_STAR_EMERGENCE_BAND.start

  if (emergenceRange <= 0) {
    return deltaMag >= DEEP_STAR_EMERGENCE_BAND.end ? 1 : 0
  }

  const normalizedDelta = clamp(
    (deltaMag - DEEP_STAR_EMERGENCE_BAND.start) / emergenceRange,
    0,
    1,
  )
  const smoothedDelta = smoothstep(normalizedDelta)

  return clamp(Math.pow(smoothedDelta, DEEP_STAR_EMERGENCE_CURVE), 0, 1)
}

export function computeScopeDeepStarCoreRadiusPx(magnitude: unknown) {
  const safeMagnitude =
    typeof magnitude === 'number' && Number.isFinite(magnitude)
      ? magnitude
      : DEEP_STAR_CORE_RADIUS_MAG_RANGE.faint
  const magnitudeRange =
    DEEP_STAR_CORE_RADIUS_MAG_RANGE.faint - DEEP_STAR_CORE_RADIUS_MAG_RANGE.bright

  if (magnitudeRange === 0) {
    return DEEP_STAR_CORE_RADIUS_RANGE_PX.min
  }

  const normalizedBrightness = clamp(
    (DEEP_STAR_CORE_RADIUS_MAG_RANGE.faint - safeMagnitude) / magnitudeRange,
    0,
    1,
  )

  return clamp(
    DEEP_STAR_CORE_RADIUS_RANGE_PX.min +
      (DEEP_STAR_CORE_RADIUS_RANGE_PX.max - DEEP_STAR_CORE_RADIUS_RANGE_PX.min) *
        Math.pow(normalizedBrightness, DEEP_STAR_CORE_RADIUS_CURVE),
    DEEP_STAR_CORE_RADIUS_RANGE_PX.min,
    DEEP_STAR_CORE_RADIUS_RANGE_PX.max,
  )
}

function normalizeAltitudeDeg(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }

  return clamp(value, -90, 90)
}

function createMainViewDeepStarHardOffState(
  decisionSource: Exclude<MainViewDeepStarDecisionSource, 'governor'>,
  transitionReason: Extract<
    MainViewDeepStarTransitionReason,
    | 'observer-missing'
    | 'stars-layer-disabled'
    | 'daylight-suppressed'
    | 'main-view-setting-disabled'
  >,
): MainViewDeepStarGovernorSnapshot {
  return {
    enabled: false,
    tier: 'off',
    band: null,
    decisionSource,
    transitionReason,
  }
}

function normalizeMainViewDeepStarGovernorTier(
  tier: MainViewDeepStarQualityTier | null | undefined,
): Exclude<MainViewDeepStarQualityTier, 'off'> | null {
  switch (tier) {
    case 'baseline':
    case 'standard':
    case 'detailed':
    case 'precision':
      return tier
    default:
      return null
  }
}

function selectMainViewDeepStarGovernorTier({
  magnificationX,
  previousTier,
}: {
  magnificationX: number
  previousTier: Exclude<MainViewDeepStarQualityTier, 'off'> | null
}): Exclude<MainViewDeepStarQualityTier, 'off'> {
  switch (previousTier) {
    case 'precision':
      if (magnificationX >= MAIN_VIEW_DEEP_STAR_GOVERNOR_MAGNIFICATION_THRESHOLDS.precision.exit) {
        return 'precision'
      }
      return magnificationX >= MAIN_VIEW_DEEP_STAR_GOVERNOR_MAGNIFICATION_THRESHOLDS.detailed.exit
        ? 'detailed'
        : magnificationX >=
              MAIN_VIEW_DEEP_STAR_GOVERNOR_MAGNIFICATION_THRESHOLDS.standard.exit
          ? 'standard'
          : 'baseline'
    case 'detailed':
      if (magnificationX >= MAIN_VIEW_DEEP_STAR_GOVERNOR_MAGNIFICATION_THRESHOLDS.precision.enter) {
        return 'precision'
      }
      if (magnificationX >= MAIN_VIEW_DEEP_STAR_GOVERNOR_MAGNIFICATION_THRESHOLDS.detailed.exit) {
        return 'detailed'
      }
      return magnificationX >=
            MAIN_VIEW_DEEP_STAR_GOVERNOR_MAGNIFICATION_THRESHOLDS.standard.exit
        ? 'standard'
        : 'baseline'
    case 'standard':
      if (magnificationX >= MAIN_VIEW_DEEP_STAR_GOVERNOR_MAGNIFICATION_THRESHOLDS.precision.enter) {
        return 'precision'
      }
      if (magnificationX >= MAIN_VIEW_DEEP_STAR_GOVERNOR_MAGNIFICATION_THRESHOLDS.detailed.enter) {
        return 'detailed'
      }
      return magnificationX >=
            MAIN_VIEW_DEEP_STAR_GOVERNOR_MAGNIFICATION_THRESHOLDS.standard.exit
        ? 'standard'
        : 'baseline'
    case 'baseline':
    default:
      if (magnificationX >= MAIN_VIEW_DEEP_STAR_GOVERNOR_MAGNIFICATION_THRESHOLDS.precision.enter) {
        return 'precision'
      }
      if (magnificationX >= MAIN_VIEW_DEEP_STAR_GOVERNOR_MAGNIFICATION_THRESHOLDS.detailed.enter) {
        return 'detailed'
      }
      if (magnificationX >= MAIN_VIEW_DEEP_STAR_GOVERNOR_MAGNIFICATION_THRESHOLDS.standard.enter) {
        return 'standard'
      }
      return 'baseline'
  }
}

function getMainViewDeepStarTierTransitionReason(
  previousTier: Exclude<MainViewDeepStarQualityTier, 'off'> | null,
  nextTier: Exclude<MainViewDeepStarQualityTier, 'off'>,
): Exclude<
  MainViewDeepStarTransitionReason,
  | 'observer-missing'
  | 'stars-layer-disabled'
  | 'daylight-suppressed'
  | 'main-view-setting-disabled'
> | null {
  if (previousTier === null) {
    return 'initial-baseline'
  }

  if (previousTier === nextTier) {
    return null
  }

  if (previousTier === 'baseline' && nextTier === 'standard') {
    return 'magnification-promoted-standard'
  }

  if (previousTier === 'standard' && nextTier === 'baseline') {
    return 'magnification-demoted-baseline'
  }

  if (
    (previousTier === 'baseline' || previousTier === 'standard') &&
    nextTier === 'detailed'
  ) {
    return 'magnification-promoted-detailed'
  }

  if (
    previousTier === 'detailed' &&
    (nextTier === 'baseline' || nextTier === 'standard')
  ) {
    return nextTier === 'standard'
      ? 'magnification-demoted-standard'
      : 'magnification-demoted-baseline'
  }

  if (nextTier === 'precision') {
    return 'magnification-promoted-precision'
  }

  if (previousTier === 'precision' && nextTier === 'detailed') {
    return 'magnification-demoted-detailed'
  }

  if (nextTier === 'standard') {
    return 'magnification-demoted-standard'
  }

  return 'magnification-demoted-baseline'
}

function normalizeScopeApparentFieldDeg(value: unknown) {
  const parsedValue = parseFiniteNumber(value)

  if (!Number.isFinite(parsedValue)) {
    return SCOPE_APPARENT_FIELD_DEG_RANGE.defaultValue
  }

  return clamp(parsedValue, SCOPE_APPARENT_FIELD_DEG_RANGE.min, SCOPE_APPARENT_FIELD_DEG_RANGE.max)
}

function normalizeMagnitude(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return clamp(value, -8, 30)
}

function normalizeProfileVerticalFovDeg(value: unknown) {
  const parsedValue = parseFiniteNumber(value)

  if (!Number.isFinite(parsedValue)) {
    return 50
  }

  return clamp(parsedValue, 1, 179)
}

function parseFiniteNumber(value: unknown) {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return Number(value)
  }

  return Number.NaN
}

function smoothstep(value: number) {
  return value * value * (3 - 2 * value)
}

function getAltitudePenalty(altitudeDeg: number) {
  const zenithDistanceDeg = clamp(90 - altitudeDeg, 0, 80)
  const airmass = 1 / Math.cos((zenithDistanceDeg * Math.PI) / 180)

  return 0.22 * (airmass - 1)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
