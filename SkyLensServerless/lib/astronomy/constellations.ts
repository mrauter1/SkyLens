import { z } from 'zod'

import constellationsCatalogJson from '../../public/data/constellations.json'
import {
  projectWorldPointToScreen,
  type ProjectedWorldPoint,
  type ProjectWorldPointInput,
} from '../projection/camera'
import type { EnabledLayer } from '../config'
import type {
  CameraPose,
  ConstellationCatalogEntry,
  SkyObject,
  StarCatalogEntry,
} from '../viewer/contracts'
import type { VisibleStarEntry } from './stars'

export interface ConstellationDetailMetadata {
  typeLabel: 'Constellation'
  summaryText: 'Major star pattern'
}

export interface ProjectedConstellationSegment {
  constellationId: string
  start: ProjectedWorldPoint
  end: ProjectedWorldPoint
}

export interface ConstellationPipelineInput {
  cameraPose: CameraPose
  viewport: {
    width: number
    height: number
  }
  verticalFovAdjustmentDeg?: number
  projectLinePoint?: (worldPoint: ProjectWorldPointInput) => ProjectedWorldPoint
  enabledLayers: Readonly<Record<EnabledLayer, boolean>>
  likelyVisibleOnly: boolean
  sunAltitudeDeg: number
  visibleStars: readonly VisibleStarEntry[]
  starCatalog: readonly StarCatalogEntry[]
}

export interface ConstellationPipelineResult {
  objects: SkyObject[]
  lineSegments: ProjectedConstellationSegment[]
}

const ConstellationCatalogSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    lineSegments: z.array(z.tuple([z.string(), z.string()])),
  }),
)

const CONSTELLATION_CATALOG = ConstellationCatalogSchema.parse(
  constellationsCatalogJson,
) as ConstellationCatalogEntry[]

export function loadConstellationCatalog() {
  return CONSTELLATION_CATALOG
}

export function validateConstellationCatalog(
  constellations: readonly ConstellationCatalogEntry[],
  stars: readonly StarCatalogEntry[],
) {
  const knownStarIds = new Set(stars.map((entry) => entry.id))

  for (const constellation of constellations) {
    for (const [startId, endId] of constellation.lineSegments) {
      if (!knownStarIds.has(startId) || !knownStarIds.has(endId)) {
        throw new Error(
          `Constellation ${constellation.id} references an unknown star ID.`,
        )
      }
    }
  }
}

export function buildVisibleConstellations({
  cameraPose,
  viewport,
  verticalFovAdjustmentDeg = 0,
  projectLinePoint,
  enabledLayers,
  likelyVisibleOnly,
  sunAltitudeDeg,
  visibleStars,
  starCatalog,
}: ConstellationPipelineInput): ConstellationPipelineResult {
  if (!enabledLayers.constellations) {
    return {
      objects: [],
      lineSegments: [],
    }
  }

  validateConstellationCatalog(CONSTELLATION_CATALOG, starCatalog)

  if (likelyVisibleOnly && sunAltitudeDeg > -6) {
    return {
      objects: [],
      lineSegments: [],
    }
  }

  const visibleStarMap = new Map(visibleStars.map((entry) => [entry.id, entry]))
  const objects: SkyObject[] = []
  const lineSegments: ProjectedConstellationSegment[] = []
  const projectConstellationPoint =
    projectLinePoint ??
    ((worldPoint: ProjectWorldPointInput) =>
      projectWorldPointToScreen(
        cameraPose,
        worldPoint,
        viewport,
        verticalFovAdjustmentDeg,
      ))

  for (const constellation of CONSTELLATION_CATALOG) {
    const projectedSegments: ProjectedConstellationSegment[] = []

    for (const [startId, endId] of constellation.lineSegments) {
      const startStar = visibleStarMap.get(startId)
      const endStar = visibleStarMap.get(endId)

      if (!startStar || !endStar) {
        continue
      }

      const startProjection = projectConstellationPoint({
        azimuthDeg: startStar.azimuthDeg,
        elevationDeg: startStar.elevationDeg,
      })
      const endProjection = projectConstellationPoint({
        azimuthDeg: endStar.azimuthDeg,
        elevationDeg: endStar.elevationDeg,
      })

      if (!startProjection.inOverscan || !endProjection.inOverscan) {
        continue
      }

      projectedSegments.push({
        constellationId: constellation.id,
        start: startProjection,
        end: endProjection,
      })
    }

    const onScreenSegments = projectedSegments.filter(
      (segment) => segment.start.inViewport && segment.end.inViewport,
    )

    if (onScreenSegments.length < 2) {
      continue
    }

    lineSegments.push(...projectedSegments)

    const constellationStars = new Map<string, VisibleStarEntry>()
    for (const [startId, endId] of constellation.lineSegments) {
      const startStar = visibleStarMap.get(startId)
      const endStar = visibleStarMap.get(endId)
      if (startStar) {
        constellationStars.set(startId, startStar)
      }
      if (endStar) {
        constellationStars.set(endId, endStar)
      }
    }

    const anchor = computeConstellationAnchor([...constellationStars.values()])
    objects.push({
      id: `constellation-${constellation.id}`,
      type: 'constellation',
      label: constellation.name,
      sublabel: 'Constellation',
      azimuthDeg: anchor.azimuthDeg,
      elevationDeg: anchor.elevationDeg,
      importance: 28,
      metadata: {
        detail: {
          typeLabel: 'Constellation',
          summaryText: 'Major star pattern',
        } satisfies ConstellationDetailMetadata,
      },
    })
  }

  return {
    objects,
    lineSegments,
  }
}

function computeConstellationAnchor(stars: readonly VisibleStarEntry[]) {
  if (stars.length === 0) {
    return {
      azimuthDeg: 0,
      elevationDeg: 0,
    }
  }

  const sums = stars.reduce(
    (accumulator, star) => {
      const azimuthRad = degreesToRadians(star.azimuthDeg)
      accumulator.sinAzimuth += Math.sin(azimuthRad)
      accumulator.cosAzimuth += Math.cos(azimuthRad)
      accumulator.elevation += star.elevationDeg
      return accumulator
    },
    {
      sinAzimuth: 0,
      cosAzimuth: 0,
      elevation: 0,
    },
  )

  return {
    azimuthDeg: normalizeDegrees(
      radiansToDegrees(Math.atan2(sums.sinAzimuth, sums.cosAzimuth)),
    ),
    elevationDeg: Number((sums.elevation / stars.length).toFixed(2)),
  }
}

function normalizeDegrees(value: number) {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI
}
