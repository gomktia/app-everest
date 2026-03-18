# Stripe Financial System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Kiwify with Stripe for payments, adding full financial management (checkout, refunds, coupons, affiliates, reports) while keeping Kiwify active in parallel.

**Architecture:** Supabase Edge Functions handle Stripe API calls and webhooks. 9 new PostgreSQL tables store financial data. Stripe Elements embedded in React frontend for checkout. pg_cron handles expiration and automated emails.

**Tech Stack:** Stripe JS SDK + React Stripe Elements (frontend), Stripe Deno SDK (Edge Functions), PostgreSQL + RLS, Resend (emails), Recharts (charts)

**Spec:** `docs/superpowers/specs/2026-03-18-stripe-financial-system-design.md`

---

## Phase 1: Database Foundation

### Task 1: Create financial tables migration

**Files:**
- Create: `supabase/migrations/20260319000001_stripe_financial_tables.sql`

- [ ] **Step 1: Write the migration file**

Create all 9 tables + join table + indexes + RLS policies + student_classes alterations in a single migration. Tables must be created in dependency order: `stripe_products` → `stripe_product_classes` → `coupons` → `affiliates` → `orders` → `order_items` → `payments` → `refunds` → `affiliate_commissions` → `abandoned_carts`.

```sql
-- ============================================================
-- Stripe Financial System Tables
-- ============================================================

-- 1. stripe_products
CREATE TABLE public.stripe_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_product_id TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'brl',
  installments_max INTEGER DEFAULT 12,
  access_days INTEGER DEFAULT 365,
  is_bundle BOOLEAN DEFAULT false,
  landing_page_slug TEXT UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. stripe_product_classes (join table for bundles)
CREATE TABLE public.stripe_product_classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_product_id UUID NOT NULL REFERENCES public.stripe_products(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  UNIQUE(stripe_product_id, class_id)
);
CREATE INDEX idx_spc_product ON public.stripe_product_classes(stripe_product_id);
CREATE INDEX idx_spc_class ON public.stripe_product_classes(class_id);

-- 3. coupons
CREATE TABLE public.coupons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  stripe_coupon_id TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value INTEGER NOT NULL,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  applicable_products UUID[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. affiliates
CREATE TABLE public.affiliates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) UNIQUE,
  affiliate_code TEXT NOT NULL UNIQUE,
  commission_percent INTEGER NOT NULL DEFAULT 10,
  total_earned_cents INTEGER DEFAULT 0,
  total_paid_cents INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. orders
CREATE TABLE public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id),
  stripe_checkout_session_id TEXT,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed','refunded','expired','partial')),
  total_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'brl',
  payment_method TEXT CHECK (payment_method IN ('card','pix','split_card')),
  installments INTEGER,
  split_payments_expected INTEGER DEFAULT 1,
  split_payments_completed INTEGER DEFAULT 0,
  coupon_id UUID REFERENCES public.coupons(id),
  affiliate_id UUID REFERENCES public.affiliates(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_orders_user ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created ON public.orders(created_at);
CREATE INDEX idx_orders_stripe_session ON public.orders(stripe_checkout_session_id);

-- 6. order_items
CREATE TABLE public.order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stripe_product_id UUID NOT NULL REFERENCES public.stripe_products(id),
  class_id UUID NOT NULL REFERENCES public.classes(id),
  price_cents INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1
);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);

-- 7. payments
CREATE TABLE public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id),
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  amount_cents INTEGER NOT NULL,
  net_amount_cents INTEGER,
  stripe_fee_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','succeeded','failed','refunded')),
  payment_method TEXT,
  card_last4 TEXT,
  card_brand TEXT,
  pix_expiration TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_payments_order ON public.payments(order_id);
CREATE INDEX idx_payments_intent ON public.payments(stripe_payment_intent_id);

-- 8. refunds
CREATE TABLE public.refunds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id),
  order_id UUID NOT NULL REFERENCES public.orders(id),
  stripe_refund_id TEXT,
  amount_cents INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','succeeded','failed')),
  admin_user_id UUID REFERENCES public.users(id),
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. affiliate_commissions
CREATE TABLE public.affiliate_commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id),
  order_id UUID NOT NULL REFERENCES public.orders(id),
  commission_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','paid','reversed')),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_aff_comm_affiliate ON public.affiliate_commissions(affiliate_id);
CREATE INDEX idx_aff_comm_order ON public.affiliate_commissions(order_id);

-- 10. abandoned_carts
CREATE TABLE public.abandoned_carts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  stripe_checkout_session_id TEXT,
  products JSONB NOT NULL,
  total_cents INTEGER NOT NULL,
  recovery_email_sent BOOLEAN DEFAULT false,
  recovery_token TEXT DEFAULT encode(gen_random_bytes(32), 'hex'),
  recovered_order_id UUID REFERENCES public.orders(id),
  abandoned_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_abandoned_carts_email ON public.abandoned_carts(email, recovery_email_sent);
CREATE INDEX idx_abandoned_carts_token ON public.abandoned_carts(recovery_token);

-- 11. Alter student_classes
-- NOTE: student_classes already has subscription_expires_at. We reuse it for Stripe access expiration.
-- No new access_expires_at column needed — use subscription_expires_at as the canonical field.
ALTER TABLE public.student_classes ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id);

-- Add 'stripe' to the source CHECK constraint
ALTER TABLE public.student_classes DROP CONSTRAINT IF EXISTS student_classes_source_check;
ALTER TABLE public.student_classes
  ADD CONSTRAINT student_classes_source_check
  CHECK (source IN ('manual', 'memberkit', 'kiwify', 'invite', 'tasting', 'stripe'));

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE public.stripe_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_product_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

-- stripe_products: public read (active), admin write
CREATE POLICY "Anyone can read active products" ON public.stripe_products
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage products" ON public.stripe_products
  FOR ALL USING (public.get_auth_user_role() = 'administrator');

-- stripe_product_classes: public read, admin write
CREATE POLICY "Anyone can read product classes" ON public.stripe_product_classes
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage product classes" ON public.stripe_product_classes
  FOR ALL USING (public.get_auth_user_role() = 'administrator');

-- orders: student sees own, admin sees all
CREATE POLICY "Users see own orders" ON public.orders
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins see all orders" ON public.orders
  FOR SELECT USING (public.get_auth_user_role() = 'administrator');
-- NOTE: Edge Functions use service_role key which bypasses RLS entirely.
-- No INSERT/UPDATE policies needed for service role operations.
-- Admins can manage orders through the admin dashboard:
CREATE POLICY "Admins can manage orders" ON public.orders
  FOR ALL USING (public.get_auth_user_role() = 'administrator');

-- order_items: follow orders access
CREATE POLICY "Users see own order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  );
CREATE POLICY "Admins see all order items" ON public.order_items
  FOR SELECT USING (public.get_auth_user_role() = 'administrator');
CREATE POLICY "Admins can manage order items" ON public.order_items
  FOR ALL USING (public.get_auth_user_role() = 'administrator');

-- payments: student sees own, admin sees all
CREATE POLICY "Users see own payments" ON public.payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = payments.order_id AND orders.user_id = auth.uid())
  );
CREATE POLICY "Admins see all payments" ON public.payments
  FOR SELECT USING (public.get_auth_user_role() = 'administrator');
CREATE POLICY "Admins can manage payments" ON public.payments
  FOR ALL USING (public.get_auth_user_role() = 'administrator');

-- refunds: admin only
CREATE POLICY "Admins see all refunds" ON public.refunds
  FOR SELECT USING (public.get_auth_user_role() = 'administrator');
CREATE POLICY "Admins can manage refunds" ON public.refunds
  FOR ALL USING (public.get_auth_user_role() = 'administrator');

-- coupons: public read active, admin write
CREATE POLICY "Anyone can read active coupons" ON public.coupons
  FOR SELECT USING (is_active = true AND (valid_until IS NULL OR valid_until > now()));
CREATE POLICY "Admins can manage coupons" ON public.coupons
  FOR ALL USING (public.get_auth_user_role() = 'administrator');

-- affiliates: affiliate sees own, admin sees all
CREATE POLICY "Affiliates see own record" ON public.affiliates
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins see all affiliates" ON public.affiliates
  FOR SELECT USING (public.get_auth_user_role() = 'administrator');
CREATE POLICY "Admins can manage affiliates" ON public.affiliates
  FOR ALL USING (public.get_auth_user_role() = 'administrator');

-- affiliate_commissions: affiliate sees own, admin sees all
CREATE POLICY "Affiliates see own commissions" ON public.affiliate_commissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.affiliates WHERE affiliates.id = affiliate_commissions.affiliate_id AND affiliates.user_id = auth.uid())
  );
CREATE POLICY "Admins see all commissions" ON public.affiliate_commissions
  FOR SELECT USING (public.get_auth_user_role() = 'administrator');
CREATE POLICY "Admins can manage commissions" ON public.affiliate_commissions
  FOR ALL USING (public.get_auth_user_role() = 'administrator');

-- abandoned_carts: admin only
CREATE POLICY "Admins see abandoned carts" ON public.abandoned_carts
  FOR SELECT USING (public.get_auth_user_role() = 'administrator');
CREATE POLICY "Admins can manage abandoned carts" ON public.abandoned_carts
  FOR ALL USING (public.get_auth_user_role() = 'administrator');
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase db push` or `npx supabase migration up`
Expected: All tables created, RLS enabled, indexes created.

- [ ] **Step 3: Regenerate TypeScript types**

Run: `npx supabase gen types typescript --local > src/lib/supabase/types.ts`
Expected: Types file updated with all new tables.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260319000001_stripe_financial_tables.sql src/lib/supabase/types.ts
git commit -m "feat: add 9 financial tables for Stripe integration with RLS policies"
```

---

## Phase 2: Shared Utilities and Edge Functions

### Task 2: Create shared email templates

**Files:**
- Create: `supabase/functions/_shared/email-templates.ts`

**IMPORTANT:** This must be done BEFORE the webhook Edge Function (Task 4) which sends emails.

- [ ] **Step 1: Create the `_shared` directory and email templates**

Create `supabase/functions/_shared/email-templates.ts` with reusable HTML email builder functions following the exact pattern from `supabase/functions/kiwify-webhook/index.ts` (lines 180-218):

- `welcomeEmail(firstName, productName, appUrl, expiresAt)` — same Everest branding (orange header `#ff6b35`, mountain emoji)
- `paymentFailedEmail(firstName, productName, retryUrl)`
- `refundEmail(firstName, productName, amountFormatted, reason)`
- `cartRecoveryEmail(firstName, productName, recoveryUrl)`
- `expirationWarningEmail(firstName, productName, daysLeft, renewUrl)`
- `accessExpiredEmail(firstName, productName, renewUrl)`

All functions return `{ subject: string, html: string }`.

Deno import: Edge Functions import from `_shared` using relative paths: `import { welcomeEmail } from '../_shared/email-templates.ts'`

- [ ] **Step 2: Create shared Resend email sender**

Create `supabase/functions/_shared/send-email.ts`:
```typescript
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''

export async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Everest Preparatorios <noreply@app.everestpreparatorios.com.br>',
      to: [to],
      subject,
      html,
    }),
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/email-templates.ts supabase/functions/_shared/send-email.ts
git commit -m "feat: add shared email templates and sender for Stripe transactional emails"
```

### Task 3: Create stripe-checkout Edge Function

**Files:**
- Create: `supabase/functions/stripe-checkout/index.ts`

**Docs to reference:**
- Stripe Checkout Sessions: https://docs.stripe.com/api/checkout/sessions
- Stripe PaymentIntents: https://docs.stripe.com/api/payment_intents
- PIX Brazil: https://docs.stripe.com/payments/pix
- Installments Brazil: https://docs.stripe.com/payments/installments

- [ ] **Step 1: Create the Edge Function**

The function should:
1. Verify Supabase JWT from `Authorization` header
2. Parse body: `{ product_slug, coupon_code?, affiliate_code?, payment_method, split_amounts? }`
3. Look up `stripe_products` + `stripe_product_classes` by slug
4. Validate coupon if provided (check DB: active, not expired, not max uses, applicable to product)
5. Create/find Stripe Customer by user email
6. For `card`: create Checkout Session with `payment_method_types: ['card']` and `payment_method_options.card.installments.enabled: true`
7. For `pix`: create Checkout Session with `payment_method_types: ['pix']`
8. For `split_card`: create 2 separate PaymentIntents with split amounts
9. Insert into `orders` (status='pending') and `order_items`
10. If affiliate_code: look up affiliates table, set `orders.affiliate_id`
11. Return `{ client_secret, order_id }` to frontend

Follow exact pattern from `supabase/functions/kiwify-webhook/index.ts`: Deno imports, CORS headers, `serve()`, `jsonResponse()` helper, `createClient` from esm.sh.

Use `import Stripe from "https://esm.sh/stripe@17?target=deno"` for Stripe SDK.

- [ ] **Step 2: Test locally with Stripe CLI**

Run: `npx supabase functions serve stripe-checkout --env-file supabase/.env.local`
Then: `stripe trigger checkout.session.completed` (Stripe CLI)
Expected: Function responds with client_secret.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/stripe-checkout/index.ts
git commit -m "feat: add stripe-checkout Edge Function for payment processing"
```

### Task 4: Create stripe-webhook Edge Function

**Files:**
- Create: `supabase/functions/stripe-webhook/index.ts`

**Docs to reference:**
- Webhook events: https://docs.stripe.com/webhooks
- constructEvent: https://docs.stripe.com/webhooks/signatures

- [ ] **Step 1: Create the Edge Function**

The function should handle these events with idempotency checks:

**`checkout.session.completed`:**
1. Check if `orders.status` is already `'paid'` → no-op (idempotency)
2. Get order by `stripe_checkout_session_id`
3. If `user_id` is NULL (landing page): create auth user + `public.users` + `students` (same pattern as `kiwify-webhook/index.ts` lines 104-156)
4. Backfill `orders.user_id`
5. For each `order_items`: insert `student_classes` with `source='stripe'`, `access_expires_at = now() + access_days`, `order_id`
6. If `orders.affiliate_id`: insert `affiliate_commissions`, update `affiliates.total_earned_cents`
7. Update `orders.status = 'paid'`
8. Send welcome email via Resend (same template as kiwify-webhook lines 176-233)

**`payment_intent.succeeded`:**
1. Find payment by `stripe_payment_intent_id` → no-op if already `succeeded`
2. Update `payments` with `stripe_charge_id`, `net_amount_cents`, `stripe_fee_cents`, `card_last4`, `card_brand`, `paid_at`
3. For split_card: increment `orders.split_payments_completed`. If completed == expected, trigger enrollment flow above

**`payment_intent.payment_failed`:**
1. Update `payments.status = 'failed'`
2. Update `orders.status = 'failed'`
3. Send failure email via Resend

**`charge.refunded`:**
1. Find order by charge → payment → order
2. Insert into `refunds`
3. Deactivate `student_classes` where `order_id` matches
4. Update `orders.status = 'refunded'`
5. If affiliate commission exists: set `status = 'reversed'`, update `affiliates.total_earned_cents`
6. Send refund confirmation email

**`checkout.session.expired`:**
1. Insert into `abandoned_carts` with products JSONB and email from session

**`charge.dispute.created`:**
1. Deactivate `student_classes` where `order_id` matches
2. Create admin notification

**Subscription events (Phase 2 stub):** For `customer.subscription.created/updated/deleted`, log the event with `console.log('[stripe-webhook] Subscription event (Phase 2):', event.type)` and return 200. No action taken in Phase 1.

Validate all webhooks with `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)`.

- [ ] **Step 2: Test with Stripe CLI**

Run: `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`
Then: `stripe trigger checkout.session.completed`
Expected: Order created, enrollment created.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/stripe-webhook/index.ts
git commit -m "feat: add stripe-webhook Edge Function with 6 event handlers"
```

### Task 5: Create stripe-admin Edge Function

**Files:**
- Create: `supabase/functions/stripe-admin/index.ts`

- [ ] **Step 1: Create the Edge Function**

The function should:
1. Verify JWT + check role = 'administrator'
2. Parse body: `{ action, ...params }`
3. Actions:
   - `refund`: `{ order_id, amount_cents?, reason }` → `stripe.refunds.create()`, insert into `refunds`, update order
   - `create-coupon`: `{ code, discount_type, discount_value, max_uses?, valid_until?, applicable_products? }` → `stripe.coupons.create()`, insert into `coupons`
   - `deactivate-coupon`: `{ coupon_id }` → update `coupons.is_active = false`
   - `extend-access`: `{ student_class_id, new_expires_at }` → update `student_classes.access_expires_at`
   - `resend-welcome`: `{ order_id }` → fetch order + user, send email via Resend

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/stripe-admin/index.ts
git commit -m "feat: add stripe-admin Edge Function for refunds, coupons, access management"
```

### Task 6: Create stripe-landing Edge Function

**Files:**
- Create: `supabase/functions/stripe-landing/index.ts`

- [ ] **Step 1: Create the Edge Function**

Same as `stripe-checkout` but:
1. No JWT validation (public endpoint)
2. Receives `{ email, name, product_slug, coupon_code?, affiliate_code?, payment_method }` in body
3. Rate limit: use IP from `x-forwarded-for` header. Check `orders` count by email in last 5 minutes (simple rate limit — reject if >5 pending orders from same email in window)
4. Create order with `user_id = NULL`, store email/name in `metadata`
5. Look up product by `landing_page_slug`
6. Return `{ client_secret, order_id }`

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/stripe-landing/index.ts
git commit -m "feat: add stripe-landing Edge Function for external sales page checkout"
```

---

## Phase 3: Frontend Services

### Task 7: Install Stripe dependencies and configure

**Files:**
- Modify: `package.json`
- Create: `src/lib/stripe.ts`

- [ ] **Step 1: Install packages**

Run: `npm install @stripe/stripe-js @stripe/react-stripe-js`

- [ ] **Step 2: Create Stripe client singleton**

```typescript
// src/lib/stripe.ts
import { loadStripe } from '@stripe/stripe-js'

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

if (!publishableKey) {
  console.warn('VITE_STRIPE_PUBLISHABLE_KEY not set')
}

export const stripePromise = publishableKey ? loadStripe(publishableKey) : null
```

- [ ] **Step 3: Add env var to .env.example (if exists) or document**

Add `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...` to environment.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/stripe.ts
git commit -m "feat: install Stripe JS SDK and create client singleton"
```

### Task 8: Create financial services

**Files:**
- Create: `src/services/stripeService.ts`
- Create: `src/services/financialService.ts`
- Create: `src/services/couponService.ts`
- Create: `src/services/affiliateService.ts`

- [ ] **Step 1: Create stripeService.ts**

```typescript
// src/services/stripeService.ts
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

interface CheckoutParams {
  productSlug: string
  couponCode?: string
  affiliateCode?: string
  paymentMethod: 'card' | 'pix' | 'split_card'
  splitAmounts?: { amount: number }[]
}

export const createCheckoutSession = async (params: CheckoutParams) => {
  const { data: { session } } = await supabase.auth.getSession()

  const response = await supabase.functions.invoke('stripe-checkout', {
    body: params,
    headers: { Authorization: `Bearer ${session?.access_token}` },
  })

  if (response.error) {
    logger.error('Checkout error:', response.error)
    throw new Error(response.error.message || 'Erro ao processar pagamento')
  }

  return response.data as { client_secret: string; order_id: string }
}

export const createLandingCheckout = async (params: CheckoutParams & { email: string; name: string }) => {
  const response = await supabase.functions.invoke('stripe-landing', {
    body: params,
  })

  if (response.error) {
    logger.error('Landing checkout error:', response.error)
    throw new Error(response.error.message || 'Erro ao processar pagamento')
  }

  return response.data as { client_secret: string; order_id: string }
}
```

- [ ] **Step 2: Create financialService.ts**

Service for admin dashboard queries: `getOrders()`, `getOrderById()`, `getFinancialStats()`, `getRevenueByMonth()`, `getAbandonedCarts()`, `exportOrdersCSV()`. All query from Supabase tables with filters. Follow pattern from `src/services/adminStatsService.ts`.

- [ ] **Step 3: Create couponService.ts**

Service: `validateCoupon(code, productId)`, `getCoupons()`, `createCoupon()`, `deactivateCoupon()`. Admin operations go through `stripe-admin` Edge Function.

- [ ] **Step 4: Create affiliateService.ts**

Service: `getAffiliates()`, `createAffiliate()`, `updateAffiliate()`, `getCommissions()`, `markCommissionPaid()`. Admin operations go through `stripe-admin` Edge Function.

- [ ] **Step 5: Commit**

```bash
git add src/services/stripeService.ts src/services/financialService.ts src/services/couponService.ts src/services/affiliateService.ts
git commit -m "feat: add financial, coupon, affiliate, and stripe services"
```

---

## Phase 4: Checkout Page

### Task 9: Create CheckoutPage component

**Files:**
- Create: `src/pages/checkout/CheckoutPage.tsx`
- Modify: `src/App.tsx` (add route)

**Docs to reference:**
- React Stripe Elements: https://docs.stripe.com/stripe-js/react
- CardElement: https://docs.stripe.com/js/element/card

- [ ] **Step 1: Create the CheckoutPage**

The page has two columns (responsive → single column on mobile):

**Left column — Order Summary:**
- Product name, description (from `stripe_products` fetched by `:slug`)
- Access duration ("Acesso por 1 ano")
- Subtotal, coupon discount (if applied), total
- Coupon input field + "Aplicar" button
- Validate coupon via `couponService.validateCoupon()`

**Right column — Payment:**
- 3 tab buttons: "Cartão", "PIX", "2 Cartões"
- **Cartão tab:** Stripe `CardElement` + installments dropdown (1x to `installments_max`)
- **PIX tab:** Stripe `PaymentElement` with PIX type. Show QR code after submit.
- **2 Cartões tab:** Two `CardElement`s + two amount inputs that must sum to total
- Green submit button (#16a34a): "Finalizar Compra — R$ X.XXX,XX"
- Security badge: "Pagamento seguro via Stripe"

**Flow:**
1. Fetch product by slug from `stripe_products`
2. On submit: call `stripeService.createCheckoutSession()`
3. Get `client_secret`, use `stripe.confirmCardPayment(clientSecret, { payment_method: ... })`
4. On success: redirect to `/checkout/sucesso?order=ORDER_ID`
5. On failure: show error toast

**Cart recovery:** If URL has `?recover=TOKEN`, look up `abandoned_carts` by `recovery_token`, pre-fill the product and email from the cart data.

Wrap entire page in `<Elements stripe={stripePromise}>`.

Use `usePageTitle('Checkout')`. Use existing UI components: `Card`, `Button`, `Input`, `Badge` from `@/components/ui/`.

- [ ] **Step 2: Create success page**

Create `src/pages/checkout/CheckoutSuccessPage.tsx`:
- Green checkmark icon
- "Compra realizada com sucesso!"
- Order details (product, value, method)
- "Acessar meus cursos" button → `/courses`
- For new users: "Você receberá um email com seu link de acesso"

- [ ] **Step 3: Add routes to App.tsx**

Add inside the public routes section (checkout should work both for logged-in and new users):

```typescript
<Route path="/checkout/:slug" element={<CheckoutPage />} />
<Route path="/checkout/sucesso" element={<CheckoutSuccessPage />} />
```

- [ ] **Step 4: Test the checkout flow manually**

1. Navigate to `/checkout/turma-eaof-2026` (need a test product slug)
2. Enter test card `4242 4242 4242 4242`
3. Select installments
4. Submit → should redirect to success page

- [ ] **Step 5: Commit**

```bash
git add src/pages/checkout/CheckoutPage.tsx src/pages/checkout/CheckoutSuccessPage.tsx src/App.tsx
git commit -m "feat: add checkout page with Stripe Elements (card, PIX, split card)"
```

---

## Phase 5: Admin Financial Dashboard

### Task 10: Create Financial Dashboard page

**Files:**
- Create: `src/pages/admin/financeiro/FinancialDashboardPage.tsx`
- Modify: `src/App.tsx` (add admin routes)
- Modify: `src/components/UnifiedSidebar.tsx` (add sidebar section)

- [ ] **Step 1: Create the Dashboard page**

Follow pattern from existing admin pages (`AdminDashboard.tsx`):

1. `usePageTitle('Financeiro')`
2. 7 KPI cards in a grid (4 cols desktop, 2 cols tablet, 1 col mobile):
   - Receita Total (green) — sum of `orders.total_cents` where status='paid', current month
   - Vendas do Mês (blue) — count of paid orders this month
   - Ticket Médio (yellow) — average of paid orders this month
   - Reembolsos (red) — count + sum of refunds this month
   - Taxa de Conversão (purple) — paid / (paid + failed + expired) this month
   - Carrinhos Abandonados (teal) — count from `abandoned_carts` this month
   - Comissões Pendentes (orange) — sum of `affiliate_commissions` where status='pending'
3. Revenue chart (12 months) using `recharts` `BarChart` component
4. `PageTabs` with tabs: Dashboard | Vendas | Reembolsos | Carrinhos Abandonados | Cupons | Afiliados | Relatórios

Use `financialService.getFinancialStats()` and `financialService.getRevenueByMonth()` for data.

Each tab should show inline content. Vendas, Cupons, Afiliados, and Relatórios tabs navigate to their own routes via `useNavigate()`.

- [ ] **Step 2: Add admin routes to App.tsx**

Inside the administrator-only `<Route>` block (around line 449):

```typescript
<Route path="financeiro" element={<FinancialDashboardPage />} />
<Route path="financeiro/vendas" element={<SalesListPage />} />
<Route path="financeiro/cupons" element={<CouponsPage />} />
<Route path="financeiro/afiliados" element={<AffiliatesPage />} />
<Route path="financeiro/relatorios" element={<ReportsPage />} />
```

- [ ] **Step 3: Add Financeiro to admin sidebar**

In `src/components/UnifiedSidebar.tsx`, add a new group in `adminMenuGroups` after "Análise":

```typescript
{
  group: 'Financeiro',
  icon: DollarSign,
  collapsible: true,
  roles: ['administrator'],
  items: [
    { label: 'Dashboard', href: '/admin/financeiro', icon: BarChart3 },
    { label: 'Vendas', href: '/admin/financeiro/vendas', icon: ShoppingCart },
    { label: 'Cupons', href: '/admin/financeiro/cupons', icon: Tag },
    { label: 'Afiliados', href: '/admin/financeiro/afiliados', icon: Users },
    { label: 'Relatórios', href: '/admin/financeiro/relatorios', icon: FileText },
  ],
},
```

Import icons: `DollarSign, BarChart3, ShoppingCart, Tag, FileText` from `lucide-react`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/financeiro/FinancialDashboardPage.tsx src/App.tsx src/components/UnifiedSidebar.tsx
git commit -m "feat: add financial dashboard with 7 KPIs, revenue chart, and sidebar navigation"
```

### Task 11: Create Sales List page (includes Reembolsos and Carrinhos Abandonados tabs)

**Files:**
- Create: `src/pages/admin/financeiro/SalesListPage.tsx`

- [ ] **Step 1: Create the page**

Follow pattern from `AdminKiwifyProductsPage.tsx` (`src/pages/admin/integrations/AdminKiwifyProductsPage.tsx`) — uses useState for filters, supabase queries with `.eq()` filters, Dialog for edit/create, and table with actions.

1. `usePageTitle('Vendas')`
2. **3 client-side sub-tabs** at top: "Todas as Vendas" | "Reembolsos" | "Carrinhos Abandonados"
3. Filter bar: search input, status dropdown (Todos/Pago/Pendente/Falhou/Reembolsado), method dropdown (Todos/Cartão/PIX/2 Cartões), period dropdown, "Exportar CSV" button
4. **Todas as Vendas tab:** Table columns: Data, Aluno (name + email), Produto, Valor, Parcelas, Método (badge), Status (colored badge), Ações (Ver detalhes, Reembolsar). Pagination.
5. **Reembolsos tab:** Filtered view showing only orders with status='refunded'. Additional columns: Motivo, Admin que aprovou, Data do reembolso. Data from `refunds` table joined with `orders`.
6. **Carrinhos Abandonados tab:** Data from `abandoned_carts` table. Columns: Email, Produto, Valor, Abandonado em, Email de recuperação enviado?, Recuperado?. Action: "Enviar email de recuperação" button.
7. "Ver detalhes" opens Dialog with full order info (payments, items, affiliate, coupon)
8. "Reembolsar" opens confirmation Dialog, calls `stripe-admin` with action `refund`

Use `financialService.getOrders(filters)` for data.

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/financeiro/SalesListPage.tsx
git commit -m "feat: add sales list page with filters, table, refund action"
```

### Task 12: Create Coupons page

**Files:**
- Create: `src/pages/admin/financeiro/CouponsPage.tsx`

- [ ] **Step 1: Create the page**

CRUD page for coupons:
1. `usePageTitle('Cupons')`
2. "Criar Cupom" button opens Dialog
3. Form: code, discount_type (% or fixed R$), discount_value, max_uses, valid_until, applicable_products (multi-select of stripe_products)
4. Table: code, type, value, uses (current/max), valid until, status, actions (edit, deactivate, copy link)
5. Copy link generates: `https://app.everestpreparatorios.com.br/checkout/SLUG?coupon=CODE`

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/financeiro/CouponsPage.tsx
git commit -m "feat: add coupons management page with CRUD"
```

### Task 13: Create Affiliates page

**Files:**
- Create: `src/pages/admin/financeiro/AffiliatesPage.tsx`

- [ ] **Step 1: Create the page**

1. `usePageTitle('Afiliados')`
2. 3 stat cards: Total Afiliados Ativos, Vendas via Afiliados, Comissões Pendentes
3. "Criar Afiliado" button → Dialog: select user, affiliate_code (auto-generated or custom), commission_percent
4. Table: Afiliado (name + email), Código, Comissão %, Vendas, Total Ganho, Pendente, Ações (Editar, Pagar)
5. "Pagar" marks commissions as `paid` via `stripe-admin`
6. Each affiliate row expandable to show commission history

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/financeiro/AffiliatesPage.tsx
git commit -m "feat: add affiliates management page with commissions"
```

### Task 14: Create Reports page

**Files:**
- Create: `src/pages/admin/financeiro/ReportsPage.tsx`

- [ ] **Step 1: Create the page**

1. `usePageTitle('Relatórios')`
2. Period selector (este mês, último mês, últimos 3 meses, último ano, custom range)
3. Metrics row: MRR, Ticket Médio, Taxa de Churn, LTV estimado
4. Charts (using `recharts` — already in package.json):
   - Receita por mês (BarChart)
   - Vendas por dia (LineChart)
   - Métodos de pagamento (PieChart: card vs PIX vs split)
   - Funil de conversão (BarChart: visitantes → checkout → pagamento → confirmado)
5. Month comparison table: mês atual vs anterior (receita, vendas, ticket médio, reembolsos)
6. Export buttons: CSV (all orders), PDF (report summary)

For CSV: generate client-side with `financialService.exportOrdersCSV()`.
For PDF: use `jspdf` (already in dependencies).

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/financeiro/ReportsPage.tsx
git commit -m "feat: add financial reports page with charts, metrics, CSV/PDF export"
```

---

## Phase 6: Student-Facing Changes

### Task 15: Add "Comprar" button to course catalog

**Files:**
- Modify: `src/pages/student/courses/MyCoursesPage.tsx` or the course catalog/vitrine page

- [ ] **Step 1: Find the course catalog page**

Check if there's a "vitrine" or catalog page showing available courses. Look at routes for `/courses` or `/vitrine`.

- [ ] **Step 2: Add purchase button**

For courses where the student is NOT enrolled:
- Show price from `stripe_products` (matched by `class_id`)
- Green "Comprar" button (`bg-green-600 hover:bg-green-700 text-white`): `#16a34a`
- On click: navigate to `/checkout/${product.landing_page_slug}`

For courses where the student IS enrolled:
- Keep existing "Acessar" button

- [ ] **Step 3: Commit**

```bash
git add src/pages/student/courses/MyCoursesPage.tsx
git commit -m "feat: add green Comprar button for non-enrolled courses with price"
```

### Task 16: Add expiration banners to student dashboard

**Files:**
- Modify: `src/pages/student/Dashboard.tsx`

- [ ] **Step 1: Add expiration warning**

Query `student_classes.access_expires_at` for current user. If any class expires within 30 days:
- Yellow banner (30-7 days): "Seu acesso ao curso X expira em Y dias. [Renovar]"
- Red banner (7-0 days): "Seu acesso ao curso X expira em Y dias! [Renovar agora]"

`[Renovar]` links to `/checkout/${slug}`.

- [ ] **Step 2: Commit**

```bash
git add src/pages/student/Dashboard.tsx
git commit -m "feat: add access expiration warning banners to student dashboard"
```

---

## Phase 7: pg_cron Jobs and Emails

### Task 17: Create pg_cron migration for automated jobs

**Files:**
- Create: `supabase/migrations/20260319000002_stripe_cron_jobs.sql`

- [ ] **Step 1: Write the cron jobs migration**

```sql
-- Enable pg_cron extension (if not already)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Deactivate expired access (daily at midnight UTC-3)
SELECT cron.schedule(
  'deactivate-expired-access',
  '0 3 * * *', -- 00:00 BRT (UTC-3)
  $$
    -- Access expiration is enforced by subscription_expires_at.
    -- RLS policies and the useAuth hook already check this field.
    -- This cron job sends expiration notifications (email + in-app).
    -- The student's access is blocked by existing RLS/hook checks on subscription_expires_at.
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT sc.user_id, 'Acesso expirado', 'Seu acesso ao curso expirou. Renove para continuar.', 'warning'
    FROM public.student_classes sc
    WHERE sc.subscription_expires_at IS NOT NULL
      AND sc.subscription_expires_at < now()
      AND sc.subscription_expires_at > now() - interval '1 day'
      AND sc.source = 'stripe';
  $$
);

-- 2. Expire unpaid PIX orders
SELECT cron.schedule(
  'expire-pix-orders',
  '*/30 * * * *', -- every 30 min
  $$
    UPDATE public.orders
    SET status = 'expired'
    WHERE status = 'pending'
      AND payment_method = 'pix'
      AND created_at < now() - interval '24 hours';
  $$
);
```

Note: Email-sending cron jobs (abandoned cart recovery, expiration warnings) should invoke Edge Functions. These are better handled by a separate Edge Function triggered by pg_cron via `pg_net` extension, or by a scheduled Vercel cron. Document this decision — implementation can use either approach.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260319000002_stripe_cron_jobs.sql
git commit -m "feat: add pg_cron jobs for access expiration and PIX cleanup"
```

**(Email templates already created in Task 2)**

---

## Phase 8: Admin Products Management

### Task 18: Create Stripe Products admin page (do this BEFORE testing checkout)

**Files:**
- Create: `src/pages/admin/financeiro/StripeProductsPage.tsx`
- Modify: `src/App.tsx` (add route)
- Modify: `src/components/UnifiedSidebar.tsx` (add "Produtos" to Financeiro group)

- [ ] **Step 1: Create the page**

Follow pattern from `AdminKiwifyProductsPage.tsx`:
1. `usePageTitle('Produtos Stripe')`
2. Stats cards: total products, active count, bundles count
3. "Criar Produto" button → Dialog
4. Form: product_name, stripe_product_id, stripe_price_id, price (R$), installments_max, access_days, is_bundle, landing_page_slug, class selection (single or multi for bundles)
5. Table: name, price, parcelas max, acesso (dias), turma(s), slug, status, actions
6. Copy checkout URL button

- [ ] **Step 2: Add route and sidebar item**

Route: `<Route path="financeiro/produtos" element={<StripeProductsPage />} />`
Sidebar: add `{ label: 'Produtos', href: '/admin/financeiro/produtos', icon: Package }` to Financeiro group.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/financeiro/StripeProductsPage.tsx src/App.tsx src/components/UnifiedSidebar.tsx
git commit -m "feat: add Stripe products management page for admin"
```

---

## Phase 9: Integration and Testing

### Task 19: End-to-end flow test (requires Task 18 products page for creating test products)

- [ ] **Step 1: Configure Stripe test keys**

Set in Supabase Secrets:
- `STRIPE_SECRET_KEY=sk_test_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`

Set in `.env.local`:
- `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...`

- [ ] **Step 2: Create a test product in Stripe Dashboard**

1. Create Product "Turma EAOF 2026 (Test)" in Stripe Dashboard
2. Create Price: R$ 1.600,00 (160000 cents)
3. Insert into `stripe_products` and `stripe_product_classes` in DB

- [ ] **Step 3: Test full purchase flow**

1. Open `/checkout/turma-eaof-2026-test`
2. Fill card: `4242 4242 4242 4242`, any expiry, any CVC
3. Select 10x parcelas
4. Submit → should see success page
5. Check DB: `orders` (status=paid), `payments` (succeeded), `student_classes` (new row with source=stripe, access_expires_at = +365 days)

- [ ] **Step 4: Test refund flow**

1. Go to `/admin/financeiro/vendas`
2. Find the test order
3. Click "Reembolsar" → confirm
4. Check DB: `refunds` (succeeded), `orders` (status=refunded), `student_classes` (is_active=false)

- [ ] **Step 5: Test PIX flow**

1. Open checkout, select PIX
2. Submit → should see PIX QR code
3. Use Stripe test mode to complete PIX payment
4. Check webhook processes correctly

- [ ] **Step 6: Test coupon flow**

1. Create coupon "EVEREST10" (10% off) in admin
2. Open checkout, enter coupon
3. Verify price updates
4. Complete purchase → verify `orders.coupon_id` is set

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: e2e test fixes for Stripe payment flow"
```

### Task 20: Deploy Edge Functions and go live

- [ ] **Step 1: Deploy all 4 Edge Functions**

Run:
```bash
npx supabase functions deploy stripe-checkout --no-verify-jwt
npx supabase functions deploy stripe-webhook --no-verify-jwt
npx supabase functions deploy stripe-admin --no-verify-jwt
npx supabase functions deploy stripe-landing --no-verify-jwt
```

Note: `--no-verify-jwt` because we handle auth manually inside the functions (stripe-webhook and stripe-landing don't use JWT).

- [ ] **Step 2: Set Supabase Secrets in production**

```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_live_...
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

- [ ] **Step 3: Configure webhook in Stripe Dashboard**

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://hnhzindsfuqnaxosujay.supabase.co/functions/v1/stripe-webhook`
3. Select events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `checkout.session.expired`, `charge.dispute.created`

- [ ] **Step 4: Push migration to production**

Run: `npx supabase db push`

- [ ] **Step 5: Commit deployment notes**

```bash
git add -A
git commit -m "chore: deployment configuration for Stripe integration"
```
