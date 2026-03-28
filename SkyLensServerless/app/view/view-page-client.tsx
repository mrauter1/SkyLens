'use client'

import { useSearchParams } from 'next/navigation'

import { ViewerShell } from '../../components/viewer/viewer-shell'
import { parseViewerRouteState } from '../../lib/permissions/coordinator'

export function ViewPageClient() {
  const searchParams = useSearchParams()

  return (
    <ViewerShell
      key={searchParams.toString()}
      initialState={parseViewerRouteState(searchParams)}
    />
  )
}
