import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { ScopeLensOverlay } from '../../components/viewer/scope-lens-overlay'

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

describe('ScopeLensOverlay', () => {
  let container: HTMLDivElement
  let root: Root

  beforeAll(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true
  })

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('renders a clipped circular pointer shield with no focusable descendants', async () => {
    await act(async () => {
      root.render(
        <ScopeLensOverlay
          diameterPx={280}
          lensVisualScale={4}
          showGradientBackground
          cameraStream={null}
          cameraStreamActive={false}
          stars={[
            {
              id: 'deep-star',
              x: 120,
              y: 118,
              vMag: 8.9,
              bMinusV: 0.3,
            },
          ]}
          objects={[
            {
              id: 'scope-star',
              x: 140,
              y: 140,
              sizePx: 8,
              className: 'rounded-full bg-white',
            },
          ]}
        />,
      )
    })

    const overlay = container.querySelector('[data-testid="scope-lens-overlay"]') as
      | HTMLDivElement
      | null
    const frame = container.querySelector('[data-testid="scope-lens-frame"]') as
      | HTMLDivElement
      | null
    const hitArea = container.querySelector('[data-testid="scope-lens-hit-area"]') as
      | HTMLDivElement
      | null
    const starCanvas = container.querySelector('[data-testid="scope-star-canvas"]') as
      | HTMLCanvasElement
      | null
    const markers = container.querySelectorAll('[data-testid="scope-bright-object-marker"]')

    expect(overlay).not.toBeNull()
    expect(frame).not.toBeNull()
    expect(hitArea).not.toBeNull()
    expect(starCanvas).not.toBeNull()
    expect(hitArea?.className).toContain('pointer-events-auto')
    expect(hitArea?.className).toContain('overflow-hidden')
    expect(frame?.style.width).toBe('280px')
    expect(frame?.style.height).toBe('280px')
    expect(hitArea?.style.clipPath).toBe('circle(50% at 50% 50%)')
    expect(markers).toHaveLength(1)
    expect(overlay?.querySelector(FOCUSABLE_SELECTOR)).toBeNull()
  })
})
