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
const HALO_RADIUS_MIN_PX = 1.4
const HALO_RADIUS_MAX_PX = 3.6
const HALO_ENABLE_CORE_RADIUS_THRESHOLD_PX = 1.15

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
      const haloRadiusPx = compressRadius(
        normalizeScopeStarRadiusPx(star.haloPx, 2.1),
        compressionFactor,
        HALO_RADIUS_MIN_PX,
        HALO_RADIUS_MAX_PX,
      )
      const coreRadiusPx = compressRadius(
        normalizeScopeStarRadiusPx(star.corePx, 1),
        compressionFactor,
        CORE_RADIUS_MIN_PX,
        CORE_RADIUS_MAX_PX,
      )
      const haloOpacity = getScopeStarHaloOpacity(star.intensity)
      const coreOpacity = getScopeStarCoreOpacity(star.intensity)
      const color = getScopeStarColor(star.bMinusV)

      if (coreRadiusPx >= HALO_ENABLE_CORE_RADIUS_THRESHOLD_PX) {
        context.beginPath()
        context.globalAlpha = 1
        context.fillStyle = getScopeStarHaloFill(context, star.x, star.y, haloRadiusPx, color, haloOpacity)
        context.arc(star.x, star.y, haloRadiusPx, 0, Math.PI * 2)
        context.fill()
      }

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

function getScopeStarHaloOpacity(intensity: number) {
  if (!Number.isFinite(intensity)) {
    return 0.2
  }

  return Math.min(Math.max(0.1 + intensity * 0.32, 0.1), 0.42)
}

function getScopeStarCoreOpacity(intensity: number) {
  if (!Number.isFinite(intensity)) {
    return 0.65
  }

  return Math.min(Math.max(0.32 + intensity * 0.68, 0.32), 0.98)
}

function getScopeStarHaloFill(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusPx: number,
  color: string,
  alpha: number,
) {
  const centerColor = withScopeStarAlpha(color, alpha)
  const edgeColor = withScopeStarAlpha(color, 0)

  if (typeof context.createRadialGradient !== 'function') {
    return centerColor
  }

  try {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radiusPx)
    gradient.addColorStop(0, centerColor)
    gradient.addColorStop(1, edgeColor)
    return gradient
  } catch {
    return centerColor
  }
}

function withScopeStarAlpha(color: string, alpha: number) {
  const rgbaMatch = color.match(
    /^rgba\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*[\d.]+\s*\)$/i,
  )

  if (!rgbaMatch) {
    return color
  }

  const [, red, green, blue] = rgbaMatch
  const clampedAlpha = Math.min(Math.max(alpha, 0), 1)

  return `rgba(${red}, ${green}, ${blue}, ${clampedAlpha})`
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
