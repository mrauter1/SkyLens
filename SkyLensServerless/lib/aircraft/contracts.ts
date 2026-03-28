import { z } from 'zod'

import { DEFAULT_AIRCRAFT_RADIUS_KM } from '../config'

export const AIRCRAFT_DEGRADED_MESSAGE = 'Live aircraft temporarily unavailable'
export const DEFAULT_AIRCRAFT_LIMIT = 50

export const AircraftAvailabilitySchema = z.enum(['available', 'degraded'])

export const AircraftQuerySchema = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lon: z.coerce.number().finite().min(-180).max(180),
  altMeters: z.coerce.number().finite().default(0),
  radiusKm: z.coerce.number().finite().positive().max(250).default(DEFAULT_AIRCRAFT_RADIUS_KM),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_AIRCRAFT_LIMIT),
})

export const AircraftObserverSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lon: z.number().finite().min(-180).max(180),
  altMeters: z.number().finite(),
})

export const AircraftApiAircraftSchema = z.object({
  id: z.string().regex(/^icao24-[0-9a-z]{6}$/i),
  callsign: z.string().min(1).optional(),
  originCountry: z.string().min(1).optional(),
  lat: z.number().finite().min(-90).max(90),
  lon: z.number().finite().min(-180).max(180),
  geoAltitudeM: z.number().finite().optional(),
  baroAltitudeM: z.number().finite().optional(),
  velocityMps: z.number().finite().nonnegative().optional(),
  trackDeg: z.number().finite().min(0).max(360).optional(),
  verticalRateMps: z.number().finite().optional(),
  timePositionS: z.number().finite().int().nonnegative().optional(),
  lastContactS: z.number().finite().int().nonnegative().optional(),
  onGround: z.boolean().optional(),
  positionSource: z.number().int().nonnegative().optional(),
  category: z.number().int().nonnegative().optional(),
  azimuthDeg: z.number().finite().min(0).max(360),
  elevationDeg: z.number().finite().min(-90).max(90),
  rangeKm: z.number().finite().nonnegative(),
})

export const AircraftApiResponseSchema = z.object({
  fetchedAt: z.string().datetime(),
  snapshotTimeS: z.number().finite().int().nonnegative(),
  observer: AircraftObserverSchema,
  availability: AircraftAvailabilitySchema,
  aircraft: z.array(AircraftApiAircraftSchema),
})

export type AircraftAvailability = z.infer<typeof AircraftAvailabilitySchema>
export type AircraftQuery = z.infer<typeof AircraftQuerySchema>
export type AircraftApiAircraft = z.infer<typeof AircraftApiAircraftSchema>
export type AircraftApiResponse = z.infer<typeof AircraftApiResponseSchema>
