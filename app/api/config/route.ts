import { NextResponse } from 'next/server'

import { getPublicConfig } from '../../../lib/config'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json(getPublicConfig())
}
