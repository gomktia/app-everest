/**
 * Logger Service
 *
 * Centralized logging system that only logs in development mode.
 * Use this instead of console.log/error/warn throughout the application.
 */

import * as Sentry from '@sentry/react'

const isDev = import.meta.env.DEV

export const logger = {
  /**
   * Debug level logging - only visible in development
   * Use for detailed debugging information
   */
  debug: (message: string, ...args: any[]) => {
    if (isDev) {
      console.log(`🔍 ${message}`, ...args)
    }
  },

  /**
   * Info level logging - only visible in development
   * Use for general information
   */
  info: (message: string, ...args: any[]) => {
    if (isDev) {
      console.log(`ℹ️  ${message}`, ...args)
    }
  },

  /**
   * Warning level logging - only visible in development
   * Use for warnings that don't break functionality
   */
  warn: (message: string, ...args: any[]) => {
    if (isDev) {
      console.warn(`⚠️  ${message}`, ...args)
    }
    // Add as breadcrumb in Sentry for debugging context
    if (!isDev) {
      Sentry.addBreadcrumb({ category: 'warning', message, level: 'warning' })
    }
  },

  /**
   * Error level logging - always visible
   * Use for errors that need attention
   * Can be integrated with error tracking services (Sentry, LogRocket, etc)
   */
  error: (message: string, ...args: any[]) => {
    console.error(`❌ ${message}`, ...args)
    // Send to Sentry in production
    if (!isDev) {
      const error = args[0] instanceof Error ? args[0] : new Error(message)
      Sentry.captureException(error, {
        extra: { message, context: args.length > 1 ? args.slice(1) : undefined },
      })
    }
  },

  /**
   * Success level logging - only visible in development
   * Use for successful operations
   */
  success: (message: string, ...args: any[]) => {
    if (isDev) {
      console.log(`✅ ${message}`, ...args)
    }
  }
}
