import { z } from 'zod'

const SatelliteGroupSchema = z.object({
  id: z.enum(['iss', 'stations', 'brightest']),
  label: z.string(),
})

const ConfigSchema = z.object({
  buildVersion: z.string(),
  defaults: z.object({
    maxLabels: z.literal(18),
    radiusKm: z.literal(250),
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
})

export type PublicConfig = z.infer<typeof ConfigSchema>
export type EnabledLayer = PublicConfig['defaults']['enabledLayers'][number]

export const LANDING_DESCRIPTION = "Point your phone at the sky and see what's above you."

export const PRIVACY_REASSURANCE_COPY = [
  'Camera stays on your device.',
  'Location is used only to calculate what is above you right now.',
] as const

export function getPublicConfig(): PublicConfig {
  return ConfigSchema.parse({
    buildVersion: process.env.SKYLENS_BUILD_VERSION ?? 'dev',
    defaults: {
      maxLabels: 18,
      radiusKm: 250,
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
  })
}
