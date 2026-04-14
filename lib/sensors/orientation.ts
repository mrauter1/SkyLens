import {
  clamp,
  createCameraQuaternion,
  createQuaternionFromBasis,
  crossVec3,
  dotVec3,
  getCameraBasisVectors,
  multiplyMat3Vec3,
  multiplyQuaternions,
  negateVec3,
  normalizeQuaternion,
  normalizeVec3,
  radiansToDegrees,
  slerpQuaternions,
  type Mat3,
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

export type OrientationSource =
  | 'absolute-sensor'
  | 'deviceorientation-absolute'
  | 'deviceorientation-relative'
  | 'manual'

export type LocalFrame = 'device' | 'screen'

export interface RawOrientationSample {
  source: OrientationSource
  localFrame: LocalFrame
  absolute: boolean
  timestampMs: number
  worldFromLocal: Mat3
  compassAccuracyDeg?: number
}

export interface PoseCalibration {
  offsetQuaternion: Quaternion
  calibrated: boolean
  sourceAtCalibration: OrientationSource | null
  lastCalibratedAtMs: number | null
}

export interface OrientationSample {
  source: OrientationSource
  absolute: boolean
  needsCalibration: boolean
  timestampMs: number
  headingDeg: number
  pitchDeg: number
  rollDeg: number
  quaternion: Quaternion
  rawQuaternion: Quaternion
  rawSample: RawOrientationSample
  compassAccuracyDeg?: number
}

export interface OrientationOffsets {
  headingDeg: number
  pitchDeg: number
}

interface OrientationPermissionRequester {
  requestPermission?: (
    absolute?: boolean,
  ) => Promise<'granted' | 'denied'>
}

interface AbsoluteOrientationSensorLike {
  start: () => void
  stop?: () => void
  addEventListener: (
    type: 'reading' | 'error',
    listener: EventListenerOrEventListenerObject,
  ) => void
  removeEventListener: (
    type: 'reading' | 'error',
    listener: EventListenerOrEventListenerObject,
  ) => void
  populateMatrix?: (target: Float32Array | Float64Array | number[]) => ArrayLike<number> | void
}

interface AbsoluteOrientationSensorConstructor {
  new (options?: {
    frequency?: number
    referenceFrame?: 'device' | 'screen'
  }): AbsoluteOrientationSensorLike
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
  DeviceOrientationEvent?: OrientationPermissionRequester
  DeviceMotionEvent?: OrientationPermissionRequester
  AbsoluteOrientationSensor?: AbsoluteOrientationSensorConstructor
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
const BASIS_EPSILON = 1e-6
const WORLD_UP: Vec3 = [0, 0, 1]
const IDENTITY_QUATERNION: Quaternion = [0, 0, 0, 1]
const DEFAULT_NEUTRAL_SENSOR_QUATERNION = createCameraQuaternion(0, 0, 0)

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

function supportsAbsoluteOrientationSensor(
  currentWindow: Pick<OrientationRuntime, 'AbsoluteOrientationSensor'>,
) {
  return typeof currentWindow.AbsoluteOrientationSensor === 'function'
}

export async function requestOrientationPermission(
  runtime?: OrientationRuntime,
): Promise<'granted' | 'denied' | 'unavailable'> {
  const currentWindow = runtime ?? getOrientationWindow()

  if (!currentWindow) {
    return 'unavailable'
  }

  const orientationSupported =
    supportsOrientationEvents(currentWindow) ||
    supportsAbsoluteOrientationSensor(currentWindow)

  if (!orientationSupported) {
    return 'unavailable'
  }

  const orientationPermission = await requestEventPermission(
    currentWindow.DeviceOrientationEvent,
    { allowAbsoluteFallback: true },
  )
  const motionPermission = await requestEventPermission(
    currentWindow.DeviceMotionEvent,
  )

  if (orientationPermission === 'denied' || motionPermission === 'denied') {
    return 'denied'
  }

  if (orientationPermission === 'granted' || motionPermission === 'granted') {
    return 'granted'
  }

  if (supportsOrientationEvents(currentWindow)) {
    const orientationEventsAvailable = await probeOrientationAvailability(currentWindow)

    if (orientationEventsAvailable) {
      return 'granted'
    }
  }

  if (supportsAbsoluteOrientationSensor(currentWindow)) {
    return (await probeAbsoluteOrientationSensorAvailability(currentWindow))
      ? 'granted'
      : 'unavailable'
  }

  return 'unavailable'
}

export function getScreenOrientationCorrectionDeg(
  runtime?: Pick<OrientationRuntime, 'screen' | 'orientation'>,
) {
  const currentWindow = runtime ?? getOrientationWindow()

  return (
    currentWindow?.screen?.orientation?.angle ??
    currentWindow?.orientation ??
    0
  )
}

export function worldFromDeviceOrientation(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
): Mat3 {
  const a = degreesToRadians(alphaDeg)
  const b = degreesToRadians(betaDeg)
  const g = degreesToRadians(gammaDeg)

  const ca = Math.cos(a)
  const sa = Math.sin(a)
  const cb = Math.cos(b)
  const sb = Math.sin(b)
  const cg = Math.cos(g)
  const sg = Math.sin(g)

  return [
    [ca * cg - sa * sb * sg, -sa * cb, ca * sg + sa * sb * cg],
    [sa * cg + ca * sb * sg, ca * cb, sa * sg - ca * sb * cg],
    [-cb * sg, sb, cb * cg],
  ]
}

export function screenBasisInDeviceCoords(screenAngleDeg: number) {
  switch (normalizeDegrees(screenAngleDeg)) {
    case 0:
      return {
        screenRightDevice: [1, 0, 0] as Vec3,
        screenUpDevice: [0, 1, 0] as Vec3,
      }
    case 90:
      return {
        screenRightDevice: [0, 1, 0] as Vec3,
        screenUpDevice: [-1, 0, 0] as Vec3,
      }
    case 180:
      return {
        screenRightDevice: [-1, 0, 0] as Vec3,
        screenUpDevice: [0, -1, 0] as Vec3,
      }
    case 270:
      return {
        screenRightDevice: [0, -1, 0] as Vec3,
        screenUpDevice: [1, 0, 0] as Vec3,
      }
    default: {
      const radians = degreesToRadians(screenAngleDeg)
      const cos = Math.cos(radians)
      const sin = Math.sin(radians)

      return {
        screenRightDevice: [cos, sin, 0] as Vec3,
        screenUpDevice: [-sin, cos, 0] as Vec3,
      }
    }
  }
}

export function rawPoseQuaternionFromSample(
  sample: RawOrientationSample,
  screenAngleDeg = 0,
): Quaternion {
  if (sample.localFrame === 'screen') {
    const rightWorld = getMat3Column(sample.worldFromLocal, 0)
    const upWorld = getMat3Column(sample.worldFromLocal, 1)
    const downWorld = negateVec3(upWorld)
    const forwardWorld = negateVec3(getMat3Column(sample.worldFromLocal, 2))

    return createQuaternionFromBasis(rightWorld, downWorld, forwardWorld)
  }

  const { screenRightDevice, screenUpDevice } = screenBasisInDeviceCoords(
    screenAngleDeg,
  )
  const rightWorld = multiplyMat3Vec3(sample.worldFromLocal, screenRightDevice)
  const upWorld = multiplyMat3Vec3(sample.worldFromLocal, screenUpDevice)
  const downWorld = negateVec3(upWorld)
  const forwardWorld = multiplyMat3Vec3(sample.worldFromLocal, [0, 0, -1])

  return createQuaternionFromBasis(rightWorld, downWorld, forwardWorld)
}

export function createPoseCalibration(
  calibration: Partial<PoseCalibration> = {},
): PoseCalibration {
  return {
    offsetQuaternion: normalizeQuaternion(
      calibration.offsetQuaternion ?? IDENTITY_QUATERNION,
    ),
    calibrated: calibration.calibrated ?? false,
    sourceAtCalibration: calibration.sourceAtCalibration ?? null,
    lastCalibratedAtMs: calibration.lastCalibratedAtMs ?? null,
  }
}

export function createIdentityPoseCalibration() {
  return createPoseCalibration()
}

export function resetPoseCalibration() {
  return createPoseCalibration()
}

export function createPoseCalibrationFromReferencePose(
  rawPoseQuaternion: Quaternion,
  {
    targetQuaternion = DEFAULT_NEUTRAL_SENSOR_QUATERNION,
    source,
    timestampMs = Date.now(),
  }: {
    targetQuaternion?: Quaternion
    source: OrientationSource
    timestampMs?: number
  },
): PoseCalibration {
  return createPoseCalibration({
    offsetQuaternion: multiplyQuaternions(
      normalizeQuaternion(targetQuaternion),
      invertQuaternion(rawPoseQuaternion),
    ),
    calibrated: true,
    sourceAtCalibration: source,
    lastCalibratedAtMs: timestampMs,
  })
}

export function createPoseCalibrationFromSample(
  sample: Pick<OrientationSample, 'rawQuaternion' | 'source' | 'timestampMs'>,
) {
  return createPoseCalibrationFromReferencePose(sample.rawQuaternion, {
    source: sample.source,
    timestampMs: sample.timestampMs,
  })
}

export function createSensorCameraPose(
  sample: RawOrientationSample | OrientationSample,
  {
    calibration = createPoseCalibration(),
    alignmentHealth = 'fair',
    screenAngleDeg = 0,
    compatibilityOffsets,
  }: {
    calibration?: PoseCalibration
    alignmentHealth?: CameraPose['alignmentHealth']
    screenAngleDeg?: number
    compatibilityOffsets?: OrientationOffsets
  } = {},
): CameraPose {
  const rawSample = 'rawSample' in sample ? sample.rawSample : sample
  const orientationSample = createOrientationSample(
    rawSample,
    calibration,
    screenAngleDeg,
    createCompatibilityOffsetQuaternion(compatibilityOffsets),
  )

  return buildCameraPose(
    orientationSample,
    orientationSample.needsCalibration ? 'poor' : alignmentHealth,
  )
}

export function normalizeDeviceOrientationReading(
  reading: DeviceOrientationReading,
  screenOrientationDeg = 0,
  calibration = createPoseCalibration(),
): OrientationSample | null {
  const rawSample = createRawDeviceOrientationSample(reading)

  if (!rawSample) {
    return null
  }

  return createOrientationSample(rawSample, calibration, screenOrientationDeg)
}

export function smoothOrientationSample(
  previous: OrientationSample | null,
  next: OrientationSample,
  smoothingFactor = DEFAULT_SMOOTHING,
): OrientationSample {
  if (!previous || previous.source !== next.source) {
    return next
  }

  const quaternion = slerpQuaternions(
    previous.quaternion,
    next.quaternion,
    smoothingFactor,
  )
  const rawQuaternion = slerpQuaternions(
    previous.rawQuaternion,
    next.rawQuaternion,
    smoothingFactor,
  )
  const debugAngles = getDebugEulerFromQuaternion(quaternion)

  return {
    ...next,
    ...debugAngles,
    quaternion,
    rawQuaternion,
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

export function startAbsoluteOrientationSensorProvider(
  onSample: (sample: RawOrientationSample) => void,
  {
    runtime,
    onUnavailable,
  }: {
    runtime?: OrientationRuntime
    onUnavailable?: () => void
  } = {},
) {
  const currentWindow = runtime ?? getOrientationWindow()

  if (!currentWindow?.AbsoluteOrientationSensor) {
    return null
  }

  let sensor: AbsoluteOrientationSensorLike

  try {
    sensor = new currentWindow.AbsoluteOrientationSensor({
      frequency: 60,
      referenceFrame: 'screen',
    })
  } catch {
    onUnavailable?.()
    return null
  }

  const handleReading = () => {
    const worldFromLocal = readOrientationSensorMatrix(sensor)

    if (!worldFromLocal) {
      return
    }

    onSample({
      source: 'absolute-sensor',
      localFrame: 'screen',
      absolute: true,
      timestampMs: Date.now(),
      worldFromLocal,
    })
  }

  const handleError = () => {
    cleanup()
    onUnavailable?.()
  }

  const cleanup = () => {
    sensor.removeEventListener('reading', handleReading)
    sensor.removeEventListener('error', handleError)
    try {
      sensor.stop?.()
    } catch {
      // Non-fatal: teardown must not block fallback providers.
    }
  }

  sensor.addEventListener('reading', handleReading)
  sensor.addEventListener('error', handleError)

  try {
    sensor.start()
  } catch {
    cleanup()
    onUnavailable?.()
    return null
  }

  return {
    stop() {
      cleanup()
    },
  }
}

export function startDeviceOrientationProvider(
  onSample: (sample: RawOrientationSample) => void,
  {
    runtime,
  }: {
    runtime?: OrientationRuntime
  } = {},
) {
  const currentWindow = runtime ?? getOrientationWindow()

  if (!currentWindow || !supportsOrientationEvents(currentWindow)) {
    return null
  }

  const handleEvent = (event: Event) => {
    const rawSample = getRawOrientationSample(event)

    if (rawSample) {
      onSample(rawSample)
    }
  }

  currentWindow.addEventListener('deviceorientationabsolute', handleEvent)
  currentWindow.addEventListener('deviceorientation', handleEvent)

  return {
    stop() {
      currentWindow.removeEventListener('deviceorientationabsolute', handleEvent)
      currentWindow.removeEventListener('deviceorientation', handleEvent)
    },
  }
}

export function subscribeToOrientationPose(
  onPose: (state: {
    pose: CameraPose
    sample: OrientationSample
    history: OrientationSample[]
    orientationSource: OrientationSource
    orientationAbsolute: boolean
    orientationNeedsCalibration: boolean
    poseCalibration: PoseCalibration
  }) => void,
  {
    runtime,
    initialCalibration = createPoseCalibration(),
    offsets = { headingDeg: 0, pitchDeg: 0 },
  }: {
    runtime?: OrientationRuntime
    initialCalibration?: PoseCalibration
    offsets?: OrientationOffsets
  } = {},
) {
  const currentWindow = runtime ?? getOrientationWindow()

  if (!currentWindow) {
    return {
      recenter() {},
      stop() {},
    }
  }

  let selectedSource: OrientationSource | null = null
  let smoothedSample: OrientationSample | null = null
  let history: OrientationSample[] = []
  let calibration = createPoseCalibration(initialCalibration)
  let pendingRelativeSample: RawOrientationSample | null = null
  let pendingAbsoluteDeviceSample: RawOrientationSample | null = null
  let relativeSelectionTimeoutId: ReturnType<typeof setTimeout> | null = null
  let sensorSelectionTimeoutId: ReturnType<typeof setTimeout> | null = null
  let sensorPending = false
  let sensorProvider: ReturnType<typeof startAbsoluteOrientationSensorProvider> | null = null

  const absoluteStreamSupported = supportsAbsoluteOrientationEvents(currentWindow)
  const compatibilityOffsetQuaternion = createCompatibilityOffsetQuaternion(offsets)

  const deviceProvider = startDeviceOrientationProvider(handleDeviceSample, {
    runtime: currentWindow,
  })

  if (!deviceProvider && !supportsAbsoluteOrientationSensor(currentWindow)) {
    return {
      recenter() {},
      stop() {},
    }
  }

  function resetSmoothingIfSourceChanged(rawSample: RawOrientationSample) {
    if (smoothedSample && smoothedSample.source !== rawSample.source) {
      smoothedSample = null
      history = []
    }
  }

  function clearRelativeSelection() {
    pendingRelativeSample = null

    if (relativeSelectionTimeoutId !== null) {
      clearTimeout(relativeSelectionTimeoutId)
      relativeSelectionTimeoutId = null
    }
  }

  function clearSensorSelection() {
    if (sensorSelectionTimeoutId !== null) {
      clearTimeout(sensorSelectionTimeoutId)
      sensorSelectionTimeoutId = null
    }
  }

  function emitRawSample(rawSample: RawOrientationSample) {
    resetSmoothingIfSourceChanged(rawSample)

    const sample = createOrientationSample(
      rawSample,
      calibration,
      getScreenOrientationCorrectionDeg(currentWindow ?? undefined),
      compatibilityOffsetQuaternion,
    )

    smoothedSample = smoothOrientationSample(smoothedSample, sample)
    history = trimOrientationHistory([...history, smoothedSample])
    const alignmentHealth = smoothedSample.needsCalibration
      ? 'poor'
      : computeAlignmentHealth(history)

    onPose({
      sample: smoothedSample,
      history,
      orientationSource: smoothedSample.source,
      orientationAbsolute: smoothedSample.absolute,
      orientationNeedsCalibration: smoothedSample.needsCalibration,
      poseCalibration: calibration,
      pose: buildCameraPose(smoothedSample, alignmentHealth),
    })
  }

  function commitBufferedDeviceFallback() {
    sensorPending = false
    clearSensorSelection()
    sensorProvider?.stop()
    sensorProvider = null

    if (selectedSource === 'absolute-sensor') {
      return
    }

    if (pendingAbsoluteDeviceSample) {
      const rawSample = pendingAbsoluteDeviceSample
      pendingAbsoluteDeviceSample = null
      clearRelativeSelection()
      selectedSource = rawSample.source
      emitRawSample(rawSample)
      return
    }

    if (pendingRelativeSample) {
      const rawSample = pendingRelativeSample
      pendingRelativeSample = null
      selectedSource = rawSample.source
      emitRawSample(rawSample)
    }
  }

  function handleSensorSample(rawSample: RawOrientationSample) {
    selectedSource = rawSample.source
    sensorPending = false
    clearSensorSelection()
    clearRelativeSelection()
    pendingAbsoluteDeviceSample = null
    emitRawSample(rawSample)
  }

  function handleDeviceSample(rawSample: RawOrientationSample) {
    if (selectedSource === 'absolute-sensor') {
      return
    }

    if (sensorPending) {
      if (rawSample.absolute) {
        pendingAbsoluteDeviceSample = rawSample
      } else {
        pendingRelativeSample = rawSample
      }

      return
    }

    if (rawSample.absolute) {
      selectedSource = rawSample.source
      pendingAbsoluteDeviceSample = null
      clearRelativeSelection()
      emitRawSample(rawSample)
      return
    }

    if (selectedSource === 'deviceorientation-absolute') {
      return
    }

    if (selectedSource === 'deviceorientation-relative') {
      emitRawSample(rawSample)
      return
    }

    if (!absoluteStreamSupported) {
      selectedSource = rawSample.source
      emitRawSample(rawSample)
      return
    }

    pendingRelativeSample = rawSample

    if (relativeSelectionTimeoutId === null) {
      relativeSelectionTimeoutId = setTimeout(() => {
        relativeSelectionTimeoutId = null

        if (!pendingRelativeSample || selectedSource === 'absolute-sensor') {
          return
        }

        selectedSource = pendingRelativeSample.source
        const nextSample = pendingRelativeSample
        pendingRelativeSample = null
        emitRawSample(nextSample)
      }, ORIENTATION_STREAM_SELECTION_TIMEOUT_MS)
    }
  }

  sensorProvider = startAbsoluteOrientationSensorProvider(handleSensorSample, {
    runtime: currentWindow,
    onUnavailable() {
      if (sensorPending) {
        commitBufferedDeviceFallback()
      }
    },
  })

  if (sensorProvider) {
    sensorPending = true
    sensorSelectionTimeoutId = setTimeout(() => {
      commitBufferedDeviceFallback()
    }, ORIENTATION_STREAM_SELECTION_TIMEOUT_MS)
  }

  return {
    recenter() {
      if (!smoothedSample) {
        return
      }

      calibration = createPoseCalibrationFromSample(smoothedSample)
      const rawSample = smoothedSample.rawSample
      smoothedSample = null
      history = []
      emitRawSample(rawSample)
    },
    setCalibration(nextCalibration: PoseCalibration) {
      calibration = createPoseCalibration(nextCalibration)

      if (!smoothedSample) {
        return
      }

      const rawSample = smoothedSample.rawSample
      smoothedSample = null
      history = []
      emitRawSample(rawSample)
    },
    stop() {
      clearSensorSelection()
      clearRelativeSelection()
      sensorProvider?.stop()
      deviceProvider?.stop()
    },
  }
}

function requestEventPermission(
  eventType: OrientationPermissionRequester | undefined,
  options: {
    allowAbsoluteFallback?: boolean
  } = {},
) {
  const requestPermission = eventType?.requestPermission

  if (!requestPermission) {
    return Promise.resolve<'granted' | 'unavailable'>('unavailable')
  }

  return requestPermission()
    .catch(async (error: unknown) => {
      if (
        !options.allowAbsoluteFallback ||
        !(error instanceof TypeError)
      ) {
        return 'denied' as const
      }

      return requestPermission(true).catch(() => 'denied' as const)
    })
}

async function probeOrientationAvailability(runtime: OrientationRuntime) {
  return new Promise<boolean>((resolve) => {
    const handleEvent = (event: Event) => {
      if (!getRawOrientationSample(event)) {
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

async function probeAbsoluteOrientationSensorAvailability(
  runtime: OrientationRuntime,
) {
  return new Promise<boolean>((resolve) => {
    let settled = false
    let controller: ReturnType<typeof startAbsoluteOrientationSensorProvider> | null = null

    const settle = (result: boolean) => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timeoutId)
      controller?.stop()
      controller = null
      resolve(result)
    }

    const timeoutId = setTimeout(() => {
      settle(false)
    }, ORIENTATION_PERMISSION_PROBE_TIMEOUT_MS)

    controller = startAbsoluteOrientationSensorProvider(
      () => {
        settle(true)
      },
      {
        runtime,
        onUnavailable() {
          settle(false)
        },
      },
    )

    if (!controller) {
      settle(false)
    }
  })
}

function createRawDeviceOrientationSample(
  reading: DeviceOrientationReading,
): RawOrientationSample | null {
  if (
    typeof reading.alpha !== 'number' ||
    typeof reading.beta !== 'number' ||
    typeof reading.gamma !== 'number'
  ) {
    return null
  }

  const absolute = reading.absolute === true

  return {
    source: absolute
      ? 'deviceorientation-absolute'
      : 'deviceorientation-relative',
    localFrame: 'device',
    absolute,
    timestampMs: Date.now(),
    worldFromLocal: worldFromDeviceOrientation(
      reading.alpha,
      reading.beta,
      reading.gamma,
    ),
  }
}

function getRawOrientationSample(event: Event) {
  const orientationEvent = event as DeviceOrientationEvent

  return createRawDeviceOrientationSample({
    alpha: orientationEvent.alpha,
    beta: orientationEvent.beta,
    gamma: orientationEvent.gamma,
    absolute: orientationEvent.absolute,
    webkitCompassHeading: (orientationEvent as DeviceOrientationEvent & {
      webkitCompassHeading?: number
    }).webkitCompassHeading,
  })
}

function createOrientationSample(
  rawSample: RawOrientationSample,
  calibration: PoseCalibration,
  screenAngleDeg: number,
  compatibilityOffsetQuaternion: Quaternion = IDENTITY_QUATERNION,
): OrientationSample {
  const rawQuaternion = rawPoseQuaternionFromSample(rawSample, screenAngleDeg)
  const calibratedQuaternion = multiplyQuaternions(
    compatibilityOffsetQuaternion,
    multiplyQuaternions(calibration.offsetQuaternion, rawQuaternion),
  )
  const debugAngles = getDebugEulerFromQuaternion(calibratedQuaternion)

  return {
    source: rawSample.source,
    absolute: rawSample.absolute,
    needsCalibration: !rawSample.absolute && !calibration.calibrated,
    timestampMs: rawSample.timestampMs,
    rawSample,
    rawQuaternion,
    quaternion: calibratedQuaternion,
    compassAccuracyDeg: rawSample.compassAccuracyDeg,
    ...debugAngles,
  }
}

function buildCameraPose(
  sample: OrientationSample,
  alignmentHealth: CameraPose['alignmentHealth'],
): CameraPose {
  return {
    yawDeg: sample.headingDeg,
    pitchDeg: sample.pitchDeg,
    rollDeg: sample.rollDeg,
    quaternion: sample.quaternion,
    alignmentHealth,
    mode: 'sensor',
  }
}

function createCompatibilityOffsetQuaternion(offsets?: OrientationOffsets) {
  if (!offsets) {
    return IDENTITY_QUATERNION
  }

  if (offsets.headingDeg === 0 && offsets.pitchDeg === 0) {
    return IDENTITY_QUATERNION
  }

  return createCameraQuaternion(offsets.headingDeg, offsets.pitchDeg, 0)
}

function getDebugEulerFromQuaternion(quaternion: Quaternion) {
  const basis = getCameraBasisVectors(quaternion)
  const headingDeg = getQuaternionHeadingDeg(basis)
  const pitchDeg = radiansToDegrees(Math.asin(clamp(basis.forward[2], -1, 1)))
  const horizontalMagnitude = Math.hypot(basis.forward[0], basis.forward[1])
  const referenceRight =
    horizontalMagnitude > BASIS_EPSILON
      ? normalizeVec3(crossVec3(basis.forward, WORLD_UP))
      : ([
          Math.cos(degreesToRadians(headingDeg)),
          Math.sin(degreesToRadians(headingDeg)),
          0,
        ] as Vec3)

  return {
    headingDeg,
    pitchDeg,
    rollDeg: normalizeSignedDegrees(
      radiansToDegrees(
        Math.atan2(
          dotVec3(crossVec3(referenceRight, basis.right), basis.forward),
          dotVec3(referenceRight, basis.right),
        ),
      ),
    ),
  }
}

function getQuaternionHeadingDeg(
  basis: ReturnType<typeof getCameraBasisVectors>,
) {
  const horizontalMagnitude = Math.hypot(basis.forward[0], basis.forward[1])

  if (horizontalMagnitude > BASIS_EPSILON) {
    return normalizeDegrees(
      radiansToDegrees(Math.atan2(basis.forward[0], basis.forward[1])),
    )
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

function getMat3Column(matrix: Mat3, columnIndex: 0 | 1 | 2): [number, number, number] {
  return [
    matrix[0][columnIndex],
    matrix[1][columnIndex],
    matrix[2][columnIndex],
  ]
}

function readOrientationSensorMatrix(sensor: AbsoluteOrientationSensorLike): Mat3 | null {
  if (!sensor.populateMatrix) {
    return null
  }

  const matrixBuffer = new Float32Array(16)
  const populated = sensor.populateMatrix(matrixBuffer) ?? matrixBuffer

  if (populated.length >= 16) {
    return [
      [populated[0], populated[4], populated[8]],
      [populated[1], populated[5], populated[9]],
      [populated[2], populated[6], populated[10]],
    ]
  }

  if (populated.length >= 9) {
    return [
      [populated[0], populated[1], populated[2]],
      [populated[3], populated[4], populated[5]],
      [populated[6], populated[7], populated[8]],
    ]
  }

  return null
}

function invertQuaternion(quaternion: Quaternion): Quaternion {
  const normalized = normalizeQuaternion(quaternion)
  return [-normalized[0], -normalized[1], -normalized[2], normalized[3]]
}

function getOrientationWindow() {
  if (typeof window === 'undefined') {
    return null
  }

  return window as unknown as OrientationRuntime
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180
}

function shortestAngleDeltaDeg(fromDeg: number, toDeg: number) {
  return normalizeSignedDegrees(toDeg - fromDeg)
}

function getCircularMeanDeg(values: readonly number[]) {
  const vector = values.reduce(
    (total, value) => {
      const radians = degreesToRadians(value)

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
