export const SCOPE_OPTICS_RANGES = {
  apertureMm: {
    min: 40,
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

export type ScopeOptics = {
  apertureMm: number
  magnificationX: number
  transparencyPct: number
}

export type ScopeRenderProfile = {
  effectiveLimitMag: number
  relativeFlux: number
  transmission: number
  opticsGain: number
  intensity: number
  corePx: number
  haloPx: number
}

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

export function computeScopeLimitingMagnitude({
  apertureMm,
  magnificationX,
  transparencyPct,
  altitudeDeg,
}: ScopeOptics & {
  altitudeDeg: unknown
}) {
  const optics = normalizeScopeOptics({
    apertureMm,
    magnificationX,
    transparencyPct,
  })
  const safeAltitudeDeg = normalizeAltitudeDeg(altitudeDeg)
  const transparency = optics.transparencyPct / 100
  const base =
    2.2 +
    2.0 * Math.log10(optics.apertureMm) +
    0.3 * Math.log10(optics.magnificationX)
  const transparencyAdj = 1.3 * (transparency - 0.7)
  const altitudePenalty = getAltitudePenalty(safeAltitudeDeg)

  return clamp(base + transparencyAdj - altitudePenalty, 3, 15.5)
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
  const transparency = normalizedOptics.transparencyPct / 100
  const altitudePenalty = getAltitudePenalty(safeAltitudeDeg)
  const transmission = clamp(
    transparency * Math.max(0.24, 1 - altitudePenalty / 2.4),
    0.18,
    1,
  )
  const apertureGain = clamp(
    0.62 + Math.log10(normalizedOptics.apertureMm / 40 + 1) * 0.95,
    0.72,
    1.7,
  )
  const magnificationGain = clamp(
    0.88 + Math.log10(normalizedOptics.magnificationX / 10 + 1) * 0.22,
    0.9,
    1.24,
  )
  const opticsGain = clamp(apertureGain * magnificationGain, 0.8, 1.95)
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

function normalizeAltitudeDeg(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }

  return clamp(value, -90, 90)
}

function normalizeMagnitude(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return clamp(value, -8, 30)
}

function getAltitudePenalty(altitudeDeg: number) {
  const zenithDistanceDeg = clamp(90 - altitudeDeg, 0, 80)
  const airmass = 1 / Math.cos((zenithDistanceDeg * Math.PI) / 180)

  return 0.22 * (airmass - 1)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
