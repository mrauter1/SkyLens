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
})

function createOrientationRuntime({
  orientationPermission,
  motionPermission,
  supportsAbsolute = true,
}: {
  orientationPermission?: () => Promise<'granted' | 'denied'>
  motionPermission?: () => Promise<'granted' | 'denied'>
  supportsAbsolute?: boolean
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
        angle: 0,
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
