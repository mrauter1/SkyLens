import { z } from 'zod'

import { getPublicConfig, type EnabledLayer } from '../config'
import type { AlignmentTargetPreference } from './alignment-tutorial'
import {
  createIdentityPoseCalibration,
  createPoseCalibration,
  type PoseCalibration,
} from '../sensors/orientation'
import {
  SCOPE_VERTICAL_FOV_RANGE,
  getDefaultMainViewOptics,
  magnificationToScopeVerticalFovDeg,
  normalizeMainViewOptics,
  normalizeScopeOptics,
  scopeVerticalFovDegToMagnificationX,
  type MainViewOptics,
  type ScopeOptics,
} from './scope-optics'

export const VIEWER_SETTINGS_STORAGE_KEY = 'skylens-serverless.viewer-settings.v1'
export const SCOPE_VERTICAL_FOV_MIN_DEG = SCOPE_VERTICAL_FOV_RANGE.min
export const SCOPE_VERTICAL_FOV_MAX_DEG = SCOPE_VERTICAL_FOV_RANGE.max
export const SCOPE_VERTICAL_FOV_DEFAULT_DEG = SCOPE_VERTICAL_FOV_RANGE.defaultValue
export const SCOPE_LENS_DIAMETER_PCT_RANGE = {
  min: 50,
  max: 90,
  step: 1,
  defaultValue: 75,
} as const

export type LabelDisplayMode = 'center_only' | 'on_objects' | 'top_list'
export type MotionQuality = 'low' | 'balanced' | 'high'

export interface ManualObserverSettings {
  lat: number
  lon: number
  altMeters: number
}

export interface ScopeSettings {
  verticalFovDeg: number
}

export interface ViewerSettings {
  enabledLayers: Record<EnabledLayer, boolean>
  mainViewDeepStarsEnabled: boolean
  likelyVisibleOnly: boolean
  labelDisplayMode: LabelDisplayMode
  motionQuality: MotionQuality
  markerScale: number
  scopeLensDiameterPct: number
  poseCalibration: PoseCalibration
  alignmentTargetPreference: AlignmentTargetPreference | null
  verticalFovAdjustmentDeg: number
  scopeModeEnabled: boolean
  mainViewOptics: MainViewOptics
  scope: ScopeSettings
  scopeOptics: ScopeOptics
  selectedCameraDeviceId: string | null
  manualObserver: ManualObserverSettings | null
  onboardingCompleted: boolean
}

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const SettingsSchema = z.object({
  enabledLayers: z.object({
    aircraft: z.boolean(),
    satellites: z.boolean(),
    planets: z.boolean(),
    stars: z.boolean(),
    constellations: z.boolean(),
  }),
  mainViewDeepStarsEnabled: z.boolean().optional(),
  likelyVisibleOnly: z.boolean(),
  labelDisplayMode: z.enum(['center_only', 'on_objects', 'top_list']),
  motionQuality: z.enum(['low', 'balanced', 'high']).optional(),
  markerScale: z.number().optional(),
  scopeLensDiameterPct: z.unknown().optional(),
  headingOffsetDeg: z.number().optional(),
  pitchOffsetDeg: z.number().optional(),
  alignmentTargetPreference: z.enum(['sun', 'moon']).nullable().optional(),
  poseCalibration: z
    .object({
      offsetQuaternion: z.tuple([z.number(), z.number(), z.number(), z.number()]),
      calibrated: z.boolean(),
      sourceAtCalibration: z
        .enum([
          'absolute-sensor',
          'relative-sensor',
          'deviceorientation-absolute',
          'deviceorientation-relative',
          'manual',
        ])
        .nullable(),
      lastCalibratedAtMs: z.number().nullable(),
    })
    .optional(),
  verticalFovAdjustmentDeg: z.number(),
  scopeModeEnabled: z.unknown().optional(),
  mainViewOptics: z.unknown().optional(),
  scope: z.unknown().optional(),
  scopeOptics: z.unknown().optional(),
  selectedCameraDeviceId: z.string().nullable(),
  manualObserver: z
    .object({
      lat: z.number(),
      lon: z.number(),
      altMeters: z.number(),
    })
    .nullable(),
  onboardingCompleted: z.boolean(),
})

export function getDefaultViewerSettings(): ViewerSettings {
  const config = getPublicConfig()
  const defaultMainViewOptics = getDefaultMainViewOptics()
  const defaultScopeOptics = normalizeScopeOptics(undefined)

  return {
    enabledLayers: {
      aircraft: config.defaults.enabledLayers.includes('aircraft'),
      satellites: config.defaults.enabledLayers.includes('satellites'),
      planets: config.defaults.enabledLayers.includes('planets'),
      stars: config.defaults.enabledLayers.includes('stars'),
      constellations: config.defaults.enabledLayers.includes('constellations'),
    },
    mainViewDeepStarsEnabled: true,
    likelyVisibleOnly: config.defaults.likelyVisibleOnly,
    labelDisplayMode: 'center_only',
    motionQuality: 'balanced',
    markerScale: 1,
    scopeLensDiameterPct: SCOPE_LENS_DIAMETER_PCT_RANGE.defaultValue,
    poseCalibration: createIdentityPoseCalibration(),
    alignmentTargetPreference: null,
    verticalFovAdjustmentDeg: 0,
    scopeModeEnabled: false,
    mainViewOptics: defaultMainViewOptics,
    scope: {
      verticalFovDeg: magnificationToScopeVerticalFovDeg(defaultScopeOptics.magnificationX),
    },
    scopeOptics: defaultScopeOptics,
    selectedCameraDeviceId: null,
    manualObserver: null,
    onboardingCompleted: false,
  }
}

export function readViewerSettings(storage = getBrowserStorage()): ViewerSettings {
  const defaults = getDefaultViewerSettings()

  if (!storage) {
    return defaults
  }

  try {
    const rawValue = storage.getItem(VIEWER_SETTINGS_STORAGE_KEY)

    if (!rawValue) {
      return defaults
    }

    const parsed = SettingsSchema.partial().parse(JSON.parse(rawValue))
    const {
      scopeLensDiameterPct: rawScopeLensDiameterPct,
      mainViewOptics: rawMainViewOpticsInput,
      scope: rawScopeInput,
      scopeOptics: rawScopeOpticsInput,
      scopeModeEnabled: rawScopeModeEnabled,
      ...parsedSettings
    } = parsed
    const mainViewOpticsInput = getSettingsObject(rawMainViewOpticsInput)
    const scopeInput = getSettingsObject(rawScopeInput)
    const scopeOpticsInput = getSettingsObject(rawScopeOpticsInput)
    const legacyScopeVerticalFovDeg = readNumberSetting(scopeInput.verticalFovDeg)
    const storedScopeMagnificationX = readNumberSetting(scopeOpticsInput.magnificationX)
    const scopeModeEnabled =
      readBooleanSetting(rawScopeModeEnabled) ??
      readBooleanSetting(scopeInput.enabled) ??
      defaults.scopeModeEnabled

    return normalizeViewerSettings({
      ...defaults,
      ...parsedSettings,
      scopeLensDiameterPct: normalizeScopeLensDiameterPct(rawScopeLensDiameterPct),
      scopeModeEnabled,
      enabledLayers: {
        ...defaults.enabledLayers,
        ...parsed.enabledLayers,
      },
      mainViewDeepStarsEnabled:
        readBooleanSetting(parsed.mainViewDeepStarsEnabled) ?? defaults.mainViewDeepStarsEnabled,
      mainViewOptics: normalizeMainViewOptics({
        ...defaults.mainViewOptics,
        apertureMm: readNumberSetting(mainViewOpticsInput.apertureMm),
        magnificationX: readNumberSetting(mainViewOpticsInput.magnificationX),
      }),
      scope: {
        ...defaults.scope,
        verticalFovDeg: legacyScopeVerticalFovDeg ?? defaults.scope.verticalFovDeg,
      },
      scopeOptics: normalizeScopeOptics({
        ...defaults.scopeOptics,
        apertureMm: readNumberSetting(scopeOpticsInput.apertureMm),
        magnificationX:
          storedScopeMagnificationX ??
          (legacyScopeVerticalFovDeg === undefined
            ? undefined
            : scopeVerticalFovDegToMagnificationX(legacyScopeVerticalFovDeg)),
        transparencyPct: readNumberSetting(scopeOpticsInput.transparencyPct),
      }),
    })
  } catch {
    return defaults
  }
}

export function writeViewerSettings(
  settings: ViewerSettings,
  storage = getBrowserStorage(),
) {
  if (!storage) {
    return
  }

  storage.setItem(
    VIEWER_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizeViewerSettings(settings)),
  )
}

export function markViewerOnboardingCompleted(storage = getBrowserStorage()) {
  const settings = readViewerSettings(storage)

  if (settings.onboardingCompleted) {
    return
  }

  writeViewerSettings(
    {
      ...settings,
      onboardingCompleted: true,
    },
    storage,
  )
}

export function normalizeViewerSettings(settings: ViewerSettings): ViewerSettings {
  const mainViewOptics = normalizeMainViewOptics(settings.mainViewOptics)
  const scopeOptics = normalizeScopeOptics(settings.scopeOptics)

  return {
    enabledLayers: {
      aircraft: settings.enabledLayers.aircraft,
      satellites: settings.enabledLayers.satellites,
      planets: settings.enabledLayers.planets,
      stars: settings.enabledLayers.stars,
      constellations: settings.enabledLayers.constellations,
    },
    mainViewDeepStarsEnabled: settings.mainViewDeepStarsEnabled !== false,
    likelyVisibleOnly: settings.likelyVisibleOnly,
    labelDisplayMode: settings.labelDisplayMode,
    motionQuality: normalizeMotionQuality(settings.motionQuality),
    markerScale: normalizeMarkerScale(settings.markerScale),
    scopeLensDiameterPct: normalizeScopeLensDiameterPct(settings.scopeLensDiameterPct),
    poseCalibration: createPoseCalibration(settings.poseCalibration),
    alignmentTargetPreference: normalizeAlignmentTargetPreference(
      settings.alignmentTargetPreference,
    ),
    verticalFovAdjustmentDeg: clamp(settings.verticalFovAdjustmentDeg, -30, 30),
    scopeModeEnabled: settings.scopeModeEnabled === true,
    mainViewOptics,
    scope: normalizeScopeSettings(settings.scope, scopeOptics),
    scopeOptics,
    selectedCameraDeviceId:
      typeof settings.selectedCameraDeviceId === 'string' &&
      settings.selectedCameraDeviceId.length > 0
        ? settings.selectedCameraDeviceId
        : null,
    manualObserver: normalizeManualObserver(settings.manualObserver),
    onboardingCompleted: settings.onboardingCompleted,
  }
}

function normalizeManualObserver(
  manualObserver: ManualObserverSettings | null | undefined,
) {
  if (!manualObserver) {
    return null
  }

  return {
    lat: clamp(manualObserver.lat, -90, 90),
    lon: clamp(manualObserver.lon, -180, 180),
    altMeters: clamp(manualObserver.altMeters, -500, 10_000),
  }
}

function normalizeScopeSettings(
  _scopeSettings: ScopeSettings | null | undefined,
  scopeOptics: ScopeOptics,
): ScopeSettings {
  return {
    verticalFovDeg: magnificationToScopeVerticalFovDeg(scopeOptics.magnificationX),
  }
}

function getSettingsObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function readBooleanSetting(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

function readNumberSetting(value: unknown) {
  const parsedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value)
        : Number.NaN

  return Number.isFinite(parsedValue) ? parsedValue : undefined
}

function normalizeMotionQuality(
  motionQuality: MotionQuality | null | undefined,
): MotionQuality {
  switch (motionQuality) {
    case 'low':
    case 'high':
      return motionQuality
    default:
      return 'balanced'
  }
}

function normalizeMarkerScale(markerScale: number | null | undefined) {
  if (typeof markerScale !== 'number' || !Number.isFinite(markerScale)) {
    return 1
  }

  return clamp(markerScale, 1, 4)
}

export function normalizeScopeLensDiameterPct(value: unknown) {
  const parsedValue = readNumberSetting(value)

  if (parsedValue === undefined) {
    return SCOPE_LENS_DIAMETER_PCT_RANGE.defaultValue
  }

  return clamp(
    parsedValue,
    SCOPE_LENS_DIAMETER_PCT_RANGE.min,
    SCOPE_LENS_DIAMETER_PCT_RANGE.max,
  )
}

function normalizeAlignmentTargetPreference(
  alignmentTargetPreference: AlignmentTargetPreference | null | undefined,
): AlignmentTargetPreference | null {
  switch (alignmentTargetPreference) {
    case 'sun':
    case 'moon':
      return alignmentTargetPreference
    default:
      return null
  }
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
