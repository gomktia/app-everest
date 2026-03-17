import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'
import { logger } from '@/lib/logger'

// Get environment variables with fallbacks
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ||
                     import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
                     'https://hnhzindsfuqnaxosujay.supabase.co'

const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ||
                                import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuaHppbmRzZnVxbmF4b3N1amF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MzU5NTIsImV4cCI6MjA2ODUxMTk1Mn0.cT7fe1wjee9HfZw_IVD7K_exMqu-LtUxiClCD-sDLyU'

// Create client with error handling and better timeout configuration
let supabase: ReturnType<typeof createClient<Database>>

try {
  supabase = createClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        storage: typeof window !== 'undefined' ? localStorage : undefined,
        storageKey: 'everest-auth-token',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        debug: false
      },
      global: {
        headers: {
          'X-Client-Info': 'everest-app'
        },
        fetch: (url, options = {}) => {
          // Edge Functions (AI correction) need longer timeout (3 min)
          // Auth token refresh: 10s (critical path on page load)
          // Regular DB queries: 15s
          const urlStr = typeof url === 'string' ? url : ''
          const isEdgeFunction = urlStr.includes('/functions/v1/')
          const isAuth = urlStr.includes('/auth/v1/')
          const timeout = isEdgeFunction ? 180000 : isAuth ? 10000 : 15000

          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), timeout)

          return fetch(url, {
            ...options,
            signal: controller.signal
          }).finally(() => {
            clearTimeout(timeoutId)
          })
        }
      },
      db: {
        schema: 'public'
      },
      realtime: {
        params: {
          eventsPerSecond: 100
        }
      }
    },
  )
} catch (error) {
  logger.error('Failed to create Supabase client:', error)
  // Create a mock client that doesn't break the app
  supabase = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({ data: [], error: null }),
      insert: () => ({ data: null, error: null }),
      update: () => ({ data: null, error: null }),
      delete: () => ({ data: null, error: null }),
    }),
  } as any
}

export { supabase }
