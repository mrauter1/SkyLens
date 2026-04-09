import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MainStarCanvas } from '../../components/viewer/main-star-canvas'

type CanvasFillCall = {
  x: number
  y: number
  radius: number
  alpha: number
  fillStyle: string | CanvasGradientCall
}

type CanvasGradientCall = {
  stops: Array<{
    offset: number
    color: string
  }>
}

describe('MainStarCanvas', () => {
  let container: HTMLDivElement
  let root: Root
  let fillCalls: CanvasFillCall[]
  let latestCanvasElement: HTMLCanvasElement | null

  beforeAll(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true
  })

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    fillCalls = []
    latestCanvasElement = null
    stubCanvasContext(fillCalls, (canvas) => {
      latestCanvasElement = canvas
    })
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('draws one compact core per star while preserving the shared B-V color mapping', async () => {
    await act(async () => {
      root.render(
        <MainStarCanvas
          widthPx={390}
          heightPx={844}
          stars={[
            {
              id: 'blue-star',
              x: 120,
              y: 220,
              bMinusV: -0.2,
              alpha: 0.75,
              radius: 1.5,
            },
            {
              id: 'warm-star',
              x: 180,
              y: 260,
              bMinusV: 0.95,
              alpha: 0.32,
              radius: 1.6,
            },
          ]}
        />,
      )
    })

    expect(container.querySelector('[data-testid="main-star-canvas"]')).not.toBeNull()
    expect(fillCalls).toEqual([
      {
        x: 120,
        y: 220,
        radius: 1.5,
        alpha: 0.75,
        fillStyle: 'rgba(192, 228, 255, 0.9)',
      },
      {
        x: 180,
        y: 260,
        radius: 1.6,
        alpha: 0.32,
        fillStyle: 'rgba(255, 222, 186, 0.88)',
      },
    ])
  })

  it('clamps invalid alpha and radius values using the same finite-safe bounds as scope mode', async () => {
    await act(async () => {
      root.render(
        <MainStarCanvas
          widthPx={390}
          heightPx={844}
          stars={[
            {
              id: 'oversized-star',
              x: 72,
              y: 84,
              bMinusV: 0.2,
              alpha: 99,
              radius: 99,
            },
            {
              id: 'fallback-star',
              x: 88,
              y: 96,
              bMinusV: Number.NaN,
              alpha: Number.NaN,
              radius: Number.NaN,
            },
          ]}
        />,
      )
    })

    expect(fillCalls).toHaveLength(2)
    expect(fillCalls[0]).toMatchObject({
      radius: 6.2,
      alpha: 1,
      fillStyle: 'rgba(226, 242, 255, 0.92)',
    })
    expect(fillCalls[1]).toMatchObject({
      radius: 1,
      alpha: 0,
      fillStyle: 'rgba(225, 244, 255, 0.88)',
    })
  })

  it('sizes the backing canvas with device-pixel-ratio scaling while keeping css size pinned to the viewport', async () => {
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: 2,
    })

    await act(async () => {
      root.render(
        <MainStarCanvas
          widthPx={390}
          heightPx={844}
          stars={[
            {
              id: 'star',
              x: 10,
              y: 12,
              bMinusV: 0,
              alpha: 0.5,
              radius: 1,
            },
          ]}
        />,
      )
    })

    const canvas = latestCanvasElement

    expect(canvas).not.toBeNull()
    expect(canvas?.width).toBe(780)
    expect(canvas?.height).toBe(1688)
    expect(canvas?.style.width).toBe('390px')
    expect(canvas?.style.height).toBe('844px')
  })
})

function stubCanvasContext(
  fillCalls: CanvasFillCall[],
  onContextRequested: (canvas: HTMLCanvasElement) => void,
) {
  let currentArc:
    | {
        x: number
        y: number
        radius: number
      }
    | null = null
  const context = {
    clearRect: () => {
      fillCalls.length = 0
      currentArc = null
    },
    beginPath: () => {
      currentArc = null
    },
    arc: (x: number, y: number, radius: number) => {
      currentArc = { x, y, radius }
    },
    fill: () => {
      if (!currentArc) {
        return
      }

      fillCalls.push({
        ...currentArc,
        alpha: context.globalAlpha,
        fillStyle: context.fillStyle,
      })
    },
    setTransform: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    globalAlpha: 1,
    fillStyle: '' as string | CanvasGradientCall,
  }

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: function getContext() {
      onContextRequested(this as HTMLCanvasElement)
      return context
    },
  })
}
