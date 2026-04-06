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

  it('draws gradient halos with compact radii while preserving B-V color semantics', async () => {
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

    expect(fillCalls).toHaveLength(4)
    expect(gradientCalls).toHaveLength(2)

    const blueHaloFill = gradientCalls[0]
    const blueCoreFill = fillCalls[1].fillStyle
    const warmHaloFill = gradientCalls[1]
    const warmCoreFill = fillCalls[3].fillStyle

    expect(blueHaloFill).toMatchObject({
      x0: 120,
      y0: 118,
      r0: 0,
      x1: 120,
      y1: 118,
    })
    expect(blueHaloFill.r1).toBeCloseTo(3.3447272727272725)
    expect(fillCalls[0].radius).toBeCloseTo(3.3447272727272725)
    expect(fillCalls[1].radius).toBeCloseTo(1.1945454545454544)
    expect(blueCoreFill).toBe('rgba(192, 228, 255, 0.9)')

    expect(blueHaloFill.colorStops).toEqual([
      {
        offset: 0,
        color: 'rgba(192, 228, 255, 0.33999999999999997)',
      },
      {
        offset: 1,
        color: 'rgba(192, 228, 255, 0)',
      },
    ])
    expect(extractAlpha(blueHaloFill.colorStops[0].color)).toBeGreaterThan(
      extractAlpha(blueHaloFill.colorStops[1].color),
    )
    expect(extractAlpha(blueHaloFill.colorStops[0].color)).toBeLessThan(fillCalls[1].alpha)

    expect(warmHaloFill).toMatchObject({
      x0: 96,
      y0: 102,
      r0: 0,
      x1: 96,
      y1: 102,
    })
    expect(warmHaloFill.r1).toBeCloseTo(2.2298181818181817)
    expect(fillCalls[2].radius).toBeCloseTo(2.2298181818181817)
    expect(fillCalls[3].radius).toBeCloseTo(1.2741818181818183)
    expect(warmCoreFill).toBe('rgba(255, 222, 186, 0.88)')
    expect(extractAlpha(warmHaloFill.colorStops[0].color)).toBeLessThan(fillCalls[3].alpha)
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

    expect(fillCalls).toHaveLength(2)
    expect(fillCalls[0].radius).toBe(3.6)
    expect(fillCalls[1].radius).toBe(2.2)
  })

  it('disables halo rendering when the compressed core radius stays below threshold', async () => {
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

  it('falls back to a deterministic solid halo when gradient creation fails', async () => {
    throwOnGradientCreation = true

    await act(async () => {
      root.render(
        <ScopeStarCanvas
          diameterPx={280}
          stars={[
            {
              id: 'fallback-star',
              x: 88,
              y: 90,
              bMinusV: 0.1,
              intensity: 0.5,
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
      radius: 3.050181818181818,
      alpha: 1,
      fillStyle: 'rgba(226, 242, 255, 0.26)',
    })
    expect(fillCalls[1]).toMatchObject({
      x: 88,
      y: 90,
      radius: 1.525090909090909,
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

function extractAlpha(color: string) {
  const match = color.match(/,\s*([\d.]+)\s*\)$/)

  return match ? Number(match[1]) : Number.NaN
}
