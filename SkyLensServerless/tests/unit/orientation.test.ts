import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  DeviceOrientationReading,
  OrientationRuntime,
} from '../../lib/sensors/orientation'
import {
  getOrientationCapabilities,
  rawPoseQuaternionFromSample,
  requestOrientationPermission,
  startDeviceOrientationProvider,
  startRelativeOrientationSensorProvider,
  subscribeToOrientationPose,
  worldFromDeviceOrientation,
} from '../../lib/sensors/orientation'
import { getCameraBasisVectors } from '../../lib/projection/camera'

describe('orientation runtime coordinator', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reports runtime capabilities including relative sensors and prompt support', () => {
    const { runtime } = createOrientationRuntime({
      supportsAbsoluteSensor: true,
      supportsRelativeSensor: true,
      orientationPermission: vi.fn(async () => 'granted' as const),
    })

    expect(getOrientationCapabilities(runtime)).toEqual({
      hasEvents: true,
      hasAbsoluteEvent: true,
      hasAbsoluteSensor: true,
      hasRelativeSensor: true,
      canRequestPermission: true,
    })
  })

  it('keeps orientation permission prompt-only when explicit request APIs are absent', async () => {
    const { runtime, listenerCount } = createOrientationRuntime()

    await expect(requestOrientationPermission(runtime)).resolves.toBe('unavailable')
    expect(listenerCount('deviceorientation')).toBe(0)
    expect(listenerCount('deviceorientationabsolute')).toBe(0)
  })

  it('preserves the iOS Safari prompt-only contract for granted and denied permission results', async () => {
    const grantedRuntime = createOrientationRuntime({
      supportsAbsoluteSensor: false,
      supportsRelativeSensor: false,
      orientationPermission: vi.fn(async () => 'granted' as const),
      motionPermission: vi.fn(async () => 'granted' as const),
    })
    const deniedRuntime = createOrientationRuntime({
      supportsAbsoluteSensor: false,
      supportsRelativeSensor: false,
      orientationPermission: vi.fn(async () => 'denied' as const),
      motionPermission: vi.fn(async () => 'granted' as const),
    })

    await expect(requestOrientationPermission(grantedRuntime.runtime)).resolves.toBe('granted')
    await expect(requestOrientationPermission(deniedRuntime.runtime)).resolves.toBe('denied')
    expect(grantedRuntime.listenerCount('deviceorientation')).toBe(0)
    expect(deniedRuntime.listenerCount('deviceorientation')).toBe(0)
  })

  it('classifies absolute and compass-backed event samples correctly', () => {
    const { runtime, emit } = createOrientationRuntime()
    const samples: Array<ReturnType<typeof captureDeviceSample>> = []

    const controller = startDeviceOrientationProvider((sample) => {
      samples.push(captureDeviceSample(sample))
    }, { runtime })

    emit('deviceorientationabsolute', {
      alpha: 25,
      beta: 80,
      gamma: 0,
      absolute: false,
    })
    emit('deviceorientation', {
      alpha: 90,
      beta: 90,
      gamma: 0,
      webkitCompassHeading: 270,
      webkitCompassAccuracy: 5,
    })

    controller?.stop()

    expect(samples).toEqual([
      {
        source: 'deviceorientation-absolute',
        absolute: true,
        compassBacked: false,
        compassHeadingDeg: undefined,
        compassAccuracyDeg: undefined,
      },
      {
        source: 'deviceorientation-relative',
        absolute: false,
        compassBacked: true,
        compassHeadingDeg: 270,
        compassAccuracyDeg: 5,
      },
    ])
  })

  it('starts the relative sensor path and emits quaternion-backed screen-frame samples', async () => {
    const { runtime, emitSensorReading } = createOrientationRuntime({
      supportsEvents: false,
      supportsAbsoluteEvent: false,
      supportsAbsoluteSensor: false,
      supportsRelativeSensor: true,
      permissionStates: {
        accelerometer: 'granted',
        gyroscope: 'granted',
      },
    })
    const samples: Array<ReturnType<typeof captureDeviceSample>> = []

    const controller = startRelativeOrientationSensorProvider((sample) => {
      samples.push(captureDeviceSample(sample))
    }, { runtime })

    await flushMicrotasks()
    emitSensorReading('relative', {
      quaternion: [0, 0, 0, 1],
    })
    controller?.stop()

    expect(samples).toEqual([
      {
        source: 'relative-sensor',
        absolute: false,
        compassBacked: false,
        compassHeadingDeg: undefined,
        compassAccuracyDeg: undefined,
      },
    ])
  })

  it('falls back to the relative sensor on Chrome Android when the absolute sensor path cannot start', async () => {
    vi.useFakeTimers()

    const { runtime, emit, emitSensorReading } = createOrientationRuntime({
      supportsAbsoluteSensor: true,
      supportsRelativeSensor: true,
      permissionStates: {
        accelerometer: 'granted',
        gyroscope: 'granted',
      },
      sensorStartThrows: {
        absolute: true,
      },
    })
    const states: Array<{ source: string; absolute: boolean; needsCalibration: boolean }> = []

    const controller = subscribeToOrientationPose(
      ({ orientationSource, orientationAbsolute, orientationNeedsCalibration }) => {
        states.push({
          source: orientationSource,
          absolute: orientationAbsolute,
          needsCalibration: orientationNeedsCalibration,
        })
      },
      { runtime },
    )

    await flushMicrotasks()
    emit('deviceorientation', {
      alpha: 15,
      beta: 75,
      gamma: -10,
      absolute: false,
    })
    emitSensorReading('relative', {
      quaternion: [0, 0, 0, 1],
    })
    await vi.advanceTimersByTimeAsync(ORIENTATION_SELECTION_TIMEOUT_MS)
    controller.stop()

    expect(states).toEqual([
      {
        source: 'relative-sensor',
        absolute: false,
        needsCalibration: true,
      },
    ])
  })

  it('buffers startup providers and picks the highest-priority absolute source', async () => {
    vi.useFakeTimers()

    const { runtime, emit, emitSensorReading } = createOrientationRuntime({
      supportsAbsoluteSensor: true,
    })
    const states: Array<{ source: string; absolute: boolean }> = []

    const controller = subscribeToOrientationPose(({ orientationSource, orientationAbsolute }) => {
      states.push({
        source: orientationSource,
        absolute: orientationAbsolute,
      })
    }, { runtime })

    await flushMicrotasks()

    emit('deviceorientation', {
      alpha: 15,
      beta: 75,
      gamma: -10,
      absolute: false,
    })
    emitSensorReading('absolute', {
      quaternion: [0, 0, 0, 1],
    })

    expect(states).toEqual([])

    await vi.advanceTimersByTimeAsync(ORIENTATION_SELECTION_TIMEOUT_MS)
    controller.stop()

    expect(states).toEqual([
      {
        source: 'absolute-sensor',
        absolute: true,
      },
    ])
  })

  it('keeps startup providers active after the initial selection window so a delayed first sample can still win', async () => {
    vi.useFakeTimers()

    const { runtime, emitSensorReading } = createOrientationRuntime({
      supportsEvents: false,
      supportsAbsoluteEvent: false,
      supportsAbsoluteSensor: true,
      supportsRelativeSensor: false,
    })
    const states: Array<{ source: string; absolute: boolean; needsCalibration: boolean }> = []

    const controller = subscribeToOrientationPose(
      ({ orientationSource, orientationAbsolute, orientationNeedsCalibration }) => {
        states.push({
          source: orientationSource,
          absolute: orientationAbsolute,
          needsCalibration: orientationNeedsCalibration,
        })
      },
      { runtime },
    )

    await flushMicrotasks()
    await vi.advanceTimersByTimeAsync(ORIENTATION_SELECTION_TIMEOUT_MS + 100)

    emitSensorReading('absolute', {
      quaternion: [0, 0, 0, 1],
    })
    await flushMicrotasks()
    controller.stop()

    expect(states).toEqual([
      {
        source: 'absolute-sensor',
        absolute: true,
        needsCalibration: false,
      },
    ])
  })

  it('keeps deviceorientationabsolute ahead of plain deviceorientation absolute events', async () => {
    vi.useFakeTimers()

    const { runtime, emit } = createOrientationRuntime({
      supportsAbsoluteSensor: false,
      supportsRelativeSensor: false,
    })
    const states: Array<{ source: string; absolute: boolean; heading: number }> = []

    const controller = subscribeToOrientationPose(({ sample, orientationSource, orientationAbsolute }) => {
      states.push({
        source: orientationSource,
        absolute: orientationAbsolute,
        heading: sample.headingDeg,
      })
    }, { runtime })

    emit('deviceorientation', {
      alpha: 180,
      beta: 90,
      gamma: 0,
      absolute: true,
    })
    emit('deviceorientationabsolute', {
      alpha: 270,
      beta: 90,
      gamma: 0,
      absolute: false,
    })

    await vi.advanceTimersByTimeAsync(ORIENTATION_SELECTION_TIMEOUT_MS)
    controller.stop()

    expect(states).toHaveLength(1)
    expect(states[0]).toMatchObject({
      source: 'deviceorientation-absolute',
      absolute: true,
    })
    expect(states[0].heading).toBeCloseTo(90, 3)
  })

  it('starts Firefox Android through events only and distinguishes absolute from relative event samples', async () => {
    vi.useFakeTimers()

    const { runtime, emit } = createOrientationRuntime({
      supportsAbsoluteSensor: false,
      supportsRelativeSensor: false,
      supportsAbsoluteEvent: false,
    })
    const states: Array<{ source: string; absolute: boolean; needsCalibration: boolean }> = []

    const controller = subscribeToOrientationPose(
      ({ orientationSource, orientationAbsolute, orientationNeedsCalibration }) => {
        states.push({
          source: orientationSource,
          absolute: orientationAbsolute,
          needsCalibration: orientationNeedsCalibration,
        })
      },
      { runtime },
    )

    emit('deviceorientation', {
      alpha: 180,
      beta: 90,
      gamma: 0,
      absolute: true,
    })
    await vi.advanceTimersByTimeAsync(ORIENTATION_SELECTION_TIMEOUT_MS)
    emit('deviceorientation', {
      alpha: 15,
      beta: 75,
      gamma: -10,
      absolute: false,
    })
    controller.stop()

    expect(states[0]).toEqual({
      source: 'deviceorientation-absolute',
      absolute: true,
      needsCalibration: false,
    })
    expect(states.at(-1)).toEqual({
      source: 'deviceorientation-absolute',
      absolute: true,
      needsCalibration: false,
    })
  })

  it('keeps Firefox Android on the relative event path when no absolute event sample appears', async () => {
    vi.useFakeTimers()

    const { runtime, emit } = createOrientationRuntime({
      supportsAbsoluteSensor: false,
      supportsRelativeSensor: false,
      supportsAbsoluteEvent: false,
    })
    const states: Array<{ source: string; absolute: boolean; needsCalibration: boolean }> = []

    const controller = subscribeToOrientationPose(
      ({ orientationSource, orientationAbsolute, orientationNeedsCalibration }) => {
        states.push({
          source: orientationSource,
          absolute: orientationAbsolute,
          needsCalibration: orientationNeedsCalibration,
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
    await vi.advanceTimersByTimeAsync(ORIENTATION_SELECTION_TIMEOUT_MS)
    controller.stop()

    expect(states).toEqual([
      {
        source: 'deviceorientation-relative',
        absolute: false,
        needsCalibration: true,
      },
    ])
  })

  it('upgrades a selected relative source when a late absolute provider proves itself', async () => {
    vi.useFakeTimers()

    const { runtime, emit } = createOrientationRuntime({
      supportsAbsoluteSensor: false,
      supportsRelativeSensor: false,
    })
    const states: Array<{
      source: string
      absolute: boolean
      needsCalibration: boolean
    }> = []

    const controller = subscribeToOrientationPose(
      ({ orientationSource, orientationAbsolute, orientationNeedsCalibration }) => {
        states.push({
          source: orientationSource,
          absolute: orientationAbsolute,
          needsCalibration: orientationNeedsCalibration,
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
    await vi.advanceTimersByTimeAsync(ORIENTATION_SELECTION_TIMEOUT_MS)

    emit('deviceorientationabsolute', {
      alpha: 270,
      beta: 90,
      gamma: 0,
      absolute: true,
    })
    emit('deviceorientationabsolute', {
      alpha: 270,
      beta: 90,
      gamma: 0,
      absolute: true,
    })
    controller.stop()

    expect(states[0]).toEqual({
      source: 'deviceorientation-relative',
      absolute: false,
      needsCalibration: true,
    })
    expect(states.at(-1)).toEqual({
      source: 'deviceorientation-absolute',
      absolute: true,
      needsCalibration: false,
    })
  })

  it('uses a Safari compass fixture whose aligned heading matches the quaternion-derived heading', () => {
    const alignedHeadingDeg = getQuaternionDerivedHeadingDeg({
      alpha: 90,
      beta: 90,
      gamma: 0,
    })

    expect(alignedHeadingDeg).toBeCloseTo(270, 3)
    expect(shortestAngleDeltaDeg(alignedHeadingDeg, 0)).toBeGreaterThan(20)
  })

  it('validates Safari compass-backed events before upgrading and downgrades after sustained failure', async () => {
    vi.useFakeTimers()

    const { runtime, emit } = createOrientationRuntime({
      supportsAbsoluteSensor: false,
      supportsRelativeSensor: false,
      supportsAbsoluteEvent: false,
    })
    const states: Array<{
      source: string
      absolute: boolean
      needsCalibration: boolean
      compassBacked?: boolean
    }> = []

    const controller = subscribeToOrientationPose(
      ({
        sample,
        orientationSource,
        orientationAbsolute,
        orientationNeedsCalibration,
      }) => {
        states.push({
          source: orientationSource,
          absolute: orientationAbsolute,
          needsCalibration: orientationNeedsCalibration,
          compassBacked: sample.compassBacked,
        })
      },
      { runtime },
    )

    emitCompassAlignedSample(emit)
    await vi.advanceTimersByTimeAsync(ORIENTATION_SELECTION_TIMEOUT_MS)
    emitCompassAlignedSample(emit)
    emitCompassAlignedSample(emit)
    emitCompassAlignedSample(emit)

    emitCompassMisalignedSample(emit)
    emitCompassMisalignedSample(emit)
    emitCompassMisalignedSample(emit)
    controller.stop()

    expect(states[0]).toEqual({
      source: 'deviceorientation-relative',
      absolute: false,
      needsCalibration: true,
      compassBacked: true,
    })
    expect(states.some((state) => state.source === 'deviceorientation-absolute')).toBe(true)
    expect(states.at(-1)).toEqual({
      source: 'deviceorientation-relative',
      absolute: false,
      needsCalibration: true,
      compassBacked: true,
    })
  })

  it('restarts arbitration after lifecycle suspend and provider stall', async () => {
    vi.useFakeTimers()

    const { runtime, emitSensorReading, getSensorStartCount, setVisibility, dispatchWindowEvent } =
      createOrientationRuntime({
        supportsAbsoluteSensor: true,
        supportsRelativeSensor: false,
      })

    const controller = subscribeToOrientationPose(() => {}, { runtime })

    await flushMicrotasks()
    emitSensorReading('absolute', {
      quaternion: [0, 0, 0, 1],
    })
    await vi.advanceTimersByTimeAsync(ORIENTATION_SELECTION_TIMEOUT_MS)

    setVisibility('hidden')
    setVisibility('visible')
    await flushMicrotasks()

    emitSensorReading('absolute', {
      quaternion: [0, 0, 0, 1],
    })
    await vi.advanceTimersByTimeAsync(ORIENTATION_SELECTION_TIMEOUT_MS)
    await vi.advanceTimersByTimeAsync(ORIENTATION_STALL_TIMEOUT_MS)
    await flushMicrotasks()
    emitSensorReading('absolute', {
      quaternion: [0, 0, 0, 1],
    })
    await vi.advanceTimersByTimeAsync(ORIENTATION_SELECTION_TIMEOUT_MS)

    dispatchWindowEvent('pagehide')
    dispatchWindowEvent('pageshow')
    await flushMicrotasks()
    emitSensorReading('absolute', {
      quaternion: [0, 0, 0, 1],
    })
    await vi.advanceTimersByTimeAsync(ORIENTATION_SELECTION_TIMEOUT_MS)
    controller.stop()

    expect(getSensorStartCount('absolute')).toBeGreaterThanOrEqual(4)
  })

  it('falls back cleanly on Samsung Internet when sensor constructors exist but fail and the event path survives restart', async () => {
    vi.useFakeTimers()

    const {
      runtime,
      emit,
      dispatchWindowEvent,
      emitSensorError,
      getSensorStartCount,
    } = createOrientationRuntime({
      supportsAbsoluteSensor: true,
      supportsRelativeSensor: true,
      permissionStates: {
        accelerometer: 'granted',
        gyroscope: 'granted',
        magnetometer: 'granted',
      },
    })
    const states: Array<{ source: string; absolute: boolean }> = []

    const controller = subscribeToOrientationPose(({ orientationSource, orientationAbsolute }) => {
      states.push({
        source: orientationSource,
        absolute: orientationAbsolute,
      })
    }, { runtime })

    await flushMicrotasks()
    emitSensorError('absolute')
    emitSensorError('relative')
    emit('deviceorientation', {
      alpha: 15,
      beta: 75,
      gamma: -10,
      absolute: false,
    })
    await vi.advanceTimersByTimeAsync(ORIENTATION_SELECTION_TIMEOUT_MS)

    dispatchWindowEvent('pagehide')
    dispatchWindowEvent('pageshow')
    await flushMicrotasks()
    emitSensorError('absolute')
    emitSensorError('relative')
    emit('deviceorientation', {
      alpha: 270,
      beta: 90,
      gamma: 0,
      absolute: true,
    })
    await vi.advanceTimersByTimeAsync(ORIENTATION_SELECTION_TIMEOUT_MS)
    controller.stop()

    expect(states[0]).toEqual({
      source: 'deviceorientation-relative',
      absolute: false,
    })
    expect(states.at(-1)).toEqual({
      source: 'deviceorientation-absolute',
      absolute: true,
    })
    expect(getSensorStartCount('absolute')).toBeGreaterThanOrEqual(2)
    expect(getSensorStartCount('relative')).toBeGreaterThanOrEqual(2)
  })

  it('reprocesses the latest event sample when screen orientation changes', async () => {
    vi.useFakeTimers()

    const { runtime, emit, setScreenAngle, dispatchWindowEvent } =
      createOrientationRuntime({
        supportsAbsoluteSensor: false,
        supportsRelativeSensor: false,
      })
    const rolls: number[] = []

    const controller = subscribeToOrientationPose(({ sample }) => {
      rolls.push(sample.rollDeg)
    }, { runtime })

    emit('deviceorientation', {
      alpha: 312,
      beta: 84,
      gamma: -11,
      absolute: false,
    })
    await vi.advanceTimersByTimeAsync(ORIENTATION_SELECTION_TIMEOUT_MS)

    setScreenAngle(90)
    dispatchWindowEvent('orientationchange')
    controller.stop()

    expect(rolls).toHaveLength(2)
    expect(rolls[1]).toBeCloseTo(rolls[0] - 90, 3)
  })

  it('does not re-emit screen-frame sensor samples on orientationchange', async () => {
    vi.useFakeTimers()

    const { runtime, emitSensorReading, setScreenAngle, dispatchWindowEvent } =
      createOrientationRuntime({
        supportsAbsoluteSensor: true,
        supportsRelativeSensor: false,
      })
    const headings: number[] = []

    const controller = subscribeToOrientationPose(({ sample }) => {
      headings.push(sample.headingDeg)
    }, { runtime })

    await flushMicrotasks()
    emitSensorReading('absolute', {
      quaternion: [0, 0, 0, 1],
    })
    await vi.advanceTimersByTimeAsync(ORIENTATION_SELECTION_TIMEOUT_MS)

    setScreenAngle(90)
    dispatchWindowEvent('orientationchange')
    controller.stop()

    expect(headings).toHaveLength(1)
  })

  it('does not let slow permission hints block absolute sensor startup arbitration', async () => {
    vi.useFakeTimers()

    const { runtime, emitSensorReading } = createOrientationRuntime({
      supportsAbsoluteSensor: true,
      supportsRelativeSensor: false,
      permissionStates: {
        accelerometer: 'granted',
        gyroscope: 'granted',
        magnetometer: 'granted',
      },
      permissionQueryDelayMs: 1_000,
    })
    const states: Array<{ source: string; absolute: boolean }> = []

    const controller = subscribeToOrientationPose(({ orientationSource, orientationAbsolute }) => {
      states.push({
        source: orientationSource,
        absolute: orientationAbsolute,
      })
    }, { runtime })

    await vi.advanceTimersByTimeAsync(60)
    await flushMicrotasks()
    emitSensorReading('absolute', {
      quaternion: [0, 0, 0, 1],
    })
    await vi.advanceTimersByTimeAsync(ORIENTATION_SELECTION_TIMEOUT_MS)
    controller.stop()

    expect(states).toEqual([
      {
        source: 'absolute-sensor',
        absolute: true,
      },
    ])
  })
})

const ORIENTATION_SELECTION_TIMEOUT_MS = 500
const ORIENTATION_STALL_TIMEOUT_MS = 1_500

type SensorKind = 'absolute' | 'relative'
type WindowEventType =
  | 'deviceorientationabsolute'
  | 'deviceorientation'
  | 'pagehide'
  | 'pageshow'
  | 'orientationchange'

function captureDeviceSample(sample: {
  source: string
  absolute: boolean
  compassBacked?: boolean
  compassHeadingDeg?: number
  compassAccuracyDeg?: number
}) {
  return {
    source: sample.source,
    absolute: sample.absolute,
    compassBacked: sample.compassBacked ?? false,
    compassHeadingDeg: sample.compassHeadingDeg,
    compassAccuracyDeg: sample.compassAccuracyDeg,
  }
}

function emitCompassAlignedSample(
  emit: (type: WindowEventType, reading: DeviceOrientationReading) => void,
) {
  emit('deviceorientation', {
    alpha: 90,
    beta: 90,
    gamma: 0,
    webkitCompassHeading: 270,
    webkitCompassAccuracy: 5,
  })
}

function emitCompassMisalignedSample(
  emit: (type: WindowEventType, reading: DeviceOrientationReading) => void,
) {
  emit('deviceorientation', {
    alpha: 90,
    beta: 90,
    gamma: 0,
    webkitCompassHeading: 0,
    webkitCompassAccuracy: 5,
  })
}

async function flushMicrotasks() {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve()
  }
}

function getQuaternionDerivedHeadingDeg(reading: Pick<DeviceOrientationReading, 'alpha' | 'beta' | 'gamma'>) {
  const rawQuaternion = rawPoseQuaternionFromSample({
    source: 'deviceorientation-relative',
    providerKind: 'event',
    localFrame: 'device',
    absolute: false,
    timestampMs: 0,
    worldFromLocal: worldFromDeviceOrientation(
      reading.alpha ?? 0,
      reading.beta ?? 0,
      reading.gamma ?? 0,
    ),
  })
  const basis = getCameraBasisVectors(rawQuaternion)
  const horizontalMagnitude = Math.hypot(basis.forward[0], basis.forward[1])

  if (horizontalMagnitude > 1e-6) {
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

function shortestAngleDeltaDeg(leftDeg: number, rightDeg: number) {
  return Math.abs((((leftDeg - rightDeg + 540) % 360) - 180))
}

function normalizeDegrees(value: number) {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI
}

function createOrientationRuntime({
  orientationPermission,
  motionPermission,
  supportsEvents = true,
  supportsAbsoluteEvent = true,
  supportsAbsoluteSensor = false,
  supportsRelativeSensor = false,
  permissionStates = {},
  permissionQueryDelayMs = 0,
  sensorStartThrows = {},
}: {
  orientationPermission?: (absolute?: boolean) => Promise<'granted' | 'denied'>
  motionPermission?: () => Promise<'granted' | 'denied'>
  supportsEvents?: boolean
  supportsAbsoluteEvent?: boolean
  supportsAbsoluteSensor?: boolean
  supportsRelativeSensor?: boolean
  permissionStates?: Partial<Record<'accelerometer' | 'gyroscope' | 'magnetometer', PermissionState>>
  permissionQueryDelayMs?: number
  sensorStartThrows?: Partial<Record<SensorKind, boolean>>
} = {}) {
  const windowListeners: Record<WindowEventType, Set<EventListenerOrEventListenerObject>> = {
    deviceorientationabsolute: new Set(),
    deviceorientation: new Set(),
    pagehide: new Set(),
    pageshow: new Set(),
    orientationchange: new Set(),
  }
  const documentListeners = {
    visibilitychange: new Set<EventListenerOrEventListenerObject>(),
  }
  const sensorStarts = {
    absolute: 0,
    relative: 0,
  }
  const sensorInstances = {
    absolute: [] as MockSensor[],
    relative: [] as MockSensor[],
  }
  const runtimeDocument = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener(type: 'visibilitychange', listener: EventListenerOrEventListenerObject) {
      documentListeners[type].add(listener)
    },
    removeEventListener(type: 'visibilitychange', listener: EventListenerOrEventListenerObject) {
      documentListeners[type].delete(listener)
    },
  }

  class MockSensor {
    quaternion?: [number, number, number, number]
    matrix?:
      | [
          [number, number, number],
          [number, number, number],
          [number, number, number],
        ]
    populateMatrix?:
      | ((target: Float32Array | Float64Array | number[]) => Float32Array | Float64Array | number[])
      | undefined
    listeners = {
      reading: new Set<EventListenerOrEventListenerObject>(),
      error: new Set<EventListenerOrEventListenerObject>(),
    }

    constructor(private readonly kind: SensorKind) {
      sensorInstances[kind].push(this)
    }

    addEventListener(
      type: 'reading' | 'error',
      listener: EventListenerOrEventListenerObject,
    ) {
      this.listeners[type].add(listener)
    }

    removeEventListener(
      type: 'reading' | 'error',
      listener: EventListenerOrEventListenerObject,
    ) {
      this.listeners[type].delete(listener)
    }

    start() {
      if (sensorStartThrows[this.kind]) {
        throw new Error(`sensor-start-failed:${this.kind}`)
      }

      sensorStarts[this.kind] += 1
    }

    stop() {}
  }

  const runtime: OrientationRuntime = {
    addEventListener(type, listener) {
      if (type in windowListeners) {
        windowListeners[type as WindowEventType].add(listener)
      }
    },
    removeEventListener(type, listener) {
      if (type in windowListeners) {
        windowListeners[type as WindowEventType].delete(listener)
      }
    },
    ...(supportsEvents ? { ondeviceorientation: null } : {}),
    ...(supportsEvents && supportsAbsoluteEvent ? { ondeviceorientationabsolute: null } : {}),
    screen: {
      orientation: {
        angle: 0,
      },
    },
    orientation: 0,
    document: runtimeDocument,
    permissions: {
      async query({ name }: PermissionDescriptor) {
        if (permissionQueryDelayMs > 0) {
          await new Promise((resolve) => {
            setTimeout(resolve, permissionQueryDelayMs)
          })
        }

        const state = permissionStates[name as keyof typeof permissionStates]

        if (!state) {
          throw new Error(`unsupported:${String(name)}`)
        }

        return {
          state,
        } as PermissionStatus
      },
    },
    ...(supportsAbsoluteSensor
      ? {
          AbsoluteOrientationSensor: class extends MockSensor {
            constructor() {
              super('absolute')
            }
          },
        }
      : {}),
    ...(supportsRelativeSensor
      ? {
          RelativeOrientationSensor: class extends MockSensor {
            constructor() {
              super('relative')
            }
          },
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
    emit(type: WindowEventType, reading: DeviceOrientationReading) {
      const event = {
        type,
        ...reading,
      } as unknown as Event

      for (const listener of [...windowListeners[type]]) {
        if (typeof listener === 'function') {
          listener(event)
        } else {
          listener.handleEvent(event)
        }
      }
    },
    dispatchWindowEvent(type: Extract<WindowEventType, 'pagehide' | 'pageshow' | 'orientationchange'>) {
      const event = { type } as Event

      for (const listener of [...windowListeners[type]]) {
        if (typeof listener === 'function') {
          listener(event)
        } else {
          listener.handleEvent(event)
        }
      }
    },
    emitSensorReading(
      kind: SensorKind,
      {
        matrix,
        quaternion,
        instanceIndex,
      }: {
        matrix?:
          | [
              [number, number, number],
              [number, number, number],
              [number, number, number],
            ]
        quaternion?: [number, number, number, number]
        instanceIndex?: number
      },
    ) {
      const resolvedInstanceIndex = instanceIndex ?? sensorInstances[kind].length - 1
      const instance = sensorInstances[kind][resolvedInstanceIndex]

      if (!instance) {
        throw new Error(`missing-${kind}-sensor-instance`)
      }

      instance.matrix = matrix
      instance.quaternion = quaternion
      instance.populateMatrix = matrix
        ? (target: Float32Array | Float64Array | number[]) => {
            target[0] = matrix[0][0]
            target[1] = matrix[1][0]
            target[2] = matrix[2][0]
            target[3] = 0
            target[4] = matrix[0][1]
            target[5] = matrix[1][1]
            target[6] = matrix[2][1]
            target[7] = 0
            target[8] = matrix[0][2]
            target[9] = matrix[1][2]
            target[10] = matrix[2][2]
            target[11] = 0
            target[12] = 0
            target[13] = 0
            target[14] = 0
            target[15] = 1
            return target
          }
        : undefined

      const event = { type: 'reading' } as Event

      for (const listener of [...instance.listeners.reading]) {
        if (typeof listener === 'function') {
          listener(event)
        } else {
          listener.handleEvent(event)
        }
      }
    },
    emitSensorError(kind: SensorKind, instanceIndex?: number) {
      const resolvedInstanceIndex = instanceIndex ?? sensorInstances[kind].length - 1
      const instance = sensorInstances[kind][resolvedInstanceIndex]

      if (!instance) {
        throw new Error(`missing-${kind}-sensor-instance`)
      }

      const event = { type: 'error' } as Event

      for (const listener of [...instance.listeners.error]) {
        if (typeof listener === 'function') {
          listener(event)
        } else {
          listener.handleEvent(event)
        }
      }
    },
    getSensorStartCount(kind: SensorKind) {
      return sensorStarts[kind]
    },
    listenerCount(type: Extract<WindowEventType, 'deviceorientation' | 'deviceorientationabsolute'>) {
      return windowListeners[type].size
    },
    setVisibility(state: DocumentVisibilityState) {
      runtimeDocument.visibilityState = state
      const event = { type: 'visibilitychange' } as Event

      for (const listener of [...documentListeners.visibilitychange]) {
        if (typeof listener === 'function') {
          listener(event)
        } else {
          listener.handleEvent(event)
        }
      }
    },
    setScreenAngle(angle: number) {
      runtime.screen = {
        orientation: {
          angle,
        },
      }
      runtime.orientation = angle
    },
  }
}
