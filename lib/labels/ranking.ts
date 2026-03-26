import type { ProjectedWorldPoint } from '../projection/camera'
import type { SkyObject } from '../viewer/contracts'

export type LabelAnchor = 'above' | 'below' | 'right' | 'left'

export interface LabelViewport {
  width: number
  height: number
}

export interface LabelCandidate<T extends SkyObject = SkyObject> {
  object: T
  projection: Pick<
    ProjectedWorldPoint,
    'visible' | 'inViewport' | 'inOverscan' | 'x' | 'y' | 'angularDistanceDeg'
  >
  secondaryLabel?: string
}

export interface LabelRect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface RankedLabelPlacement<T extends SkyObject = SkyObject>
  extends LabelCandidate<T> {
  anchor: LabelAnchor
  anchorPoint: {
    x: number
    y: number
  }
  rect: LabelRect
  rankScore: number
}

const DEFAULT_GLOBAL_LABEL_CAP = 18
const MIN_LABEL_SPACING_PX = 24
const LABEL_GAP_PX = 12
const LABEL_ANCHOR_ORDER: LabelAnchor[] = ['above', 'below', 'right', 'left']

const PER_TYPE_BUDGET: Partial<Record<SkyObject['type'], number>> = {
  aircraft: 12,
  satellite: 8,
  star: 30,
}

export function selectLabelCandidates<T extends SkyObject>(
  candidates: readonly LabelCandidate<T>[],
  {
    centerLockedObjectId = null,
  }: {
    centerLockedObjectId?: string | null
  } = {},
) {
  const visibleCandidates = candidates.filter((candidate) => candidate.projection.visible)
  const groupedCandidates = new Map<SkyObject['type'], LabelCandidate<T>[]>()

  for (const candidate of visibleCandidates) {
    const group = groupedCandidates.get(candidate.object.type)

    if (group) {
      group.push(candidate)
      continue
    }

    groupedCandidates.set(candidate.object.type, [candidate])
  }

  const selected: LabelCandidate<T>[] = []

  for (const [type, group] of groupedCandidates) {
    const sortedGroup = [...group].sort((left, right) =>
      compareLabelCandidates(left, right, { centerLockedObjectId }),
    )
    const budget = PER_TYPE_BUDGET[type]

    if (!budget || sortedGroup.length <= budget) {
      selected.push(...sortedGroup)
      continue
    }

    const limitedGroup = sortedGroup.slice(0, budget)

    if (
      centerLockedObjectId &&
      group.some((candidate) => candidate.object.id === centerLockedObjectId) &&
      !limitedGroup.some((candidate) => candidate.object.id === centerLockedObjectId)
    ) {
      const centerLockedCandidate = sortedGroup.find(
        (candidate) => candidate.object.id === centerLockedObjectId,
      )

      if (centerLockedCandidate) {
        limitedGroup[limitedGroup.length - 1] = centerLockedCandidate
      }
    }

    selected.push(...limitedGroup)
  }

  return selected.sort((left, right) =>
    compareLabelCandidates(left, right, { centerLockedObjectId }),
  )
}

export function layoutLabels<T extends SkyObject>(
  candidates: readonly LabelCandidate<T>[],
  {
    viewport,
    centerLockedObjectId = null,
    maxLabels = DEFAULT_GLOBAL_LABEL_CAP,
  }: {
    viewport: LabelViewport
    centerLockedObjectId?: string | null
    maxLabels?: number
  },
): RankedLabelPlacement<T>[] {
  const rankedCandidates = selectLabelCandidates(candidates, {
    centerLockedObjectId,
  })
  const placements: RankedLabelPlacement<T>[] = []

  for (const candidate of rankedCandidates) {
    if (placements.length >= maxLabels) {
      break
    }

    const labelSize = estimateLabelDimensions(
      candidate.object.label,
      candidate.secondaryLabel,
    )
    const baseX = clamp(candidate.projection.x, 0, viewport.width)
    const baseY = clamp(candidate.projection.y, 0, viewport.height)

    for (const anchor of LABEL_ANCHOR_ORDER) {
      const rect = buildLabelRect(anchor, baseX, baseY, labelSize, viewport)
      const anchorPoint = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }

      const collides = placements.some((placement) => {
        return (
          doLabelRectsOverlap(placement.rect, rect) ||
          !hasMinimumAnchorSpacing(placement.anchorPoint, anchorPoint)
        )
      })

      if (collides) {
        continue
      }

      placements.push({
        ...candidate,
        anchor,
        anchorPoint,
        rect,
        rankScore: getLabelRankScore(candidate, { centerLockedObjectId }),
      })
      break
    }
  }

  return placements
}

export function compareLabelCandidates<T extends SkyObject>(
  left: LabelCandidate<T>,
  right: LabelCandidate<T>,
  {
    centerLockedObjectId = null,
  }: {
    centerLockedObjectId?: string | null
  } = {},
) {
  const priorityDifference =
    getTypePriority(right.object, centerLockedObjectId) -
    getTypePriority(left.object, centerLockedObjectId)

  if (priorityDifference !== 0) {
    return priorityDifference
  }

  const angularDifference =
    left.projection.angularDistanceDeg - right.projection.angularDistanceDeg

  if (angularDifference !== 0) {
    return angularDifference
  }

  const importanceDifference = right.object.importance - left.object.importance

  if (importanceDifference !== 0) {
    return importanceDifference
  }

  const elevationDifference = right.object.elevationDeg - left.object.elevationDeg

  if (elevationDifference !== 0) {
    return elevationDifference
  }

  if (
    (left.object.type === 'aircraft' || left.object.type === 'satellite') &&
    (right.object.type === 'aircraft' || right.object.type === 'satellite')
  ) {
    const rangeDifference =
      (left.object.rangeKm ?? Number.POSITIVE_INFINITY) -
      (right.object.rangeKm ?? Number.POSITIVE_INFINITY)

    if (rangeDifference !== 0) {
      return rangeDifference
    }
  }

  if (
    (left.object.type === 'star' || left.object.type === 'planet') &&
    (right.object.type === 'star' || right.object.type === 'planet')
  ) {
    const magnitudeDifference =
      (left.object.magnitude ?? Number.POSITIVE_INFINITY) -
      (right.object.magnitude ?? Number.POSITIVE_INFINITY)

    if (magnitudeDifference !== 0) {
      return magnitudeDifference
    }
  }

  return left.object.id.localeCompare(right.object.id)
}

export function getLabelRankScore<T extends SkyObject>(
  candidate: LabelCandidate<T>,
  {
    centerLockedObjectId = null,
  }: {
    centerLockedObjectId?: string | null
  } = {},
) {
  const priority = getTypePriority(candidate.object, centerLockedObjectId)
  const angularScore = (180 - candidate.projection.angularDistanceDeg) * 1_000_000
  const importanceScore = candidate.object.importance * 10_000
  const elevationScore = candidate.object.elevationDeg * 100
  const rangeScore =
    candidate.object.type === 'aircraft' || candidate.object.type === 'satellite'
      ? (1_000 - Math.min(candidate.object.rangeKm ?? 1_000, 1_000)) * 10
      : 0
  const magnitudeScore =
    candidate.object.type === 'star' || candidate.object.type === 'planet'
      ? (20 - Math.min(candidate.object.magnitude ?? 20, 20)) * 100
      : 0

  return priority * 1_000_000_000 + angularScore + importanceScore + elevationScore + rangeScore + magnitudeScore
}

export function estimateLabelDimensions(primaryLabel: string, secondaryLabel?: string) {
  const widestLineLength = Math.max(primaryLabel.length, secondaryLabel?.length ?? 0)
  const width = clamp(Math.round(widestLineLength * 7.4 + 28), 88, 220)

  return {
    width,
    height: secondaryLabel ? 52 : 36,
  }
}

export function doLabelRectsOverlap(left: LabelRect, right: LabelRect) {
  return !(
    left.right <= right.left ||
    right.right <= left.left ||
    left.bottom <= right.top ||
    right.bottom <= left.top
  )
}

export function hasMinimumAnchorSpacing(
  left: {
    x: number
    y: number
  },
  right: {
    x: number
    y: number
  },
  minimumSpacingPx = MIN_LABEL_SPACING_PX,
) {
  return Math.hypot(left.x - right.x, left.y - right.y) >= minimumSpacingPx
}

function getTypePriority(object: SkyObject, centerLockedObjectId: string | null) {
  if (object.id === centerLockedObjectId) {
    return 9
  }

  if (object.metadata.isIss === true) {
    return 8
  }

  switch (object.type) {
    case 'aircraft':
      return 7
    case 'moon':
      return 6
    case 'sun':
      return 5
    case 'planet':
      return 4
    case 'satellite':
      return 3
    case 'star':
      return 2
    case 'constellation':
      return 1
    default:
      return 0
  }
}

function buildLabelRect(
  anchor: LabelAnchor,
  x: number,
  y: number,
  size: {
    width: number
    height: number
  },
  viewport: LabelViewport,
): LabelRect {
  const width = Math.min(size.width, viewport.width)
  const height = Math.min(size.height, viewport.height)
  let left = 0
  let top = 0

  if (anchor === 'above') {
    left = x - width / 2
    top = y - LABEL_GAP_PX - height
  } else if (anchor === 'below') {
    left = x - width / 2
    top = y + LABEL_GAP_PX
  } else if (anchor === 'right') {
    left = x + LABEL_GAP_PX
    top = y - height / 2
  } else {
    left = x - LABEL_GAP_PX - width
    top = y - height / 2
  }

  const clampedLeft = clamp(left, 0, viewport.width - width)
  const clampedTop = clamp(top, 0, viewport.height - height)

  return {
    left: clampedLeft,
    top: clampedTop,
    right: clampedLeft + width,
    bottom: clampedTop + height,
    width,
    height,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
