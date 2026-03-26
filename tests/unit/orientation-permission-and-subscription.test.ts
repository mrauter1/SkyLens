import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DeviceOrientationReading, OrientationRuntime } from '../../lib/sensors/orientation'
import {
  requestOrientationPermission,
  subscribeToOrientationPose,
} from '../../lib/sensors/orientation'

describe('orientation permission and subscription', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns denied when an explicit orientation permission request is denied', async () => {
    const { runtime } = createOrientationRuntime({
      orientationPermission: vi.fn(async () => 'denied'),
    })

    await expect(requestOrientationPermission(runtime)).resolves.toBe('denied')
  })

  it('returns granted after an explicit orientation permission grant without waiting for a probe', async () => {
    const { runtime, listenerCount } = createOrientationRuntime({
      orientationPermission: vi.fn(async () => 'granted'),
    })

    await expect(requestOrientationPermission(runtime)).resolves.toBe('granted')
    expect(listenerCount('deviceorientationabsolute')).toBe(0)
    expect(listenerCount('deviceorientation')).toBe(0)
  })

  it('returns denied when motion permission denies even if orientation permission grants', async () => {
    const { runtime } = createOrientationRuntime({
      orientationPermission: vi.fn(async () => 'granted'),
      motionPermission: vi.fn(async () => 'denied'),
    })

    await expect(requestOrientationPermission(runtime)).resolves.toBe('denied')
  })

  it('returns granted after a live orientation probe on platforms without permission APIs', async () => {
    vi.useFakeTimers()

    const { runtime, emit, listenerCount } = createOrientationRuntime()
    const permissionPromise = requestOrientationPermission(runtime)

    await Promise.resolve()
    await Promise.resolve()

    expect(listenerCount('deviceorientationabsolute')).toBe(1)
    expect(listenerCount('deviceorientation')).toBe(1)

    emit('deviceorientation', {
      alpha: 12,
      beta: 4,
      gamma: 1,
    })

    await expect(permissionPromise).resolves.toBe('granted')
    expect(listenerCount('deviceorientationabsolute')).toBe(0)
    expect(listenerCount('deviceorientation')).toBe(0)
  })

  it('returns unavailable when no usable orientation sample arrives before the probe timeout', async () => {
    vi.useFakeTimers()

    const { runtime, emit, listenerCount } = createOrientationRuntime()
    const permissionPromise = requestOrientationPermission(runtime)

    await Promise.resolve()
    await Promise.resolve()

    emit('deviceorientationabsolute', {
      alpha: null,
      beta: 4,
      gamma: 1,
    })

    await vi.runAllTimersAsync()

    await expect(permissionPromise).resolves.toBe('unavailable')
    expect(listenerCount('deviceorientationabsolute')).toBe(0)
    expect(listenerCount('deviceorientation')).toBe(0)
  })

  it('falls back to deviceorientation after a short delay when absolute never becomes usable', async () => {
    vi.useFakeTimers()

    const { runtime, emit } = createOrientationRuntime()
    const poses: Array<{ headingDeg: number }> = []

    const subscription = subscribeToOrientationPose(
      ({ sample }) => {
        poses.push({ headingDeg: sample.headingDeg })
      },
      { runtime },
    )

    emit('deviceorientationabsolute', {
      alpha: null,
      beta: 0,
      gamma: 0,
    })
    emit('deviceorientation', {
      alpha: 10,
      beta: 0,
      gamma: 0,
    })
    emit('deviceorientation', {
      alpha: 20,
      beta: 0,
      gamma: 0,
    })

    expect(poses).toHaveLength(0)

    await vi.runAllTimersAsync()

    emit('deviceorientationabsolute', {
      alpha: 200,
      beta: 0,
      gamma: 0,
    })
    emit('deviceorientation', {
      alpha: 30,
      beta: 0,
      gamma: 0,
    })

    subscription.stop()

    expect(poses).toHaveLength(2)
    expect(poses[0].headingDeg).toBe(20)
    expect(poses[1].headingDeg).toBeCloseTo(22, 4)
  })

  it('prefers deviceorientationabsolute when it becomes valid before relative fallback locks in', async () => {
    vi.useFakeTimers()

    const { runtime, emit } = createOrientationRuntime()
    const poses: Array<{ headingDeg: number }> = []

    const subscription = subscribeToOrientationPose(
      ({ sample }) => {
        poses.push({ headingDeg: sample.headingDeg })
      },
      { runtime },
    )

    emit('deviceorientation', {
      alpha: 10,
      beta: 0,
      gamma: 0,
    })

    expect(poses).toHaveLength(0)

    emit('deviceorientationabsolute', {
      alpha: 50,
      beta: 0,
      gamma: 0,
      absolute: true,
    })

    await vi.runAllTimersAsync()

    emit('deviceorientation', {
      alpha: 100,
      beta: 0,
      gamma: 0,
    })
    emit('deviceorientationabsolute', {
      alpha: 60,
      beta: 0,
      gamma: 0,
      absolute: true,
    })

    subscription.stop()

    expect(poses).toHaveLength(2)
    expect(poses[0].headingDeg).toBe(50)
    expect(poses[1].headingDeg).toBeCloseTo(52, 4)
  })

  it('selects deviceorientation immediately when the absolute stream is not supported', () => {
    const { runtime, emit } = createOrientationRuntime({
      supportsAbsolute: false,
    })
    const poses: Array<{ headingDeg: number }> = []

    const subscription = subscribeToOrientationPose(
      ({ sample }) => {
        poses.push({ headingDeg: sample.headingDeg })
      },
      { runtime },
    )

    emit('deviceorientation', {
      alpha: 25,
      beta: 0,
      gamma: 0,
    })

    subscription.stop()

    expect(poses).toHaveLength(1)
    expect(poses[0].headingDeg).toBe(25)
  })

  it('keeps emitted samples continuous through zenith before smoothing and recenter are applied', () => {
    const { runtime, emit } = createOrientationRuntime({
      supportsAbsolute: false,
      screenAngle: 90,
    })
    const poses: Array<{ headingDeg: number; pitchDeg: number; rollDeg: number }> = []

    const subscription = subscribeToOrientationPose(
      ({ sample }) => {
        poses.push({
          headingDeg: sample.headingDeg,
          pitchDeg: sample.pitchDeg,
          rollDeg: sample.rollDeg,
        })
      },
      { runtime },
    )

    emit('deviceorientation', {
      alpha: 0,
      beta: 0,
      gamma: 89,
    })
    emit('deviceorientation', {
      alpha: 180,
      beta: 180,
      gamma: 80,
    })

    subscription.stop()

    expect(poses).toHaveLength(2)
    expect(poses[0].headingDeg).toBeCloseTo(90, 4)
    expect(Math.abs(poses[0].pitchDeg)).toBeCloseTo(89, 4)
    expect(poses[0].rollDeg).toBeCloseTo(0, 4)
    expect(poses[1].headingDeg).toBeCloseTo(90, 4)
    expect(poses[1].pitchDeg).toBeGreaterThan(90)
    expect(Math.abs(normalizeSignedDegrees(poses[1].rollDeg))).toBeCloseTo(0, 4)
  })

  it('keeps repeated landscape zenith samples on the same normalized positive pitch branch', () => {
    const { runtime, emit } = createOrientationRuntime({
      supportsAbsolute: false,
      screenAngle: 90,
    })
    const poses: Array<{ headingDeg: number; pitchDeg: number; rollDeg: number }> = []

    const subscription = subscribeToOrientationPose(
      ({ sample }) => {
        poses.push({
          headingDeg: sample.headingDeg,
          pitchDeg: sample.pitchDeg,
          rollDeg: sample.rollDeg,
        })
      },
      { runtime },
    )

    emit('deviceorientation', {
      alpha: 0,
      beta: 0,
      gamma: 80,
    })
    emit('deviceorientation', {
      alpha: 0,
      beta: 0,
      gamma: 89,
    })

    subscription.stop()

    expect(poses).toHaveLength(2)
    expect(poses[0].pitchDeg).toBeCloseTo(80, 4)
    expect(poses[1].headingDeg).toBeCloseTo(90, 4)
    expect(poses[1].pitchDeg).toBeGreaterThan(poses[0].pitchDeg)
    expect(poses[1].pitchDeg).toBeGreaterThan(0)
    expect(Math.abs(normalizeSignedDegrees(poses[1].rollDeg))).toBeCloseTo(0, 4)
  })

  it('keeps emitted samples continuous through nadir before smoothing and recenter are applied', () => {
    const { runtime, emit } = createOrientationRuntime({
      supportsAbsolute: false,
      screenAngle: 90,
    })
    const poses: Array<{ headingDeg: number; pitchDeg: number; rollDeg: number }> = []

    const subscription = subscribeToOrientationPose(
      ({ sample }) => {
        poses.push({
          headingDeg: sample.headingDeg,
          pitchDeg: sample.pitchDeg,
          rollDeg: sample.rollDeg,
        })
      },
      { runtime },
    )

    emit('deviceorientation', {
      alpha: 0,
      beta: 0,
      gamma: -89,
    })
    emit('deviceorientation', {
      alpha: 180,
      beta: -180,
      gamma: -80,
    })

    subscription.stop()

    expect(poses).toHaveLength(2)
    expect(poses[0].headingDeg).toBeCloseTo(90, 4)
    expect(Math.abs(poses[0].pitchDeg)).toBeCloseTo(89, 4)
    expect(poses[0].rollDeg).toBeCloseTo(0, 4)
    expect(poses[1].headingDeg).toBeCloseTo(90, 4)
    expect(poses[1].pitchDeg).toBeLessThan(-90)
    expect(Math.abs(normalizeSignedDegrees(poses[1].rollDeg))).toBeCloseTo(0, 4)
  })

  it('keeps recenter stable when the baseline is captured near zenith', () => {
    const { runtime, emit } = createOrientationRuntime({
      supportsAbsolute: false,
      screenAngle: 90,
    })
    const poses: Array<{ yawDeg: number; pitchDeg: number; rollDeg: number }> = []

    const subscription = subscribeToOrientationPose(
      ({ pose }) => {
        poses.push({
          yawDeg: pose.yawDeg,
          pitchDeg: pose.pitchDeg,
          rollDeg: pose.rollDeg,
        })
      },
      { runtime },
    )

    emit('deviceorientation', {
      alpha: 0,
      beta: 0,
      gamma: 89,
    })

    subscription.recenter()

    emit('deviceorientation', {
      alpha: 180,
      beta: 180,
      gamma: 80,
    })

    subscription.stop()

    expect(poses).toHaveLength(2)
    expect(poses[0].yawDeg).toBeCloseTo(90, 4)
    expect(Math.abs(poses[0].pitchDeg)).toBeCloseTo(89, 4)
    expect(poses[1].yawDeg).toBeCloseTo(0, 4)
    expect(poses[1].pitchDeg).toBeGreaterThan(0)
    expect(poses[1].pitchDeg).toBeLessThan(5)
    expect(Math.abs(normalizeSignedDegrees(poses[1].rollDeg))).toBeCloseTo(0, 4)
  })
})

function createOrientationRuntime({
  orientationPermission,
  motionPermission,
  supportsAbsolute = true,
  screenAngle = 0,
}: {
  orientationPermission?: () => Promise<'granted' | 'denied'>
  motionPermission?: () => Promise<'granted' | 'denied'>
  supportsAbsolute?: boolean
  screenAngle?: number
} = {}) {
  const listeners = {
    deviceorientationabsolute: new Set<EventListenerOrEventListenerObject>(),
    deviceorientation: new Set<EventListenerOrEventListenerObject>(),
  }

  const runtime: OrientationRuntime = {
    addEventListener(type, listener) {
      listeners[type].add(listener)
    },
    removeEventListener(type, listener) {
      listeners[type].delete(listener)
    },
    ondeviceorientation: null,
    ...(supportsAbsolute ? { ondeviceorientationabsolute: null } : {}),
    screen: {
      orientation: {
        angle: screenAngle,
      },
    },
    ...(orientationPermission
      ? {
          DeviceOrientationEvent: {
            requestPermission: orientationPermission,
          },
        }
      : {}),
    ...(motionPermission
      ? {
          DeviceMotionEvent: {
            requestPermission: motionPermission,
          },
        }
      : {}),
  }

  return {
    runtime,
    emit(
      type: 'deviceorientationabsolute' | 'deviceorientation',
      reading: DeviceOrientationReading,
    ) {
      const event = {
        type,
        ...reading,
      } as unknown as Event

      for (const listener of [...listeners[type]]) {
        if (typeof listener === 'function') {
          listener(event)
        } else {
          listener.handleEvent(event)
        }
      }
    },
    listenerCount(type: 'deviceorientationabsolute' | 'deviceorientation') {
      return listeners[type].size
    },
  }
}

function normalizeSignedDegrees(value: number) {
  const normalized = ((value % 360) + 360) % 360
  return normalized > 180 ? normalized - 360 : normalized
}
