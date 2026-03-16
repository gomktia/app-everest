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
})
