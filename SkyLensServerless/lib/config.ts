import { z } from 'zod'

export const DEFAULT_AIRCRAFT_RADIUS_KM = 180
export const MIN_AIRCRAFT_ELEVATION_DEG = 2
export const LOCAL_SCOPE_DATA_BASE_PATH = '/data/scope/v1' as const
export const DEFAULT_SCOPE_REMOTE_BASE_URL =
  'https://pub-566fb74233f3432ba4d47900577e552e.r2.dev/scope/v1'
export const POLL_INTERVAL_MS_BY_QUALITY = {
  low: 30_000,
  balanced: 15_000,
  high: 10_000,
} as const

const SatelliteGroupSchema = z.object({
  id: z.enum(['iss', 'stations', 'brightest']),
  label: z.string(),
})

const ConfigSchema = z.object({
  buildVersion: z.string(),
  defaults: z.object({
    maxLabels: z.literal(18),
    radiusKm: z.literal(180),
    verticalFovDeg: z.literal(50),
    likelyVisibleOnly: z.literal(false),
    enabledLayers: z.tuple([
      z.literal('aircraft'),
      z.literal('satellites'),
      z.literal('planets'),
      z.literal('stars'),
      z.literal('constellations'),
    ]),
  }),
  satelliteGroups: z.tuple([
    SatelliteGroupSchema.extend({ id: z.literal('iss'), label: z.literal('ISS') }),
    SatelliteGroupSchema.extend({
      id: z.literal('stations'),
      label: z.literal('Space Stations'),
    }),
    SatelliteGroupSchema.extend({
      id: z.literal('brightest'),
      label: z.literal('100 Brightest'),
    }),
  ]),
  scopeData: z.object({
    remoteEnabled: z.boolean(),
    remoteBaseUrl: z.string().url().nullable(),
    localBasePath: z.literal(LOCAL_SCOPE_DATA_BASE_PATH),
  }),
})

export type PublicConfig = z.infer<typeof ConfigSchema>
export type EnabledLayer = PublicConfig['defaults']['enabledLayers'][number]

export const LANDING_DESCRIPTION = "Point your phone at the sky and see what's above you."

export const PRIVACY_REASSURANCE_COPY = [
  'Camera stays on your device.',
  'Approximate location-based aircraft queries go directly from your browser to OpenSky.',
  'Live satellite catalogs are fetched directly from CelesTrak.',
  'No camera frames are uploaded.',
] as const

export function getPublicConfig(): PublicConfig {
  const remoteBaseUrl = getConfiguredScopeRemoteBaseUrl()
  const remoteEnabled = getConfiguredScopeRemoteEnabled()

  return ConfigSchema.parse({
    buildVersion:
      process.env.NEXT_PUBLIC_SKYLENS_BUILD_VERSION ??
      process.env.SKYLENS_BUILD_VERSION ??
      'dev',
    defaults: {
      maxLabels: 18,
      radiusKm: DEFAULT_AIRCRAFT_RADIUS_KM,
      verticalFovDeg: 50,
      likelyVisibleOnly: false,
      enabledLayers: [
        'aircraft',
        'satellites',
        'planets',
        'stars',
        'constellations',
      ],
    },
    satelliteGroups: [
      { id: 'iss', label: 'ISS' },
      { id: 'stations', label: 'Space Stations' },
      { id: 'brightest', label: '100 Brightest' },
    ],
    scopeData: {
      remoteEnabled: remoteEnabled && remoteBaseUrl !== null,
      remoteBaseUrl,
      localBasePath: LOCAL_SCOPE_DATA_BASE_PATH,
    },
  })
}

function parsePublicBooleanEnv(value: string | undefined) {
  if (!value) {
    return false
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function getConfiguredScopeRemoteBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_SKYLENS_SCOPE_REMOTE_BASE_URL?.trim()
  const candidate = configured || DEFAULT_SCOPE_REMOTE_BASE_URL

  try {
    const url = new URL(candidate)
    url.hash = ''
    url.search = ''
    return url.toString().replace(/\/+$/u, '')
  } catch {
    return DEFAULT_SCOPE_REMOTE_BASE_URL
  }
}

function getConfiguredScopeRemoteEnabled() {
  if (process.env.NEXT_PUBLIC_SKYLENS_SCOPE_REMOTE_ENABLED === undefined) {
    return true
  }

  return parsePublicBooleanEnv(process.env.NEXT_PUBLIC_SKYLENS_SCOPE_REMOTE_ENABLED)
}
