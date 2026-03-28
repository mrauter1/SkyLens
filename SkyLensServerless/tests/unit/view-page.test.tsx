import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockViewerShellProps, mockSearchParams } = vi.hoisted(() => ({
  mockViewerShellProps: vi.fn(),
  mockSearchParams: {
    current: new URLSearchParams(),
  },
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams.current,
}))

vi.mock('../../components/viewer/viewer-shell', () => ({
  ViewerShell: (props: unknown) => {
    mockViewerShellProps(props)

    return React.createElement('div', {
      'data-testid': 'viewer-shell',
    })
  },
}))

import { ViewPageClient } from '../../app/view/view-page-client'

describe('ViewPageClient', () => {
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
    mockViewerShellProps.mockReset()
    mockSearchParams.current = new URLSearchParams()
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('parses client-side search params into the viewer route state', async () => {
    mockSearchParams.current = new URLSearchParams({
      entry: 'demo',
      location: 'unavailable',
      camera: 'unavailable',
      orientation: 'unavailable',
      demoScenario: 'tokyo-iss',
    })

    await act(async () => {
      root.render(React.createElement(ViewPageClient))
    })

    expect(mockViewerShellProps).toHaveBeenCalledWith({
      initialState: {
        entry: 'demo',
        location: 'unavailable',
        camera: 'unavailable',
        orientation: 'unavailable',
        demoScenarioId: 'tokyo-iss',
      },
    })
  })
})
