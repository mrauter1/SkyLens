import { Constellation, Horizon, Observer } from 'astronomy-engine'
import { z } from 'zod'

import starsCatalogJson from '../../public/data/stars_200.json'
import type { EnabledLayer } from '../config'
import type { ObserverState, SkyObject, StarCatalogEntry } from '../viewer/contracts'
import {
  DEFAULT_SCOPE_OPTICS_SETTINGS,
  normalizeScopeOpticsSettings,
  type ScopeOpticsSettings,
} from '../viewer/settings'
import {
  computeStarPhotometry,
  isStarVisibleWithScopeOptics,
  type ScopeRenderMetadata,
} from '../viewer/scope-optics'

export interface StarDetailMetadata {
  typeLabel: 'Star'
  magnitude: number
  elevationDeg: number
  constellationName?: string
}

export interface StarObjectMetadata extends Record<string, unknown> {
  detail: StarDetailMetadata
  scopeRender?: ScopeRenderMetadata
}

export interface VisibleStarEntry extends StarCatalogEntry {
  azimuthDeg: number
  elevationDeg: number
  constellationName?: string
  importance: number
  object: SkyObject
}

export interface StarPipelineInput {
  observer: ObserverState
  timeMs: number
  enabledLayers: Readonly<Record<EnabledLayer, boolean>>
  likelyVisibleOnly: boolean
  sunAltitudeDeg: number
  scopeModeEnabled?: boolean
  scopeOptics?: ScopeOpticsSettings
}

const StarCatalogSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    raDeg: z.number(),
    decDeg: z.number(),
    magnitude: z.number(),
  }),
)

const STAR_CATALOG = StarCatalogSchema.parse(starsCatalogJson) as StarCatalogEntry[]

export function loadStarCatalog() {
  return STAR_CATALOG
}

export function normalizeVisibleStars({
  observer,
  timeMs,
  enabledLayers,
  likelyVisibleOnly,
  sunAltitudeDeg,
  scopeModeEnabled = false,
  scopeOptics = DEFAULT_SCOPE_OPTICS_SETTINGS,
}: StarPipelineInput): VisibleStarEntry[] {
  if (!enabledLayers.stars) {
    return []
  }

  if (likelyVisibleOnly && sunAltitudeDeg > -6) {
    return []
  }

  const astronomyObserver = new Observer(observer.lat, observer.lon, observer.altMeters)
  const time = new Date(timeMs)
  const normalizedScopeOptics = normalizeScopeOpticsSettings(scopeOptics)

  return STAR_CATALOG.flatMap((entry) => {
    const horizontal = Horizon(
      time,
      astronomyObserver,
      normalizeRightAscensionHours(entry.raDeg),
      entry.decDeg,
      'normal',
    )

    if (horizontal.altitude < 0) {
      return []
    }

    if (
      scopeModeEnabled &&
      !isStarVisibleWithScopeOptics(
        entry.magnitude,
        normalizedScopeOptics,
        horizontal.altitude,
      )
    ) {
      return []
    }

    const constellationName = Constellation(
      normalizeRightAscensionHours(entry.raDeg),
      entry.decDeg,
    ).name
    const elevationDeg = roundAngle(horizontal.altitude)
    const metadata: StarObjectMetadata = {
      detail: {
        typeLabel: 'Star',
        magnitude: entry.magnitude,
        elevationDeg,
        constellationName,
      },
    }

    if (scopeModeEnabled) {
      metadata.scopeRender = computeStarPhotometry(
        entry.magnitude,
        normalizedScopeOptics,
        horizontal.altitude,
      )
    }

    const object: SkyObject = {
      id: entry.id,
      type: 'star',
      label: entry.name,
      azimuthDeg: normalizeDegrees(horizontal.azimuth),
      elevationDeg,
      magnitude: entry.magnitude,
      importance: magnitudeToImportance(entry.magnitude),
      metadata,
    }

    return [
      {
        ...entry,
        azimuthDeg: object.azimuthDeg,
        elevationDeg,
        constellationName,
        importance: object.importance,
        object,
      },
    ]
  }).sort((left, right) => right.importance - left.importance)
}

function normalizeRightAscensionHours(raDeg: number) {
  return normalizeDegrees(raDeg) / 15
}

function normalizeDegrees(value: number) {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function magnitudeToImportance(magnitude: number) {
  return Math.max(24, Number((70 - magnitude * 8).toFixed(2)))
}

function roundAngle(value: number) {
  return Number(value.toFixed(2))
}
