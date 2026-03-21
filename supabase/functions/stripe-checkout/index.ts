import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@17?target=deno"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2025-04-30.basil',
  httpClient: Stripe.createFetchHttpClient(),
})

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    // 1. Authenticate user via JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const appUrl = Deno.env.get('APP_URL') || 'https://app.everestpreparatorios.com.br'

    // User client to verify JWT
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return jsonResponse({ error: 'Invalid or expired token' }, 401)
    }

    // Admin client for DB operations (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 2. Parse request body
    const body = await req.json()
    const {
      product_slug,
      coupon_code,
      affiliate_code,
      payment_method,
      installments,
      split_amounts,
    } = body as {
      product_slug: string
      coupon_code?: string
      affiliate_code?: string
      payment_method: 'card' | 'pix' | 'split_card'
      installments?: number
      split_amounts?: number[]
    }

    if (!product_slug) {
      return jsonResponse({ error: 'product_slug is required' }, 400)
    }
    if (!payment_method || !['card', 'pix', 'split_card'].includes(payment_method)) {
      return jsonResponse({ error: 'payment_method must be card, pix, or split_card' }, 400)
    }

    // 3. Look up product
    const { data: product, error: productError } = await supabaseAdmin
      .from('stripe_products')
      .select('*')
      .eq('landing_page_slug', product_slug)
      .eq('is_active', true)
      .single()

    if (productError || !product) {
      return jsonResponse({ error: 'Product not found or inactive' }, 404)
    }

    // 4. Look up linked classes
    const { data: productClasses, error: classesError } = await supabaseAdmin
      .from('stripe_product_classes')
      .select('class_id')
      .eq('stripe_product_id', product.id)

    if (classesError || !productClasses || productClasses.length === 0) {
      return jsonResponse({ error: 'No classes linked to this product' }, 404)
    }

    // 5. Coupon validation
    let couponId: string | null = null
    let discountCents = 0

    if (coupon_code) {
      const { data: coupon, error: couponError } = await supabaseAdmin
        .from('coupons')
        .select('*')
        .eq('code', coupon_code.toUpperCase().trim())
        .eq('is_active', true)
        .single()

      if (couponError || !coupon) {
        return jsonResponse({ error: 'Invalid or inactive coupon' }, 400)
      }

      // Check expiration
      if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
        return jsonResponse({ error: 'Coupon has expired' }, 400)
      }

      // Check max uses
      if (coupon.max_uses !== null && coupon.current_uses >= coupon.max_uses) {
        return jsonResponse({ error: 'Coupon has reached maximum uses' }, 400)
      }

      // Check product applicability
      if (coupon.applicable_products && coupon.applicable_products.length > 0) {
        if (!coupon.applicable_products.includes(product.id)) {
          return jsonResponse({ error: 'Coupon is not valid for this product' }, 400)
        }
      }

      // Calculate discount
      if (coupon.discount_type === 'percent') {
        discountCents = Math.round(product.price_cents * coupon.discount_value / 100)
      } else {
        // fixed: discount_value is already in cents
        discountCents = coupon.discount_value
      }

      // Don't let discount exceed price
      if (discountCents > product.price_cents) {
        discountCents = product.price_cents
      }

      couponId = coupon.id
    }

    // 6. Affiliate validation
    let affiliateId: string | null = null

    if (affiliate_code) {
      const { data: affiliate, error: affiliateError } = await supabaseAdmin
        .from('affiliates')
        .select('id')
        .eq('affiliate_code', affiliate_code.trim())
        .eq('is_active', true)
        .single()

      if (affiliateError || !affiliate) {
        // Silently ignore invalid affiliate codes (don't block checkout)
        console.warn(`Invalid affiliate code: ${affiliate_code}`)
      } else {
        affiliateId = affiliate.id
      }
    }

    const totalCents = product.price_cents - discountCents

    // 7. Get or create Stripe Customer
    const userEmail = user.email!
    const userName = [
      user.user_metadata?.first_name,
      user.user_metadata?.last_name,
    ].filter(Boolean).join(' ') || userEmail

    const existingCustomers = await stripe.customers.list({ email: userEmail, limit: 1 })
    let stripeCustomerId: string

    if (existingCustomers.data.length > 0) {
      stripeCustomerId = existingCustomers.data[0].id
    } else {
      const newCustomer = await stripe.customers.create({
        email: userEmail,
        name: userName,
        metadata: { supabase_user_id: user.id },
      })
      stripeCustomerId = newCustomer.id
    }

    // 8. Create order record
    const orderData: Record<string, unknown> = {
      user_id: user.id,
      stripe_customer_id: stripeCustomerId,
      status: 'pending',
      total_cents: totalCents,
      currency: product.currency || 'brl',
      payment_method,
      installments: payment_method === 'card' ? (installments || 1) : null,
      split_payments_expected: payment_method === 'split_card' ? 2 : 1,
      coupon_id: couponId,
      affiliate_id: affiliateId,
      metadata: { email: userEmail, name: userName, product_slug },
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert(orderData)
      .select('id')
      .single()

    if (orderError || !order) {
      return jsonResponse({ error: 'Failed to create order', detail: orderError?.message }, 500)
    }

    const orderId = order.id

    // 9. Create order_items for each linked class
    const orderItems = productClasses.map((pc: { class_id: string }) => ({
      order_id: orderId,
      stripe_product_id: product.id,
      class_id: pc.class_id,
      price_cents: totalCents,
      quantity: 1,
    }))

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      return jsonResponse({ error: 'Failed to create order items', detail: itemsError.message }, 500)
    }

    // Increment coupon usage
    if (couponId) {
      const { data: couponData } = await supabaseAdmin
        .from('coupons')
        .select('current_uses')
        .eq('id', couponId)
        .single()

      if (couponData) {
        await supabaseAdmin
          .from('coupons')
          .update({ current_uses: (couponData.current_uses || 0) + 1 })
          .eq('id', couponId)
      }
    }

    const successUrl = `${appUrl}/checkout/sucesso?order=${orderId}`
    const cancelUrl = `${appUrl}/checkout/${product_slug}?cancelled=true`

    // 10-12. Handle payment methods
    if (payment_method === 'card') {
      // Create Stripe Checkout Session for card payment
      // Build installment config (up to 12x for Brazilian cards)
      const maxInstallments = installments && installments >= 2 && installments <= 12
        ? installments
        : 12

      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: product.currency || 'brl',
              product: product.stripe_product_id,
              unit_amount: totalCents,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          metadata: {
            order_id: orderId,
            product_slug,
            user_id: user.id,
          },
        },
        payment_method_options: {
          card: {
            installments: {
              enabled: true,
            },
          },
        },
        metadata: {
          order_id: orderId,
          product_slug,
          installments: String(maxInstallments),
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      })

      // Update order with session ID
      await supabaseAdmin
        .from('orders')
        .update({ stripe_checkout_session_id: session.id })
        .eq('id', orderId)

      return jsonResponse({ session_url: session.url, order_id: orderId })
    }

    if (payment_method === 'pix') {
      // Create Stripe Checkout Session for PIX
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ['pix'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'brl',
              product: product.stripe_product_id,
              unit_amount: totalCents,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          metadata: {
            order_id: orderId,
            product_slug,
            user_id: user.id,
          },
        },
        metadata: {
          order_id: orderId,
          product_slug,
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      })

      // Update order with session ID
      await supabaseAdmin
        .from('orders')
        .update({ stripe_checkout_session_id: session.id })
        .eq('id', orderId)

      return jsonResponse({ session_url: session.url, order_id: orderId })
    }

    if (payment_method === 'split_card') {
      // Validate split_amounts
      if (!split_amounts || split_amounts.length !== 2) {
        return jsonResponse({ error: 'split_amounts must be an array of exactly 2 amounts' }, 400)
      }

      const splitSum = split_amounts[0] + split_amounts[1]
      if (splitSum !== totalCents) {
        return jsonResponse({
          error: 'split_amounts must sum to the total amount',
          expected: totalCents,
          received: splitSum,
        }, 400)
      }

      // Create 2 PaymentIntents
      const intent1 = await stripe.paymentIntents.create({
        amount: split_amounts[0],
        currency: product.currency || 'brl',
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        metadata: {
          order_id: orderId,
          product_slug,
          user_id: user.id,
          split_part: '1',
          split_total: '2',
        },
      })

      const intent2 = await stripe.paymentIntents.create({
        amount: split_amounts[1],
        currency: product.currency || 'brl',
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        metadata: {
          order_id: orderId,
          product_slug,
          user_id: user.id,
          split_part: '2',
          split_total: '2',
        },
      })

      // Create 2 payment records
      await supabaseAdmin.from('payments').insert([
        {
          order_id: orderId,
          stripe_payment_intent_id: intent1.id,
          amount_cents: split_amounts[0],
          status: 'pending',
          payment_method: 'card',
        },
        {
          order_id: orderId,
          stripe_payment_intent_id: intent2.id,
          amount_cents: split_amounts[1],
          status: 'pending',
          payment_method: 'card',
        },
      ])

      return jsonResponse({
        client_secrets: [intent1.client_secret, intent2.client_secret],
        order_id: orderId,
      })
    }

    return jsonResponse({ error: 'Unhandled payment method' }, 400)

  } catch (error) {
    console.error('stripe-checkout error:', error)
    return jsonResponse({ error: 'Internal server error', detail: (error as Error).message }, 500)
  }
})
