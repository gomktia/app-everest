import Stripe from "https://esm.sh/stripe@17?target=deno"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { welcomeEmail, refundEmail } from '../_shared/email-templates.ts'
import { sendEmail } from '../_shared/send-email.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2025-04-30.basil',
  httpClient: Stripe.createFetchHttpClient(),
})

const APP_URL = Deno.env.get('APP_URL') || 'https://app.everestpreparatorios.com.br'

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

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ============================================================
// Action Handlers
// ============================================================

async function handleRefund(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  adminUserId: string,
  params: { order_id: string; amount_cents?: number; reason?: string },
) {
  const { order_id, amount_cents, reason } = params

  if (!order_id) {
    return jsonResponse({ error: 'order_id is required' }, 400)
  }

  // 1. Find order with payments
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*, payments(*), order_items(*, stripe_products:stripe_product_id(product_name))')
    .eq('id', order_id)
    .single()

  if (orderErr || !order) {
    return jsonResponse({ error: 'Order not found' }, 404)
  }

  if (order.status === 'refunded') {
    return jsonResponse({ error: 'Order is already refunded' }, 400)
  }

  // 2. Find a succeeded payment with a stripe_payment_intent_id
  const succeededPayment = order.payments?.find(
    (p: { status: string; stripe_payment_intent_id: string | null }) =>
      p.status === 'succeeded' && p.stripe_payment_intent_id,
  )

  if (!succeededPayment) {
    return jsonResponse({ error: 'No succeeded payment found for this order' }, 400)
  }

  // 3. Create Stripe refund
  const refundParams: Stripe.RefundCreateParams = {
    payment_intent: succeededPayment.stripe_payment_intent_id,
  }
  if (amount_cents) {
    refundParams.amount = amount_cents
  }
  if (reason) {
    // Stripe accepts: duplicate, fraudulent, requested_by_customer
    const stripeReason = ['duplicate', 'fraudulent', 'requested_by_customer'].includes(reason)
      ? reason as Stripe.RefundCreateParams.Reason
      : 'requested_by_customer'
    refundParams.reason = stripeReason
  }

  const stripeRefund = await stripe.refunds.create(refundParams)

  // 4. Insert into refunds table
  const refundAmountCents = amount_cents || order.total_cents
  await supabase.from('refunds').insert({
    payment_id: succeededPayment.id,
    order_id,
    stripe_refund_id: stripeRefund.id,
    amount_cents: refundAmountCents,
    reason: reason || 'requested_by_customer',
    status: 'succeeded',
    admin_user_id: adminUserId,
    refunded_at: new Date().toISOString(),
  })

  // 5. Deactivate student_classes (expire now)
  await supabase
    .from('student_classes')
    .update({ subscription_expires_at: new Date().toISOString() })
    .eq('order_id', order_id)

  // 6. Update order status
  await supabase
    .from('orders')
    .update({ status: 'refunded' })
    .eq('id', order_id)

  // 7. Reverse affiliate commission if exists
  const { data: commission } = await supabase
    .from('affiliate_commissions')
    .select('id, affiliate_id, commission_cents, status')
    .eq('order_id', order_id)
    .neq('status', 'reversed')
    .maybeSingle()

  if (commission) {
    await supabase
      .from('affiliate_commissions')
      .update({ status: 'reversed', reversed_at: new Date().toISOString() })
      .eq('id', commission.id)

    const { data: affiliate } = await supabase
      .from('affiliates')
      .select('id, total_earned_cents')
      .eq('id', commission.affiliate_id)
      .single()

    if (affiliate) {
      await supabase
        .from('affiliates')
        .update({ total_earned_cents: Math.max(0, (affiliate.total_earned_cents || 0) - commission.commission_cents) })
        .eq('id', affiliate.id)
    }
  }

  // 8. Send refund email
  if (order.user_id) {
    const { data: userData } = await supabase
      .from('users')
      .select('email, first_name')
      .eq('id', order.user_id)
      .single()

    if (userData?.email) {
      const productName = order.order_items?.[0]?.stripe_products?.product_name || 'seu curso'
      const amountFormatted = `R$ ${(refundAmountCents / 100).toFixed(2).replace('.', ',')}`
      const tpl = refundEmail(
        userData.first_name || 'Aluno',
        productName,
        amountFormatted,
        reason || 'Solicitado pelo administrador',
      )
      await sendEmail(userData.email, tpl.subject, tpl.html)
    }
  }

  return jsonResponse({
    success: true,
    action: 'refund',
    stripe_refund_id: stripeRefund.id,
    amount_cents: refundAmountCents,
    order_id,
  })
}

async function handleCreateCoupon(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  params: {
    code: string
    discount_type: 'percent' | 'fixed'
    discount_value: number
    max_uses?: number
    valid_until?: string
    applicable_products?: string[]
  },
) {
  const { code, discount_type, discount_value, max_uses, valid_until, applicable_products } = params

  if (!code || !discount_type || !discount_value) {
    return jsonResponse({ error: 'code, discount_type, and discount_value are required' }, 400)
  }

  if (!['percent', 'fixed'].includes(discount_type)) {
    return jsonResponse({ error: 'discount_type must be percent or fixed' }, 400)
  }

  if (discount_type === 'percent' && (discount_value < 1 || discount_value > 100)) {
    return jsonResponse({ error: 'percent discount must be between 1 and 100' }, 400)
  }

  // Check if code already exists
  const { data: existing } = await supabase
    .from('coupons')
    .select('id')
    .eq('code', code.toUpperCase().trim())
    .maybeSingle()

  if (existing) {
    return jsonResponse({ error: 'Coupon code already exists' }, 400)
  }

  // Create coupon in Stripe
  const stripeCouponParams: Stripe.CouponCreateParams = {
    name: code.toUpperCase().trim(),
    currency: 'brl',
  }

  if (discount_type === 'percent') {
    stripeCouponParams.percent_off = discount_value
  } else {
    stripeCouponParams.amount_off = discount_value
  }

  if (valid_until) {
    stripeCouponParams.redeem_by = Math.floor(new Date(valid_until).getTime() / 1000)
  }

  if (max_uses) {
    stripeCouponParams.max_redemptions = max_uses
  }

  const stripeCoupon = await stripe.coupons.create(stripeCouponParams)

  // Insert into local coupons table
  const { data: coupon, error: couponErr } = await supabase
    .from('coupons')
    .insert({
      code: code.toUpperCase().trim(),
      discount_type,
      discount_value,
      max_uses: max_uses || null,
      current_uses: 0,
      valid_until: valid_until || null,
      applicable_products: applicable_products || null,
      is_active: true,
      stripe_coupon_id: stripeCoupon.id,
    })
    .select('id')
    .single()

  if (couponErr) {
    return jsonResponse({ error: 'Failed to create coupon', detail: couponErr.message }, 500)
  }

  return jsonResponse({
    success: true,
    action: 'create-coupon',
    coupon_id: coupon.id,
    stripe_coupon_id: stripeCoupon.id,
    code: code.toUpperCase().trim(),
  })
}

async function handleUpdateCoupon(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  params: {
    coupon_id: string
    discount_type: 'percent' | 'fixed'
    discount_value: number
    max_uses?: number
    valid_until?: string
    applicable_products?: string[]
  },
) {
  const { coupon_id, discount_type, discount_value, max_uses, valid_until, applicable_products } = params

  if (!coupon_id) {
    return jsonResponse({ error: 'coupon_id is required' }, 400)
  }

  const { data: coupon, error: couponErr } = await supabase
    .from('coupons')
    .select('id, code, stripe_coupon_id')
    .eq('id', coupon_id)
    .single()

  if (couponErr || !coupon) {
    return jsonResponse({ error: 'Coupon not found' }, 404)
  }

  // Update locally
  const updates: Record<string, unknown> = {
    discount_type,
    discount_value,
    max_uses: max_uses || null,
    valid_until: valid_until || null,
    applicable_products: applicable_products || null,
  }

  const { error: updateErr } = await supabase
    .from('coupons')
    .update(updates)
    .eq('id', coupon_id)

  if (updateErr) {
    return jsonResponse({ error: 'Failed to update coupon', detail: updateErr.message }, 500)
  }

  return jsonResponse({
    success: true,
    action: 'update-coupon',
    coupon_id,
    code: coupon.code,
  })
}

async function handleDeactivateCoupon(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  params: { coupon_id: string },
) {
  const { coupon_id } = params

  if (!coupon_id) {
    return jsonResponse({ error: 'coupon_id is required' }, 400)
  }

  const { data: coupon, error: couponErr } = await supabase
    .from('coupons')
    .select('id, is_active, stripe_coupon_id')
    .eq('id', coupon_id)
    .single()

  if (couponErr || !coupon) {
    return jsonResponse({ error: 'Coupon not found' }, 404)
  }

  if (!coupon.is_active) {
    return jsonResponse({ error: 'Coupon is already inactive' }, 400)
  }

  // Deactivate in Stripe if we have a stripe_coupon_id
  if (coupon.stripe_coupon_id) {
    try {
      await stripe.coupons.del(coupon.stripe_coupon_id)
    } catch (err) {
      console.error('[stripe-admin] Failed to delete Stripe coupon:', (err as Error).message)
      // Continue anyway — local deactivation is more important
    }
  }

  // Deactivate locally
  await supabase
    .from('coupons')
    .update({ is_active: false })
    .eq('id', coupon_id)

  return jsonResponse({
    success: true,
    action: 'deactivate-coupon',
    coupon_id,
  })
}

async function handleExtendAccess(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  params: { student_class_id: string; new_expires_at: string },
) {
  const { student_class_id, new_expires_at } = params

  if (!student_class_id || !new_expires_at) {
    return jsonResponse({ error: 'student_class_id and new_expires_at are required' }, 400)
  }

  // Validate date
  const expiresDate = new Date(new_expires_at)
  if (isNaN(expiresDate.getTime())) {
    return jsonResponse({ error: 'new_expires_at must be a valid ISO date' }, 400)
  }

  const { data: sc, error: scErr } = await supabase
    .from('student_classes')
    .select('id, user_id, class_id, subscription_expires_at')
    .eq('id', student_class_id)
    .single()

  if (scErr || !sc) {
    return jsonResponse({ error: 'Student class enrollment not found' }, 404)
  }

  await supabase
    .from('student_classes')
    .update({ subscription_expires_at: expiresDate.toISOString() })
    .eq('id', student_class_id)

  return jsonResponse({
    success: true,
    action: 'extend-access',
    student_class_id,
    previous_expires_at: sc.subscription_expires_at,
    new_expires_at: expiresDate.toISOString(),
  })
}

async function handleResendWelcome(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  params: { order_id: string },
) {
  const { order_id } = params

  if (!order_id) {
    return jsonResponse({ error: 'order_id is required' }, 400)
  }

  // Fetch order with items and user info
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*, order_items(*, stripe_products:stripe_product_id(product_name, access_days))')
    .eq('id', order_id)
    .single()

  if (orderErr || !order) {
    return jsonResponse({ error: 'Order not found' }, 404)
  }

  if (!order.user_id) {
    return jsonResponse({ error: 'Order has no associated user' }, 400)
  }

  // Get user info
  const { data: userData } = await supabase
    .from('users')
    .select('email, first_name')
    .eq('id', order.user_id)
    .single()

  if (!userData?.email) {
    return jsonResponse({ error: 'User email not found' }, 404)
  }

  // Get the latest expiration from student_classes for this order
  const { data: studentClasses } = await supabase
    .from('student_classes')
    .select('subscription_expires_at')
    .eq('order_id', order_id)
    .order('subscription_expires_at', { ascending: false })
    .limit(1)

  const expiresAt = studentClasses?.[0]?.subscription_expires_at
  const expiresFormatted = expiresAt
    ? new Date(expiresAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : ''

  const productName = order.order_items?.[0]?.stripe_products?.product_name || 'Everest'
  const firstName = userData.first_name || 'Aluno'

  const tpl = welcomeEmail(firstName, productName, APP_URL, expiresFormatted)
  await sendEmail(userData.email, tpl.subject, tpl.html)

  return jsonResponse({
    success: true,
    action: 'resend-welcome',
    order_id,
    sent_to: userData.email,
  })
}

// ============================================================
// Main Handler
// ============================================================

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

    const supabaseAdmin = getSupabaseAdmin()
    const token = authHeader.replace('Bearer ', '')

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    // 2. Verify admin role
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role !== 'administrator') {
      return jsonResponse({ error: 'Admin access required' }, 403)
    }

    // 3. Parse request body and route to action
    const body = await req.json()
    const { action, ...params } = body

    if (!action) {
      return jsonResponse({ error: 'action is required' }, 400)
    }

    console.log('[stripe-admin] Action:', action, 'by admin:', user.id)

    switch (action) {
      case 'refund':
        return await handleRefund(supabaseAdmin, user.id, params)

      case 'create-coupon':
        return await handleCreateCoupon(supabaseAdmin, params)

      case 'update-coupon':
        return await handleUpdateCoupon(supabaseAdmin, params)

      case 'deactivate-coupon':
        return await handleDeactivateCoupon(supabaseAdmin, params)

      case 'extend-access':
        return await handleExtendAccess(supabaseAdmin, params)

      case 'resend-welcome':
        return await handleResendWelcome(supabaseAdmin, params)

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400)
    }
  } catch (error) {
    console.error('[stripe-admin] Internal error:', (error as Error).message)
    return jsonResponse({ error: 'Internal server error', detail: (error as Error).message }, 500)
  }
})
