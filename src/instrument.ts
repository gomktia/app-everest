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
    'error loading dynamically imported module',
    "'text/html' is not a valid JavaScript MIME type",
    'Loading chunk',
    'Loading CSS chunk',
    // Benign: fetch aborted by component unmount or navigation
    'AbortError',
    'The operation was aborted',
    'signal is aborted without reason',
    // Network errors — only ignore generic browser network failures
    'NetworkError when attempting to fetch resource',
    'net::ERR_INTERNET_DISCONNECTED',
    'net::ERR_NETWORK_CHANGED',
    'net::ERR_NAME_NOT_RESOLVED',
    'Load failed',
    // Auth noise — expected on public pages or wrong password
    'AuthSessionMissingError',
    'Auth session missing',
    'AuthRetryableFetchError',
    'Invalid login credentials',
    // Supabase client init (missing env vars on stale cache)
    'supabaseUrl is required',
    'Missing VITE_SUPABASE_URL',
    // PWA service worker registration failures (benign)
    /^Rejected$/,
    // Profile fetch timeout — transient network issue, already retries
    'Profile fetch timeout',
    // Auth rate limiting — expected when user clicks too fast
    'you can only request this after',
    // Edge Function errors — operational, UI already shows toast
    'Edge Function returned a non-2xx status code',
    // Generic fetch failures — network issues, not code bugs
    /^TypeError: Failed to fetch/,
  ],
})
