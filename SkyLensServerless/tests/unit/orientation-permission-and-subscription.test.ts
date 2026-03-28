import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  DeviceOrientationReading,
  OrientationRuntime,
} from '../../lib/sensors/orientation'
import {
  requestOrientationPermission,
  subscribeToOrientationPose,
} from '../../lib/sensors/orientation'
import { getCameraBasisVectors } from '../../lib/projection/camera'

describe('orientation permission and subscription', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('requests iOS/WebKit orientation permission with absolute=true and motion permission in the same flow', async () => {
    const orientationPermission = vi.fn(async () => 'granted' as const)
    const motionPermission = vi.fn(async () => 'granted' as const)
    const { runtime } = createOrientationRuntime({
      orientationPermission,
      motionPermission,
    })

    await expect(requestOrientationPermission(runtime)).resolves.toBe('granted')
    expect(orientationPermission).toHaveBeenCalledWith(true)
    expect(motionPermission).toHaveBeenCalledWith(undefined)
  })

  it('returns denied when an explicit motion permission request denies', async () => {
    const { runtime } = createOrientationRuntime({
      orientationPermission: vi.fn(
        async (): Promise<'granted' | 'denied'> => 'granted',
      ),
      motionPermission: vi.fn(
        async (): Promise<'granted' | 'denied'> => 'denied',
      ),
    })

    await expect(requestOrientationPermission(runtime)).resolves.toBe('denied')
  })

  it('returns granted after a live probe on platforms without permission APIs', async () => {
    const { runtime, emit } = createOrientationRuntime()
    const permissionPromise = requestOrientationPermission(runtime)

    await Promise.resolve()
    await Promise.resolve()
    emit('deviceorientation', {
      alpha: 12,
      beta: 4,
      gamma: 1,
    })

    await expect(permissionPromise).resolves.toBe('granted')
  })

  it('returns granted when only AbsoluteOrientationSensor is available and produces a reading', async () => {
    const { runtime, triggerSensorReading } = createOrientationRuntime({
      supportsEvents: false,
      sensorMatrix: [
        [1, 0, 0],
        [0, 0, -1],
        [0, 1, 0],
      ],
    })
    const permissionPromise = requestOrientationPermission(runtime)

    await Promise.resolve()
    await Promise.resolve()
    triggerSensorReading()

    await expect(permissionPromise).resolves.toBe('granted')
  })

  it('falls back from a silent orientation-event probe to AbsoluteOrientationSensor permission success', async () => {
    vi.useFakeTimers()

    const { runtime, triggerSensorReading } = createOrientationRuntime({
      sensorMatrix: [
        [1, 0, 0],
        [0, 0, -1],
        [0, 1, 0],
      ],
    })
    const permissionPromise = requestOrientationPermission(runtime)

    await Promise.resolve()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(250)
    triggerSensorReading()

    await expect(permissionPromise).resolves.toBe('granted')
  })

  it('returns unavailable when only AbsoluteOrientationSensor is available and no reading arrives', async () => {
    vi.useFakeTimers()

    const { runtime } = createOrientationRuntime({
      supportsEvents: false,
      sensorMatrix: [
        [1, 0, 0],
        [0, 0, -1],
        [0, 1, 0],
      ],
    })
    const permissionPromise = requestOrientationPermission(runtime)

    await Promise.resolve()
    await Promise.resolve()
    await vi.runAllTimersAsync()

    await expect(permissionPromise).resolves.toBe('unavailable')
  })

  it('returns unavailable when no usable orientation sample arrives before the probe timeout', async () => {
    vi.useFakeTimers()

    const { runtime } = createOrientationRuntime()
    const permissionPromise = requestOrientationPermission(runtime)

    await Promise.resolve()
    await Promise.resolve()
    await vi.runAllTimersAsync()

    await expect(permissionPromise).resolves.toBe('unavailable')
  })

  it('uses event.absolute truth instead of the event name when choosing relative vs absolute mode', async () => {
    vi.useFakeTimers()

    const { runtime, emit } = createOrientationRuntime()
    const states: Array<{
      source: string
      absolute: boolean
      needsCalibration: boolean
    }> = []

    const subscription = subscribeToOrientationPose(
      ({
        orientationSource,
        orientationAbsolute,
        orientationNeedsCalibration,
      }) => {
        states.push({
          source: orientationSource,
          absolute: orientationAbsolute,
          needsCalibration: orientationNeedsCalibration,
        })
      },
      { runtime },
    )

    emit('deviceorientationabsolute', {
      alpha: 25,
      beta: 80,
      gamma: 0,
      absolute: false,
    })

    await vi.runAllTimersAsync()

    emit('deviceorientation', {
      alpha: 40,
      beta: 80,
      gamma: 0,
      absolute: true,
    })

    subscription.stop()

    expect(states).toHaveLength(2)
    expect(states[0]).toEqual({
      source: 'deviceorientation-relative',
      absolute: false,
      needsCalibration: true,
    })
    expect(states[1]).toEqual({
      source: 'deviceorientation-absolute',
      absolute: true,
      needsCalibration: false,
    })
  })

  it('prefers AbsoluteOrientationSensor screen-frame samples when available', () => {
    const { runtime, triggerSensorReading } = createOrientationRuntime({
      sensorMatrix: [
        [1, 0, 0],
        [0, 0, -1],
        [0, 1, 0],
      ],
    })
    const states: Array<{
      source: string
      absolute: boolean
      needsCalibration: boolean
      forward: readonly number[]
    }> = []

    const subscription = subscribeToOrientationPose(
      ({ pose, orientationAbsolute, orientationNeedsCalibration, orientationSource }) => {
        states.push({
          source: orientationSource,
          absolute: orientationAbsolute,
          needsCalibration: orientationNeedsCalibration,
          forward: getCameraBasisVectors(pose.quaternion).forward,
        })
      },
      { runtime },
    )

    triggerSensorReading()
    subscription.stop()

    expect(states).toHaveLength(1)
    expect(states[0]).toMatchObject({
      source: 'absolute-sensor',
      absolute: true,
      needsCalibration: false,
    })
    expect(states[0].forward[0]).toBeCloseTo(0, 6)
    expect(states[0].forward[1]).toBeCloseTo(1, 6)
    expect(states[0].forward[2]).toBeCloseTo(0, 6)
  })

  it('falls back to the buffered absolute device sample when the sensor provider stays pending', async () => {
    vi.useFakeTimers()

    const { runtime, emit } = createOrientationRuntime({
      sensorMatrix: [
        [1, 0, 0],
        [0, 0, -1],
        [0, 1, 0],
      ],
    })
    const states: Array<{
      source: string
      absolute: boolean
      needsCalibration: boolean
      forward: readonly number[]
    }> = []

    const subscription = subscribeToOrientationPose(
      ({ pose, orientationAbsolute, orientationNeedsCalibration, orientationSource }) => {
        states.push({
          source: orientationSource,
          absolute: orientationAbsolute,
          needsCalibration: orientationNeedsCalibration,
          forward: getCameraBasisVectors(pose.quaternion).forward,
        })
      },
      { runtime },
    )

    emit('deviceorientation', {
      alpha: 10,
      beta: 90,
      gamma: 0,
      absolute: false,
    })
    emit('deviceorientationabsolute', {
      alpha: 270,
      beta: 90,
      gamma: 0,
      absolute: true,
    })

    expect(states).toHaveLength(0)

    await vi.runAllTimersAsync()
    subscription.stop()

    expect(states).toHaveLength(1)
    expect(states[0]).toMatchObject({
      source: 'deviceorientation-absolute',
      absolute: true,
      needsCalibration: false,
    })
    expect(states[0].forward[0]).toBeCloseTo(1, 6)
    expect(states[0].forward[1]).toBeCloseTo(0, 6)
    expect(states[0].forward[2]).toBeCloseTo(0, 6)
  })

  it('requires calibration for relative mode until the controller recenters the raw pose', async () => {
    vi.useFakeTimers()

    const { runtime, emit } = createOrientationRuntime({
      supportsAbsolute: false,
    })
    const states: Array<{
      yawDeg: number
      pitchDeg: number
      alignmentHealth: string
      needsCalibration: boolean
      forward: [number, number, number]
    }> = []

    const subscription = subscribeToOrientationPose(
      ({ pose, orientationNeedsCalibration }) => {
        states.push({
          yawDeg: pose.yawDeg,
          pitchDeg: pose.pitchDeg,
          alignmentHealth: pose.alignmentHealth,
          needsCalibration: orientationNeedsCalibration,
          forward: getCameraBasisVectors(pose.quaternion).forward,
        })
      },
      { runtime },
    )

    emit('deviceorientation', {
      alpha: 15,
      beta: 75,
      gamma: -10,
      absolute: false,
    })
    subscription.recenter()
    emit('deviceorientation', {
      alpha: 15,
      beta: 75,
      gamma: -10,
      absolute: false,
    })

    subscription.stop()

    expect(states).toHaveLength(3)
    expect(states[0].needsCalibration).toBe(true)
    expect(states[0].alignmentHealth).toBe('poor')
    expect(states.at(-1)?.needsCalibration).toBe(false)
    expect(states.at(-1)?.alignmentHealth).toBe('fair')
    expect(states.at(-1)?.forward[0]).toBeCloseTo(0, 5)
    expect(states.at(-1)?.forward[1]).toBeCloseTo(1, 5)
    expect(states.at(-1)?.forward[2]).toBeCloseTo(0, 5)
  })
})

function createOrientationRuntime({
  orientationPermission,
  motionPermission,
  supportsAbsolute = true,
  supportsEvents = true,
  sensorMatrix,
}: {
  orientationPermission?: (absolute?: boolean) => Promise<'granted' | 'denied'>
  motionPermission?: () => Promise<'granted' | 'denied'>
  supportsAbsolute?: boolean
  supportsEvents?: boolean
  sensorMatrix?: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ]
} = {}) {
  const listeners = {
    deviceorientationabsolute: new Set<EventListenerOrEventListenerObject>(),
    deviceorientation: new Set<EventListenerOrEventListenerObject>(),
  }
  const sensorListeners = {
    reading: new Set<EventListenerOrEventListenerObject>(),
    error: new Set<EventListenerOrEventListenerObject>(),
  }

  class MockAbsoluteOrientationSensor {
    addEventListener(
      type: 'reading' | 'error',
      listener: EventListenerOrEventListenerObject,
    ) {
      sensorListeners[type].add(listener)
    }

    removeEventListener(
      type: 'reading' | 'error',
      listener: EventListenerOrEventListenerObject,
    ) {
      sensorListeners[type].delete(listener)
    }

    populateMatrix(target: Float32Array | Float64Array | number[]) {
      if (!sensorMatrix) {
        throw new Error('no-matrix')
      }

      target[0] = sensorMatrix[0][0]
      target[1] = sensorMatrix[1][0]
      target[2] = sensorMatrix[2][0]
      target[3] = 0
      target[4] = sensorMatrix[0][1]
      target[5] = sensorMatrix[1][1]
      target[6] = sensorMatrix[2][1]
      target[7] = 0
      target[8] = sensorMatrix[0][2]
      target[9] = sensorMatrix[1][2]
      target[10] = sensorMatrix[2][2]
      target[11] = 0
      target[12] = 0
      target[13] = 0
      target[14] = 0
      target[15] = 1
      return target
    }

    start() {}
    stop() {}
  }

  const runtime: OrientationRuntime = {
    addEventListener(type, listener) {
      listeners[type].add(listener)
    },
    removeEventListener(type, listener) {
      listeners[type].delete(listener)
    },
    ...(supportsEvents ? { ondeviceorientation: null } : {}),
    ...(supportsEvents && supportsAbsolute ? { ondeviceorientationabsolute: null } : {}),
    ...(sensorMatrix
      ? {
          AbsoluteOrientationSensor: MockAbsoluteOrientationSensor,
        }
      : {}),
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
    triggerSensorReading() {
      const event = { type: 'reading' } as Event

      for (const listener of [...sensorListeners.reading]) {
        if (typeof listener === 'function') {
          listener(event)
        } else {
          listener.handleEvent(event)
        }
      }
    },
  }
}
