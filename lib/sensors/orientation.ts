import {
  clamp,
  crossVec3,
  createAxisAngleQuaternion,
  createCameraQuaternion,
  getCameraBasisVectors,
  multiplyQuaternions,
  normalizeVec3,
  radiansToDegrees,
  slerpQuaternions,
  dotVec3,
  type Quaternion,
  type Vec3,
} from '../projection/camera'
import type { CameraPose } from '../viewer/contracts'

export interface DeviceOrientationReading {
  alpha: number | null
  beta: number | null
  gamma: number | null
  absolute?: boolean
  webkitCompassHeading?: number
}

export interface OrientationSample {
  headingDeg: number
  pitchDeg: number
  rollDeg: number
  timestampMs: number
  quaternion?: Quaternion
}

export interface OrientationOffsets {
  headingDeg: number
  pitchDeg: number
}

export interface OrientationRuntime {
  addEventListener: (
    type: 'deviceorientationabsolute' | 'deviceorientation',
    listener: EventListenerOrEventListenerObject,
  ) => void
  removeEventListener: (
    type: 'deviceorientationabsolute' | 'deviceorientation',
    listener: EventListenerOrEventListenerObject,
  ) => void
  ondeviceorientation?: unknown
  ondeviceorientationabsolute?: unknown
  screen?: {
    orientation?: {
      angle?: number
    }
  }
  orientation?: number
  DeviceOrientationEvent?: {
    requestPermission?: () => Promise<'granted' | 'denied'>
  }
  DeviceMotionEvent?: {
    requestPermission?: () => Promise<'granted' | 'denied'>
  }
}

export interface ManualPoseState {
  yawDeg: number
  pitchDeg: number
  rollDeg: number
}

export interface ManualPoseDragOptions {
  yawDegPerPixel?: number
  pitchDegPerPixel?: number
}

const DEFAULT_SMOOTHING = 0.2
const DEFAULT_MANUAL_YAW_PER_PIXEL = 0.12
const DEFAULT_MANUAL_PITCH_PER_PIXEL = 0.12
const ORIENTATION_PERMISSION_PROBE_TIMEOUT_MS = 250
const ORIENTATION_STREAM_SELECTION_TIMEOUT_MS = 150
const SCREEN_CORRECTION_AXIS: Vec3 = [0, 1, 0]
const WORLD_UP: Vec3 = [0, 0, 1]
const BASIS_EPSILON = 1e-6

export function supportsOrientationEvents(currentWindow: {
  ondeviceorientation?: unknown
  ondeviceorientationabsolute?: unknown
}) {
  return (
    'ondeviceorientationabsolute' in currentWindow ||
    'ondeviceorientation' in currentWindow
  )
}

function supportsAbsoluteOrientationEvents(currentWindow: {
  ondeviceorientationabsolute?: unknown
}) {
  return 'ondeviceorientationabsolute' in currentWindow
}

export async function requestOrientationPermission(
  runtime?: OrientationRuntime,
): Promise<'granted' | 'denied' | 'unavailable'> {
  const currentWindow = runtime ?? getOrientationWindow()

  if (!currentWindow) {
    return 'unavailable'
  }

  const orientationSupported = supportsOrientationEvents(currentWindow)
  if (!orientationSupported) {
    return 'unavailable'
  }

  const orientationPermission = await requestEventPermission(currentWindow.DeviceOrientationEvent)
  const motionPermission = await requestEventPermission(currentWindow.DeviceMotionEvent)

  if (orientationPermission === 'denied') {
    return 'denied'
  }

  if (motionPermission === 'denied') {
    return 'denied'
  }

  if (orientationPermission === 'granted' || motionPermission === 'granted') {
    return 'granted'
  }

  return (await probeOrientationAvailability(currentWindow)) ? 'granted' : 'unavailable'
}

export function getScreenOrientationCorrectionDeg(runtime?: Pick<OrientationRuntime, 'screen' | 'orientation'>) {
  const currentWindow = runtime ?? getOrientationWindow()

  return (
    currentWindow?.screen?.orientation?.angle ??
    currentWindow?.orientation ??
    0
  )
}

export function normalizeDeviceOrientationReading(
  reading: DeviceOrientationReading,
  screenOrientationDeg = 0,
  previousSample: OrientationSample | null = null,
): OrientationSample | null {
  const rawHeading =
    typeof reading.webkitCompassHeading === 'number'
      ? reading.webkitCompassHeading
      : reading.alpha

  if (
    typeof rawHeading !== 'number' ||
    typeof reading.beta !== 'number' ||
    typeof reading.gamma !== 'number'
  ) {
    return null
  }

  const correctedQuaternion = applyScreenOrientationCorrection(
    createCameraQuaternion(
      normalizeDegrees(rawHeading),
      clamp(reading.beta, -180, 180),
      clamp(reading.gamma, -180, 180),
    ),
    screenOrientationDeg,
  )

  const sample = createOrientationSampleFromQuaternion(
    correctedQuaternion,
    Date.now(),
    previousSample,
    screenOrientationDeg,
  )

  return sample
}

function resolveContinuousOrientationSample(
  sample: OrientationSample,
  previousSample: OrientationSample | null,
) {
  if (!previousSample) {
    return sample
  }

  const candidates = createOrientationContinuityCandidates(sample).map((candidate) => {
    return {
      headingDeg:
        previousSample.headingDeg +
        shortestAngleDeltaDeg(previousSample.headingDeg, candidate.headingDeg),
      pitchDeg: candidate.pitchDeg,
      rollDeg:
        previousSample.rollDeg +
        shortestAngleDeltaDeg(previousSample.rollDeg, candidate.rollDeg),
      timestampMs: candidate.timestampMs,
      quaternion: candidate.quaternion,
    }
  })

  return candidates.reduce((best, candidate) => {
    const bestScore = scoreOrientationSampleDelta(best, previousSample)
    const candidateScore = scoreOrientationSampleDelta(candidate, previousSample)

    return candidateScore < bestScore ? candidate : best
  })
}

function createOrientationContinuityCandidates(sample: OrientationSample) {
  const mirroredPitchDeg =
    sample.pitchDeg >= 0 ? 180 - sample.pitchDeg : -180 - sample.pitchDeg

  return [
    sample,
    {
      headingDeg: normalizeDegrees(sample.headingDeg + 180),
      pitchDeg: mirroredPitchDeg,
      rollDeg: normalizeSignedDegrees(sample.rollDeg + 180),
      timestampMs: sample.timestampMs,
      quaternion: sample.quaternion,
    },
  ]
}

function scoreOrientationSampleDelta(
  sample: OrientationSample,
  previousSample: OrientationSample,
) {
  const headingDeltaDeg = shortestAngleDeltaDeg(previousSample.headingDeg, sample.headingDeg)
  const pitchDeltaDeg = sample.pitchDeg - previousSample.pitchDeg
  const rollDeltaDeg = shortestAngleDeltaDeg(previousSample.rollDeg, sample.rollDeg)

  return (
    headingDeltaDeg * headingDeltaDeg +
    pitchDeltaDeg * pitchDeltaDeg +
    rollDeltaDeg * rollDeltaDeg
  )
}

export function smoothOrientationSample(
  previous: OrientationSample | null,
  next: OrientationSample,
  smoothingFactor = DEFAULT_SMOOTHING,
): OrientationSample {
  if (!previous) {
    return next
  }

  const smoothedSample: OrientationSample = {
    headingDeg: interpolateAngle(previous.headingDeg, next.headingDeg, smoothingFactor),
    pitchDeg: interpolateNumber(previous.pitchDeg, next.pitchDeg, smoothingFactor),
    rollDeg: interpolateAngle(previous.rollDeg, next.rollDeg, smoothingFactor),
    timestampMs: next.timestampMs,
  }

  if (previous.quaternion || next.quaternion) {
    smoothedSample.quaternion =
      previous.quaternion && next.quaternion
        ? slerpQuaternions(previous.quaternion, next.quaternion, smoothingFactor)
        : createCameraQuaternion(
            smoothedSample.headingDeg,
            smoothedSample.pitchDeg,
            smoothedSample.rollDeg,
          )
  }

  return smoothedSample
}

export function computeAlignmentHealth(samples: readonly OrientationSample[]) {
  if (samples.length < 2) {
    return 'fair' as const
  }

  const durationMs = samples.at(-1)!.timestampMs - samples[0].timestampMs

  if (durationMs <= 0) {
    return 'fair' as const
  }

  const totalAngularDistance = samples.slice(1).reduce((total, sample, index) => {
    return total + Math.abs(shortestAngleDeltaDeg(samples[index].headingDeg, sample.headingDeg))
  }, 0)
  const averageAngularSpeedDegPerSec = totalAngularDistance / (durationMs / 1000)

  if (averageAngularSpeedDegPerSec > 5) {
    return 'fair' as const
  }

  const meanHeadingDeg = getCircularMeanDeg(samples.map((sample) => sample.headingDeg))
  const headingVarianceDeg = Math.sqrt(
    samples.reduce((total, sample) => {
      const delta = shortestAngleDeltaDeg(meanHeadingDeg, sample.headingDeg)
      return total + delta * delta
    }, 0) / samples.length,
  )

  if (headingVarianceDeg <= 5) {
    return 'good' as const
  }

  if (headingVarianceDeg <= 12) {
    return 'fair' as const
  }

  return 'poor' as const
}

export function trimOrientationHistory(
  samples: readonly OrientationSample[],
  windowMs = 2_000,
) {
  if (samples.length === 0) {
    return []
  }

  const newestTimestamp = samples.at(-1)!.timestampMs

  return samples.filter((sample) => newestTimestamp - sample.timestampMs <= windowMs)
}

export function createSensorCameraPose(
  sample: OrientationSample,
  {
    baseline,
    offsets = { headingDeg: 0, pitchDeg: 0 },
    alignmentHealth,
  }: {
    baseline?: OrientationSample | null
    offsets?: OrientationOffsets
    alignmentHealth: CameraPose['alignmentHealth']
  },
): CameraPose {
  const yawDeg = normalizeDegrees(
    sample.headingDeg - (baseline?.headingDeg ?? 0) + offsets.headingDeg,
  )
  const pitchDeg = sample.pitchDeg - (baseline?.pitchDeg ?? 0) + offsets.pitchDeg
  const rollDeg = normalizeSignedDegrees(sample.rollDeg - (baseline?.rollDeg ?? 0))

  return {
    yawDeg,
    pitchDeg,
    rollDeg,
    quaternion: createCameraQuaternion(yawDeg, pitchDeg, rollDeg),
    alignmentHealth,
    mode: 'sensor',
  }
}

export function getRecenterBaseline(sample: OrientationSample | null) {
  return sample
    ? {
        ...sample,
      }
    : null
}

export function createManualPoseState(
  initialState: Partial<ManualPoseState> = {},
): ManualPoseState {
  return {
    yawDeg: normalizeDegrees(initialState.yawDeg ?? 0),
    pitchDeg: initialState.pitchDeg ?? 0,
    rollDeg: normalizeSignedDegrees(initialState.rollDeg ?? 0),
  }
}

export function applyManualPoseDrag(
  poseState: ManualPoseState,
  deltaX: number,
  deltaY: number,
  {
    yawDegPerPixel = DEFAULT_MANUAL_YAW_PER_PIXEL,
    pitchDegPerPixel = DEFAULT_MANUAL_PITCH_PER_PIXEL,
  }: ManualPoseDragOptions = {},
): ManualPoseState {
  return {
    yawDeg: normalizeDegrees(poseState.yawDeg + deltaX * yawDegPerPixel),
    pitchDeg: poseState.pitchDeg - deltaY * pitchDegPerPixel,
    rollDeg: poseState.rollDeg,
  }
}

export function recenterManualPose() {
  return createManualPoseState()
}

export function createManualCameraPose(poseState: ManualPoseState): CameraPose {
  return {
    yawDeg: poseState.yawDeg,
    pitchDeg: poseState.pitchDeg,
    rollDeg: poseState.rollDeg,
    quaternion: createCameraQuaternion(
      poseState.yawDeg,
      poseState.pitchDeg,
      poseState.rollDeg,
    ),
    alignmentHealth: 'fair',
    mode: 'manual',
  }
}

export function subscribeToOrientationPose(
  onPose: (state: {
    pose: CameraPose
    sample: OrientationSample
    history: OrientationSample[]
  }) => void,
  {
    runtime,
    offsets = { headingDeg: 0, pitchDeg: 0 },
  }: {
    runtime?: OrientationRuntime
    offsets?: OrientationOffsets
  } = {},
) {
  const currentWindow = runtime ?? getOrientationWindow()

  if (!currentWindow || !supportsOrientationEvents(currentWindow)) {
    return {
      recenter() {},
      stop() {},
    }
  }

  let selectedEvent: 'deviceorientationabsolute' | 'deviceorientation' | null = null
  let smoothedSample: OrientationSample | null = null
  let recenterBaseline: OrientationSample | null = null
  let history: OrientationSample[] = []
  let pendingRelativeSample: OrientationSample | null = null
  let lastAbsoluteSample: OrientationSample | null = null
  let lastRelativeSample: OrientationSample | null = null
  let relativeSelectionTimeoutId: ReturnType<typeof setTimeout> | null = null
  const absoluteStreamSupported = supportsAbsoluteOrientationEvents(currentWindow)

  const clearPendingRelativeSelection = () => {
    pendingRelativeSample = null

    if (relativeSelectionTimeoutId !== null) {
      clearTimeout(relativeSelectionTimeoutId)
      relativeSelectionTimeoutId = null
    }
  }

  const emitSample = (sample: OrientationSample) => {
    smoothedSample = smoothOrientationSample(smoothedSample, sample)
    history = trimOrientationHistory([...history, smoothedSample])
    const alignmentHealth = computeAlignmentHealth(history)

    onPose({
      sample: smoothedSample,
      history,
      pose: createSensorCameraPose(smoothedSample, {
        baseline: recenterBaseline,
        offsets,
        alignmentHealth,
      }),
    })
  }

  const commitRelativeSelection = () => {
    if (selectedEvent || !pendingRelativeSample) {
      return
    }

    selectedEvent = 'deviceorientation'
    const sample = pendingRelativeSample
    clearPendingRelativeSelection()
    emitSample(sample)
  }

  const handleEvent = (event: Event) => {
    const eventType = event.type as 'deviceorientationabsolute' | 'deviceorientation'
    const normalized = getNormalizedOrientationSample(
      event,
      currentWindow,
      eventType === 'deviceorientationabsolute'
        ? lastAbsoluteSample
        : pendingRelativeSample ?? lastRelativeSample,
    )

    if (!normalized) {
      return
    }

    if (eventType === 'deviceorientationabsolute') {
      lastAbsoluteSample = normalized
    } else {
      lastRelativeSample = normalized
    }

    if (selectedEvent && eventType !== selectedEvent) {
      return
    }

    if (selectedEvent) {
      emitSample(normalized)
      return
    }

    if (eventType === 'deviceorientationabsolute') {
      selectedEvent = eventType
      clearPendingRelativeSelection()
      emitSample(normalized)
      return
    }

    if (!absoluteStreamSupported) {
      selectedEvent = eventType
      emitSample(normalized)
      return
    }

    pendingRelativeSample = normalized

    if (relativeSelectionTimeoutId === null) {
      relativeSelectionTimeoutId = setTimeout(() => {
        relativeSelectionTimeoutId = null
        commitRelativeSelection()
      }, ORIENTATION_STREAM_SELECTION_TIMEOUT_MS)
    }
  }

  currentWindow.addEventListener('deviceorientationabsolute', handleEvent)
  currentWindow.addEventListener('deviceorientation', handleEvent)

  return {
    recenter() {
      recenterBaseline = getRecenterBaseline(smoothedSample)
    },
    stop() {
      clearPendingRelativeSelection()
      currentWindow.removeEventListener('deviceorientationabsolute', handleEvent)
      currentWindow.removeEventListener('deviceorientation', handleEvent)
    },
  }
}

function requestEventPermission(
  eventType:
    | {
        requestPermission?: () => Promise<'granted' | 'denied'>
      }
    | undefined,
) {
  if (!eventType?.requestPermission) {
    return Promise.resolve<'granted' | 'unavailable'>('unavailable')
  }

  return eventType.requestPermission().catch(() => 'denied')
}

async function probeOrientationAvailability(runtime: OrientationRuntime) {
  return new Promise<boolean>((resolve) => {
    const handleEvent = (event: Event) => {
      if (!getNormalizedOrientationSample(event, runtime)) {
        return
      }

      cleanup()
      resolve(true)
    }

    const timeoutId = setTimeout(() => {
      cleanup()
      resolve(false)
    }, ORIENTATION_PERMISSION_PROBE_TIMEOUT_MS)

    const cleanup = () => {
      clearTimeout(timeoutId)
      runtime.removeEventListener('deviceorientationabsolute', handleEvent)
      runtime.removeEventListener('deviceorientation', handleEvent)
    }

    runtime.addEventListener('deviceorientationabsolute', handleEvent)
    runtime.addEventListener('deviceorientation', handleEvent)
  })
}

function getNormalizedOrientationSample(
  event: Event,
  runtime: Pick<OrientationRuntime, 'screen' | 'orientation'>,
  previousSample: OrientationSample | null = null,
) {
  const orientationEvent = event as DeviceOrientationEvent

  return normalizeDeviceOrientationReading(
    {
      alpha: orientationEvent.alpha,
      beta: orientationEvent.beta,
      gamma: orientationEvent.gamma,
      absolute: orientationEvent.absolute,
      webkitCompassHeading: (orientationEvent as DeviceOrientationEvent & {
        webkitCompassHeading?: number
      }).webkitCompassHeading,
    },
    getScreenOrientationCorrectionDeg(runtime),
    previousSample,
  )
}

function applyScreenOrientationCorrection(
  quaternion: Quaternion,
  screenOrientationDeg: number,
) {
  const screenCorrectionDeg = normalizeSignedDegrees(
    normalizeDegrees(screenOrientationDeg),
  )

  if (screenCorrectionDeg === 0) {
    return quaternion
  }

  return multiplyQuaternions(
    quaternion,
    createAxisAngleQuaternion(SCREEN_CORRECTION_AXIS, screenCorrectionDeg),
  )
}

function createOrientationSampleFromQuaternion(
  quaternion: Quaternion,
  timestampMs: number,
  previousSample: OrientationSample | null,
  screenOrientationDeg: number,
): OrientationSample {
  const basis = getCameraBasisVectors(quaternion)
  const headingDeg = getQuaternionHeadingDeg(basis, previousSample)
  const extractedSample = {
    headingDeg,
    pitchDeg: radiansToDegrees(Math.asin(clamp(basis.forward[2], -1, 1))),
    rollDeg: getQuaternionRollDeg(basis, headingDeg),
    timestampMs,
    quaternion,
  }
  const sample = resolveContinuousOrientationSample(
    extractedSample,
    previousSample,
  )

  return orientLandscapeSampleForPoseContract(sample, screenOrientationDeg)
}

function orientLandscapeSampleForPoseContract(
  sample: OrientationSample,
  screenOrientationDeg: number,
) {
  const normalizedScreenDeg = Math.abs(
    normalizeSignedDegrees(normalizeDegrees(screenOrientationDeg)),
  )

  if (normalizedScreenDeg !== 90 || Math.abs(sample.pitchDeg) > 90) {
    return sample
  }

  const pitchDeg = -sample.pitchDeg
  const rollDeg = normalizeSignedDegrees(-sample.rollDeg)

  return {
    ...sample,
    pitchDeg,
    rollDeg,
    quaternion: createCameraQuaternion(sample.headingDeg, pitchDeg, rollDeg),
  }
}

function getQuaternionHeadingDeg(
  basis: ReturnType<typeof getCameraBasisVectors>,
  previousSample: OrientationSample | null,
) {
  const horizontalMagnitude = Math.hypot(basis.forward[0], basis.forward[1])

  if (horizontalMagnitude > BASIS_EPSILON) {
    return normalizeDegrees(
      radiansToDegrees(Math.atan2(basis.forward[0], basis.forward[1])),
    )
  }

  if (previousSample) {
    return previousSample.headingDeg
  }

  if (basis.forward[2] >= 0) {
    return normalizeDegrees(
      radiansToDegrees(Math.atan2(-basis.down[0], basis.down[1])),
    )
  }

  return normalizeDegrees(
    radiansToDegrees(Math.atan2(basis.down[0], -basis.down[1])),
  )
}

function getQuaternionRollDeg(
  basis: ReturnType<typeof getCameraBasisVectors>,
  headingDeg: number,
) {
  const horizontalMagnitude = Math.hypot(basis.forward[0], basis.forward[1])
  const referenceRight =
    horizontalMagnitude > BASIS_EPSILON
      ? normalizeVec3(crossVec3(basis.forward, WORLD_UP))
      : ([
          Math.cos((headingDeg * Math.PI) / 180),
          Math.sin((headingDeg * Math.PI) / 180),
          0,
        ] as Vec3)

  return normalizeSignedDegrees(
    radiansToDegrees(
      Math.atan2(
        dotVec3(crossVec3(referenceRight, basis.right), basis.forward),
        dotVec3(referenceRight, basis.right),
      ),
    ),
  )
}

function getOrientationWindow() {
  if (typeof window === 'undefined') {
    return null
  }

  return window as unknown as OrientationRuntime
}

function interpolateNumber(previous: number, next: number, factor: number) {
  return previous + (next - previous) * factor
}

function interpolateAngle(previous: number, next: number, factor: number) {
  return normalizeDegrees(previous + shortestAngleDeltaDeg(previous, next) * factor)
}

function shortestAngleDeltaDeg(fromDeg: number, toDeg: number) {
  return normalizeSignedDegrees(toDeg - fromDeg)
}

function getCircularMeanDeg(values: readonly number[]) {
  const vector = values.reduce(
    (total, value) => {
      const radians = (value * Math.PI) / 180

      return {
        x: total.x + Math.cos(radians),
        y: total.y + Math.sin(radians),
      }
    },
    { x: 0, y: 0 },
  )

  return normalizeDegrees((Math.atan2(vector.y, vector.x) * 180) / Math.PI)
}

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360
}

function normalizeSignedDegrees(value: number) {
  const normalized = normalizeDegrees(value)
  return normalized > 180 ? normalized - 360 : normalized
}
