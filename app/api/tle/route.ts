import { NextResponse } from 'next/server'

import { getTleApiResponse } from '../../../lib/satellites/tle'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(await getTleApiResponse())
  } catch {
    return NextResponse.json(
      {
        error: 'TLE data unavailable.',
      },
      { status: 503 },
    )
  }
}
