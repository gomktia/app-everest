import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@17?target=deno"

const ALLOWED_ORIGIN = Deno.env.get('APP_URL') || 'https://app.everestpreparatorios.com.br'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const appUrl = Deno.env.get('APP_URL') || 'https://app.everestpreparatorios.com.br'

    // Admin client for DB operations (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Parse request body
    const body = await req.json()
    const {
      email,
      name,
      product_slug,
      coupon_code,
      affiliate_code,
      payment_method,
    } = body as {
      email: string
      name: string
      product_slug: string
      coupon_code?: string
      affiliate_code?: string
      payment_method: 'card' | 'pix'
    }

    // Validate required fields
    if (!email || typeof email !== 'string') {
      return jsonResponse({ error: 'email is required' }, 400)
    }
    if (!name || typeof name !== 'string') {
      return jsonResponse({ error: 'name is required' }, 400)
    }
    if (!product_slug) {
      return jsonResponse({ error: 'product_slug is required' }, 400)
    }
    if (!payment_method || !['card', 'pix'].includes(payment_method)) {
      return jsonResponse({ error: 'payment_method must be card or pix' }, 400)
    }

    const normalizedEmail = email.toLowerCase().trim()

    // 2. Rate limit: max 5 pending orders from same email in last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { count: recentOrderCount, error: rateLimitError } = await supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .gte('created_at', fiveMinutesAgo)
      .contains('metadata', { email: normalizedEmail })

    if (rateLimitError) {
      console.error('[stripe-landing] Rate limit check failed:', rateLimitError.message)
    }

    if ((recentOrderCount ?? 0) > 5) {
      return jsonResponse({ error: 'Too many pending orders. Please wait a few minutes.' }, 429)
    }

    // 3. Look up product by landing_page_slug
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
        console.warn(`[stripe-landing] Invalid affiliate code: ${affiliate_code}`)
      } else {
        affiliateId = affiliate.id
      }
    }

    const totalCents = product.price_cents - discountCents

    // 7. Get or create Stripe Customer by email
    const existingCustomers = await stripe.customers.list({ email: normalizedEmail, limit: 1 })
    let stripeCustomerId: string

    if (existingCustomers.data.length > 0) {
      stripeCustomerId = existingCustomers.data[0].id
    } else {
      const newCustomer = await stripe.customers.create({
        email: normalizedEmail,
        name: name.trim(),
      })
      stripeCustomerId = newCustomer.id
    }

    // 8. Create order with user_id=NULL
    const nameParts = name.trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    const orderData: Record<string, unknown> = {
      user_id: null,
      stripe_customer_id: stripeCustomerId,
      status: 'pending',
      total_cents: totalCents,
      currency: product.currency || 'brl',
      payment_method,
      installments: null,
      split_payments_expected: 1,
      coupon_id: couponId,
      affiliate_id: affiliateId,
      metadata: {
        email: normalizedEmail,
        name: name.trim(),
        first_name: firstName,
        last_name: lastName,
        affiliate_code: affiliate_code || null,
        product_slug,
        source: 'landing_page',
      },
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
    const cancelUrl = `${appUrl}/comprar/${product_slug}?cancelled=true`

    // 10. Create Stripe Checkout Session (card or pix)
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: [payment_method === 'pix' ? 'pix' : 'card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: payment_method === 'pix' ? 'brl' : (product.currency || 'brl'),
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
          source: 'landing_page',
        },
      },
      metadata: {
        order_id: orderId,
        product_slug,
        email: normalizedEmail,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    // Update order with session ID
    await supabaseAdmin
      .from('orders')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', orderId)

    // 11. Return session URL and order ID
    return jsonResponse({ session_url: session.url, order_id: orderId })

  } catch (error) {
    console.error('[stripe-landing] Error:', (error as Error).message)
    return jsonResponse({ error: 'Internal server error', detail: (error as Error).message }, 500)
  }
})
