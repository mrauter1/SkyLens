import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { AircraftQuerySchema } from '../../../lib/aircraft/contracts'
import { getAircraftApiResponse } from '../../../lib/aircraft/opensky'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const query = AircraftQuerySchema.parse({
      lat: url.searchParams.get('lat') ?? undefined,
      lon: url.searchParams.get('lon') ?? undefined,
      altMeters: url.searchParams.get('altMeters') ?? undefined,
      radiusKm: url.searchParams.get('radiusKm') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    })

    return NextResponse.json(await getAircraftApiResponse(query))
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid aircraft query.',
          issues: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
        error: 'Aircraft data unavailable.',
      },
      { status: 503 },
    )
  }
}
