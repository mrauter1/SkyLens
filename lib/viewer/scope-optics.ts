import type { ScopeOpticsSettings } from './settings'

export interface ScopeRenderMetadata {
  displayIntensity: number
  corePx: number
  haloPx: number
}

const MIN_TRANSPARENCY_FRACTION = 0.4
const MAX_TRANSPARENCY_FRACTION = 1
const MIN_LIMITING_MAGNITUDE = 3
const MAX_LIMITING_MAGNITUDE = 15.5
const MAX_ZENITH_ANGLE_DEG = 80
const M_REF = 6
const K_EXT = 0.16
const GAMMA = 2.2
const I_MAX = 4
const CORE_MIN = 1
const CORE_MAX = 3.8
const HALO_BASE = 1.25
const HALO_GAIN = 1.6
const G_A_MAX = 1.35
const G_M_MAX = 1.2

export function computeLimitingMagnitude(
  optics: ScopeOpticsSettings,
  altitudeDeg: number,
) {
  const transparencyFactor = normalizeTransparencyFactor(optics.transparencyPct)
  const base =
    2.2 +
    2.0 * Math.log10(optics.apertureMm) +
    0.3 * Math.log10(optics.magnificationX)
  const transparencyAdj = 1.3 * (transparencyFactor - 0.7)
  const altPenalty = 0.22 * (computeAirmass(altitudeDeg) - 1)

  return clamp(
    base + transparencyAdj - altPenalty,
    MIN_LIMITING_MAGNITUDE,
    MAX_LIMITING_MAGNITUDE,
  )
}

export function isStarVisibleWithScopeOptics(
  starMagnitude: number,
  optics: ScopeOpticsSettings,
  altitudeDeg: number,
) {
  return starMagnitude <= computeLimitingMagnitude(optics, altitudeDeg)
}

export function computeStarPhotometry(
  starMagnitude: number,
  optics: ScopeOpticsSettings,
  altitudeDeg: number,
): ScopeRenderMetadata {
  const transparencyFactor = normalizeTransparencyFactor(optics.transparencyPct)
  const airmass = computeAirmass(altitudeDeg)
  const relativeFlux = 10 ** (-0.4 * (starMagnitude - M_REF))
  const altitudeTransmission = Math.exp(-K_EXT * (airmass - 1))
  const gA = clamp(
    1 + 0.18 * Math.log10(optics.apertureMm / 100),
    0.85,
    G_A_MAX,
  )
  const gM = clamp(
    1 + 0.1 * Math.log10(optics.magnificationX / 40),
    0.9,
    G_M_MAX,
  )
  const rawI = relativeFlux * transparencyFactor * altitudeTransmission * gA * gM
  const displayIntensity = clamp(clamp(rawI, 0, I_MAX) ** (1 / GAMMA), 0, 1)
  const corePx = clamp(
    CORE_MIN + 1.2 * Math.log10(1 + 6 * displayIntensity),
    CORE_MIN,
    CORE_MAX,
  )

  return {
    displayIntensity,
    corePx,
    haloPx: corePx * (HALO_BASE + HALO_GAIN * displayIntensity),
  }
}

function normalizeTransparencyFactor(transparencyPct: number) {
  return clamp(transparencyPct / 100, MIN_TRANSPARENCY_FRACTION, MAX_TRANSPARENCY_FRACTION)
}

function computeAirmass(altitudeDeg: number) {
  const zenithAngleDeg = clamp(90 - altitudeDeg, 0, MAX_ZENITH_ANGLE_DEG)

  return 1 / Math.cos(toRadians(zenithAngleDeg))
}

function toRadians(valueDeg: number) {
  return (valueDeg * Math.PI) / 180
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
