import { ViewerShell } from '../../components/viewer/viewer-shell'
import { parseViewerRouteState } from '../../lib/permissions/coordinator'

type ViewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function ViewPage({ searchParams }: ViewPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}

  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (typeof value === 'string') {
      params.set(key, value)
      continue
    }

    if (Array.isArray(value) && value[0]) {
      params.set(key, value[0])
    }
  }

  return <ViewerShell initialState={parseViewerRouteState(params)} />
}
