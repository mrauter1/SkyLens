import { describe, expect, it, vi } from 'vitest'

import {
  createCameraQuaternion,
  getEffectiveVerticalFovDeg,
  getHorizontalFovDeg,
  getRearCameraConstraintCandidates,
  normalizeQuaternion,
  pickCenterLockedCandidate,
  projectWorldPointToScreen,
  requestRearCameraStream,
} from '../../lib/projection/camera'

describe('projection camera foundation', () => {
  it('uses the locked fixed-fov model', () => {
    expect(getEffectiveVerticalFovDeg(-20)).toBe(40)
    expect(getEffectiveVerticalFovDeg(0)).toBe(50)
    expect(getEffectiveVerticalFovDeg(20)).toBe(60)
    expect(getHorizontalFovDeg(50, 16 / 9)).toBeCloseTo(79.32, 2)
  })

  it('requests rear camera constraints without microphone access', () => {
    const [exactEnvironment, environmentFallback] = getRearCameraConstraintCandidates()

    expect(exactEnvironment).toMatchObject({
      audio: false,
      video: {
        facingMode: { exact: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    })
    expect(environmentFallback).toMatchObject({
      audio: false,
      video: {
        facingMode: 'environment',
      },
    })
  })

  it('retries the environment fallback after an exact-environment rear camera failure', async () => {
    const firstStream = new Error('exact-environment-unavailable')
    const fallbackStream = { id: 'fallback-stream' } as MediaStream
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(firstStream)
      .mockResolvedValueOnce(fallbackStream)

    await expect(
      requestRearCameraStream({
        getUserMedia,
      }),
    ).resolves.toBe(fallbackStream)

    expect(getUserMedia).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        audio: false,
        video: expect.objectContaining({
          facingMode: { exact: 'environment' },
        }),
      }),
    )
    expect(getUserMedia).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        audio: false,
        video: expect.objectContaining({
          facingMode: 'environment',
        }),
      }),
    )
  })

  it('keeps a normalized quaternion and centers forward objects', () => {
    const quaternion = createCameraQuaternion(0, 0, 0)

    expect(Math.hypot(...normalizeQuaternion(quaternion))).toBeCloseTo(1, 6)

    const projection = projectWorldPointToScreen(
      { quaternion },
      { azimuthDeg: 0, elevationDeg: 0 },
      { width: 400, height: 800 },
    )

    expect(projection.visible).toBe(true)
    expect(projection.x).toBeCloseTo(200, 3)
    expect(projection.y).toBeCloseTo(400, 3)
    expect(projection.angularDistanceDeg).toBeCloseTo(0, 4)
  })

  it('moves eastward objects to the right and hides objects behind the camera', () => {
    const quaternion = createCameraQuaternion(0, 0, 0)

    const eastProjection = projectWorldPointToScreen(
      { quaternion },
      { azimuthDeg: 15, elevationDeg: 0 },
      { width: 400, height: 800 },
    )
    const southProjection = projectWorldPointToScreen(
      { quaternion },
      { azimuthDeg: 180, elevationDeg: 0 },
      { width: 400, height: 800 },
    )

    expect(eastProjection.visible).toBe(true)
    expect(eastProjection.x).toBeGreaterThan(200)
    expect(southProjection.visible).toBe(false)
  })

  it('keeps projection stable through zenith without flipping the right axis', () => {
    const viewport = { width: 400, height: 800 }

    for (const pitchDeg of [89, 90, 91]) {
      const quaternion = createCameraQuaternion(0, pitchDeg, 0)
      const centeredProjection = projectWorldPointToScreen(
        { quaternion },
        { azimuthDeg: 0, elevationDeg: pitchDeg },
        viewport,
      )
      const eastProjection = projectWorldPointToScreen(
        { quaternion },
        { azimuthDeg: 10, elevationDeg: 89 },
        viewport,
      )
      const westProjection = projectWorldPointToScreen(
        { quaternion },
        { azimuthDeg: 350, elevationDeg: 89 },
        viewport,
      )

      expect(centeredProjection.visible).toBe(true)
      expect(centeredProjection.x).toBeCloseTo(200, 3)
      expect(centeredProjection.y).toBeCloseTo(400, 3)
      expect(eastProjection.visible).toBe(true)
      expect(westProjection.visible).toBe(true)
      expect(Number.isFinite(eastProjection.x)).toBe(true)
      expect(Number.isFinite(westProjection.x)).toBe(true)
      expect(eastProjection.x).toBeGreaterThan(200)
      expect(westProjection.x).toBeLessThan(200)
    }
  })

  it('keeps projection stable through nadir without flipping the right axis', () => {
    const viewport = { width: 400, height: 800 }

    for (const pitchDeg of [-89, -90, -91]) {
      const quaternion = createCameraQuaternion(0, pitchDeg, 0)
      const centeredProjection = projectWorldPointToScreen(
        { quaternion },
        { azimuthDeg: 0, elevationDeg: pitchDeg },
        viewport,
      )
      const eastProjection = projectWorldPointToScreen(
        { quaternion },
        { azimuthDeg: 10, elevationDeg: -89 },
        viewport,
      )
      const westProjection = projectWorldPointToScreen(
        { quaternion },
        { azimuthDeg: 350, elevationDeg: -89 },
        viewport,
      )

      expect(centeredProjection.visible).toBe(true)
      expect(centeredProjection.x).toBeCloseTo(200, 3)
      expect(centeredProjection.y).toBeCloseTo(400, 3)
      expect(eastProjection.visible).toBe(true)
      expect(westProjection.visible).toBe(true)
      expect(Number.isFinite(eastProjection.x)).toBe(true)
      expect(Number.isFinite(westProjection.x)).toBe(true)
      expect(eastProjection.x).toBeGreaterThan(200)
      expect(westProjection.x).toBeLessThan(200)
    }
  })

  it('center-locks by angular distance within the fixed 4-degree radius', () => {
    const centered = pickCenterLockedCandidate([
      { id: 'closer-lower-rank', rankScore: 60, angularDistanceDeg: 1.2 },
      { id: 'wider-higher-rank', rankScore: 80, angularDistanceDeg: 3.6 },
      { id: 'outside-radius', rankScore: 99, angularDistanceDeg: 4.2 },
    ])

    expect(centered?.id).toBe('wider-higher-rank')
  })
})
