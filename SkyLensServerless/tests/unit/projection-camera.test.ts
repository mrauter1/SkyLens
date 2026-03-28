import { describe, expect, it, vi } from 'vitest'

import {
  createCameraFrameLayout,
  createCameraQuaternion,
  createQuaternionFromBasis,
  getCameraBasisVectors,
  getEffectiveVerticalFovDeg,
  getHorizontalFovDeg,
  getRearCameraConstraintCandidates,
  mapImagePointToViewport,
  multiplyMat3Vec3,
  negateVec3,
  normalizeQuaternion,
  pickCenterLockedCandidate,
  projectWorldPointToImagePlane,
  projectWorldPointToScreen,
  requestRearCameraStream,
} from '../../lib/projection/camera'

describe('projection camera foundation', () => {
  it('supports a wider fov calibration range', () => {
    expect(getEffectiveVerticalFovDeg(-40)).toBe(20)
    expect(getEffectiveVerticalFovDeg(0)).toBe(50)
    expect(getEffectiveVerticalFovDeg(60)).toBe(100)
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

  it('exposes an orthonormal camera basis from the quaternion helpers', () => {
    const basis = getCameraBasisVectors(createCameraQuaternion(32, 18, -12))

    expect(Math.hypot(...basis.right)).toBeCloseTo(1, 6)
    expect(Math.hypot(...basis.down)).toBeCloseTo(1, 6)
    expect(Math.hypot(...basis.forward)).toBeCloseTo(1, 6)
    expect(
      basis.right[0] * basis.down[0] +
        basis.right[1] * basis.down[1] +
        basis.right[2] * basis.down[2],
    ).toBeCloseTo(0, 6)
    expect(
      basis.right[0] * basis.forward[0] +
        basis.right[1] * basis.forward[1] +
        basis.right[2] * basis.forward[2],
    ).toBeCloseTo(0, 6)
    expect(
      basis.down[0] * basis.forward[0] +
        basis.down[1] * basis.forward[1] +
        basis.down[2] * basis.forward[2],
    ).toBeCloseTo(0, 6)
  })

  it('rebuilds the same manual quaternion from exported basis helpers', () => {
    const quaternion = createCameraQuaternion(32, 18, -12)
    const basis = getCameraBasisVectors(quaternion)
    const rebuilt = normalizeQuaternion(
      createQuaternionFromBasis(basis.right, basis.down, basis.forward),
    )
    const normalizedQuaternion = normalizeQuaternion(quaternion)
    const alignment =
      rebuilt[0] * normalizedQuaternion[0] +
      rebuilt[1] * normalizedQuaternion[1] +
      rebuilt[2] * normalizedQuaternion[2] +
      rebuilt[3] * normalizedQuaternion[3]

    expect(Math.abs(alignment)).toBeCloseTo(1, 6)
  })

  it('exports matrix helpers for the upcoming orientation pipeline', () => {
    expect(
      multiplyMat3Vec3(
        [
          [1, 2, 3],
          [0, -1, 4],
          [2, 0, 1],
        ],
        [2, -1, 3],
      ),
    ).toEqual([9, 13, 7])
    expect(negateVec3([2, -1, 3])).toEqual([-2, 1, -3])
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

  it('maps image-plane points through object-fit cover cropping', () => {
    const layout = createCameraFrameLayout({
      width: 400,
      height: 800,
      sourceWidth: 1600,
      sourceHeight: 900,
    })

    expect(layout.scale).toBeCloseTo(8 / 9, 6)
    expect(layout.cropX).toBeCloseTo(511.111111, 6)
    expect(layout.cropY).toBeCloseTo(0, 6)
    const mapped = mapImagePointToViewport(
      {
        visible: true,
        imageX: 1200,
        imageY: 450,
      },
      layout,
    )

    expect(mapped.visible).toBe(false)
    expect(mapped.inViewport).toBe(false)
    expect(mapped.inOverscan).toBe(false)
    expect(mapped.x).toBeCloseTo(555.555556, 6)
    expect(mapped.y).toBeCloseTo(400, 6)
  })

  it('defaults source dimensions to the viewport for legacy callers', () => {
    const quaternion = createCameraQuaternion(18, 6, 0)
    const implicitLayout = createCameraFrameLayout({
      width: 390,
      height: 844,
    })
    const implicitProjection = projectWorldPointToScreen(
      { quaternion },
      { azimuthDeg: 20, elevationDeg: 6 },
      { width: 390, height: 844 },
    )
    const explicitProjection = projectWorldPointToScreen(
      { quaternion },
      { azimuthDeg: 20, elevationDeg: 6 },
      {
        width: 390,
        height: 844,
        sourceWidth: 390,
        sourceHeight: 844,
      },
    )

    expect(implicitLayout).toMatchObject({
      sourceWidth: 390,
      sourceHeight: 844,
      viewportWidth: 390,
      viewportHeight: 844,
      scale: 1,
      cropX: 0,
      cropY: 0,
    })
    expect(implicitProjection).toEqual(explicitProjection)
  })

  it('preserves overscan visibility when cover cropping pushes a point just outside the viewport', () => {
    const layout = createCameraFrameLayout({
      width: 400,
      height: 800,
      sourceWidth: 1600,
      sourceHeight: 900,
    })
    const mapped = mapImagePointToViewport(
      {
        visible: true,
        imageX: 552.5,
        imageY: 450,
      },
      layout,
    )

    expect(mapped.visible).toBe(true)
    expect(mapped.inViewport).toBe(false)
    expect(mapped.inOverscan).toBe(true)
    expect(mapped.x).toBeCloseTo(-20, 6)
    expect(mapped.y).toBeCloseTo(400, 6)
  })

  it('projects screen points using source-frame dimensions under cover cropping', () => {
    const quaternion = createCameraQuaternion(0, 0, 0)
    const coverViewport = {
      width: 400,
      height: 800,
      sourceWidth: 1600,
      sourceHeight: 900,
    }

    const centeredProjection = projectWorldPointToScreen(
      { quaternion },
      { azimuthDeg: 0, elevationDeg: 0 },
      coverViewport,
    )
    const eastProjection = projectWorldPointToScreen(
      { quaternion },
      { azimuthDeg: 10, elevationDeg: 0 },
      coverViewport,
    )
    const imageProjection = projectWorldPointToImagePlane(
      { quaternion },
      { azimuthDeg: 10, elevationDeg: 0 },
      {
        sourceWidth: 1600,
        sourceHeight: 900,
      },
    )
    const expectedCoverX = imageProjection.imageX * (8 / 9) - 511.1111111111111
    const expectedCoverY = imageProjection.imageY * (8 / 9)

    expect(centeredProjection.inViewport).toBe(true)
    expect(centeredProjection.x).toBeCloseTo(200, 3)
    expect(centeredProjection.y).toBeCloseTo(400, 3)
    expect(imageProjection.imageX).toBeGreaterThan(800)
    expect(imageProjection.imageY).toBeCloseTo(450, 3)
    expect(eastProjection.visible).toBe(true)
    expect(eastProjection.inViewport).toBe(true)
    expect(eastProjection.x).toBeCloseTo(expectedCoverX, 6)
    expect(eastProjection.y).toBeCloseTo(expectedCoverY, 6)
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
