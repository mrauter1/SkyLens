'use client'

import { useEffect, useRef } from 'react'

export type ScopeStarCanvasPoint = {
  id: string
  x: number
  y: number
  bMinusV: number
  intensity: number
  corePx: number
  haloPx: number
}

type ScopeStarCanvasProps = {
  diameterPx: number
  stars: ScopeStarCanvasPoint[]
}

const MIN_LENS_COMPRESSION_FACTOR = 0.72
const MAX_LENS_COMPRESSION_FACTOR = 1
const MIN_LENS_DIAMETER_PX = 180
const MAX_LENS_DIAMETER_PX = 400
const CORE_RADIUS_MIN_PX = 0.9
const CORE_RADIUS_MAX_PX = 2.2
const CORE_ALPHA_MIN = 0.32
const CORE_ALPHA_MAX = 0.98

export function ScopeStarCanvas({
  diameterPx,
  stars,
}: ScopeStarCanvasProps) {
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

    const devicePixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
    canvas.width = Math.round(diameterPx * devicePixelRatio)
    canvas.height = Math.round(diameterPx * devicePixelRatio)
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    context.clearRect(0, 0, diameterPx, diameterPx)
    const compressionFactor = getLensCompressionFactor(diameterPx)

    for (const star of stars) {
      const coreRadiusPx = compressRadius(
        normalizeScopeStarRadiusPx(star.corePx, 1),
        compressionFactor,
        CORE_RADIUS_MIN_PX,
        CORE_RADIUS_MAX_PX,
      )
      const coreOpacity = getScopeStarCoreAlpha(star.intensity)
      const color = getScopeStarColor(star.bMinusV)

      context.beginPath()
      context.fillStyle = color
      context.globalAlpha = coreOpacity
      context.arc(star.x, star.y, coreRadiusPx, 0, Math.PI * 2)
      context.fill()
    }

    context.globalAlpha = 1
  }, [diameterPx, stars])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      data-testid="scope-star-canvas"
      style={{
        width: `${diameterPx}px`,
        height: `${diameterPx}px`,
      }}
    />
  )
}

function normalizeScopeStarRadiusPx(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.min(Math.max(value, 0.8), 6.2)
}

function getLensCompressionFactor(diameterPx: number) {
  const safeDiameterPx = Number.isFinite(diameterPx) ? diameterPx : 240
  const diameterRangePx = MAX_LENS_DIAMETER_PX - MIN_LENS_DIAMETER_PX

  if (diameterRangePx <= 0) {
    return MIN_LENS_COMPRESSION_FACTOR
  }

  const normalizedDiameter =
    (safeDiameterPx - MIN_LENS_DIAMETER_PX) / diameterRangePx
  const unclampedFactor =
    MIN_LENS_COMPRESSION_FACTOR +
    normalizedDiameter * (MAX_LENS_COMPRESSION_FACTOR - MIN_LENS_COMPRESSION_FACTOR)

  return Math.min(Math.max(unclampedFactor, MIN_LENS_COMPRESSION_FACTOR), MAX_LENS_COMPRESSION_FACTOR)
}

function compressRadius(radiusPx: number, compressionFactor: number, min: number, max: number) {
  const safeRadiusPx = Number.isFinite(radiusPx) ? radiusPx : min
  const safeCompressionFactor = Number.isFinite(compressionFactor)
    ? compressionFactor
    : MIN_LENS_COMPRESSION_FACTOR

  return Math.min(Math.max(safeRadiusPx * safeCompressionFactor, min), max)
}

function getScopeStarCoreAlpha(intensity: number) {
  if (!Number.isFinite(intensity)) {
    return 0.65
  }

  return Math.min(Math.max(CORE_ALPHA_MIN + intensity * 0.68, CORE_ALPHA_MIN), CORE_ALPHA_MAX)
}

function getScopeStarColor(bMinusV: number) {
  if (!Number.isFinite(bMinusV)) {
    return 'rgba(225, 244, 255, 0.88)'
  }

  if (bMinusV <= -0.1) {
    return 'rgba(192, 228, 255, 0.9)'
  }

  if (bMinusV <= 0.35) {
    return 'rgba(226, 242, 255, 0.92)'
  }

  if (bMinusV <= 0.8) {
    return 'rgba(255, 243, 214, 0.9)'
  }

  return 'rgba(255, 222, 186, 0.88)'
}
