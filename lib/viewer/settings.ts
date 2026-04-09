import { z } from 'zod'

import { getPublicConfig, type EnabledLayer } from '../config'
import type { AlignmentTargetPreference } from './alignment-tutorial'
import {
  createIdentityPoseCalibration,
  createPoseCalibration,
  type PoseCalibration,
} from '../sensors/orientation'

export const VIEWER_SETTINGS_STORAGE_KEY = 'skylens.viewer-settings.v1'

export type LabelDisplayMode = 'center_only' | 'on_objects' | 'top_list'
export type MotionQuality = 'low' | 'balanced' | 'high'

export interface ManualObserverSettings {
  lat: number
  lon: number
  altMeters: number
}

export interface ScopeOpticsSettings {
  apertureMm: number
  magnificationX: number
  transparencyPct: number
}

export const SCOPE_OPTICS_RANGES = {
  apertureMm: {
    min: 20,
    max: 400,
    step: 1,
  },
  magnificationX: {
    min: 10,
    max: 400,
    step: 1,
  },
  transparencyPct: {
    min: 40,
    max: 100,
    step: 1,
  },
} as const satisfies Record<
  keyof ScopeOpticsSettings,
  {
    min: number
    max: number
    step: number
  }
>

export const DEFAULT_SCOPE_OPTICS_SETTINGS: ScopeOpticsSettings = {
  apertureMm: 100,
  magnificationX: 40,
  transparencyPct: 80,
}

export interface ViewerSettings {
  enabledLayers: Record<EnabledLayer, boolean>
  likelyVisibleOnly: boolean
  scopeModeEnabled: boolean
  scopeOptics: ScopeOpticsSettings
  labelDisplayMode: LabelDisplayMode
  motionQuality: MotionQuality
  markerScale: number
  poseCalibration: PoseCalibration
  alignmentTargetPreference: AlignmentTargetPreference | null
  verticalFovAdjustmentDeg: number
  selectedCameraDeviceId: string | null
  manualObserver: ManualObserverSettings | null
  onboardingCompleted: boolean
}

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const ScopeOpticsSettingsSchema = z.object({
  apertureMm: z.number(),
  magnificationX: z.number(),
  transparencyPct: z.number(),
})

const SettingsSchema = z.object({
  enabledLayers: z.object({
    aircraft: z.boolean(),
    satellites: z.boolean(),
    planets: z.boolean(),
    stars: z.boolean(),
    constellations: z.boolean(),
  }),
  likelyVisibleOnly: z.boolean(),
  scopeModeEnabled: z.boolean().optional(),
  scopeOptics: z.unknown().optional(),
  labelDisplayMode: z.enum(['center_only', 'on_objects', 'top_list']),
  motionQuality: z.enum(['low', 'balanced', 'high']).optional(),
  markerScale: z.number().optional(),
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
          'deviceorientation-absolute',
          'deviceorientation-relative',
          'manual',
        ])
        .nullable(),
      lastCalibratedAtMs: z.number().nullable(),
    })
    .optional(),
  verticalFovAdjustmentDeg: z.number(),
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

  return {
    enabledLayers: {
      aircraft: config.defaults.enabledLayers.includes('aircraft'),
      satellites: config.defaults.enabledLayers.includes('satellites'),
      planets: config.defaults.enabledLayers.includes('planets'),
      stars: config.defaults.enabledLayers.includes('stars'),
      constellations: config.defaults.enabledLayers.includes('constellations'),
    },
    likelyVisibleOnly: config.defaults.likelyVisibleOnly,
    scopeModeEnabled: false,
    scopeOptics: {
      ...DEFAULT_SCOPE_OPTICS_SETTINGS,
    },
    labelDisplayMode: 'center_only',
    motionQuality: 'balanced',
    markerScale: 1,
    poseCalibration: createIdentityPoseCalibration(),
    alignmentTargetPreference: null,
    verticalFovAdjustmentDeg: 0,
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
    const scopeOptics = normalizeScopeOpticsStorageInput(parsed.scopeOptics)

    return normalizeViewerSettings({
      ...defaults,
      ...parsed,
      enabledLayers: {
        ...defaults.enabledLayers,
        ...parsed.enabledLayers,
      },
      scopeOptics: {
        ...defaults.scopeOptics,
        ...scopeOptics,
      },
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
  return {
    enabledLayers: {
      aircraft: settings.enabledLayers.aircraft,
      satellites: settings.enabledLayers.satellites,
      planets: settings.enabledLayers.planets,
      stars: settings.enabledLayers.stars,
      constellations: settings.enabledLayers.constellations,
    },
    likelyVisibleOnly: settings.likelyVisibleOnly,
    scopeModeEnabled: settings.scopeModeEnabled === true,
    scopeOptics: normalizeScopeOpticsSettings(settings.scopeOptics),
    labelDisplayMode: settings.labelDisplayMode,
    motionQuality: normalizeMotionQuality(settings.motionQuality),
    markerScale: normalizeMarkerScale(settings.markerScale),
    poseCalibration: createPoseCalibration(settings.poseCalibration),
    alignmentTargetPreference: normalizeAlignmentTargetPreference(
      settings.alignmentTargetPreference,
    ),
    verticalFovAdjustmentDeg: clamp(settings.verticalFovAdjustmentDeg, -30, 30),
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

function normalizeScopeOpticsStorageInput(
  value: unknown,
): Partial<ScopeOpticsSettings> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const candidate = value as Record<string, unknown>
  const normalized: Partial<ScopeOpticsSettings> = {}

  const apertureMmResult = z.number().safeParse(candidate.apertureMm)
  if (apertureMmResult.success) {
    normalized.apertureMm = apertureMmResult.data
  }

  const magnificationXResult = z.number().safeParse(candidate.magnificationX)
  if (magnificationXResult.success) {
    normalized.magnificationX = magnificationXResult.data
  }

  const transparencyPctResult = z.number().safeParse(candidate.transparencyPct)
  if (transparencyPctResult.success) {
    normalized.transparencyPct = transparencyPctResult.data
  }

  return ScopeOpticsSettingsSchema.partial().parse(normalized)
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

export function normalizeScopeOpticsSettings(
  scopeOptics: ScopeOpticsSettings | null | undefined,
): ScopeOpticsSettings {
  return {
    apertureMm: normalizeFiniteNumber(
      scopeOptics?.apertureMm,
      DEFAULT_SCOPE_OPTICS_SETTINGS.apertureMm,
      SCOPE_OPTICS_RANGES.apertureMm.min,
      SCOPE_OPTICS_RANGES.apertureMm.max,
    ),
    magnificationX: normalizeFiniteNumber(
      scopeOptics?.magnificationX,
      DEFAULT_SCOPE_OPTICS_SETTINGS.magnificationX,
      SCOPE_OPTICS_RANGES.magnificationX.min,
      SCOPE_OPTICS_RANGES.magnificationX.max,
    ),
    transparencyPct: normalizeFiniteNumber(
      scopeOptics?.transparencyPct,
      DEFAULT_SCOPE_OPTICS_SETTINGS.transparencyPct,
      SCOPE_OPTICS_RANGES.transparencyPct.min,
      SCOPE_OPTICS_RANGES.transparencyPct.max,
    ),
  }
}

function normalizeMarkerScale(markerScale: number | null | undefined) {
  if (typeof markerScale !== 'number' || !Number.isFinite(markerScale)) {
    return 1
  }

  return clamp(markerScale, 1, 4)
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

function normalizeFiniteNumber(
  value: number | null | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return clamp(value, min, max)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
