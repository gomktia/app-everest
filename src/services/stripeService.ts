import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

interface CheckoutParams {
  productSlug: string
  couponCode?: string
  affiliateCode?: string
  paymentMethod: 'card' | 'pix' | 'split_card'
  installments?: number
  splitAmounts?: number[]
}

export const createCheckoutSession = async (params: CheckoutParams) => {
  const { data: { session } } = await supabase.auth.getSession()

  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    body: {
      product_slug: params.productSlug,
      coupon_code: params.couponCode,
      affiliate_code: params.affiliateCode,
      payment_method: params.paymentMethod,
      installments: params.installments,
      split_amounts: params.splitAmounts,
    },
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
  })

  if (error) {
    logger.error('Checkout error:', error)
    throw new Error(error.message || 'Erro ao processar pagamento')
  }

  return data as { session_url?: string; client_secrets?: string[]; order_id: string }
}

export const createLandingCheckout = async (params: CheckoutParams & { email: string; name: string }) => {
  const { data, error } = await supabase.functions.invoke('stripe-landing', {
    body: {
      email: params.email,
      name: params.name,
      product_slug: params.productSlug,
      coupon_code: params.couponCode,
      affiliate_code: params.affiliateCode,
      payment_method: params.paymentMethod,
    },
  })

  if (error) {
    logger.error('Landing checkout error:', error)
    throw new Error(error.message || 'Erro ao processar pagamento')
  }

  return data as { session_url: string; order_id: string }
}
