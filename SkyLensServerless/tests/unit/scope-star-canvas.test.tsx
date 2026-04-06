import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { ScopeStarCanvas } from '../../components/viewer/scope-star-canvas'

type CanvasGradientCall = {
  x0: number
  y0: number
  r0: number
  x1: number
  y1: number
  r1: number
  colorStops: Array<{
    offset: number
    color: string
  }>
}

type CanvasFillCall = {
  x: number
  y: number
  radius: number
  alpha: number
  fillStyle: string | CanvasGradientCall
}

describe('ScopeStarCanvas', () => {
  let container: HTMLDivElement
  let root: Root
  let fillCalls: CanvasFillCall[]
  let gradientCalls: CanvasGradientCall[]
  let throwOnGradientCreation: boolean

  beforeAll(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true
  })

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    fillCalls = []
    gradientCalls = []
    throwOnGradientCreation = false
    stubCanvasContext(fillCalls, gradientCalls, () => throwOnGradientCreation)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('draws one compact core per star while preserving B-V color semantics', async () => {
    await act(async () => {
      root.render(
        <ScopeStarCanvas
          diameterPx={240}
          stars={[
            {
              id: 'blue-star',
              x: 120,
              y: 118,
              bMinusV: -0.2,
              intensity: 0.75,
              corePx: 1.5,
              haloPx: 4.2,
            },
            {
              id: 'warm-star',
              x: 96,
              y: 102,
              bMinusV: 0.95,
              intensity: 0.32,
              corePx: 1.6,
              haloPx: 2.8,
            },
          ]}
        />,
      )
    })

    expect(fillCalls).toHaveLength(2)
    expect(gradientCalls).toHaveLength(0)
    expect(fillCalls[0]?.x).toBe(120)
    expect(fillCalls[0]?.y).toBe(118)
    expect(fillCalls[0]?.radius).toBeCloseTo(1.1945454545454544)
    expect(fillCalls[0]?.alpha).toBeCloseTo(0.8300000000000001)
    expect(fillCalls[0]?.fillStyle).toBe('rgba(192, 228, 255, 0.9)')
    expect(fillCalls[1]?.x).toBe(96)
    expect(fillCalls[1]?.y).toBe(102)
    expect(fillCalls[1]?.radius).toBeCloseTo(1.2741818181818183)
    expect(fillCalls[1]?.alpha).toBeCloseTo(0.5376000000000001)
    expect(fillCalls[1]?.fillStyle).toBe('rgba(255, 222, 186, 0.88)')
  })

  it('compresses and clamps radii into compact envelopes', async () => {
    await act(async () => {
      root.render(
        <ScopeStarCanvas
          diameterPx={180}
          stars={[
            {
              id: 'compact-star',
              x: 80,
              y: 76,
              bMinusV: 0.2,
              intensity: 1,
              corePx: 99,
              haloPx: 99,
            },
          ]}
        />,
      )
    })

    expect(fillCalls).toHaveLength(1)
    expect(gradientCalls).toHaveLength(0)
    expect(fillCalls[0].radius).toBe(2.2)
    expect(fillCalls[0].alpha).toBe(0.98)
  })

  it('ignores halo payload values and still renders a single fill pass', async () => {
    await act(async () => {
      root.render(
        <ScopeStarCanvas
          diameterPx={240}
          stars={[
            {
              id: 'tiny-star',
              x: 70,
              y: 64,
              bMinusV: 0.4,
              intensity: 0.5,
              corePx: 1.1,
              haloPx: 3.5,
            },
          ]}
        />,
      )
    })

    expect(gradientCalls).toHaveLength(0)
    expect(fillCalls).toHaveLength(1)
    expect(fillCalls[0]).toMatchObject({
      x: 70,
      y: 64,
      radius: 0.9,
      fillStyle: 'rgba(255, 243, 214, 0.9)',
    })
  })

  it('clamps core alpha deterministically without a halo path', async () => {
    await act(async () => {
      root.render(
        <ScopeStarCanvas
          diameterPx={280}
          stars={[
            {
              id: 'bright-star',
              x: 88,
              y: 90,
              bMinusV: 0.1,
              intensity: 99,
              corePx: 1.8,
              haloPx: 3.6,
            },
            {
              id: 'fallback-star',
              x: 120,
              y: 90,
              bMinusV: 0.1,
              intensity: Number.NaN,
              corePx: 1.8,
              haloPx: 3.6,
            },
          ]}
        />,
      )
    })

    expect(gradientCalls).toHaveLength(0)
    expect(fillCalls).toHaveLength(2)
    expect(fillCalls[0]).toMatchObject({
      x: 88,
      y: 90,
      radius: 1.525090909090909,
      alpha: 0.98,
      fillStyle: 'rgba(226, 242, 255, 0.92)',
    })
    expect(fillCalls[1]).toMatchObject({
      x: 120,
      y: 90,
      radius: 1.525090909090909,
      alpha: 0.65,
      fillStyle: 'rgba(226, 242, 255, 0.92)',
    })
  })

  it('keeps B-V color mapping unchanged across the existing ranges', async () => {
    await act(async () => {
      root.render(
        <ScopeStarCanvas
          diameterPx={240}
          stars={[
            {
              id: 'blue-star',
              x: 40,
              y: 44,
              bMinusV: -0.2,
              intensity: 0.3,
              corePx: 1,
              haloPx: 1,
            },
            {
              id: 'neutral-star',
              x: 64,
              y: 44,
              bMinusV: 0.2,
              intensity: 0.3,
              corePx: 1,
              haloPx: 1,
            },
            {
              id: 'warm-star',
              x: 88,
              y: 44,
              bMinusV: 0.6,
              intensity: 0.3,
              corePx: 1,
              haloPx: 1,
            },
            {
              id: 'red-star',
              x: 112,
              y: 44,
              bMinusV: 1,
              intensity: 0.3,
              corePx: 1,
              haloPx: 1,
            },
            {
              id: 'fallback-star',
              x: 136,
              y: 44,
              bMinusV: Number.NaN,
              intensity: 0.3,
              corePx: 1,
              haloPx: 1,
            },
          ]}
        />,
      )
    })

    expect(gradientCalls).toHaveLength(0)
    expect(fillCalls).toHaveLength(5)
    expect(fillCalls.map((call) => call.fillStyle)).toEqual([
      'rgba(192, 228, 255, 0.9)',
      'rgba(226, 242, 255, 0.92)',
      'rgba(255, 243, 214, 0.9)',
      'rgba(255, 222, 186, 0.88)',
      'rgba(225, 244, 255, 0.88)',
    ])
  })
})

function stubCanvasContext(
  fillCalls: CanvasFillCall[],
  gradientCalls: CanvasGradientCall[],
  shouldThrowOnGradientCreation: () => boolean,
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
      gradientCalls.length = 0
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
    setTransform: () => undefined,
    createRadialGradient: (
      x0: number,
      y0: number,
      r0: number,
      x1: number,
      y1: number,
      r1: number,
    ) => {
      if (shouldThrowOnGradientCreation()) {
        throw new Error('gradient unavailable')
      }

      const gradient: CanvasGradientCall = {
        x0,
        y0,
        r0,
        x1,
        y1,
        r1,
        colorStops: [],
      }

      gradientCalls.push(gradient)

      return {
        addColorStop: (offset: number, color: string) => {
          gradient.colorStops.push({ offset, color })
        },
      }
    },
    globalAlpha: 1,
    fillStyle: '' as string | CanvasGradientCall,
  }

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => context,
  })
}
