import type { CameraPose } from '../viewer/contracts'

export type Quaternion = [number, number, number, number]
export type Vec3 = readonly [number, number, number]
export type Mat3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
]

export interface RearCameraStreamRuntime {
  getUserMedia: (
    constraints: MediaStreamConstraints,
  ) => Promise<MediaStream>
}

export interface CameraDeviceRuntime extends RearCameraStreamRuntime {
  enumerateDevices?: () => Promise<MediaDeviceInfo[]>
}

export interface RearCameraRequestOptions {
  preferredDeviceId?: string | null
}

export interface CameraDeviceOption {
  deviceId: string
  label: string
}

export interface ProjectViewport {
  width: number
  height: number
  sourceWidth?: number
  sourceHeight?: number
  objectFit?: 'cover'
  overscanRatio?: number
}

export interface CameraFrameLayout {
  sourceWidth: number
  sourceHeight: number
  viewportWidth: number
  viewportHeight: number
  objectFit: 'cover'
  scale: number
  cropX: number
  cropY: number
}

export interface ProjectedImagePlanePoint {
  visible: boolean
  imageX: number
  imageY: number
  normalizedX: number
  normalizedY: number
  angularDistanceDeg: number
  cameraVector: [number, number, number]
}

export interface ViewportMappedPoint {
  visible: boolean
  inViewport: boolean
  inOverscan: boolean
  x: number
  y: number
}

export interface ProjectWorldPointInput {
  azimuthDeg: number
  elevationDeg: number
}

export interface ProjectedWorldPoint {
  visible: boolean
  inViewport: boolean
  inOverscan: boolean
  x: number
  y: number
  normalizedX: number
  normalizedY: number
  angularDistanceDeg: number
  cameraVector: [number, number, number]
}

export interface CenterLockCandidate {
  id: string
  rankScore: number
  angularDistanceDeg: number
}

export interface ProjectionProfile {
  verticalFovDeg: number
}

export interface ProjectionProfileOptions {
  verticalFovDeg: number
  minVerticalFovDeg?: number
  maxVerticalFovDeg?: number
}

const DEFAULT_VERTICAL_FOV_DEG = 50
const MIN_VERTICAL_FOV_DEG = 20
const MAX_VERTICAL_FOV_DEG = 100
const DEFAULT_OVERSCAN_RATIO = 0.1
const MIN_PROFILE_VERTICAL_FOV_DEG = 1
const MAX_PROFILE_VERTICAL_FOV_DEG = 179

export function getRearCameraConstraintCandidates(
  preferredDeviceId?: string | null,
): MediaStreamConstraints[] {
  const candidates: MediaStreamConstraints[] = []

  if (preferredDeviceId) {
    candidates.push({
      audio: false,
      video: {
        deviceId: { exact: preferredDeviceId },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    })
  }

  candidates.push(
    {
      audio: false,
      video: {
        facingMode: { exact: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    },
    {
      audio: false,
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    },
  )

  return candidates
}

export async function requestRearCameraStream(
  runtime: RearCameraStreamRuntime = navigator.mediaDevices,
  options: RearCameraRequestOptions = {},
): Promise<MediaStream> {
  for (const constraints of getRearCameraConstraintCandidates(options.preferredDeviceId)) {
    try {
      return await runtime.getUserMedia(constraints)
    } catch {
      continue
    }
  }

  throw new Error('rear-camera-unavailable')
}

export async function probeRearCameraPermission(
  runtime?: RearCameraStreamRuntime,
): Promise<'granted' | 'denied' | 'unavailable'> {
  if (typeof navigator === 'undefined' && !runtime) {
    return 'unavailable'
  }

  const mediaRuntime =
    runtime ??
    (typeof navigator !== 'undefined' ? navigator.mediaDevices : null)

  if (!mediaRuntime) {
    return 'unavailable'
  }

  try {
    const stream = await requestRearCameraStream(mediaRuntime)
    stopMediaStream(stream)
    return 'granted'
  } catch {
    return 'denied'
  }
}

export async function listAvailableVideoInputDevices(
  runtime: Pick<CameraDeviceRuntime, 'enumerateDevices'> | null =
    typeof navigator !== 'undefined' ? navigator.mediaDevices : null,
): Promise<CameraDeviceOption[]> {
  if (!runtime?.enumerateDevices) {
    return []
  }

  const devices = await runtime.enumerateDevices()
  const videoInputs = devices.filter((device) => device.kind === 'videoinput')

  if (videoInputs.length === 0) {
    return []
  }

  const sortedInputs = [...videoInputs].sort((left, right) => {
    return getCameraDevicePriority(right.label) - getCameraDevicePriority(left.label)
  })
  const rearInputs = sortedInputs.filter((device) => isLikelyRearCameraLabel(device.label))
  const preferredInputs = rearInputs.length > 0 ? rearInputs : sortedInputs

  return preferredInputs.map((device, index) => ({
    deviceId: device.deviceId,
    label: device.label || `Camera ${index + 1}`,
  }))
}

export function getStreamVideoDeviceId(stream: MediaStream | null | undefined) {
  const tracks =
    stream && typeof stream.getVideoTracks === 'function'
      ? stream.getVideoTracks()
      : []
  const [track] = tracks

  if (!track || typeof track.getSettings !== 'function') {
    return null
  }

  return track.getSettings().deviceId ?? null
}

export function stopMediaStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop())
}

export function getEffectiveVerticalFovDeg(verticalFovAdjustmentDeg = 0) {
  return getProjectionVerticalFovDeg(
    createWideProjectionProfile(verticalFovAdjustmentDeg),
  )
}

export function getHorizontalFovDeg(
  verticalFovDeg: number,
  aspectRatio: number,
) {
  return radiansToDegrees(
    2 *
      Math.atan(
        Math.tan(degreesToRadians(verticalFovDeg) / 2) * Math.max(aspectRatio, 0.0001),
      ),
  )
}

export function createProjectionProfile({
  verticalFovDeg,
  minVerticalFovDeg = MIN_PROFILE_VERTICAL_FOV_DEG,
  maxVerticalFovDeg = MAX_PROFILE_VERTICAL_FOV_DEG,
}: ProjectionProfileOptions): ProjectionProfile {
  const minVerticalFov = Math.min(minVerticalFovDeg, maxVerticalFovDeg)
  const maxVerticalFov = Math.max(minVerticalFovDeg, maxVerticalFovDeg)

  return {
    verticalFovDeg: clamp(verticalFovDeg, minVerticalFov, maxVerticalFov),
  }
}

export function createWideProjectionProfile(verticalFovAdjustmentDeg = 0) {
  return createProjectionProfile({
    verticalFovDeg: DEFAULT_VERTICAL_FOV_DEG + verticalFovAdjustmentDeg,
    minVerticalFovDeg: MIN_VERTICAL_FOV_DEG,
    maxVerticalFovDeg: MAX_VERTICAL_FOV_DEG,
  })
}

export function getProjectionVerticalFovDeg(profile: ProjectionProfile) {
  return clamp(
    profile.verticalFovDeg,
    MIN_PROFILE_VERTICAL_FOV_DEG,
    MAX_PROFILE_VERTICAL_FOV_DEG,
  )
}

export function getProjectionHorizontalFovDeg(
  profile: ProjectionProfile,
  aspectRatio: number,
) {
  return getHorizontalFovDeg(getProjectionVerticalFovDeg(profile), aspectRatio)
}

export function normalizeQuaternion(quaternion: Quaternion): Quaternion {
  const magnitude = Math.hypot(...quaternion)

  if (!Number.isFinite(magnitude) || magnitude === 0) {
    return [0, 0, 0, 1]
  }

  return quaternion.map((value) => value / magnitude) as Quaternion
}

export function createAxisAngleQuaternion(
  axis: Vec3,
  angleDeg: number,
): Quaternion {
  const [ax, ay, az] = normalizeVec3(axis)
  const halfAngleRad = degreesToRadians(angleDeg) / 2
  const sinHalfAngle = Math.sin(halfAngleRad)

  return normalizeQuaternion([
    ax * sinHalfAngle,
    ay * sinHalfAngle,
    az * sinHalfAngle,
    Math.cos(halfAngleRad),
  ])
}

export function createCameraQuaternion(
  yawDeg: number,
  pitchDeg: number,
  rollDeg: number,
): Quaternion {
  const worldUp: Vec3 = [0, 0, 1]
  const yawRad = -degreesToRadians(yawDeg)
  const pitchRad = degreesToRadians(pitchDeg)
  const rollRad = degreesToRadians(rollDeg)

  let right: Vec3 = [1, 0, 0]
  let down: Vec3 = [0, 0, -1]
  let forward: Vec3 = [0, 1, 0]

  if (Math.abs(yawRad) > 1e-6) {
    right = rotateAroundAxis(right, worldUp, yawRad)
    down = rotateAroundAxis(down, worldUp, yawRad)
    forward = rotateAroundAxis(forward, worldUp, yawRad)
  }

  if (Math.abs(pitchRad) > 1e-6) {
    down = rotateAroundAxis(down, right, pitchRad)
    forward = rotateAroundAxis(forward, right, pitchRad)
  }

  if (Math.abs(rollRad) > 1e-6) {
    right = rotateAroundAxis(right, forward, rollRad)
    down = rotateAroundAxis(down, forward, rollRad)
  }

  right = normalizeVec3(right)
  down = normalizeVec3(down)
  forward = normalizeVec3(forward)

  return normalizeQuaternion(
    quaternionFromRotationMatrix([
      [right[0], down[0], forward[0]],
      [right[1], down[1], forward[1]],
      [right[2], down[2], forward[2]],
    ]),
  )
}

export function createQuaternionFromBasis(
  right: Vec3,
  down: Vec3,
  forward: Vec3,
): Quaternion {
  const normalizedRight = normalizeVec3(right)
  const normalizedDown = normalizeVec3(down)
  const normalizedForward = normalizeVec3(forward)

  return normalizeQuaternion(
    quaternionFromRotationMatrix([
      [normalizedRight[0], normalizedDown[0], normalizedForward[0]],
      [normalizedRight[1], normalizedDown[1], normalizedForward[1]],
      [normalizedRight[2], normalizedDown[2], normalizedForward[2]],
    ]),
  )
}

export function multiplyQuaternions(
  left: Quaternion,
  right: Quaternion,
): Quaternion {
  return normalizeQuaternion(multiplyQuaternionRaw(left, right))
}

export function slerpQuaternions(
  from: Quaternion,
  to: Quaternion,
  factor: number,
): Quaternion {
  const clampedFactor = clamp(factor, 0, 1)
  const start = normalizeQuaternion(from)
  let end = normalizeQuaternion(to)
  let cosineHalfTheta =
    start[0] * end[0] +
    start[1] * end[1] +
    start[2] * end[2] +
    start[3] * end[3]

  if (cosineHalfTheta < 0) {
    end = [-end[0], -end[1], -end[2], -end[3]]
    cosineHalfTheta = -cosineHalfTheta
  }

  if (cosineHalfTheta > 0.9995) {
    return normalizeQuaternion([
      start[0] + (end[0] - start[0]) * clampedFactor,
      start[1] + (end[1] - start[1]) * clampedFactor,
      start[2] + (end[2] - start[2]) * clampedFactor,
      start[3] + (end[3] - start[3]) * clampedFactor,
    ])
  }

  const halfTheta = Math.acos(clamp(cosineHalfTheta, -1, 1))
  const sinHalfTheta = Math.sin(halfTheta)

  if (Math.abs(sinHalfTheta) < 1e-6) {
    return start
  }

  const startWeight = Math.sin((1 - clampedFactor) * halfTheta) / sinHalfTheta
  const endWeight = Math.sin(clampedFactor * halfTheta) / sinHalfTheta

  return normalizeQuaternion([
    start[0] * startWeight + end[0] * endWeight,
    start[1] * startWeight + end[1] * endWeight,
    start[2] * startWeight + end[2] * endWeight,
    start[3] * startWeight + end[3] * endWeight,
  ])
}

export function getCameraBasisVectors(quaternion: Quaternion) {
  const normalizedQuaternion = normalizeQuaternion(quaternion)

  return {
    right: rotateVectorByQuaternion([1, 0, 0], normalizedQuaternion),
    down: rotateVectorByQuaternion([0, 1, 0], normalizedQuaternion),
    forward: rotateVectorByQuaternion([0, 0, 1], normalizedQuaternion),
  }
}

export function worldToCameraVector(
  pose: Pick<CameraPose, 'quaternion'>,
  worldVector: Vec3,
): [number, number, number] {
  return rotateVectorByQuaternion(worldVector, conjugateQuaternion(pose.quaternion))
}

export function horizontalToWorldVector(
  azimuthDeg: number,
  elevationDeg: number,
): [number, number, number] {
  const azimuthRad = degreesToRadians(azimuthDeg)
  const elevationRad = degreesToRadians(elevationDeg)
  const horizontalMagnitude = Math.cos(elevationRad)

  return [
    horizontalMagnitude * Math.sin(azimuthRad),
    horizontalMagnitude * Math.cos(azimuthRad),
    Math.sin(elevationRad),
  ]
}

export function createCameraFrameLayout(
  viewport: ProjectViewport,
): CameraFrameLayout {
  const sourceWidth = Math.max(viewport.sourceWidth ?? viewport.width, 1)
  const sourceHeight = Math.max(viewport.sourceHeight ?? viewport.height, 1)
  const viewportWidth = Math.max(viewport.width, 1)
  const viewportHeight = Math.max(viewport.height, 1)
  const objectFit = viewport.objectFit ?? 'cover'
  const scale = Math.max(
    viewportWidth / sourceWidth,
    viewportHeight / sourceHeight,
  )
  const displayedWidth = sourceWidth * scale
  const displayedHeight = sourceHeight * scale

  return {
    sourceWidth,
    sourceHeight,
    viewportWidth,
    viewportHeight,
    objectFit,
    scale,
    cropX: (displayedWidth - viewportWidth) / 2,
    cropY: (displayedHeight - viewportHeight) / 2,
  }
}

export function projectWorldPointToImagePlane(
  pose: Pick<CameraPose, 'quaternion'>,
  worldPoint: ProjectWorldPointInput,
  frame: Pick<CameraFrameLayout, 'sourceWidth' | 'sourceHeight'>,
  verticalFovAdjustmentDeg = 0,
): ProjectedImagePlanePoint {
  return projectWorldPointToImagePlaneWithProfile(
    pose,
    worldPoint,
    frame,
    createWideProjectionProfile(verticalFovAdjustmentDeg),
  )
}

export function projectWorldPointToImagePlaneWithProfile(
  pose: Pick<CameraPose, 'quaternion'>,
  worldPoint: ProjectWorldPointInput,
  frame: Pick<CameraFrameLayout, 'sourceWidth' | 'sourceHeight'>,
  profile: ProjectionProfile,
): ProjectedImagePlanePoint {
  const worldVector = horizontalToWorldVector(
    worldPoint.azimuthDeg,
    worldPoint.elevationDeg,
  )
  const cameraVector = worldToCameraVector(pose, worldVector)
  const angularDistanceDeg = radiansToDegrees(
    Math.acos(clamp(cameraVector[2], -1, 1)),
  )

  if (cameraVector[2] <= 0) {
    return {
      visible: false,
      imageX: Number.NaN,
      imageY: Number.NaN,
      normalizedX: Number.NaN,
      normalizedY: Number.NaN,
      angularDistanceDeg,
      cameraVector,
    }
  }

  const sourceWidth = Math.max(frame.sourceWidth, 1)
  const sourceHeight = Math.max(frame.sourceHeight, 1)
  const verticalFovDeg = getProjectionVerticalFovDeg(profile)
  const aspectRatio = sourceWidth / sourceHeight
  const horizontalFovDeg = getProjectionHorizontalFovDeg(profile, aspectRatio)
  const normalizedX =
    cameraVector[0] /
    (cameraVector[2] * Math.tan(degreesToRadians(horizontalFovDeg) / 2))
  const normalizedY =
    cameraVector[1] /
    (cameraVector[2] * Math.tan(degreesToRadians(verticalFovDeg) / 2))

  return {
    visible: true,
    imageX: ((normalizedX + 1) / 2) * sourceWidth,
    imageY: ((normalizedY + 1) / 2) * sourceHeight,
    normalizedX,
    normalizedY,
    angularDistanceDeg,
    cameraVector,
  }
}

export function mapImagePointToViewport(
  point: Pick<ProjectedImagePlanePoint, 'visible' | 'imageX' | 'imageY'>,
  layout: CameraFrameLayout,
  overscanRatio = DEFAULT_OVERSCAN_RATIO,
): ViewportMappedPoint {
  if (!point.visible) {
    return {
      visible: false,
      inViewport: false,
      inOverscan: false,
      x: Number.NaN,
      y: Number.NaN,
    }
  }

  const x = point.imageX * layout.scale - layout.cropX
  const y = point.imageY * layout.scale - layout.cropY
  const overscanX = layout.viewportWidth * overscanRatio
  const overscanY = layout.viewportHeight * overscanRatio
  const inViewport =
    x >= 0 && x <= layout.viewportWidth && y >= 0 && y <= layout.viewportHeight
  const inOverscan =
    x >= -overscanX &&
    x <= layout.viewportWidth + overscanX &&
    y >= -overscanY &&
    y <= layout.viewportHeight + overscanY

  return {
    visible: inOverscan,
    inViewport,
    inOverscan,
    x,
    y,
  }
}

export function projectWorldPointToScreen(
  pose: Pick<CameraPose, 'quaternion'>,
  worldPoint: ProjectWorldPointInput,
  viewport: ProjectViewport,
  verticalFovAdjustmentDeg = 0,
): ProjectedWorldPoint {
  return projectWorldPointToScreenWithProfile(
    pose,
    worldPoint,
    viewport,
    createWideProjectionProfile(verticalFovAdjustmentDeg),
  )
}

export function projectWorldPointToScreenWithProfile(
  pose: Pick<CameraPose, 'quaternion'>,
  worldPoint: ProjectWorldPointInput,
  viewport: ProjectViewport,
  profile: ProjectionProfile,
): ProjectedWorldPoint {
  const layout = createCameraFrameLayout(viewport)
  const imageProjection = projectWorldPointToImagePlaneWithProfile(
    pose,
    worldPoint,
    layout,
    profile,
  )
  const viewportProjection = mapImagePointToViewport(
    imageProjection,
    layout,
    viewport.overscanRatio ?? DEFAULT_OVERSCAN_RATIO,
  )

  return {
    visible: viewportProjection.visible,
    inViewport: viewportProjection.inViewport,
    inOverscan: viewportProjection.inOverscan,
    x: viewportProjection.x,
    y: viewportProjection.y,
    normalizedX: imageProjection.normalizedX,
    normalizedY: imageProjection.normalizedY,
    angularDistanceDeg: imageProjection.angularDistanceDeg,
    cameraVector: imageProjection.cameraVector,
  }
}

export function pickCenterLockedCandidate<T extends CenterLockCandidate>(
  candidates: readonly T[],
  angularRadiusDeg = 4,
): T | null {
  return (
    candidates
      .filter((candidate) => candidate.angularDistanceDeg <= angularRadiusDeg)
      .sort((left, right) => {
        if (right.rankScore !== left.rankScore) {
          return right.rankScore - left.rankScore
        }

        return left.angularDistanceDeg - right.angularDistanceDeg
      })[0] ?? null
  )
}

export function degreesToRadians(value: number) {
  return (value * Math.PI) / 180
}

export function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function isLikelyRearCameraLabel(label: string) {
  return /\b(back|rear|environment|world|ultra[- ]wide|wide|telephoto)\b/i.test(label)
}

function getCameraDevicePriority(label: string) {
  const normalizedLabel = label.toLowerCase()

  if (/\b(back|rear|environment)\b/.test(normalizedLabel)) {
    return 3
  }

  if (/\b(ultra[- ]wide|wide|telephoto)\b/.test(normalizedLabel)) {
    return 2
  }

  if (/\bfront|user|facetime\b/.test(normalizedLabel)) {
    return 0
  }

  return 1
}

function magnitudeVec3(vector: Vec3) {
  return Math.hypot(vector[0], vector[1], vector[2])
}

export function normalizeVec3(vector: Vec3): [number, number, number] {
  const magnitude = magnitudeVec3(vector)

  if (magnitude === 0) {
    return [0, 0, 0]
  }

  return [vector[0] / magnitude, vector[1] / magnitude, vector[2] / magnitude]
}

export function crossVec3(left: Vec3, right: Vec3): [number, number, number] {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ]
}

export function dotVec3(left: Vec3, right: Vec3) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2]
}

export function multiplyMat3Vec3(mat: Mat3, vector: Vec3): [number, number, number] {
  return [
    mat[0][0] * vector[0] + mat[0][1] * vector[1] + mat[0][2] * vector[2],
    mat[1][0] * vector[0] + mat[1][1] * vector[1] + mat[1][2] * vector[2],
    mat[2][0] * vector[0] + mat[2][1] * vector[1] + mat[2][2] * vector[2],
  ]
}

export function negateVec3(vector: Vec3): [number, number, number] {
  return [-vector[0], -vector[1], -vector[2]]
}

function rotateAroundAxis(
  vector: Vec3,
  axis: Vec3,
  angleRad: number,
): [number, number, number] {
  const [ax, ay, az] = normalizeVec3(axis)
  const [vx, vy, vz] = vector
  const cosTheta = Math.cos(angleRad)
  const sinTheta = Math.sin(angleRad)
  const dotProduct = vx * ax + vy * ay + vz * az

  return [
    vx * cosTheta + (ay * vz - az * vy) * sinTheta + ax * dotProduct * (1 - cosTheta),
    vy * cosTheta + (az * vx - ax * vz) * sinTheta + ay * dotProduct * (1 - cosTheta),
    vz * cosTheta + (ax * vy - ay * vx) * sinTheta + az * dotProduct * (1 - cosTheta),
  ]
}

function quaternionFromRotationMatrix(matrix: number[][]): Quaternion {
  const trace = matrix[0][0] + matrix[1][1] + matrix[2][2]

  if (trace > 0) {
    const scale = Math.sqrt(trace + 1) * 2

    return [
      (matrix[2][1] - matrix[1][2]) / scale,
      (matrix[0][2] - matrix[2][0]) / scale,
      (matrix[1][0] - matrix[0][1]) / scale,
      0.25 * scale,
    ]
  }

  if (matrix[0][0] > matrix[1][1] && matrix[0][0] > matrix[2][2]) {
    const scale = Math.sqrt(1 + matrix[0][0] - matrix[1][1] - matrix[2][2]) * 2

    return [
      0.25 * scale,
      (matrix[0][1] + matrix[1][0]) / scale,
      (matrix[0][2] + matrix[2][0]) / scale,
      (matrix[2][1] - matrix[1][2]) / scale,
    ]
  }

  if (matrix[1][1] > matrix[2][2]) {
    const scale = Math.sqrt(1 + matrix[1][1] - matrix[0][0] - matrix[2][2]) * 2

    return [
      (matrix[0][1] + matrix[1][0]) / scale,
      0.25 * scale,
      (matrix[1][2] + matrix[2][1]) / scale,
      (matrix[0][2] - matrix[2][0]) / scale,
    ]
  }

  const scale = Math.sqrt(1 + matrix[2][2] - matrix[0][0] - matrix[1][1]) * 2

  return [
    (matrix[0][2] + matrix[2][0]) / scale,
    (matrix[1][2] + matrix[2][1]) / scale,
    0.25 * scale,
    (matrix[1][0] - matrix[0][1]) / scale,
  ]
}

function conjugateQuaternion(quaternion: Quaternion): Quaternion {
  return [-quaternion[0], -quaternion[1], -quaternion[2], quaternion[3]]
}

function rotateVectorByQuaternion(vector: Vec3, quaternion: Quaternion): [number, number, number] {
  const q = normalizeQuaternion(quaternion)
  const vectorQuat: Quaternion = [vector[0], vector[1], vector[2], 0]
  const rotated = multiplyQuaternionRaw(
    multiplyQuaternionRaw(q, vectorQuat),
    conjugateQuaternion(q),
  )

  return [rotated[0], rotated[1], rotated[2]]
}

function multiplyQuaternionRaw(left: Quaternion, right: Quaternion): Quaternion {
  return [
    left[3] * right[0] +
      left[0] * right[3] +
      left[1] * right[2] -
      left[2] * right[1],
    left[3] * right[1] -
      left[0] * right[2] +
      left[1] * right[3] +
      left[2] * right[0],
    left[3] * right[2] +
      left[0] * right[1] -
      left[1] * right[0] +
      left[2] * right[3],
    left[3] * right[3] -
      left[0] * right[0] -
      left[1] * right[1] -
      left[2] * right[2],
  ]
}
