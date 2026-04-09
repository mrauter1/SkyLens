'use client'

import { StarPointCanvas, type StarPointCanvasPoint } from './star-point-canvas'

export type ScopeStarCanvasPoint = StarPointCanvasPoint

type ScopeStarCanvasProps = {
  diameterPx: number
  stars: ScopeStarCanvasPoint[]
}

export function ScopeStarCanvas({
  diameterPx,
  stars,
}: ScopeStarCanvasProps) {
  return (
    <StarPointCanvas
      widthPx={diameterPx}
      heightPx={diameterPx}
      points={stars}
      testId="scope-star-canvas"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}
