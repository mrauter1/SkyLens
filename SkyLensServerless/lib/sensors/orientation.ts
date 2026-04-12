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
  webkitCompassAccuracy?: number
}

export type OrientationSource =
  | 'absolute-sensor'
  | 'relative-sensor'
  | 'deviceorientation-absolute'
  | 'deviceorientation-relative'
  | 'manual'

export type LocalFrame = 'device' | 'screen'

export interface RawOrientationSample {
  source: OrientationSource
  providerKind: 'sensor' | 'event'
  localFrame: LocalFrame
  absolute: boolean
  timestampMs: number
  worldFromLocal?: Mat3
  rawQuaternion?: Quaternion
  compassBacked?: boolean
  compassHeadingDeg?: number
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
  reportedCompassHeadingDeg?: number
  compassAccuracyDeg?: number
  compassBacked?: boolean
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
  quaternion?: ArrayLike<number>
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

type RelativeOrientationSensorLike = AbsoluteOrientationSensorLike

interface RelativeOrientationSensorConstructor {
  new (options?: {
    frequency?: number
    referenceFrame?: 'device' | 'screen'
  }): RelativeOrientationSensorLike
}

interface OrientationRuntimeDocument {
  visibilityState?: DocumentVisibilityState
  addEventListener?: (
    type: 'visibilitychange',
    listener: EventListenerOrEventListenerObject,
  ) => void
  removeEventListener?: (
    type: 'visibilitychange',
    listener: EventListenerOrEventListenerObject,
  ) => void
}

export interface OrientationRuntime {
  addEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) => void
  removeEventListener: (
    type: string,
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
  document?: OrientationRuntimeDocument
  DeviceOrientationEvent?: OrientationPermissionRequester
  DeviceMotionEvent?: OrientationPermissionRequester
  AbsoluteOrientationSensor?: AbsoluteOrientationSensorConstructor
  RelativeOrientationSensor?: RelativeOrientationSensorConstructor
  permissions?: Pick<Permissions, 'query'>
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

interface OrientationCapabilities {
  hasEvents: boolean
  hasAbsoluteEvent: boolean
  hasAbsoluteSensor: boolean
  hasRelativeSensor: boolean
  canRequestPermission: boolean
}

interface PermissionHints {
  accelerometer?: PermissionState | 'unsupported'
  gyroscope?: PermissionState | 'unsupported'
  magnetometer?: PermissionState | 'unsupported'
}

interface OrientationProviderController {
  id: Exclude<OrientationSource, 'manual'>
  absolute: boolean
  priority: number
  stop(): void
}

type AutomaticOrientationSource = Exclude<OrientationSource, 'manual'>
type DeviceOrientationProviderId =
  | 'deviceorientationabsolute-event'
  | 'deviceorientation-absolute-event'
  | 'deviceorientation-relative-event'
  | 'deviceorientation-safari-validated-event'
type InternalProviderId =
  | 'absolute-sensor'
  | 'relative-sensor'
  | DeviceOrientationProviderId

interface InternalProviderSample {
  providerId: InternalProviderId
  rawSample: RawOrientationSample
}

const DEFAULT_SMOOTHING = 0.2
const DEFAULT_MANUAL_YAW_PER_PIXEL = 0.12
const DEFAULT_MANUAL_PITCH_PER_PIXEL = 0.12

const ORIENTATION_PERMISSION_HINT_STARTUP_TIMEOUT_MS = 50
const ORIENTATION_PROVIDER_SELECTION_TIMEOUT_MS = 500
const ORIENTATION_ABSOLUTE_UPGRADE_WINDOW_MS = 5_000
const ORIENTATION_PROVIDER_STALL_TIMEOUT_MS = 1_500
const ORIENTATION_MIN_CONSECUTIVE_SAMPLES_FOR_UPGRADE = 2

const SAFARI_COMPASS_VALIDATION_SAMPLES = 3
const SAFARI_COMPASS_MAX_ACCURACY_DEG = 20
const SAFARI_COMPASS_MAX_HEADING_DELTA_DEG = 20

const BASIS_EPSILON = 1e-6
const WORLD_UP: Vec3 = [0, 0, 1]
const IDENTITY_QUATERNION: Quaternion = [0, 0, 0, 1]
const DEFAULT_NEUTRAL_SENSOR_QUATERNION = createCameraQuaternion(0, 0, 0)

const PROVIDER_PRIORITY: Record<AutomaticOrientationSource, number> = {
  'absolute-sensor': 100,
  'deviceorientation-absolute': 90,
  'relative-sensor': 70,
  'deviceorientation-relative': 60,
}
const INTERNAL_PROVIDER_PRIORITY: Record<InternalProviderId, number> = {
  'absolute-sensor': 100,
  'deviceorientationabsolute-event': 95,
  'deviceorientation-absolute-event': 90,
  'deviceorientation-safari-validated-event': 80,
  'relative-sensor': 70,
  'deviceorientation-relative-event': 60,
}

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

export function supportsRelativeOrientationSensor(
  currentWindow: Pick<OrientationRuntime, 'RelativeOrientationSensor'>,
) {
  return typeof currentWindow.RelativeOrientationSensor === 'function'
}

export function getOrientationCapabilities(
  runtime?: OrientationRuntime,
): OrientationCapabilities {
  const currentWindow = runtime ?? getOrientationWindow()

  if (!currentWindow) {
    return {
      hasEvents: false,
      hasAbsoluteEvent: false,
      hasAbsoluteSensor: false,
      hasRelativeSensor: false,
      canRequestPermission: false,
    }
  }

  return {
    hasEvents: supportsOrientationEvents(currentWindow),
    hasAbsoluteEvent: supportsAbsoluteOrientationEvents(currentWindow),
    hasAbsoluteSensor: supportsAbsoluteOrientationSensor(currentWindow),
    hasRelativeSensor: supportsRelativeOrientationSensor(currentWindow),
    canRequestPermission:
      typeof currentWindow.DeviceOrientationEvent?.requestPermission === 'function' ||
      typeof currentWindow.DeviceMotionEvent?.requestPermission === 'function',
  }
}

export async function requestOrientationPermission(
  runtime?: OrientationRuntime,
): Promise<'granted' | 'denied' | 'unavailable'> {
  const currentWindow = runtime ?? getOrientationWindow()

  if (!currentWindow) {
    return 'unavailable'
  }

  const capabilities = getOrientationCapabilities(currentWindow)

  if (
    !capabilities.hasEvents &&
    !capabilities.hasAbsoluteSensor &&
    !capabilities.hasRelativeSensor
  ) {
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

  return capabilities.canRequestPermission ? 'unavailable' : 'unavailable'
}

export async function querySensorPermissionHints(
  runtime: OrientationRuntime,
): Promise<PermissionHints> {
  return {
    accelerometer: await querySensorPermissionState(runtime, 'accelerometer'),
    gyroscope: await querySensorPermissionState(runtime, 'gyroscope'),
    magnetometer: await querySensorPermissionState(runtime, 'magnetometer'),
  }
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

export function applyScreenCorrectionToQuaternion(
  quaternion: Quaternion,
  screenAngleDeg: number,
): Quaternion {
  const basis = getCameraBasisVectors(quaternion)
  const deviceRight = basis.right
  const deviceUp = negateVec3(basis.down)
  const { screenRightDevice, screenUpDevice } = screenBasisInDeviceCoords(
    screenAngleDeg,
  )

  const correctedRight = combineBasisVectors(
    deviceRight,
    deviceUp,
    screenRightDevice[0],
    screenRightDevice[1],
  )
  const correctedUp = combineBasisVectors(
    deviceRight,
    deviceUp,
    screenUpDevice[0],
    screenUpDevice[1],
  )

  return createQuaternionFromBasis(
    correctedRight,
    negateVec3(correctedUp),
    basis.forward,
  )
}

export function rawPoseQuaternionFromSample(
  sample: RawOrientationSample,
  screenAngleDeg = 0,
): Quaternion {
  if (sample.rawQuaternion) {
    return sample.localFrame === 'screen'
      ? normalizeQuaternion(sample.rawQuaternion)
      : applyScreenCorrectionToQuaternion(sample.rawQuaternion, screenAngleDeg)
  }

  if (!sample.worldFromLocal) {
    throw new Error('orientation-sample-missing-pose-data')
  }

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
    return capAlignmentHealthForCompass(samples.at(-1), 'fair')
  }

  const durationMs = samples.at(-1)!.timestampMs - samples[0].timestampMs

  if (durationMs <= 0) {
    return capAlignmentHealthForCompass(samples.at(-1), 'fair')
  }

  const totalAngularDistance = samples.slice(1).reduce((total, sample, index) => {
    return total + Math.abs(shortestAngleDeltaDeg(samples[index].headingDeg, sample.headingDeg))
  }, 0)
  const averageAngularSpeedDegPerSec = totalAngularDistance / (durationMs / 1000)

  let result: CameraPose['alignmentHealth'] = 'poor'

  if (averageAngularSpeedDegPerSec > 5) {
    result = 'fair'
  } else {
    const meanHeadingDeg = getCircularMeanDeg(samples.map((sample) => sample.headingDeg))
    const headingVarianceDeg = Math.sqrt(
      samples.reduce((total, sample) => {
        const delta = shortestAngleDeltaDeg(meanHeadingDeg, sample.headingDeg)
        return total + delta * delta
      }, 0) / samples.length,
    )

    if (headingVarianceDeg <= 5) {
      result = 'good'
    } else if (headingVarianceDeg <= 12) {
      result = 'fair'
    }
  }

  return capAlignmentHealthForCompass(samples.at(-1), result)
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
  return startOrientationSensorProvider(
    'absolute-sensor',
    onSample,
    {
      runtime,
      onUnavailable,
      requiredPermissions: ['accelerometer', 'gyroscope', 'magnetometer'],
      createSensor: (currentWindow) => new currentWindow.AbsoluteOrientationSensor!({
        frequency: 60,
        referenceFrame: 'screen',
      }),
    },
  )
}

export function startRelativeOrientationSensorProvider(
  onSample: (sample: RawOrientationSample) => void,
  {
    runtime,
    onUnavailable,
  }: {
    runtime?: OrientationRuntime
    onUnavailable?: () => void
  } = {},
) {
  return startOrientationSensorProvider(
    'relative-sensor',
    onSample,
    {
      runtime,
      onUnavailable,
      requiredPermissions: ['accelerometer', 'gyroscope'],
      createSensor: (currentWindow) => new currentWindow.RelativeOrientationSensor!({
        frequency: 60,
        referenceFrame: 'screen',
      }),
    },
  )
}

export function startDeviceOrientationProvider(
  onSample: (sample: RawOrientationSample) => void,
  {
    runtime,
    onClassifiedSample,
  }: {
    runtime?: OrientationRuntime
    onClassifiedSample?: (
      sample: RawOrientationSample,
      providerId: DeviceOrientationProviderId,
    ) => void
  } = {},
) {
  const currentWindow = runtime ?? getOrientationWindow()

  if (!currentWindow || !supportsOrientationEvents(currentWindow)) {
    return null
  }

  const handleEvent = (event: Event) => {
    const classifiedSample = getRawOrientationSample(event)

    if (classifiedSample) {
      onSample(classifiedSample.rawSample)
      onClassifiedSample?.(
        classifiedSample.rawSample,
        classifiedSample.providerId,
      )
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
      setCalibration() {},
      stop() {},
    }
  }

  const runtimeWindow = currentWindow

  const compatibilityOffsetQuaternion = createCompatibilityOffsetQuaternion(offsets)

  let calibration = createPoseCalibration(initialCalibration)
  let smoothedSample: OrientationSample | null = null
  let latestSample: InternalProviderSample | null = null
  let history: OrientationSample[] = []
  let selectedSource: AutomaticOrientationSource | null = null
  let selectedProviderId: InternalProviderId | null = null
  let selectionCandidates = new Map<InternalProviderId, InternalProviderSample>()
  let upgradeCounts = new Map<InternalProviderId, number>()
  let providerControllers: OrientationProviderController[] = []
  let selectionTimeoutId: ReturnType<typeof setTimeout> | null = null
  let stallTimeoutId: ReturnType<typeof setTimeout> | null = null
  let selectionActive = false
  let selectionWindowExpired = false
  let stopped = false
  let suspended = false
  let upgradeDeadlineMs: number | null = null
  let compassValidation = {
    consecutiveValidSamples: 0,
    consecutiveInvalidSamples: 0,
    validated: false,
  }

  const handleProviderSample = (incomingSample: InternalProviderSample) => {
    if (stopped || suspended) {
      return
    }

    const providerSample = reconcileCompassValidation(incomingSample)

    if (selectionActive) {
      selectionCandidates.set(providerSample.providerId, providerSample)

      if (selectionWindowExpired) {
        const winner = chooseProviderCandidate(selectionCandidates)

        if (!winner) {
          return
        }

        selectionActive = false
        selectionWindowExpired = false
        emitRawSample(winner)

        if (!winner.rawSample.absolute) {
          upgradeDeadlineMs = Date.now() + ORIENTATION_ABSOLUTE_UPGRADE_WINDOW_MS
        }
      }

      return
    }

    if (!selectedSource || !selectedProviderId) {
      return
    }

    if (providerSample.providerId === selectedProviderId) {
      emitRawSample(providerSample)
      return
    }

    if (
      selectedProviderId === 'deviceorientation-safari-validated-event' &&
      providerSample.providerId === 'deviceorientation-relative-event'
    ) {
      emitRawSample(providerSample)
      return
    }

    if (
      providerSample.providerId === 'deviceorientation-safari-validated-event' &&
      providerSample.rawSample.absolute &&
      selectedSource !== null &&
      !isSourceAbsolute(selectedSource) &&
      canAttemptAbsoluteUpgrade()
    ) {
      emitRawSample(providerSample)
      return
    }

    if (canUpgradeToAbsolute(providerSample)) {
      const nextCount = (upgradeCounts.get(providerSample.providerId) ?? 0) + 1
      upgradeCounts.set(providerSample.providerId, nextCount)

      if (nextCount >= ORIENTATION_MIN_CONSECUTIVE_SAMPLES_FOR_UPGRADE) {
        emitRawSample(providerSample)
      }
    }
  }

  const restartArbitration = () => {
    if (stopped || suspended || isRuntimeHidden(currentWindow)) {
      return
    }

    stopProviders()
    clearTrackingState()
    startArbitration()
  }

  const handleSelectedProviderUnavailable = (source: AutomaticOrientationSource) => {
    if (!selectionActive && selectedSource === source) {
      restartArbitration()
    }
  }

  const lifecycleListeners = attachLifecycleListeners(
    runtimeWindow,
    () => {
      if (stopped) {
        return
      }

      suspended = true
      stopProviders()
      clearTrackingState()
    },
    () => {
      if (stopped || isRuntimeHidden(runtimeWindow)) {
        return
      }

      suspended = false
      restartArbitration()
    },
    () => {
      if (
        stopped ||
        !latestSample ||
        latestSample.rawSample.providerKind !== 'event' ||
        !selectedSource
      ) {
        return
      }

      smoothedSample = null
      history = []
      emitRawSample(latestSample)
    },
  )

  if (!isRuntimeHidden(runtimeWindow)) {
    startArbitration()
  } else {
    suspended = true
  }

  function startArbitration() {
    selectionActive = true
    selectionWindowExpired = false
    selectionCandidates = new Map()
    upgradeCounts = new Map()

    const absoluteSensor = startAbsoluteOrientationSensorProvider((rawSample) => {
      handleProviderSample({
        providerId: 'absolute-sensor',
        rawSample,
      })
    }, {
      runtime: runtimeWindow,
      onUnavailable() {
        handleSelectedProviderUnavailable('absolute-sensor')
      },
    })

    if (absoluteSensor) {
      providerControllers.push({
        id: 'absolute-sensor',
        absolute: true,
        priority: PROVIDER_PRIORITY['absolute-sensor'],
        stop: absoluteSensor.stop,
      })
    }

    const relativeSensor = startRelativeOrientationSensorProvider((rawSample) => {
      handleProviderSample({
        providerId: 'relative-sensor',
        rawSample,
      })
    }, {
      runtime: runtimeWindow,
      onUnavailable() {
        handleSelectedProviderUnavailable('relative-sensor')
      },
    })

    if (relativeSensor) {
      providerControllers.push({
        id: 'relative-sensor',
        absolute: false,
        priority: PROVIDER_PRIORITY['relative-sensor'],
        stop: relativeSensor.stop,
      })
    }

    const eventProvider = startDeviceOrientationProvider(() => {}, {
      runtime: runtimeWindow,
      onClassifiedSample(rawSample, providerId) {
        handleProviderSample({
          providerId,
          rawSample,
        })
      },
    })

    if (eventProvider) {
      providerControllers.push({
        id: 'deviceorientation-relative',
        absolute: false,
        priority: PROVIDER_PRIORITY['deviceorientation-relative'],
        stop: eventProvider.stop,
      })
    }

    if (providerControllers.length === 0) {
      selectionActive = false
      return
    }

    selectionTimeoutId = setTimeout(() => {
      selectionTimeoutId = null

      const winner = chooseProviderCandidate(selectionCandidates)

      if (!winner) {
        selectionWindowExpired = true
        return
      }

      selectionActive = false
      emitRawSample(winner)

      if (!winner.rawSample.absolute) {
        upgradeDeadlineMs = Date.now() + ORIENTATION_ABSOLUTE_UPGRADE_WINDOW_MS
      }
    }, ORIENTATION_PROVIDER_SELECTION_TIMEOUT_MS)
  }

  function emitRawSample(providerSample: InternalProviderSample) {
    const { providerId, rawSample } = providerSample
    const previousSource = selectedSource
    const nextSource = rawSample.source as AutomaticOrientationSource

    if (previousSource !== nextSource || selectedProviderId !== providerId) {
      smoothedSample = null
      history = []
      upgradeCounts = new Map()
    }

    const preserveCompassValidation =
      rawSample.providerKind === 'event' &&
      rawSample.compassBacked === true &&
      (providerId === 'deviceorientation-relative-event' ||
        providerId === 'deviceorientation-safari-validated-event')

    if (!preserveCompassValidation) {
      compassValidation = {
        consecutiveValidSamples: 0,
        consecutiveInvalidSamples: 0,
        validated: false,
      }
    }

    selectedSource = nextSource
    selectedProviderId = providerId
    latestSample = providerSample

    const sample = createOrientationSample(
      rawSample,
      calibration,
      getScreenOrientationCorrectionDeg(runtimeWindow),
      compatibilityOffsetQuaternion,
    )

    smoothedSample = smoothOrientationSample(smoothedSample, sample)
    history = trimOrientationHistory([...history, smoothedSample])
    const alignmentHealth = smoothedSample.needsCalibration
      ? 'poor'
      : computeAlignmentHealth(history)

    resetStallTimeout()

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

  function reconcileCompassValidation(
    providerSample: InternalProviderSample,
  ): InternalProviderSample {
    const { rawSample } = providerSample
    const isSelectedEventStream =
      selectedProviderId === 'deviceorientation-relative-event' ||
      selectedProviderId === 'deviceorientation-safari-validated-event'

    if (
      selectionActive ||
      !isSelectedEventStream ||
      rawSample.providerKind !== 'event' ||
      providerSample.providerId !== 'deviceorientation-relative-event'
    ) {
      return providerSample
    }

    const validationPassed = isCompassValidationSample(rawSample, runtimeWindow)

    if (compassValidation.validated) {
      if (validationPassed) {
        compassValidation.consecutiveInvalidSamples = 0
        return promoteCompassBackedSample(providerSample)
      }

      compassValidation.consecutiveInvalidSamples += 1

      if (
        compassValidation.consecutiveInvalidSamples >=
        SAFARI_COMPASS_VALIDATION_SAMPLES
      ) {
        compassValidation = {
          consecutiveValidSamples: 0,
          consecutiveInvalidSamples: 0,
          validated: false,
        }
        return providerSample
      }

      return providerSample
    }

    if (!validationPassed || !canAttemptAbsoluteUpgrade()) {
      compassValidation.consecutiveValidSamples = 0
      return providerSample
    }

    compassValidation.consecutiveValidSamples += 1

    if (
      compassValidation.consecutiveValidSamples <
      SAFARI_COMPASS_VALIDATION_SAMPLES
    ) {
      return providerSample
    }

    compassValidation = {
      consecutiveValidSamples: 0,
      consecutiveInvalidSamples: 0,
      validated: true,
    }
    upgradeCounts.set(
      'deviceorientation-safari-validated-event',
      ORIENTATION_MIN_CONSECUTIVE_SAMPLES_FOR_UPGRADE - 1,
    )

    return promoteCompassBackedSample(providerSample)
  }

  function canUpgradeToAbsolute(providerSample: InternalProviderSample) {
    return (
      selectedSource !== null &&
      selectedProviderId !== null &&
      !isSourceAbsolute(selectedSource) &&
      providerSample.rawSample.absolute &&
      canAttemptAbsoluteUpgrade() &&
      INTERNAL_PROVIDER_PRIORITY[providerSample.providerId] >
        INTERNAL_PROVIDER_PRIORITY[selectedProviderId]
    )
  }

  function canAttemptAbsoluteUpgrade() {
    return upgradeDeadlineMs !== null && Date.now() <= upgradeDeadlineMs
  }

  function resetStallTimeout() {
    if (stallTimeoutId !== null) {
      clearTimeout(stallTimeoutId)
    }

    stallTimeoutId = setTimeout(() => {
      stallTimeoutId = null
      restartArbitration()
    }, ORIENTATION_PROVIDER_STALL_TIMEOUT_MS)
  }

  function clearTrackingState() {
    clearSelectionTimeout()
    clearStallTimeout()
    selectionActive = false
    selectionWindowExpired = false
    selectedSource = null
    selectedProviderId = null
    latestSample = null
    smoothedSample = null
    history = []
    selectionCandidates = new Map()
    upgradeCounts = new Map()
    upgradeDeadlineMs = null
    compassValidation = {
      consecutiveValidSamples: 0,
      consecutiveInvalidSamples: 0,
      validated: false,
    }
  }

  function stopProviders() {
    clearSelectionTimeout()
    clearStallTimeout()

    for (const controller of providerControllers) {
      controller.stop()
    }

    providerControllers = []
  }

  function clearSelectionTimeout() {
    if (selectionTimeoutId !== null) {
      clearTimeout(selectionTimeoutId)
      selectionTimeoutId = null
    }
  }

  function clearStallTimeout() {
    if (stallTimeoutId !== null) {
      clearTimeout(stallTimeoutId)
      stallTimeoutId = null
    }
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
      emitRawSample({
        providerId: latestSample?.providerId ?? selectedProviderId ?? 'deviceorientation-relative-event',
        rawSample,
      })
    },
    setCalibration(nextCalibration: PoseCalibration) {
      calibration = createPoseCalibration(nextCalibration)

      if (!latestSample) {
        return
      }

      smoothedSample = null
      history = []
      emitRawSample(latestSample)
    },
    stop() {
      stopped = true
      stopProviders()
      clearTrackingState()
      lifecycleListeners.stop()
    },
  }
}

function requestEventPermission(
  eventType: OrientationPermissionRequester | undefined,
  options: {
    allowAbsoluteFallback?: boolean
  } = {},
) {
  if (!eventType?.requestPermission) {
    return Promise.resolve<'granted' | 'unavailable'>('unavailable')
  }

  return eventType
    .requestPermission()
    .catch(async (error: unknown) => {
      if (
        !options.allowAbsoluteFallback ||
        !(error instanceof TypeError)
      ) {
        return 'denied' as const
      }

      return eventType.requestPermission(true).catch(() => 'denied' as const)
    })
}

function createRawDeviceOrientationSample(
  reading: DeviceOrientationReading,
  eventType: string = 'deviceorientation',
): RawOrientationSample | null {
  if (
    typeof reading.alpha !== 'number' ||
    typeof reading.beta !== 'number' ||
    typeof reading.gamma !== 'number'
  ) {
    return null
  }

  const compassHeadingDeg = isFiniteNumber(reading.webkitCompassHeading)
    ? normalizeDegrees(reading.webkitCompassHeading)
    : undefined
  const compassAccuracyDeg = isFiniteNumber(reading.webkitCompassAccuracy)
    ? reading.webkitCompassAccuracy
    : undefined
  const absolute =
    eventType === 'deviceorientationabsolute' || reading.absolute === true

  return {
    source: absolute
      ? 'deviceorientation-absolute'
      : 'deviceorientation-relative',
    providerKind: 'event',
    localFrame: 'device',
    absolute,
    timestampMs: Date.now(),
    worldFromLocal: worldFromDeviceOrientation(
      reading.alpha,
      reading.beta,
      reading.gamma,
    ),
    compassBacked: !absolute && compassHeadingDeg !== undefined,
    compassHeadingDeg,
    compassAccuracyDeg,
  }
}

function classifyDeviceOrientationProviderId(
  event: Event,
  orientationEvent: DeviceOrientationEvent,
): DeviceOrientationProviderId | null {
  if (
    typeof orientationEvent.alpha !== 'number' ||
    typeof orientationEvent.beta !== 'number' ||
    typeof orientationEvent.gamma !== 'number'
  ) {
    return null
  }

  if (event.type === 'deviceorientationabsolute') {
    return 'deviceorientationabsolute-event'
  }

  if (orientationEvent.absolute === true) {
    return 'deviceorientation-absolute-event'
  }

  return 'deviceorientation-relative-event'
}

function getRawOrientationSample(event: Event): {
  providerId: DeviceOrientationProviderId
  rawSample: RawOrientationSample
} | null {
  const orientationEvent = event as DeviceOrientationEvent
  const providerId = classifyDeviceOrientationProviderId(event, orientationEvent)
  const rawSample = createRawDeviceOrientationSample(
    {
      alpha: orientationEvent.alpha,
      beta: orientationEvent.beta,
      gamma: orientationEvent.gamma,
      absolute: orientationEvent.absolute,
      webkitCompassHeading: (orientationEvent as DeviceOrientationEvent & {
        webkitCompassHeading?: number
      }).webkitCompassHeading,
      webkitCompassAccuracy: (orientationEvent as DeviceOrientationEvent & {
        webkitCompassAccuracy?: number
      }).webkitCompassAccuracy,
    },
    event.type,
  )

  if (!providerId || !rawSample) {
    return null
  }

  return {
    providerId,
    rawSample,
  }
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
    reportedCompassHeadingDeg: rawSample.compassHeadingDeg,
    compassAccuracyDeg: rawSample.compassAccuracyDeg,
    compassBacked: rawSample.compassBacked,
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

function startOrientationSensorProvider(
  source: 'absolute-sensor' | 'relative-sensor',
  onSample: (sample: RawOrientationSample) => void,
  {
    runtime,
    onUnavailable,
    requiredPermissions,
    createSensor,
  }: {
    runtime?: OrientationRuntime
    onUnavailable?: () => void
    requiredPermissions: Array<keyof PermissionHints>
    createSensor: (runtime: OrientationRuntime) => AbsoluteOrientationSensorLike
  },
) {
  const currentWindow = runtime ?? getOrientationWindow()

  if (!currentWindow) {
    return null
  }

  if (
    (source === 'absolute-sensor' &&
      !supportsAbsoluteOrientationSensor(currentWindow)) ||
    (source === 'relative-sensor' &&
      !supportsRelativeOrientationSensor(currentWindow))
  ) {
    return null
  }

  let sensor: AbsoluteOrientationSensorLike | null = null
  let stopped = false
  let started = false
  let readingListener: (() => void) | null = null
  let errorListener: (() => void) | null = null

  const notifyUnavailable = () => {
    if (!stopped) {
      onUnavailable?.()
    }
  }

  const cleanup = () => {
    if (sensor && readingListener && errorListener) {
      sensor.removeEventListener('reading', readingListener)
      sensor.removeEventListener('error', errorListener)
    }

    if (sensor && started) {
      try {
        sensor.stop?.()
      } catch {
        // Teardown failures must not block fallback providers.
      }
    }

    sensor = null
    readingListener = null
    errorListener = null
    started = false
  }

  void (async () => {
    const permissionHints = await querySensorPermissionHintsForStartup(currentWindow)

    const hasDeniedPermission =
      permissionHints !== null &&
      permissionHints.available &&
      requiredPermissions.some(
        (permissionName) => permissionHints[permissionName] === 'denied',
      )

    if (stopped || hasDeniedPermission) {
      notifyUnavailable()
      return
    }

    try {
      sensor = createSensor(currentWindow)
    } catch {
      notifyUnavailable()
      return
    }

    const handleReading = () => {
      if (!sensor) {
        return
      }

      const sensorSample = readOrientationSensorSample(sensor)

      if (!sensorSample) {
        return
      }

      onSample({
        source,
        providerKind: 'sensor',
        localFrame: 'screen',
        absolute: source === 'absolute-sensor',
        timestampMs: Date.now(),
        ...sensorSample,
      })
    }

    const handleError = () => {
      cleanup()
      notifyUnavailable()
    }

    readingListener = handleReading
    errorListener = handleError

    sensor.addEventListener('reading', handleReading)
    sensor.addEventListener('error', handleError)

    try {
      sensor.start()
      started = true
    } catch {
      cleanup()
      notifyUnavailable()
    }
  })()

  return {
    stop() {
      stopped = true
      cleanup()
    },
  }
}

function chooseProviderCandidate(
  candidates: Map<InternalProviderId, InternalProviderSample>,
) {
  const samples = [...candidates.values()]

  if (samples.length === 0) {
    return null
  }

  const sortByPriority = (
    left: InternalProviderSample,
    right: InternalProviderSample,
  ) =>
    INTERNAL_PROVIDER_PRIORITY[right.providerId] -
    INTERNAL_PROVIDER_PRIORITY[left.providerId]

  const absoluteWinner = samples
    .filter((sample) => sample.rawSample.absolute)
    .sort(sortByPriority)[0]

  if (absoluteWinner) {
    return absoluteWinner
  }

  return samples.sort(sortByPriority)[0] ?? null
}

function readOrientationSensorSample(sensor: AbsoluteOrientationSensorLike) {
  const worldFromLocal = readOrientationSensorMatrix(sensor)

  if (worldFromLocal) {
    return { worldFromLocal }
  }

  const rawQuaternion = readOrientationSensorQuaternion(sensor)

  if (rawQuaternion) {
    return { rawQuaternion }
  }

  return null
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

function readOrientationSensorQuaternion(
  sensor: AbsoluteOrientationSensorLike,
): Quaternion | null {
  if (!sensor.quaternion || sensor.quaternion.length < 4) {
    return null
  }

  const quaternion: Quaternion = [
    sensor.quaternion[0],
    sensor.quaternion[1],
    sensor.quaternion[2],
    sensor.quaternion[3],
  ]

  return quaternion.every((value) => Number.isFinite(value))
    ? normalizeQuaternion(quaternion)
    : null
}

async function querySensorPermissionState(
  runtime: OrientationRuntime,
  permissionName: 'accelerometer' | 'gyroscope' | 'magnetometer',
): Promise<PermissionState | 'unsupported'> {
  if (!runtime.permissions?.query) {
    return 'unsupported'
  }

  try {
    const status = await runtime.permissions.query({
      name: permissionName,
    } as unknown as PermissionDescriptor)
    return status.state
  } catch {
    return 'unsupported'
  }
}

async function querySensorPermissionHintsForStartup(
  runtime: OrientationRuntime,
): Promise<(PermissionHints & { available: boolean }) | null> {
  if (!runtime.permissions?.query) {
    return null
  }

  try {
    const permissionHints = await Promise.race<
      PermissionHints | null
    >([
      querySensorPermissionHints(runtime),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), ORIENTATION_PERMISSION_HINT_STARTUP_TIMEOUT_MS)
      }),
    ])

    if (!permissionHints) {
      return null
    }

    return {
      ...permissionHints,
      available: true,
    }
  } catch {
    return null
  }
}

function isCompassValidationSample(
  rawSample: RawOrientationSample,
  runtime: OrientationRuntime,
) {
  if (
    !rawSample.compassBacked ||
    !isFiniteNumber(rawSample.compassHeadingDeg) ||
    !isFiniteNumber(rawSample.compassAccuracyDeg) ||
    rawSample.compassAccuracyDeg > SAFARI_COMPASS_MAX_ACCURACY_DEG
  ) {
    return false
  }

  const rawQuaternion = rawPoseQuaternionFromSample(
    rawSample,
    getScreenOrientationCorrectionDeg(runtime),
  )
  const quaternionDerivedHeadingDeg = getDebugEulerFromQuaternion(rawQuaternion).headingDeg
  const delta = Math.abs(
    shortestAngleDeltaDeg(quaternionDerivedHeadingDeg, rawSample.compassHeadingDeg),
  )

  return delta <= SAFARI_COMPASS_MAX_HEADING_DELTA_DEG
}

function promoteCompassBackedSample(
  providerSample: InternalProviderSample,
): InternalProviderSample {
  return {
    providerId: 'deviceorientation-safari-validated-event',
    rawSample: {
      ...providerSample.rawSample,
      source: 'deviceorientation-absolute',
      absolute: true,
    },
  }
}

function capAlignmentHealthForCompass(
  sample: OrientationSample | undefined,
  alignmentHealth: CameraPose['alignmentHealth'],
) {
  if (
    !sample ||
    (!sample.absolute && !sample.compassBacked) ||
    !isFiniteNumber(sample.compassAccuracyDeg)
  ) {
    return alignmentHealth
  }

  if (sample.compassAccuracyDeg > 45) {
    return 'poor'
  }

  if (sample.compassAccuracyDeg > 20 && alignmentHealth === 'good') {
    return 'fair'
  }

  return alignmentHealth
}

function combineBasisVectors(
  xAxis: Vec3,
  yAxis: Vec3,
  xScale: number,
  yScale: number,
): Vec3 {
  return normalizeVec3([
    xAxis[0] * xScale + yAxis[0] * yScale,
    xAxis[1] * xScale + yAxis[1] * yScale,
    xAxis[2] * xScale + yAxis[2] * yScale,
  ])
}

function attachLifecycleListeners(
  runtime: OrientationRuntime,
  onSuspend: () => void,
  onResume: () => void,
  onOrientationChange: () => void,
) {
  const runtimeDocument =
    runtime.document ??
    (typeof document !== 'undefined'
      ? (document as OrientationRuntimeDocument)
      : undefined)

  const handleVisibilityChange = () => {
    if (runtimeDocument?.visibilityState === 'hidden') {
      onSuspend()
      return
    }

    onResume()
  }

  const handlePageHide = () => {
    onSuspend()
  }

  const handlePageShow = () => {
    onResume()
  }

  const handleOrientationChange = () => {
    onOrientationChange()
  }

  runtimeDocument?.addEventListener?.('visibilitychange', handleVisibilityChange)
  runtime.addEventListener('pagehide', handlePageHide)
  runtime.addEventListener('pageshow', handlePageShow)
  runtime.addEventListener('orientationchange', handleOrientationChange)

  return {
    stop() {
      runtimeDocument?.removeEventListener?.('visibilitychange', handleVisibilityChange)
      runtime.removeEventListener('pagehide', handlePageHide)
      runtime.removeEventListener('pageshow', handlePageShow)
      runtime.removeEventListener('orientationchange', handleOrientationChange)
    },
  }
}

function isRuntimeHidden(runtime: OrientationRuntime) {
  const runtimeDocument =
    runtime.document ??
    (typeof document !== 'undefined'
      ? (document as OrientationRuntimeDocument)
      : undefined)

  return runtimeDocument?.visibilityState === 'hidden'
}

function isSourceAbsolute(source: AutomaticOrientationSource) {
  return source === 'absolute-sensor' || source === 'deviceorientation-absolute'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function getMat3Column(matrix: Mat3, columnIndex: 0 | 1 | 2): [number, number, number] {
  return [
    matrix[0][columnIndex],
    matrix[1][columnIndex],
    matrix[2][columnIndex],
  ]
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
