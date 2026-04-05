'use client'

import { useEffect, useRef } from 'react'

export type ScopeStarCanvasPoint = {
  id: string
  x: number
  y: number
  vMag: number
  bMinusV: number
}

type ScopeStarCanvasProps = {
  diameterPx: number
  stars: ScopeStarCanvasPoint[]
}

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
      const radiusPx = getScopeStarRadiusPx(star.vMag)
      context.beginPath()
      context.fillStyle = getScopeStarColor(star.bMinusV)
      context.globalAlpha = getScopeStarOpacity(star.vMag)
      context.arc(star.x, star.y, radiusPx, 0, Math.PI * 2)
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

function getScopeStarRadiusPx(vMag: number) {
  if (!Number.isFinite(vMag)) {
    return 1
  }

  if (vMag <= 2) {
    return 2.4
  }

  if (vMag <= 4) {
    return 2
  }

  if (vMag <= 6.5) {
    return 1.7
  }

  if (vMag <= 8.5) {
    return 1.35
  }

  return 1.05
}

function getScopeStarOpacity(vMag: number) {
  if (!Number.isFinite(vMag)) {
    return 0.7
  }

  return Math.min(Math.max(1.08 - vMag / 16, 0.32), 0.95)
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
