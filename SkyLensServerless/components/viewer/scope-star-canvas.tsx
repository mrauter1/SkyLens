'use client'

import { useEffect, useRef } from 'react'

export type ScopeStarCanvasPoint = {
  id: string
  x: number
  y: number
  bMinusV: number
  alpha: number
  radius: number
}

type ScopeStarCanvasProps = {
  diameterPx: number
  stars: ScopeStarCanvasPoint[]
}

const CORE_RADIUS_MIN_PX = 0.8
const CORE_RADIUS_MAX_PX = 6.2

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

    for (const star of stars) {
      const coreRadiusPx = normalizeScopeStarRadiusPx(star.radius, 1)
      const coreOpacity = normalizeScopeStarAlpha(star.alpha, 0)
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

  return Math.min(Math.max(value, CORE_RADIUS_MIN_PX), CORE_RADIUS_MAX_PX)
}

function normalizeScopeStarAlpha(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.min(Math.max(value, 0), 1)
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
