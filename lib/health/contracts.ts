import { z } from 'zod'

export const CacheHealthStatusSchema = z.enum(['empty', 'fresh', 'stale', 'expired'])

export const CacheHealthSchema = z.object({
  status: CacheHealthStatusSchema,
  fetchedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
})

export const HealthApiResponseSchema = z.object({
  app: z.object({
    status: z.literal('ok'),
  }),
  aircraftCache: CacheHealthSchema,
  tleCache: CacheHealthSchema,
})

export type CacheHealthStatus = z.infer<typeof CacheHealthStatusSchema>
export type CacheHealth = z.infer<typeof CacheHealthSchema>
export type HealthApiResponse = z.infer<typeof HealthApiResponseSchema>
