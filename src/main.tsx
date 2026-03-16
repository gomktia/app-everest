/* Main entry point for the application - renders the root React component */
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.tsx'
import './main.css'

// Initialize Sentry error monitoring
const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      // Don't send in development
      if (import.meta.env.DEV) return null
      return event
    },
  })
}

// Register PWA Service Worker
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Nova versão disponível! Deseja atualizar?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    // App pronto para funcionar offline
  },
})

createRoot(document.getElementById('root')!).render(<App />)
