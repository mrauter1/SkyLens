import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  DESKTOP_VIEWER_SHELL_MEDIA_QUERY,
  getServerViewerResponsiveShell,
  getViewerResponsiveShell,
  subscribeToViewerResponsiveShell,
} from '../../lib/viewer/responsive-shell'

const originalMatchMedia = window.matchMedia

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: originalMatchMedia,
  })
})

describe('responsive viewer shell', () => {
  it('uses compact server markup and selects the desktop shell only for the full capability query', () => {
    const matchMedia = vi.fn((query: string) => ({
      matches: query === DESKTOP_VIEWER_SHELL_MEDIA_QUERY,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: matchMedia,
    })

    expect(getServerViewerResponsiveShell()).toBe('compact')
    expect(getViewerResponsiveShell()).toBe('desktop')
    expect(matchMedia).toHaveBeenCalledWith(DESKTOP_VIEWER_SHELL_MEDIA_QUERY)
  })

  it('subscribes to and cleans up capability changes without resize polling', () => {
    const addEventListener = vi.fn()
    const removeEventListener = vi.fn()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(() => ({
        matches: false,
        media: DESKTOP_VIEWER_SHELL_MEDIA_QUERY,
        addEventListener,
        removeEventListener,
      })),
    })
    const onStoreChange = vi.fn()
    const unsubscribe = subscribeToViewerResponsiveShell(onStoreChange)
    const listener = addEventListener.mock.calls[0]?.[1] as (() => void) | undefined

    listener?.()
    expect(onStoreChange).toHaveBeenCalledTimes(1)
    unsubscribe()
    expect(removeEventListener).toHaveBeenCalledWith('change', listener)
  })
})
