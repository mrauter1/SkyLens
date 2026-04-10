'use client'

import { useEffect, useRef } from 'react'

import { ScopeStarCanvas, type ScopeStarCanvasPoint } from './scope-star-canvas'

export type ScopeLensOverlayObject = {
  id: string
  x: number
  y: number
  sizePx: number
  opacity: number
  className: string
}

export type ScopeLensOverlayLineSegment = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}

type ScopeLensOverlayProps = {
  diameterPx: number
  lensVisualScale: number
  showGradientBackground: boolean
  cameraStream: MediaStream | null
  cameraStreamActive: boolean
  stars: ScopeStarCanvasPoint[]
  lineSegments: ScopeLensOverlayLineSegment[]
  objects: ScopeLensOverlayObject[]
}

export function ScopeLensOverlay({
  diameterPx,
  lensVisualScale,
  showGradientBackground,
  cameraStream,
  cameraStreamActive,
  stars,
  lineSegments,
  objects,
}: ScopeLensOverlayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const videoElement = videoRef.current

    if (!videoElement) {
      return
    }

    if (cameraStreamActive && cameraStream) {
      if (videoElement.srcObject !== cameraStream) {
        videoElement.srcObject = cameraStream
      }

      void videoElement.play().catch(() => {})
      return
    }

    if (videoElement.srcObject) {
      videoElement.srcObject = null
    }
  }, [cameraStream, cameraStreamActive])

  const backgroundScale = Math.max(lensVisualScale, 1).toFixed(3)

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      data-testid="scope-lens-overlay"
    >
      <div
        className="relative"
        data-testid="scope-lens-frame"
        style={{
          width: `${diameterPx}px`,
          height: `${diameterPx}px`,
        }}
      >
        <div
          className="pointer-events-auto absolute inset-0 overflow-hidden bg-slate-950/92"
          data-testid="scope-lens-hit-area"
          style={{
            clipPath: 'circle(50% at 50% 50%)',
          }}
        >
          {showGradientBackground ? (
            <div
              className="gradient-fallback absolute inset-0"
              style={{
                transform: `scale(${backgroundScale})`,
                transformOrigin: 'center',
              }}
            />
          ) : null}
          {cameraStreamActive ? (
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                transform: `scale(${backgroundScale})`,
                transformOrigin: 'center',
              }}
              autoPlay
              muted
              playsInline
              tabIndex={-1}
            />
          ) : null}
          <div
            className="sky-grid absolute inset-0 opacity-45"
            style={{
              transform: `scale(${backgroundScale})`,
              transformOrigin: 'center',
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_28%,rgba(255,255,255,0.14),transparent_26%),linear-gradient(180deg,rgba(2,6,23,0.06),rgba(2,6,23,0.3))]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_56%,rgba(2,6,23,0.1)_74%,rgba(2,6,23,0.4)_100%)]" />
          <ScopeStarCanvas
            diameterPx={diameterPx}
            stars={stars}
          />
          {lineSegments.length > 0 ? (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              data-testid="scope-constellation-svg"
            >
              {lineSegments.map((segment) => (
                <line
                  key={segment.id}
                  data-testid="scope-constellation-line"
                  data-segment-id={segment.id}
                  x1={segment.x1}
                  y1={segment.y1}
                  x2={segment.x2}
                  y2={segment.y2}
                  stroke="rgba(186, 230, 253, 0.42)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              ))}
            </svg>
          ) : null}
          {objects.map((object) => (
            <div
              key={object.id}
              className="pointer-events-none absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
              data-object-id={object.id}
              data-testid="scope-bright-object-marker"
              style={{
                left: `${object.x}px`,
                top: `${object.y}px`,
              }}
            >
              <span
                className={`block ${object.className}`}
                style={{
                  width: `${object.sizePx}px`,
                  height: `${object.sizePx}px`,
                  opacity: object.opacity,
                }}
              />
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 rounded-full border border-slate-100/45 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_18px_42px_rgba(2,6,23,0.44)]" />
        <div className="pointer-events-none absolute inset-[5px] rounded-full border border-white/8" />
        <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16),inset_0_0_22px_rgba(255,255,255,0.06),inset_0_-28px_42px_rgba(2,6,23,0.45)]" />
      </div>
    </div>
  )
}
