import { describe, expect, it } from 'vitest'

import noisyHeadingFixture from '../fixtures/sensors/noisy_heading.json'
import steadyHeadingFixture from '../fixtures/sensors/steady_heading.json'
import {
  applyManualPoseDrag,
  computeAlignmentHealth,
  createManualCameraPose,
  createManualPoseState,
  createSensorCameraPose,
  getRecenterBaseline,
  normalizeDeviceOrientationReading,
  smoothOrientationSample,
} from '../../lib/sensors/orientation'
import {
  createCameraQuaternion,
  projectWorldPointToScreen,
  slerpQuaternions,
} from '../../lib/projection/camera'

describe('orientation foundation', () => {
  it('applies screen-orientation correction without mirroring east and west', () => {
    const normalized = normalizeDeviceOrientationReading(
      {
        alpha: 40,
        beta: 20,
        gamma: 8,
      },
      90,
    )

    expect(normalized).not.toBeNull()
    expect(Math.hypot(...normalized!.quaternion!)).toBeCloseTo(1, 6)

    const pose = createSensorCameraPose(normalized!, {
      alignmentHealth: 'good',
    })
    const eastProjection = projectWorldPointToScreen(
      pose,
      {
        azimuthDeg: pose.yawDeg + 10,
        elevationDeg: pose.pitchDeg,
      },
      { width: 400, height: 800 },
    )
    const westProjection = projectWorldPointToScreen(
      pose,
      {
        azimuthDeg: pose.yawDeg - 10,
        elevationDeg: pose.pitchDeg,
      },
      { width: 400, height: 800 },
    )

    expect(eastProjection.visible).toBe(true)
    expect(westProjection.visible).toBe(true)
    expect(eastProjection.x).toBeGreaterThan(westProjection.x)
  })

  it('keeps raw orientation normalization continuous through zenith-equivalent readings', () => {
    const beforeZenith = normalizeDeviceOrientationReading(
      {
        alpha: 0,
        beta: 0,
        gamma: 89,
      },
      90,
    )

    expect(beforeZenith).not.toBeNull()

    const afterZenith = normalizeDeviceOrientationReading(
      {
        alpha: 180,
        beta: 180,
        gamma: 80,
      },
      90,
      beforeZenith,
    )

    expect(afterZenith).not.toBeNull()
    expect(afterZenith?.headingDeg).toBeCloseTo(90, 4)
    expect(afterZenith?.pitchDeg).toBeCloseTo(100, 4)
    expect(afterZenith?.rollDeg).toBeCloseTo(0, 4)
  })

  it('normalizes the same landscape quaternion consistently with and without prior history', () => {
    const firstLandscape = normalizeDeviceOrientationReading(
      {
        alpha: 0,
        beta: 0,
        gamma: 89,
      },
      90,
    )

    const portraitHistory = normalizeDeviceOrientationReading({
      alpha: 0,
      beta: 89,
      gamma: 0,
    })

    const afterPortrait = normalizeDeviceOrientationReading(
      {
        alpha: 0,
        beta: 0,
        gamma: 89,
      },
      90,
      portraitHistory,
    )

    expect(firstLandscape).not.toBeNull()
    expect(portraitHistory).not.toBeNull()
    expect(afterPortrait).not.toBeNull()
    expect(firstLandscape?.headingDeg).toBeCloseTo(afterPortrait?.headingDeg ?? NaN, 6)
    expect(firstLandscape?.pitchDeg).toBeCloseTo(afterPortrait?.pitchDeg ?? NaN, 6)
    expect(firstLandscape?.rollDeg).toBeCloseTo(afterPortrait?.rollDeg ?? NaN, 6)
    expect(firstLandscape?.pitchDeg).toBeCloseTo(89, 4)
    expect(firstLandscape?.rollDeg).toBeCloseTo(0, 4)
    expectQuaternionEquivalent(
      firstLandscape?.quaternion,
      createCameraQuaternion(
        firstLandscape?.headingDeg ?? NaN,
        firstLandscape?.pitchDeg ?? NaN,
        firstLandscape?.rollDeg ?? NaN,
      ),
    )
    expectQuaternionEquivalent(
      afterPortrait?.quaternion,
      createCameraQuaternion(
        afterPortrait?.headingDeg ?? NaN,
        afterPortrait?.pitchDeg ?? NaN,
        afterPortrait?.rollDeg ?? NaN,
      ),
    )
  })

  it('normalizes the same landscape nadir quaternion consistently with and without prior history', () => {
    const firstLandscape = normalizeDeviceOrientationReading(
      {
        alpha: 0,
        beta: 0,
        gamma: -89,
      },
      90,
    )

    const portraitHistory = normalizeDeviceOrientationReading({
      alpha: 0,
      beta: -89,
      gamma: 0,
    })

    const afterPortrait = normalizeDeviceOrientationReading(
      {
        alpha: 0,
        beta: 0,
        gamma: -89,
      },
      90,
      portraitHistory,
    )

    expect(firstLandscape).not.toBeNull()
    expect(portraitHistory).not.toBeNull()
    expect(afterPortrait).not.toBeNull()
    expect(firstLandscape?.headingDeg).toBeCloseTo(afterPortrait?.headingDeg ?? NaN, 6)
    expect(firstLandscape?.pitchDeg).toBeCloseTo(afterPortrait?.pitchDeg ?? NaN, 6)
    expect(firstLandscape?.rollDeg).toBeCloseTo(afterPortrait?.rollDeg ?? NaN, 6)
    expect(firstLandscape?.pitchDeg).toBeCloseTo(-89, 4)
    expect(firstLandscape?.rollDeg).toBeCloseTo(0, 4)
    expectQuaternionEquivalent(
      firstLandscape?.quaternion,
      createCameraQuaternion(
        firstLandscape?.headingDeg ?? NaN,
        firstLandscape?.pitchDeg ?? NaN,
        firstLandscape?.rollDeg ?? NaN,
      ),
    )
    expectQuaternionEquivalent(
      afterPortrait?.quaternion,
      createCameraQuaternion(
        afterPortrait?.headingDeg ?? NaN,
        afterPortrait?.pitchDeg ?? NaN,
        afterPortrait?.rollDeg ?? NaN,
      ),
    )
  })

  it('keeps raw orientation normalization continuous through nadir-equivalent readings', () => {
    const beforeNadir = normalizeDeviceOrientationReading(
      {
        alpha: 0,
        beta: 0,
        gamma: -89,
      },
      90,
    )

    expect(beforeNadir).not.toBeNull()

    const afterNadir = normalizeDeviceOrientationReading(
      {
        alpha: 180,
        beta: -180,
        gamma: -80,
      },
      90,
      beforeNadir,
    )

    expect(afterNadir).not.toBeNull()
    expect(afterNadir?.headingDeg).toBeCloseTo(90, 4)
    expect(afterNadir?.pitchDeg).toBeCloseTo(-100, 4)
    expect(afterNadir?.rollDeg).toBeCloseTo(0, 4)
  })

  it('prefers Safari compass heading when it disagrees with alpha', () => {
    const normalized = normalizeDeviceOrientationReading({
      alpha: 10,
      beta: 15,
      gamma: -5,
      webkitCompassHeading: 270,
    })

    expect(normalized).not.toBeNull()
    expect(normalized?.headingDeg).toBeCloseTo(270, 4)
  })

  it('smooths wrapped headings without jumping across north', () => {
    const smoothed = smoothOrientationSample(
      {
        headingDeg: 350,
        pitchDeg: 0,
        rollDeg: 0,
        timestampMs: 0,
      },
      {
        headingDeg: 10,
        pitchDeg: 10,
        rollDeg: 5,
        timestampMs: 100,
      },
    )

    expect(smoothed.headingDeg).toBeCloseTo(354, 4)
    expect(smoothed.pitchDeg).toBeCloseTo(2, 4)
  })

  it('interpolates quaternion metadata without changing continuous euler smoothing', () => {
    const previous = {
      headingDeg: 350,
      pitchDeg: 15,
      rollDeg: -10,
      timestampMs: 0,
      quaternion: createCameraQuaternion(350, 15, -10),
    }
    const next = {
      headingDeg: 10,
      pitchDeg: 35,
      rollDeg: 30,
      timestampMs: 100,
      quaternion: createCameraQuaternion(10, 35, 30),
    }

    const smoothed = smoothOrientationSample(previous, next)

    expect(smoothed.headingDeg).toBeCloseTo(354, 4)
    expect(smoothed.pitchDeg).toBeCloseTo(19, 4)
    expect(smoothed.rollDeg).toBeCloseTo(358, 4)
    expect(Math.hypot(...(smoothed.quaternion ?? [NaN, NaN, NaN, NaN]))).toBeCloseTo(1, 6)
    expectQuaternionEquivalent(
      smoothed.quaternion,
      slerpQuaternions(previous.quaternion, next.quaternion, 0.2),
    )
  })

  it('rebuilds quaternion metadata from the smoothed euler pose when only one sample has quaternion data', () => {
    const smoothed = smoothOrientationSample(
      {
        headingDeg: 350,
        pitchDeg: 0,
        rollDeg: 0,
        timestampMs: 0,
      },
      {
        headingDeg: 10,
        pitchDeg: 10,
        rollDeg: 5,
        timestampMs: 100,
        quaternion: createCameraQuaternion(10, 10, 5),
      },
    )

    expectQuaternionEquivalent(
      smoothed.quaternion,
      createCameraQuaternion(
        smoothed.headingDeg,
        smoothed.pitchDeg,
        smoothed.rollDeg,
      ),
    )
  })

  it('scores steady and noisy heading fixtures using the locked thresholds', () => {
    expect(computeAlignmentHealth(steadyHeadingFixture)).toBe('good')
    expect(computeAlignmentHealth(noisyHeadingFixture)).toBe('poor')
  })

  it('recenter resets the live baseline without wiping user offsets', () => {
    const sample = {
      headingDeg: 72,
      pitchDeg: 18,
      rollDeg: 3,
      timestampMs: 400,
    }

    const pose = createSensorCameraPose(sample, {
      baseline: getRecenterBaseline(sample),
      offsets: {
        headingDeg: 5,
        pitchDeg: -2,
      },
      alignmentHealth: 'good',
    })

    expect(pose.yawDeg).toBe(5)
    expect(pose.pitchDeg).toBe(-2)
    expect(Math.hypot(...pose.quaternion)).toBeCloseTo(1, 6)
  })

  it('keeps sensor poses continuous beyond pitch 90 degrees', () => {
    const pose = createSensorCameraPose(
      {
        headingDeg: 12,
        pitchDeg: 105,
        rollDeg: 4,
        timestampMs: 100,
      },
      {
        alignmentHealth: 'good',
      },
    )

    expect(pose.pitchDeg).toBe(105)
    expect(Math.hypot(...pose.quaternion)).toBeCloseTo(1, 6)
  })

  it('manual pan fallback yields the same normalized pose contract as sensors', () => {
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

function expectQuaternionEquivalent(
  actual: [number, number, number, number] | undefined,
  expected: [number, number, number, number],
) {
  expect(actual).toBeDefined()
  const similarity =
    actual![0] * expected[0] +
    actual![1] * expected[1] +
    actual![2] * expected[2] +
    actual![3] * expected[3]

  expect(Math.abs(similarity)).toBeCloseTo(1, 6)
}
