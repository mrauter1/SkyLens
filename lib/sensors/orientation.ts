import { createCameraQuaternion } from '../projection/camera'
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

export function supportsOrientationEvents(currentWindow: {
  ondeviceorientation?: unknown
  ondeviceorientationabsolute?: unknown
}) {
  return (
    'ondeviceorientationabsolute' in currentWindow ||
    'ondeviceorientation' in currentWindow
  )
}

export async function requestOrientationPermission(
  runtime?: OrientationRuntime,
): Promise<'granted' | 'denied' | 'unavailable'> {
  const currentWindow = runtime ?? getOrientationWindow()

  if (!currentWindow) {
    return 'unavailable'
  }

  const orientationSupported = supportsOrientationEvents(currentWindow)
  const orientationPermission = await requestEventPermission(
    currentWindow.DeviceOrientationEvent,
  )

  if (orientationPermission === 'denied') {
    return 'denied'
  }

  if (orientationPermission === 'granted') {
    return orientationSupported ? 'granted' : 'unavailable'
  }

  const motionPermission = await requestEventPermission(currentWindow.DeviceMotionEvent)

  if (motionPermission === 'denied') {
    return 'denied'
  }

  return orientationSupported ? 'granted' : 'unavailable'
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

  const normalizedScreenAngle = normalizeDegrees(screenOrientationDeg)
  let pitchDeg = clamp(reading.beta, -180, 180)
  let rollDeg = clamp(reading.gamma, -180, 180)
  let headingDeg = normalizeDegrees(rawHeading)

  if (normalizedScreenAngle === 90) {
    headingDeg = normalizeDegrees(headingDeg + 90)
    pitchDeg = clamp(reading.gamma, -90, 90)
    rollDeg = clamp(-reading.beta, -180, 180)
  } else if (normalizedScreenAngle === 180) {
    headingDeg = normalizeDegrees(headingDeg + 180)
    pitchDeg = clamp(-reading.beta, -90, 90)
    rollDeg = clamp(-reading.gamma, -180, 180)
  } else if (normalizedScreenAngle === 270) {
    headingDeg = normalizeDegrees(headingDeg - 90)
    pitchDeg = clamp(-reading.gamma, -90, 90)
    rollDeg = clamp(reading.beta, -180, 180)
  } else {
    pitchDeg = clamp(reading.beta, -90, 90)
    rollDeg = clamp(reading.gamma, -180, 180)
  }

  return {
    headingDeg,
    pitchDeg,
    rollDeg,
    timestampMs: Date.now(),
  }
}

export function smoothOrientationSample(
  previous: OrientationSample | null,
  next: OrientationSample,
  smoothingFactor = DEFAULT_SMOOTHING,
): OrientationSample {
  if (!previous) {
    return next
  }

  return {
    headingDeg: interpolateAngle(previous.headingDeg, next.headingDeg, smoothingFactor),
    pitchDeg: interpolateNumber(previous.pitchDeg, next.pitchDeg, smoothingFactor),
    rollDeg: interpolateAngle(previous.rollDeg, next.rollDeg, smoothingFactor),
    timestampMs: next.timestampMs,
  }
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
  const pitchDeg = clamp(
    sample.pitchDeg - (baseline?.pitchDeg ?? 0) + offsets.pitchDeg,
    -90,
    90,
  )
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
    pitchDeg: clamp(initialState.pitchDeg ?? 0, -85, 85),
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
    pitchDeg: clamp(poseState.pitchDeg - deltaY * pitchDegPerPixel, -85, 85),
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

  let preferredEvent: 'deviceorientationabsolute' | 'deviceorientation' | null = null
  let smoothedSample: OrientationSample | null = null
  let recenterBaseline: OrientationSample | null = null
  let history: OrientationSample[] = []

  const handleEvent = (event: Event) => {
    const orientationEvent = event as DeviceOrientationEvent
    const normalized = normalizeDeviceOrientationReading(
      {
        alpha: orientationEvent.alpha,
        beta: orientationEvent.beta,
        gamma: orientationEvent.gamma,
        absolute: orientationEvent.absolute,
        webkitCompassHeading: (orientationEvent as DeviceOrientationEvent & {
          webkitCompassHeading?: number
        }).webkitCompassHeading,
      },
      getScreenOrientationCorrectionDeg(currentWindow),
    )

    if (!normalized) {
      return
    }

    const eventType = event.type as 'deviceorientationabsolute' | 'deviceorientation'

    if (!preferredEvent) {
      preferredEvent =
        eventType === 'deviceorientationabsolute' ? eventType : preferredEvent ?? eventType
    }

    if (
      preferredEvent === 'deviceorientationabsolute' &&
      eventType === 'deviceorientation'
    ) {
      return
    }

    smoothedSample = smoothOrientationSample(smoothedSample, normalized)
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

  currentWindow.addEventListener('deviceorientationabsolute', handleEvent)
  currentWindow.addEventListener('deviceorientation', handleEvent)

  return {
    recenter() {
      recenterBaseline = getRecenterBaseline(smoothedSample)
    },
    stop() {
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
