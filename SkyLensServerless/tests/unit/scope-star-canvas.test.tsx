import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { ScopeStarCanvas } from '../../components/viewer/scope-star-canvas'

type CanvasFillCall = {
  x: number
  y: number
  radius: number
  alpha: number
  fillStyle: string
}

describe('ScopeStarCanvas', () => {
  let container: HTMLDivElement
  let root: Root
  let fillCalls: CanvasFillCall[]

  beforeAll(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true
  })

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    fillCalls = []
    stubCanvasContext(fillCalls)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('draws profile-driven halo/core passes while preserving B-V color semantics', async () => {
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
              corePx: 1.4,
              haloPx: 4.2,
            },
            {
              id: 'warm-star',
              x: 96,
              y: 102,
              bMinusV: 0.95,
              intensity: 0.32,
              corePx: 1.1,
              haloPx: 2.8,
            },
          ]}
        />,
      )
    })

    expect(fillCalls).toHaveLength(4)

    expect(fillCalls[0]).toMatchObject({
      x: 120,
      y: 118,
      radius: 4.2,
      fillStyle: 'rgba(192, 228, 255, 0.9)',
    })
    expect(fillCalls[1]).toMatchObject({
      x: 120,
      y: 118,
      radius: 1.4,
      fillStyle: 'rgba(192, 228, 255, 0.9)',
    })
    expect(fillCalls[0].alpha).toBeLessThan(fillCalls[1].alpha)

    expect(fillCalls[2]).toMatchObject({
      x: 96,
      y: 102,
      radius: 2.8,
      fillStyle: 'rgba(255, 222, 186, 0.88)',
    })
    expect(fillCalls[3]).toMatchObject({
      x: 96,
      y: 102,
      radius: 1.1,
      fillStyle: 'rgba(255, 222, 186, 0.88)',
    })
    expect(fillCalls[2].alpha).toBeLessThan(fillCalls[3].alpha)
  })

  it('clamps malformed profile inputs to compact fallback draw values', async () => {
    await act(async () => {
      root.render(
        <ScopeStarCanvas
          diameterPx={180}
          stars={[
            {
              id: 'fallback-star',
              x: 80,
              y: 76,
              bMinusV: Number.NaN,
              intensity: Number.NaN,
              corePx: Number.NaN,
              haloPx: 99,
            },
          ]}
        />,
      )
    })

    expect(fillCalls).toHaveLength(2)
    expect(fillCalls[0]).toMatchObject({
      radius: 6.2,
      alpha: 0.2,
      fillStyle: 'rgba(225, 244, 255, 0.88)',
    })
    expect(fillCalls[1]).toMatchObject({
      radius: 1,
      alpha: 0.65,
      fillStyle: 'rgba(225, 244, 255, 0.88)',
    })
  })
})

function stubCanvasContext(fillCalls: CanvasFillCall[]) {
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
    setTransform: () => undefined,
    globalAlpha: 1,
    fillStyle: '',
  }

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => context,
  })
}
