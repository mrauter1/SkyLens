import { z } from 'zod'

import constellationsCatalogJson from '../../public/data/constellations.json'
import {
  projectWorldPointToScreen,
  type ProjectViewport,
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
import { loadStarCatalog, type VisibleStarEntry } from './stars'

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
  viewport: ProjectViewport
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
const BUNDLED_STAR_CATALOG = loadStarCatalog()

validateConstellationCatalog(CONSTELLATION_CATALOG, BUNDLED_STAR_CATALOG)

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
  starCatalog: _starCatalog,
}: ConstellationPipelineInput): ConstellationPipelineResult {
  if (!enabledLayers.constellations) {
    return {
      objects: [],
      lineSegments: [],
    }
  }

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

      if (
        !isConstellationSegmentPartiallyInView(startProjection, endProjection, viewport)
      ) {
        continue
      }

      projectedSegments.push({
        constellationId: constellation.id,
        start: startProjection,
        end: endProjection,
      })
    }

    if (projectedSegments.length === 0) {
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

function isConstellationSegmentPartiallyInView(
  start: ProjectedWorldPoint,
  end: ProjectedWorldPoint,
  viewport: { width: number; height: number },
) {
  if (!start.visible || !end.visible) {
    return false
  }

  if (start.inViewport || end.inViewport) {
    return true
  }

  if (
    !Number.isFinite(start.x) ||
    !Number.isFinite(start.y) ||
    !Number.isFinite(end.x) ||
    !Number.isFinite(end.y)
  ) {
    return false
  }

  const viewportMinX = 0
  const viewportMinY = 0
  const viewportMaxX = viewport.width
  const viewportMaxY = viewport.height

  return doesLineSegmentIntersectRect(
    start.x,
    start.y,
    end.x,
    end.y,
    viewportMinX,
    viewportMinY,
    viewportMaxX,
    viewportMaxY,
  )
}

function doesLineSegmentIntersectRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
) {
  const dx = x2 - x1
  const dy = y2 - y1
  const p = [-dx, dx, -dy, dy]
  const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1]
  let tMin = 0
  let tMax = 1

  for (let index = 0; index < p.length; index += 1) {
    const denominator = p[index]
    const numerator = q[index]

    if (denominator === 0) {
      if (numerator < 0) {
        return false
      }
      continue
    }

    const ratio = numerator / denominator
    if (denominator < 0) {
      tMin = Math.max(tMin, ratio)
    } else {
      tMax = Math.min(tMax, ratio)
    }

    if (tMin > tMax) {
      return false
    }
  }

  return true
}
