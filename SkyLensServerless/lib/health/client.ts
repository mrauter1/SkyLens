import {
  HealthApiResponseSchema,
  type HealthApiResponse,
} from './contracts'
import { getTleCacheHealth } from '../satellites/tle'

export async function fetchHealthStatus(
  now = new Date(),
): Promise<HealthApiResponse> {
  return HealthApiResponseSchema.parse({
    app: {
      status: 'ok',
    },
    tleCache: getTleCacheHealth(now),
  })
}
