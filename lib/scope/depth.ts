import type { PermissionStatusValue } from '../permissions/coordinator'
import type { AlignmentHealth, CameraMode } from '../viewer/contracts'

import {
  SCOPE_DATASET_BANDS,
  type ScopeBandDefinition,
} from './contracts'

export function selectScopeBand({
  scopeVerticalFovDeg,
  cameraMode,
  orientationStatus,
  latestOrientationSampleAgeMs,
  alignmentHealth,
}: {
  scopeVerticalFovDeg: number
  cameraMode: CameraMode
  orientationStatus: PermissionStatusValue
  latestOrientationSampleAgeMs: number | null
  alignmentHealth: AlignmentHealth
}): ScopeBandDefinition {
  if (scopeVerticalFovDeg > 15) {
    return SCOPE_DATASET_BANDS[0]
  }

  if (scopeVerticalFovDeg > 10) {
    return SCOPE_DATASET_BANDS[1]
  }

  if (scopeVerticalFovDeg > 5) {
    return SCOPE_DATASET_BANDS[2]
  }

  const canUseDeepestBand =
    cameraMode === 'sensor' &&
    orientationStatus === 'granted' &&
    latestOrientationSampleAgeMs !== null &&
    latestOrientationSampleAgeMs <= 300 &&
    alignmentHealth === 'good'

  return canUseDeepestBand ? SCOPE_DATASET_BANDS[3] : SCOPE_DATASET_BANDS[2]
}

export function areScopeDeepStarsDaylightSuppressed({
  likelyVisibleOnly,
  sunAltitudeDeg,
}: {
  likelyVisibleOnly: boolean
  sunAltitudeDeg: number
}) {
  return likelyVisibleOnly && sunAltitudeDeg > -6
}
