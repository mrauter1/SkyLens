'use client'

import { StarPointCanvas, type StarPointCanvasPoint } from './star-point-canvas'

export type MainStarCanvasPoint = StarPointCanvasPoint

type MainStarCanvasProps = {
  widthPx: number
  heightPx: number
  stars: MainStarCanvasPoint[]
}

export function MainStarCanvas({
  widthPx,
  heightPx,
  stars,
}: MainStarCanvasProps) {
  return (
    <StarPointCanvas
      widthPx={widthPx}
      heightPx={heightPx}
      points={stars}
      testId="main-star-canvas"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}
