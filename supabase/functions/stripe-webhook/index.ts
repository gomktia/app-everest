import Stripe from "https://esm.sh/stripe@17?target=deno"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { welcomeEmail, paymentFailedEmail, refundEmail } from '../_shared/email-templates.ts'
import { sendEmail } from '../_shared/send-email.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2025-04-30.basil',
  httpClient: Stripe.createFetchHttpClient(),
})

const APP_URL = Deno.env.get('APP_URL') || 'https://app.everestpreparatorios.com.br'

function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const special = '#@!&%'
  const all = upper + lower + digits + special

  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)]

  // Guarantee at least 1 of each type
  const required = [pick(upper), pick(lower), pick(digits), pick(special)]
  for (let i = 0; i < 4; i++) required.push(pick(all))

  // Shuffle
  for (let i = required.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [required[i], required[j]] = [required[j], required[i]]
  }
  return required.join('')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
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
// Shared enrollment logic — used by checkout.session.completed
// and split_card completion in payment_intent.succeeded
// ============================================================
async function enrollFromOrder(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  orderId: string,
) {
  // Fetch order with items
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*, order_items(*, stripe_products:stripe_product_id(access_days, product_name))')
    .eq('id', orderId)
    .single()

  if (orderErr || !order) {
    console.error('[stripe-webhook] enrollFromOrder: order not found', orderId, orderErr)
    return
  }

  // If user_id is NULL (landing page flow) — create user from metadata
  let userId = order.user_id
  let tempPassword: string | null = null
  if (!userId) {
    const email = order.metadata?.email?.toLowerCase()?.trim()
    const firstName = order.metadata?.first_name || ''
    const lastName = order.metadata?.last_name || ''

    if (!email) {
      console.error('[stripe-webhook] enrollFromOrder: no email in order metadata', orderId)
      return
    }

    // Check if user already exists in public.users
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      userId = existingUser.id
    } else {
      // Generate random temporary password (8 chars: upper + lower + digit + special)
      tempPassword = generateTempPassword()

      const { data: newAuthUser, error: createAuthError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName, temp_password: true },
      })

      if (createAuthError) {
        if (createAuthError.message?.includes('already been registered')) {
          const { data: { users } } = await supabase.auth.admin.listUsers()
          const found = users?.find((u: { email?: string }) => u.email === email)
          if (!found) {
            console.error('[stripe-webhook] User exists in auth but not found via listUsers')
            return
          }
          userId = found.id
        } else {
          console.error('[stripe-webhook] Failed to create auth user:', createAuthError.message)
          return
        }
      } else {
        userId = newAuthUser.user.id
      }

      // Create public.users record
      await supabase.from('users').upsert({
        id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        role: 'student',
        is_active: true,
      }, { onConflict: 'id' })

      // Note: students table removed — student data lives in users + student_classes
    }

    // Backfill user_id on the order
    await supabase.from('orders').update({ user_id: userId }).eq('id', orderId)
  }

  // Enroll in each class from order_items
  let productName = ''
  let latestExpires = ''
  for (const item of order.order_items || []) {
    const accessDays = item.stripe_products?.access_days ?? 365
    productName = item.stripe_products?.product_name || productName

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + accessDays)
    const expiresIso = expiresAt.toISOString()
    if (expiresIso > latestExpires) latestExpires = expiresIso

    // Skip if already enrolled in that class
    const { data: existing } = await supabase
      .from('student_classes')
      .select('id')
      .eq('user_id', userId)
      .eq('class_id', item.class_id)
      .maybeSingle()

    if (!existing) {
      await supabase.from('student_classes').insert({
        user_id: userId,
        class_id: item.class_id,
        enrollment_date: new Date().toISOString().split('T')[0],
        source: 'stripe',
        subscription_expires_at: expiresIso,
        order_id: orderId,
      })
    }
  }

  // Handle affiliate commission
  if (order.affiliate_id) {
    // Fetch affiliate
    const { data: affiliate } = await supabase
      .from('affiliates')
      .select('id, commission_percent, total_earned_cents')
      .eq('id', order.affiliate_id)
      .single()

    if (affiliate) {
      const commissionCents = Math.round(order.total_cents * affiliate.commission_percent / 100)

      // Check idempotency — skip if commission already exists for this order
      const { data: existingComm } = await supabase
        .from('affiliate_commissions')
        .select('id')
        .eq('order_id', orderId)
        .eq('affiliate_id', affiliate.id)
        .maybeSingle()

      if (!existingComm) {
        await supabase.from('affiliate_commissions').insert({
          affiliate_id: affiliate.id,
          order_id: orderId,
          commission_cents: commissionCents,
          status: 'pending',
        })

        await supabase
          .from('affiliates')
          .update({ total_earned_cents: (affiliate.total_earned_cents || 0) + commissionCents })
          .eq('id', affiliate.id)
      }
    }
  }

  // Mark order as paid
  await supabase.from('orders').update({ status: 'paid' }).eq('id', orderId)

  // Send welcome email
  const email = order.metadata?.email || (userId ? (await supabase.from('users').select('email, first_name').eq('id', userId).single()).data?.email : null)
  const firstName = order.metadata?.first_name || ''
  const expiresFormatted = latestExpires
    ? new Date(latestExpires).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : ''

  if (email) {
    const tpl = welcomeEmail(firstName || 'Aluno', productName || 'Everest', APP_URL, expiresFormatted, tempPassword)
    await sendEmail(email, tpl.subject, tpl.html)
  }

  return { userId, productName }
}

// ============================================================
// Event Handlers
// ============================================================

async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session
  const supabase = getSupabaseAdmin()

  // Find order by checkout session ID or metadata
  const orderId = session.metadata?.order_id
  let order

  if (orderId) {
    const { data } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single()
    order = data
  } else {
    const { data } = await supabase
      .from('orders')
      .select('id, status')
      .eq('stripe_checkout_session_id', session.id)
      .single()
    order = data
  }

  if (!order) {
    console.error('[stripe-webhook] checkout.session.completed: order not found', session.id)
    return jsonResponse({ error: 'Order not found' }, 404)
  }

  // Idempotency: already paid → no-op
  if (order.status === 'paid') {
    return jsonResponse({ message: 'Order already paid, skipping' })
  }

  // Store customer email in order metadata if not present
  if (session.customer_details?.email) {
    const { data: currentOrder } = await supabase
      .from('orders')
      .select('metadata')
      .eq('id', order.id)
      .single()

    const meta = currentOrder?.metadata || {}
    if (!meta.email) {
      meta.email = session.customer_details.email.toLowerCase().trim()
      meta.first_name = meta.first_name || session.customer_details.name?.split(' ')[0] || ''
      meta.last_name = meta.last_name || session.customer_details.name?.split(' ').slice(1).join(' ') || ''
      await supabase.from('orders').update({ metadata: meta }).eq('id', order.id)
    }
  }

  // Update stripe_customer_id on order
  if (session.customer) {
    await supabase
      .from('orders')
      .update({ stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer.id })
      .eq('id', order.id)
  }

  await enrollFromOrder(supabase, order.id)
  return jsonResponse({ success: true, event: 'checkout.session.completed', order_id: order.id })
}

async function handlePaymentIntentSucceeded(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent
  const supabase = getSupabaseAdmin()

  // Find payment by stripe_payment_intent_id
  const { data: payment } = await supabase
    .from('payments')
    .select('id, order_id, status')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .maybeSingle()

  if (!payment) {
    console.log('[stripe-webhook] payment_intent.succeeded: no matching payment record', paymentIntent.id)
    return jsonResponse({ message: 'No matching payment record found' })
  }

  // Idempotency: already succeeded → skip
  if (payment.status === 'succeeded') {
    return jsonResponse({ message: 'Payment already succeeded, skipping' })
  }

  // Extract charge details
  const chargeId = paymentIntent.latest_charge
    ? (typeof paymentIntent.latest_charge === 'string' ? paymentIntent.latest_charge : paymentIntent.latest_charge.id)
    : null

  let netAmountCents: number | null = null
  let stripeFee: number | null = null
  let cardLast4: string | null = null
  let cardBrand: string | null = null

  if (chargeId) {
    try {
      const charge = await stripe.charges.retrieve(chargeId as string, {
        expand: ['balance_transaction'],
      })
      if (charge.balance_transaction && typeof charge.balance_transaction !== 'string') {
        netAmountCents = charge.balance_transaction.net
        stripeFee = charge.balance_transaction.fee
      }
      if (charge.payment_method_details?.card) {
        cardLast4 = charge.payment_method_details.card.last4 ?? null
        cardBrand = charge.payment_method_details.card.brand ?? null
      }
    } catch (err) {
      console.error('[stripe-webhook] Failed to retrieve charge details:', (err as Error).message)
    }
  }

  // Update payment record
  await supabase
    .from('payments')
    .update({
      stripe_charge_id: chargeId,
      net_amount_cents: netAmountCents,
      stripe_fee_cents: stripeFee,
      card_last4: cardLast4,
      card_brand: cardBrand,
      status: 'succeeded',
      paid_at: new Date().toISOString(),
    })
    .eq('id', payment.id)

  // For split_card orders: check if all payments are completed
  const { data: order } = await supabase
    .from('orders')
    .select('id, payment_method, split_payments_expected, split_payments_completed, status')
    .eq('id', payment.order_id)
    .single()

  if (order?.payment_method === 'split_card') {
    const newCompleted = (order.split_payments_completed || 0) + 1
    await supabase
      .from('orders')
      .update({ split_payments_completed: newCompleted })
      .eq('id', order.id)

    // If all split payments completed, trigger enrollment
    if (newCompleted >= (order.split_payments_expected || 1) && order.status !== 'paid') {
      await enrollFromOrder(supabase, order.id)
    }
  }

  return jsonResponse({ success: true, event: 'payment_intent.succeeded', payment_id: payment.id })
}

async function handlePaymentIntentFailed(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent
  const supabase = getSupabaseAdmin()

  // Find payment
  const { data: payment } = await supabase
    .from('payments')
    .select('id, order_id, status')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .maybeSingle()

  if (!payment) {
    console.log('[stripe-webhook] payment_intent.payment_failed: no matching payment', paymentIntent.id)
    return jsonResponse({ message: 'No matching payment record' })
  }

  // Idempotency
  if (payment.status === 'failed') {
    return jsonResponse({ message: 'Payment already marked as failed' })
  }

  // Update payment status
  await supabase
    .from('payments')
    .update({ status: 'failed' })
    .eq('id', payment.id)

  // Get the order
  const { data: order } = await supabase
    .from('orders')
    .select('id, payment_method, status, user_id, metadata, total_cents')
    .eq('id', payment.order_id)
    .single()

  if (!order) {
    return jsonResponse({ error: 'Order not found for failed payment' }, 404)
  }

  // For split_card: if first payment succeeded and second failed, auto-refund the first
  if (order.payment_method === 'split_card') {
    const { data: succeededPayments } = await supabase
      .from('payments')
      .select('id, stripe_payment_intent_id')
      .eq('order_id', order.id)
      .eq('status', 'succeeded')

    if (succeededPayments && succeededPayments.length > 0) {
      for (const sp of succeededPayments) {
        try {
          await stripe.refunds.create({ payment_intent: sp.stripe_payment_intent_id })
          await supabase
            .from('payments')
            .update({ status: 'refunded' })
            .eq('id', sp.id)
        } catch (refundErr) {
          console.error('[stripe-webhook] Auto-refund failed for split payment:', (refundErr as Error).message)
        }
      }
    }
  }

  // Update order status
  await supabase
    .from('orders')
    .update({ status: 'failed' })
    .eq('id', order.id)

  // Send failure email
  const email = order.metadata?.email
  const firstName = order.metadata?.first_name || 'Aluno'
  if (email) {
    // Fetch product name from order items
    const { data: items } = await supabase
      .from('order_items')
      .select('stripe_products:stripe_product_id(product_name)')
      .eq('order_id', order.id)
      .limit(1)

    const productName = items?.[0]?.stripe_products?.product_name || 'seu curso'
    const retryUrl = `${APP_URL}/checkout?retry=${order.id}`
    const tpl = paymentFailedEmail(firstName, productName, retryUrl)
    await sendEmail(email, tpl.subject, tpl.html)
  }

  return jsonResponse({ success: true, event: 'payment_intent.payment_failed', order_id: order.id })
}

async function handleChargeRefunded(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge
  const supabase = getSupabaseAdmin()

  // Find payment by stripe_charge_id
  const { data: payment } = await supabase
    .from('payments')
    .select('id, order_id')
    .eq('stripe_charge_id', charge.id)
    .maybeSingle()

  if (!payment) {
    console.log('[stripe-webhook] charge.refunded: no matching payment for charge', charge.id)
    return jsonResponse({ message: 'No matching payment record' })
  }

  // Idempotency: check if refund already exists for this charge
  const stripeRefundId = charge.refunds?.data?.[0]?.id || charge.id
  const { data: existingRefund } = await supabase
    .from('refunds')
    .select('id')
    .eq('stripe_refund_id', stripeRefundId)
    .maybeSingle()

  if (existingRefund) {
    return jsonResponse({ message: 'Refund already processed' })
  }

  const refundAmountCents = charge.amount_refunded

  // Insert refund record
  await supabase.from('refunds').insert({
    payment_id: payment.id,
    order_id: payment.order_id,
    stripe_refund_id: stripeRefundId,
    amount_cents: refundAmountCents,
    reason: charge.refunds?.data?.[0]?.reason || 'requested_by_customer',
    status: 'succeeded',
    refunded_at: new Date().toISOString(),
  })

  // Deactivate student_classes for this order
  await supabase
    .from('student_classes')
    .update({ subscription_expires_at: new Date().toISOString() })
    .eq('order_id', payment.order_id)

  // Update order status
  await supabase
    .from('orders')
    .update({ status: 'refunded' })
    .eq('id', payment.order_id)

  // Reverse affiliate commission if exists
  const { data: commission } = await supabase
    .from('affiliate_commissions')
    .select('id, affiliate_id, commission_cents, status')
    .eq('order_id', payment.order_id)
    .neq('status', 'reversed')
    .maybeSingle()

  if (commission) {
    await supabase
      .from('affiliate_commissions')
      .update({ status: 'reversed', reversed_at: new Date().toISOString() })
      .eq('id', commission.id)

    // Decrease affiliate total_earned_cents
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

  // Send refund email
  const { data: order } = await supabase
    .from('orders')
    .select('user_id, metadata, total_cents')
    .eq('id', payment.order_id)
    .single()

  if (order) {
    const email = order.metadata?.email
    const firstName = order.metadata?.first_name || 'Aluno'

    if (email) {
      const { data: items } = await supabase
        .from('order_items')
        .select('stripe_products:stripe_product_id(product_name)')
        .eq('order_id', payment.order_id)
        .limit(1)

      const productName = items?.[0]?.stripe_products?.product_name || 'seu curso'
      const amountFormatted = `R$ ${(refundAmountCents / 100).toFixed(2).replace('.', ',')}`
      const reason = charge.refunds?.data?.[0]?.reason || 'Solicitado pelo cliente'
      const tpl = refundEmail(firstName, productName, amountFormatted, reason)
      await sendEmail(email, tpl.subject, tpl.html)
    }
  }

  return jsonResponse({ success: true, event: 'charge.refunded', order_id: payment.order_id })
}

async function handleCheckoutSessionExpired(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session
  const supabase = getSupabaseAdmin()

  const email = session.customer_details?.email || session.metadata?.email || ''
  const products = session.metadata?.products ? JSON.parse(session.metadata.products) : []
  const totalCents = session.amount_total || 0

  if (email) {
    await supabase.from('abandoned_carts').insert({
      email: email.toLowerCase().trim(),
      stripe_checkout_session_id: session.id,
      products,
      total_cents: totalCents,
    })
  }

  // Update order status to expired if we have one
  if (session.metadata?.order_id) {
    await supabase
      .from('orders')
      .update({ status: 'expired' })
      .eq('id', session.metadata.order_id)
      .eq('status', 'pending')
  }

  return jsonResponse({ success: true, event: 'checkout.session.expired' })
}

async function handleChargeDisputeCreated(event: Stripe.Event) {
  const dispute = event.data.object as Stripe.Dispute
  const supabase = getSupabaseAdmin()

  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id
  if (!chargeId) {
    return jsonResponse({ message: 'No charge ID in dispute' })
  }

  // Find payment and order by charge
  const { data: payment } = await supabase
    .from('payments')
    .select('id, order_id')
    .eq('stripe_charge_id', chargeId)
    .maybeSingle()

  if (!payment) {
    console.log('[stripe-webhook] charge.dispute.created: no matching payment for charge', chargeId)
    return jsonResponse({ message: 'No matching payment record' })
  }

  // Deactivate student_classes for this order
  await supabase
    .from('student_classes')
    .update({ subscription_expires_at: new Date().toISOString() })
    .eq('order_id', payment.order_id)

  // Create notification for admin users
  const { data: admins } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'administrator')
    .eq('is_active', true)

  if (admins) {
    const notifications = admins.map((admin: { id: string }) => ({
      user_id: admin.id,
      title: 'Chargeback recebido',
      message: `Um chargeback foi aberto para o pedido ${payment.order_id}. O acesso do aluno foi suspenso automaticamente.`,
      type: 'alert',
    }))

    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications)
    }
  }

  return jsonResponse({ success: true, event: 'charge.dispute.created', order_id: payment.order_id })
}

// ============================================================
// Main Handler
// ============================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate webhook signature
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return jsonResponse({ error: 'Missing stripe-signature header' }, 400)
    }

    let event: Stripe.Event
    try {
      const body = await req.text()
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
      )
    } catch (err) {
      return jsonResponse({ error: `Webhook signature verification failed: ${(err as Error).message}` }, 400)
    }

    console.log('[stripe-webhook] Received event:', event.type, event.id)

    // Route to handler
    switch (event.type) {
      case 'checkout.session.completed':
        return await handleCheckoutSessionCompleted(event)

      case 'payment_intent.succeeded':
        return await handlePaymentIntentSucceeded(event)

      case 'payment_intent.payment_failed':
        return await handlePaymentIntentFailed(event)

      case 'charge.refunded':
        return await handleChargeRefunded(event)

      case 'checkout.session.expired':
        return await handleCheckoutSessionExpired(event)

      case 'charge.dispute.created':
        return await handleChargeDisputeCreated(event)

      // Phase 2 stubs: subscription events
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
      case 'customer.subscription.trial_will_end':
        console.log('[stripe-webhook] Subscription event (Phase 2):', event.type)
        return jsonResponse({ message: 'Subscription events deferred to Phase 2' })

      default:
        console.log('[stripe-webhook] Unhandled event type:', event.type)
        return jsonResponse({ message: `Unhandled event type: ${event.type}` })
    }
  } catch (error) {
    console.error('[stripe-webhook] Internal error:', (error as Error).message)
    return jsonResponse({ error: 'Internal server error', detail: (error as Error).message }, 500)
  }
})
