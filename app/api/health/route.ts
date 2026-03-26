import { NextResponse } from 'next/server'

import { getAircraftCacheHealth } from '../../../lib/aircraft/opensky'
import { HealthApiResponseSchema } from '../../../lib/health/contracts'
import { getTleCacheHealth } from '../../../lib/satellites/tle'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    HealthApiResponseSchema.parse({
      app: {
        status: 'ok',
      },
      aircraftCache: getAircraftCacheHealth(),
      tleCache: getTleCacheHealth(),
    }),
  )
}
