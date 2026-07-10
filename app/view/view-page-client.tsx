'use client'

import { useSearchParams } from 'next/navigation'

import { ViewerShell } from '../../components/viewer/viewer-shell'
import {
  parseViewerRouteState,
  type ViewerRouteState,
} from '../../lib/permissions/coordinator'

export function getViewerSessionKey(state: ViewerRouteState) {
  return state.entry === 'demo'
    ? `demo:${state.demoScenarioId ?? 'default'}`
    : 'live'
}

export function ViewPageClient() {
  const searchParams = useSearchParams()
  const initialState = parseViewerRouteState(searchParams)

  return (
    <ViewerShell
      key={getViewerSessionKey(initialState)}
      initialState={initialState}
    />
  )
}
