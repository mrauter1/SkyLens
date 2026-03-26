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

describe('orientation foundation', () => {
  it('corrects device readings for screen orientation', () => {
    const normalized = normalizeDeviceOrientationReading(
      {
        alpha: 40,
        beta: 20,
        gamma: 8,
      },
      90,
    )

    expect(normalized).toMatchObject({
      headingDeg: 130,
      pitchDeg: 8,
      rollDeg: -20,
    })
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
    expect(afterZenith).toMatchObject({
      headingDeg: 90,
      pitchDeg: 100,
      rollDeg: 0,
    })
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
    expect(afterNadir).toMatchObject({
      headingDeg: 90,
      pitchDeg: -100,
      rollDeg: 0,
    })
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
