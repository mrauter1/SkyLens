import type { EnabledLayer } from '../config'
import type { ObserverState, SkyObject } from '../viewer/contracts'
import {
  resolveSatelliteMotionObjects,
  type SatelliteDetailMetadata,
} from '../viewer/motion'
import type { TleApiResponse } from './contracts'
import { TleApiResponseSchema } from './contracts'
import { getTleApiResponse } from './tle'

export type { SatelliteDetailMetadata }

export async function fetchSatelliteCatalog(
  fetchImpl: typeof fetch = fetch,
): Promise<TleApiResponse> {
  return TleApiResponseSchema.parse(await getTleApiResponse(fetchImpl))
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
