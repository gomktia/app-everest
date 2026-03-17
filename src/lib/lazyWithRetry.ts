import { lazy, type ComponentType } from 'react'

/**
 * Wrapper around React.lazy() that auto-reloads on chunk load failure.
 * After a new deploy, old chunk filenames no longer exist on the server.
 * This catches the import error and reloads the page to get fresh chunks.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(() =>
    factory().catch((error) => {
      const lastReload = sessionStorage.getItem('everest-chunk-reload')
      const now = Date.now()

      // Only auto-reload once per 30 seconds to prevent infinite loop
      if (!lastReload || now - parseInt(lastReload) > 30000) {
        sessionStorage.setItem('everest-chunk-reload', String(now))
        window.location.reload()
      }

      throw error
    })
  )
}
