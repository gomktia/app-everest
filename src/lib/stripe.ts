import { loadStripe } from '@stripe/stripe-js'
import { logger } from '@/lib/logger'

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

if (!publishableKey) {
  logger.warn('VITE_STRIPE_PUBLISHABLE_KEY not set')
}

export const stripePromise = publishableKey ? loadStripe(publishableKey) : null
