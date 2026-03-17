// Sentry must be initialized before any other imports
import './instrument'
import * as Sentry from '@sentry/react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './main.css'

// Register PWA Service Worker
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    // Auto-update without asking — prevents stale chunks on deploy
    updateSW(true)
  },
  onOfflineReady() {
    // App pronto para funcionar offline
  },
})

// React 19: use reactErrorHandler for automatic error capture
const root = createRoot(document.getElementById('root')!, {
  onUncaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
    console.warn('Uncaught error', error, errorInfo.componentStack)
  }),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
})

root.render(<App />)
