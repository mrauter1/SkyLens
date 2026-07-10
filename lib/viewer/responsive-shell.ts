export type ViewerResponsiveShell = 'compact' | 'desktop'

export const DESKTOP_VIEWER_SHELL_MEDIA_QUERY =
  '(min-width: 1024px) and (hover: hover) and (pointer: fine)'

export function getViewerResponsiveShell(): ViewerResponsiveShell {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'compact'
  }

  return window.matchMedia(DESKTOP_VIEWER_SHELL_MEDIA_QUERY).matches
    ? 'desktop'
    : 'compact'
}

export function getServerViewerResponsiveShell(): ViewerResponsiveShell {
  return 'compact'
}

export function subscribeToViewerResponsiveShell(onStoreChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {}
  }

  const mediaQuery = window.matchMedia(DESKTOP_VIEWER_SHELL_MEDIA_QUERY)
  const handleChange = () => onStoreChange()
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handleChange)
  } else {
    mediaQuery.addListener(handleChange)
  }

  return () => {
    if (typeof mediaQuery.removeEventListener === 'function') {
      mediaQuery.removeEventListener('change', handleChange)
    } else {
      mediaQuery.removeListener(handleChange)
    }
  }
}
