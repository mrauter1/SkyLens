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
              alpha: 0.75,
              radius: 1.5,
            },
            {
              id: 'warm-star',
              x: 96,
              y: 102,
              bMinusV: 0.95,
              alpha: 0.32,
              radius: 1.6,
            },
          ]}
        />,
      )
    })

    expect(fillCalls).toHaveLength(2)
    expect(gradientCalls).toHaveLength(0)
    expect(fillCalls[0]?.x).toBe(120)
    expect(fillCalls[0]?.y).toBe(118)
    expect(fillCalls[0]?.radius).toBe(1.5)
    expect(fillCalls[0]?.alpha).toBe(0.75)
    expect(fillCalls[0]?.fillStyle).toBe('rgba(192, 228, 255, 0.9)')
    expect(fillCalls[1]?.x).toBe(96)
    expect(fillCalls[1]?.y).toBe(102)
    expect(fillCalls[1]?.radius).toBe(1.6)
    expect(fillCalls[1]?.alpha).toBe(0.32)
    expect(fillCalls[1]?.fillStyle).toBe('rgba(255, 222, 186, 0.88)')
  })

  it('clamps supplied radii into broad finite-safe bounds', async () => {
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
              alpha: 1,
              radius: 99,
            },
          ]}
        />,
      )
    })

    expect(fillCalls).toHaveLength(1)
    expect(gradientCalls).toHaveLength(0)
    expect(fillCalls[0].radius).toBe(6.2)
    expect(fillCalls[0].alpha).toBe(1)
  })

  it('falls back to a 1px core radius for invalid radius inputs without adding halos', async () => {
    await act(async () => {
      root.render(
        <ScopeStarCanvas
          diameterPx={180}
          stars={[
            {
              id: 'fallback-radius-star',
              x: 72,
              y: 84,
              bMinusV: 0.2,
              alpha: 0.45,
              radius: Number.NaN,
            },
          ]}
        />,
      )
    })

    expect(fillCalls).toHaveLength(1)
    expect(gradientCalls).toHaveLength(0)
    expect(fillCalls[0]).toMatchObject({
      x: 72,
      y: 84,
      radius: 1,
      alpha: 0.45,
      fillStyle: 'rgba(226, 242, 255, 0.92)',
    })
  })

  it('clamps undersized radii to the broad finite-safe lower bound without adding halos', async () => {
    await act(async () => {
      root.render(
        <ScopeStarCanvas
          diameterPx={180}
          stars={[
            {
              id: 'undersized-radius-star',
              x: 68,
              y: 92,
              bMinusV: 0.6,
              alpha: 0.55,
              radius: -4,
            },
          ]}
        />,
      )
    })

    expect(fillCalls).toHaveLength(1)
    expect(gradientCalls).toHaveLength(0)
    expect(fillCalls[0]).toMatchObject({
      x: 68,
      y: 92,
      radius: 0.8,
      alpha: 0.55,
      fillStyle: 'rgba(255, 243, 214, 0.9)',
    })
  })

  it('renders a single core fill pass from explicit radius and alpha', async () => {
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
              alpha: 0.5,
              radius: 1.1,
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
      radius: 1.1,
      alpha: 0.5,
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
              alpha: 99,
              radius: 1.8,
            },
            {
              id: 'fallback-star',
              x: 120,
              y: 90,
              bMinusV: 0.1,
              alpha: Number.NaN,
              radius: 1.8,
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
      radius: 1.8,
      alpha: 1,
      fillStyle: 'rgba(226, 242, 255, 0.92)',
    })
    expect(fillCalls[1]).toMatchObject({
      x: 120,
      y: 90,
      radius: 1.8,
      alpha: 0,
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
              alpha: 0.3,
              radius: 1,
            },
            {
              id: 'neutral-star',
              x: 64,
              y: 44,
              bMinusV: 0.2,
              alpha: 0.3,
              radius: 1,
            },
            {
              id: 'warm-star',
              x: 88,
              y: 44,
              bMinusV: 0.6,
              alpha: 0.3,
              radius: 1,
            },
            {
              id: 'red-star',
              x: 112,
              y: 44,
              bMinusV: 1,
              alpha: 0.3,
              radius: 1,
            },
            {
              id: 'fallback-star',
              x: 136,
              y: 44,
              bMinusV: Number.NaN,
              alpha: 0.3,
              radius: 1,
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
