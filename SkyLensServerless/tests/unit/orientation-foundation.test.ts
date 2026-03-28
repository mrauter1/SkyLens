import { describe, expect, it } from 'vitest'

import {
  applyManualPoseDrag,
  createManualCameraPose,
  createManualPoseState,
  createPoseCalibration,
  createPoseCalibrationFromReferencePose,
  createSensorCameraPose,
  normalizeDeviceOrientationReading,
  rawPoseQuaternionFromSample,
  worldFromDeviceOrientation,
  type RawOrientationSample,
} from '../../lib/sensors/orientation'
import {
  getCameraBasisVectors,
  multiplyMat3Vec3,
} from '../../lib/projection/camera'

describe('orientation foundation', () => {
  it('maps the W3C upright north-facing sample to the rear-camera forward vector', () => {
    const forward = multiplyMat3Vec3(
      worldFromDeviceOrientation(0, 90, 0),
      [0, 0, -1],
    )

    expectVec3Close(forward, [0, 1, 0])
  })

  it('maps the W3C upright west-facing sample to the rear-camera forward vector', () => {
    const forward = multiplyMat3Vec3(
      worldFromDeviceOrientation(90, 90, 0),
      [0, 0, -1],
    )

    expectVec3Close(forward, [-1, 0, 0])
  })

  it('preserves forward direction between the W3C landscape example and the equivalent upright pose', () => {
    const compassHeadingDeg = 35
    const upright = rawPoseQuaternionFromSample(
      createDeviceRawSample(
        worldFromDeviceOrientation(360 - compassHeadingDeg, 90, 0),
      ),
      0,
    )
    const landscape = rawPoseQuaternionFromSample(
      createDeviceRawSample(
        worldFromDeviceOrientation(270 - compassHeadingDeg, 0, 90),
      ),
      90,
    )

    expectVec3Close(
      getCameraBasisVectors(upright).forward,
      getCameraBasisVectors(landscape).forward,
    )
  })

  it('preserves forward direction across portrait and landscape screen angles for the same physical pose', () => {
    const sample = createDeviceRawSample(
      worldFromDeviceOrientation(312, 84, -11),
    )
    const forwardVectors = [0, 90, 180, 270].map((screenAngleDeg) =>
      getCameraBasisVectors(
        rawPoseQuaternionFromSample(sample, screenAngleDeg),
      ).forward,
    )

    for (const forward of forwardVectors.slice(1)) {
      expectVec3Close(forwardVectors[0], forward)
    }
  })

  it('keeps relative samples marked as unaligned until a calibration quaternion is applied', () => {
    const rawSample = createDeviceRawSample(
      worldFromDeviceOrientation(15, 75, -10),
    )
    const uncalibratedPose = createSensorCameraPose(rawSample, {
      calibration: createPoseCalibration(),
    })
    const rawQuaternion = rawPoseQuaternionFromSample(rawSample)
    const calibratedPose = createSensorCameraPose(rawSample, {
      calibration: createPoseCalibrationFromReferencePose(rawQuaternion, {
        source: rawSample.source,
        timestampMs: rawSample.timestampMs,
      }),
    })

    expect(uncalibratedPose.alignmentHealth).toBe('poor')
    expect(calibratedPose.alignmentHealth).toBe('fair')
    expectVec3Close(
      getCameraBasisVectors(calibratedPose.quaternion).forward,
      [0, 1, 0],
    )
  })

  it('ignores webkitCompassHeading when building pose samples', () => {
    const sample = normalizeDeviceOrientationReading({
      alpha: 20,
      beta: 90,
      gamma: 0,
      webkitCompassHeading: 270,
    })

    expect(sample).not.toBeNull()
    expect(sample?.headingDeg).not.toBeCloseTo(270, 4)
  })

  it('manual pan fallback yields a normalized manual pose', () => {
    const dragged = applyManualPoseDrag(createManualPoseState(), 50, -20)
    const pose = createManualCameraPose(dragged)

    expect(pose.mode).toBe('manual')
    expect(pose.yawDeg).toBeCloseTo(6, 3)
    expect(pose.pitchDeg).toBeCloseTo(2.4, 3)
    expect(Math.hypot(...pose.quaternion)).toBeCloseTo(1, 6)
  })

  it('manual pan can move smoothly past zenith without a hard pitch ceiling', () => {
    const dragged = applyManualPoseDrag(
      createManualPoseState({
        pitchDeg: 89,
      }),
      0,
      -20,
      {
        pitchDegPerPixel: 0.2,
      },
    )
    const pose = createManualCameraPose(dragged)

    expect(dragged.pitchDeg).toBe(93)
    expect(pose.pitchDeg).toBe(93)
    expect(Math.hypot(...pose.quaternion)).toBeCloseTo(1, 6)
  })
})

function createDeviceRawSample(worldFromLocal: RawOrientationSample['worldFromLocal']): RawOrientationSample {
  return {
    source: 'deviceorientation-relative',
    providerKind: 'event',
    localFrame: 'device',
    absolute: false,
    timestampMs: 1_000,
    worldFromLocal,
  }
}

function expectVec3Close(
  actual: readonly [number, number, number],
  expected: readonly [number, number, number],
) {
  expect(actual[0]).toBeCloseTo(expected[0], 6)
  expect(actual[1]).toBeCloseTo(expected[1], 6)
  expect(actual[2]).toBeCloseTo(expected[2], 6)
}
