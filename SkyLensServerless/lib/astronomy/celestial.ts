import {
  Body,
  Constellation,
  Equator,
  Horizon,
  Illumination,
  Observer,
} from 'astronomy-engine'

import type { EnabledLayer } from '../config'
import type { ObserverState, SkyObject } from '../viewer/contracts'

export interface CelestialDetailMetadata {
  typeLabel: 'Sun' | 'Moon' | 'Planet'
  elevationDeg: number
  azimuthDeg: number
  constellationName?: string
  magnitude?: number
  daylightLabelSuppressed?: boolean
}

export interface CelestialPipelineInput {
  observer: ObserverState
  timeMs: number
  enabledLayers: Readonly<Record<EnabledLayer, boolean>>
  likelyVisibleOnly: boolean
  focusedObjectId?: string | null
}

export interface CelestialPipelineResult {
  objects: SkyObject[]
  sunAltitudeDeg: number
}

type CelestialVisibilityMode = 'hidden' | 'normal' | 'focus-only'

type CelestialBodyConfig = {
  body: Body
  id: string
  label: string
  type: SkyObject['type']
  typeLabel: CelestialDetailMetadata['typeLabel']
  importance: number
}

const PLANET_PRIORITY_WHEN_DAYLIT = new Set(['planet-venus', 'planet-jupiter'])

const CELESTIAL_BODIES: CelestialBodyConfig[] = [
  {
    body: Body.Sun,
    id: 'sun',
    label: 'Sun',
    type: 'sun',
    typeLabel: 'Sun',
    importance: 90,
  },
  {
    body: Body.Moon,
    id: 'moon',
    label: 'Moon',
    type: 'moon',
    typeLabel: 'Moon',
    importance: 96,
  },
  {
    body: Body.Mercury,
    id: 'planet-mercury',
    label: 'Mercury',
    type: 'planet',
    typeLabel: 'Planet',
    importance: 66,
  },
  {
    body: Body.Venus,
    id: 'planet-venus',
    label: 'Venus',
    type: 'planet',
    typeLabel: 'Planet',
    importance: 82,
  },
  {
    body: Body.Mars,
    id: 'planet-mars',
    label: 'Mars',
    type: 'planet',
    typeLabel: 'Planet',
    importance: 72,
  },
  {
    body: Body.Jupiter,
    id: 'planet-jupiter',
    label: 'Jupiter',
    type: 'planet',
    typeLabel: 'Planet',
    importance: 84,
  },
  {
    body: Body.Saturn,
    id: 'planet-saturn',
    label: 'Saturn',
    type: 'planet',
    typeLabel: 'Planet',
    importance: 70,
  },
  {
    body: Body.Uranus,
    id: 'planet-uranus',
    label: 'Uranus',
    type: 'planet',
    typeLabel: 'Planet',
    importance: 62,
  },
  {
    body: Body.Neptune,
    id: 'planet-neptune',
    label: 'Neptune',
    type: 'planet',
    typeLabel: 'Planet',
    importance: 60,
  },
]

export function createAstronomyObserver(observer: ObserverState) {
  return new Observer(observer.lat, observer.lon, observer.altMeters)
}

export function normalizeCelestialObjects({
  observer,
  timeMs,
  enabledLayers,
  likelyVisibleOnly,
  focusedObjectId = null,
}: CelestialPipelineInput): CelestialPipelineResult {
  if (!enabledLayers.planets) {
    const sunAltitudeDeg = getSolarAltitudeDeg(observer, timeMs)
    return {
      objects: [],
      sunAltitudeDeg,
    }
  }

  const astronomyObserver = createAstronomyObserver(observer)
  const time = new Date(timeMs)
  const sunAltitudeDeg = getSolarAltitudeDeg(observer, timeMs, astronomyObserver)
  const objects: SkyObject[] = []

  for (const config of CELESTIAL_BODIES) {
    const equatorial = Equator(config.body, time, astronomyObserver, true, true)
    const horizontal = Horizon(
      time,
      astronomyObserver,
      equatorial.ra,
      equatorial.dec,
      'normal',
    )

    const visibilityMode = getCelestialVisibilityMode(
      config,
      horizontal.altitude,
      sunAltitudeDeg,
      likelyVisibleOnly,
      focusedObjectId,
    )

    if (visibilityMode === 'hidden') {
      continue
    }

    const illumination = Illumination(config.body, time)
    const constellationName =
      config.type === 'sun'
        ? undefined
        : Constellation(equatorial.ra, equatorial.dec).name
    const magnitude =
      Number.isFinite(illumination.mag) && config.type !== 'sun'
        ? Number(illumination.mag.toFixed(2))
        : undefined

    objects.push({
      id: config.id,
      type: config.type,
      label: config.label,
      sublabel: config.type === 'planet' ? 'Planet' : undefined,
      azimuthDeg: normalizeDegrees(horizontal.azimuth),
      elevationDeg: roundAngle(horizontal.altitude),
      magnitude,
      importance: config.importance,
      metadata: {
        detail: {
          typeLabel: config.typeLabel,
          elevationDeg: roundAngle(horizontal.altitude),
          azimuthDeg: roundAngle(horizontal.azimuth),
          constellationName,
          magnitude,
          daylightLabelSuppressed: visibilityMode === 'focus-only',
        } satisfies CelestialDetailMetadata,
        daylightLabelSuppressed: visibilityMode === 'focus-only',
      },
    })
  }

  return {
    objects,
    sunAltitudeDeg,
  }
}

export function getSolarAltitudeDeg(
  observer: ObserverState,
  timeMs: number,
  astronomyObserver = createAstronomyObserver(observer),
) {
  const time = new Date(timeMs)
  const equatorial = Equator(Body.Sun, time, astronomyObserver, true, true)
  const horizontal = Horizon(
    time,
    astronomyObserver,
    equatorial.ra,
    equatorial.dec,
    'normal',
  )

  return roundAngle(horizontal.altitude)
}

export function isCelestialDaylightLabelSuppressed(
  object: Pick<SkyObject, 'type' | 'metadata'>,
) {
  return object.type === 'planet' && object.metadata.daylightLabelSuppressed === true
}

function getCelestialVisibilityMode(
  config: CelestialBodyConfig,
  altitudeDeg: number,
  sunAltitudeDeg: number,
  likelyVisibleOnly: boolean,
  focusedObjectId: string | null,
): CelestialVisibilityMode {
  if (altitudeDeg < 0) {
    return 'hidden'
  }

  if (!likelyVisibleOnly) {
    return 'normal'
  }

  if (config.type === 'sun' || config.type === 'moon') {
    return 'normal'
  }

  if (sunAltitudeDeg <= 0) {
    return 'normal'
  }

  if (PLANET_PRIORITY_WHEN_DAYLIT.has(config.id)) {
    return 'normal'
  }

  if (focusedObjectId === config.id) {
    return 'normal'
  }

  return 'focus-only'
}

function normalizeDegrees(value: number) {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function roundAngle(value: number) {
  return Number(value.toFixed(2))
}
