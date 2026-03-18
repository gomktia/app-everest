import * as Sentry from '@sentry/react'
import {
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from 'react-router-dom'
import { useEffect } from 'react'

Sentry.init({
  dsn: 'https://2b5f1b9967a93c8048aa0705b601f896@o4511056120971264.ingest.us.sentry.io/4511056128311296',
  environment: import.meta.env.MODE,
  sendDefaultPii: true,
  integrations: [
    Sentry.reactRouterV6BrowserTracingIntegration({
      useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
    }),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.2,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
  ignoreErrors: [
    // Stale chunks after deploy (user has old cached version)
    'Failed to fetch dynamically imported module',
    "'text/html' is not a valid JavaScript MIME type",
    'Loading chunk',
    'Loading CSS chunk',
    // Benign: fetch aborted by component unmount or navigation
    'AbortError',
    'The operation was aborted',
    // Network errors — only ignore generic browser network failures
    'NetworkError when attempting to fetch resource',
    'net::ERR_INTERNET_DISCONNECTED',
    'net::ERR_NETWORK_CHANGED',
  ],
})
