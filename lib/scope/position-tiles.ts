import { getHorizontalFovDeg } from '../projection/camera'

import type { ScopeBandIndex, ScopeBandIndexTile } from './contracts'

export function wrapRaDeg(value: number) {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

export function getScopeTileSelectionRadiusDeg({
  verticalFovDeg,
  viewportWidth,
  viewportHeight,
}: {
  verticalFovDeg: number
  viewportWidth: number
  viewportHeight: number
}) {
  const horizontalFovDeg = getHorizontalFovDeg(
    verticalFovDeg,
    Math.max(viewportWidth, 1) / Math.max(viewportHeight, 1),
  )
  const halfDiagonalDeg =
    Math.sqrt(verticalFovDeg * verticalFovDeg + horizontalFovDeg * horizontalFovDeg) / 2

  return halfDiagonalDeg + 1
}

export function selectScopeTilesForPointing({
  index,
  centerRaDeg,
  centerDecDeg,
  selectionRadiusDeg,
}: {
  index: ScopeBandIndex
  centerRaDeg: number
  centerDecDeg: number
  selectionRadiusDeg: number
}) {
  const queryDecMin = clampNumber(centerDecDeg - selectionRadiusDeg, -90, 90)
  const queryDecMax = clampNumber(centerDecDeg + selectionRadiusDeg, -90, 90)
  const normalizedCenterRaDeg = wrapRaDeg(centerRaDeg)
  const reachesPole = queryDecMin <= -89 || queryDecMax >= 89
  const worstCaseAbsDecDeg = Math.max(Math.abs(queryDecMin), Math.abs(queryDecMax))
  const cosWorstCaseDec = Math.cos((worstCaseAbsDecDeg * Math.PI) / 180)
  const raHalfSpanDeg =
    reachesPole || Math.abs(cosWorstCaseDec) < 0.01
      ? 180
      : Math.min(180, selectionRadiusDeg / Math.max(Math.abs(cosWorstCaseDec), 0.01))
  const querySegments = getWrappedRaSegments(
    normalizedCenterRaDeg - raHalfSpanDeg,
    normalizedCenterRaDeg + raHalfSpanDeg,
  )

  return index.tiles.filter((tile) => {
    const tileBounds = getTileBounds(tile, index)

    if (!rangesOverlap(queryDecMin, queryDecMax, tileBounds.decMinDeg, tileBounds.decMaxDeg)) {
      return false
    }

    if (raHalfSpanDeg >= 180) {
      return true
    }

    return tileBounds.raSegments.some((tileSegment) =>
      querySegments.some((querySegment) =>
        rangesOverlap(querySegment.minDeg, querySegment.maxDeg, tileSegment.minDeg, tileSegment.maxDeg),
      ),
    )
  })
}

export function getScopeTileId(tile: Pick<ScopeBandIndexTile, 'file'>) {
  return tile.file.replace(/\.bin$/u, '')
}

function getTileBounds(tile: ScopeBandIndexTile, index: Pick<ScopeBandIndex, 'raStepDeg' | 'decStepDeg'>) {
  const raMinDeg = tile.raIndex * index.raStepDeg
  const raMaxDeg = raMinDeg + index.raStepDeg
  const decMinDeg = tile.decIndex * index.decStepDeg - 90
  const decMaxDeg = decMinDeg + index.decStepDeg

  return {
    decMinDeg,
    decMaxDeg,
    raSegments: getWrappedRaSegments(raMinDeg, raMaxDeg),
  }
}

function getWrappedRaSegments(minDeg: number, maxDeg: number) {
  const spanDeg = maxDeg - minDeg

  if (spanDeg >= 360) {
    return [{ minDeg: 0, maxDeg: 360 }]
  }

  const normalizedMinDeg = wrapRaDeg(minDeg)
  const normalizedMaxDeg = wrapRaDeg(maxDeg)

  if (normalizedMinDeg <= normalizedMaxDeg) {
    return [{ minDeg: normalizedMinDeg, maxDeg: normalizedMaxDeg }]
  }

  return [
    { minDeg: normalizedMinDeg, maxDeg: 360 },
    { minDeg: 0, maxDeg: normalizedMaxDeg },
  ]
}

function rangesOverlap(
  leftMinDeg: number,
  leftMaxDeg: number,
  rightMinDeg: number,
  rightMaxDeg: number,
) {
  return leftMinDeg <= rightMaxDeg && rightMinDeg <= leftMaxDeg
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
