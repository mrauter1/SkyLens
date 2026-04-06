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
  scopeOptics: ScopeOpticsSettingsSchema.partial().optional(),
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

    return normalizeViewerSettings({
      ...defaults,
      ...parsed,
      enabledLayers: {
        ...defaults.enabledLayers,
        ...parsed.enabledLayers,
      },
      scopeOptics: {
        ...defaults.scopeOptics,
        ...parsed.scopeOptics,
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
      50,
      400,
    ),
    magnificationX: normalizeFiniteNumber(
      scopeOptics?.magnificationX,
      DEFAULT_SCOPE_OPTICS_SETTINGS.magnificationX,
      10,
      400,
    ),
    transparencyPct: normalizeFiniteNumber(
      scopeOptics?.transparencyPct,
      DEFAULT_SCOPE_OPTICS_SETTINGS.transparencyPct,
      40,
      100,
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
