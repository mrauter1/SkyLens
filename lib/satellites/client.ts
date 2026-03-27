import type { EnabledLayer } from '../config'
import type { ObserverState, SkyObject } from '../viewer/contracts'
import {
  resolveSatelliteMotionObjects,
  type SatelliteDetailMetadata,
} from '../viewer/motion'
import type { TleApiResponse } from './contracts'
import { TleApiResponseSchema } from './contracts'

export type { SatelliteDetailMetadata }

export async function fetchSatelliteCatalog(
  fetchImpl: typeof fetch = fetch,
): Promise<TleApiResponse> {
  const response = await fetchImpl('/api/tle', {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('Satellite catalog unavailable.')
  }

  return TleApiResponseSchema.parse(await response.json())
}

export function normalizeSatelliteObjects({
  catalog,
  observer,
  timeMs,
  enabledLayers,
  likelyVisibleOnly,
  sunAltitudeDeg,
}: {
  catalog: TleApiResponse | null
  observer: ObserverState
  timeMs: number
  enabledLayers: Readonly<Record<EnabledLayer, boolean>>
  likelyVisibleOnly: boolean
  sunAltitudeDeg: number
}): SkyObject[] {
  return resolveSatelliteMotionObjects({
    catalog,
    observer,
    timeMs,
    enabledLayers,
    likelyVisibleOnly,
    sunAltitudeDeg,
  }).map(({ object }) => object)
}
