'use client'

import { useEffect, useRef, type CSSProperties } from 'react'

import { getStarColorFromBMinusV } from '../../lib/viewer/star-colors'

export type StarPointCanvasPoint = {
  id: string
  x: number
  y: number
  bMinusV: number
  alpha: number
  radius: number
}

type StarPointCanvasProps = {
  widthPx: number
  heightPx: number
  points: StarPointCanvasPoint[]
  testId: string
  className?: string
  style?: CSSProperties
}

const CORE_RADIUS_MIN_PX = 0.8
const CORE_RADIUS_MAX_PX = 6.2
const MAX_CANVAS_DEVICE_PIXEL_RATIO = 2
const DENSE_STAR_POINT_THRESHOLD = 2_000
const VERY_DENSE_STAR_POINT_THRESHOLD = 8_000

export function StarPointCanvas({
  widthPx,
  heightPx,
  points,
  testId,
  className,
  style,
}: StarPointCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')

    if (!context) {
      return
    }

    const devicePixelRatio = resolveStarCanvasPixelRatio(
      typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
      points.length,
    )
    const backingWidthPx = Math.round(widthPx * devicePixelRatio)
    const backingHeightPx = Math.round(heightPx * devicePixelRatio)

    if (canvas.width !== backingWidthPx || canvas.height !== backingHeightPx) {
      canvas.width = backingWidthPx
      canvas.height = backingHeightPx
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    }

    context.clearRect(0, 0, Math.ceil(widthPx), Math.ceil(heightPx))

    for (const point of points) {
      context.beginPath()
      context.fillStyle = getStarColorFromBMinusV(point.bMinusV)
      context.globalAlpha = normalizeStarPointAlpha(point.alpha, 0)
      context.arc(point.x, point.y, normalizeStarPointRadiusPx(point.radius, 1), 0, Math.PI * 2)
      context.fill()
    }

    context.globalAlpha = 1
  }, [heightPx, points, widthPx])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      data-testid={testId}
      style={{
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        ...style,
      }}
    />
  )
}

export function resolveStarCanvasPixelRatio(
  devicePixelRatio: number,
  pointCount: number,
) {
  const safeDevicePixelRatio = Number.isFinite(devicePixelRatio)
    ? Math.max(1, devicePixelRatio)
    : 1

  if (pointCount >= VERY_DENSE_STAR_POINT_THRESHOLD) {
    return 1
  }
  if (pointCount >= DENSE_STAR_POINT_THRESHOLD) {
    return Math.min(safeDevicePixelRatio, 1.5)
  }
  return Math.min(safeDevicePixelRatio, MAX_CANVAS_DEVICE_PIXEL_RATIO)
}

function normalizeStarPointRadiusPx(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.min(Math.max(value, CORE_RADIUS_MIN_PX), CORE_RADIUS_MAX_PX)
}

function normalizeStarPointAlpha(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.min(Math.max(value, 0), 1)
}
