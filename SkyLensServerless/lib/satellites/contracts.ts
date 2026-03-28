import { z } from 'zod'

export const SatelliteGroupIdSchema = z.enum(['iss', 'stations', 'brightest'])

export const TleSatelliteSchema = z
  .object({
    id: z.string().regex(/^\d+$/),
    name: z.string().min(1),
    noradId: z.number().int().positive(),
    groups: z.array(SatelliteGroupIdSchema).min(1),
    tle1: z.string().min(1),
    tle2: z.string().min(1),
    isIss: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.id !== String(value.noradId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Satellite id must stay aligned with the NORAD id.',
        path: ['id'],
      })
    }
  })

export const TleApiResponseSchema = z.object({
  fetchedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  stale: z.boolean().optional(),
  satellites: z.array(TleSatelliteSchema),
})

export type SatelliteGroupId = z.infer<typeof SatelliteGroupIdSchema>
export type TleSatellite = z.infer<typeof TleSatelliteSchema>
export type TleApiResponse = z.infer<typeof TleApiResponseSchema>
