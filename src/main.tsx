/* Main entry point for the application - renders the root React component */
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.tsx'
import './main.css'

// Initialize Sentry error monitoring
Sentry.init({
  dsn: 'https://2b5f1b9967a93c8048aa0705b601f896@o4511056120971264.ingest.us.sentry.io/4511056128311296',
  environment: import.meta.env.MODE,
  sendDefaultPii: true,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
  ],
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
  beforeSend(event) {
    if (import.meta.env.DEV) return null
    return event
  },
})

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
