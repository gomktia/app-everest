# Stripe Financial System — Design Spec

**Date:** 2026-03-18
**Status:** Approved

## Overview

Replace Kiwify as primary payment processor with Stripe. Full financial management system: checkout embutido no app, pagamento com cartão parcelado (até 12x issuer-based), PIX, dois cartões, cupons, afiliados, carrinho abandonado, reembolsos, e dashboard financeiro completo no admin. Acesso de 1 ano por compra. Migração gradual — Kiwify continua funcionando em paralelo.

## Decisions

| Aspecto | Decisão |
|---------|---------|
| Modelo de cobrança | Pagamento único + assinatura + bundles |
| Acesso | 1 ano (365 dias) |
| Parcelamento | Até 12x no cartão (issuer-based, recebem valor cheio) |
| Métodos de pagamento | Cartão + PIX + dois cartões |
| Checkout | Stripe Elements embutido no app + link externo para página de vendas existente |
| Backend | Supabase Edge Functions (mesma infra atual) |
| Admin financeiro | Nível D: vendas, reembolsos, carrinho abandonado, cupons, relatórios, métricas, gráficos, CSV, afiliados/comissões |
| Afiliados | Comissão fixa % por venda |
| Botão compra | Verde (green-600 `#16a34a`) |
| Página de vendas | Já existe externamente — não criar nova |

## 1. Architecture

### Flow

```
ALUNO (App ou Landing Page existente)
  │ Stripe Elements (cartão/PIX/2 cartões)
  ▼
Edge Function: stripe-checkout / stripe-landing
  │ Cria PaymentIntent (orders.user_id = NULL para landing, preenchido no webhook)
  ▼
Stripe API
  │ Processa pagamento
  │ Webhook ──────────────────┐
  ▼                           ▼
Edge Function: stripe-webhook
  │
  ├─ checkout.session.completed → cria conta + matrícula + email boas-vindas (SOURCE OF TRUTH for enrollment)
  ├─ payment_intent.succeeded → atualiza payments com charge_id, fees, card info (NO enrollment here)
  ├─ payment_intent.payment_failed → marca order como failed + email de falha
  ├─ charge.refunded → remove acesso + registra reembolso + reverte comissão afiliado
  ├─ checkout.session.expired → carrinho abandonado
  └─ charge.dispute.created → alerta admin (chargeback) + bloqueia acesso
         │
         ▼
PostgreSQL (Supabase) — 9 tabelas financeiras
```

**Enrollment source of truth:** `checkout.session.completed` is the ONLY event that triggers account creation and enrollment. For split card flow (2 PaymentIntents), enrollment happens when BOTH intents succeed — tracked via `orders.split_payments_completed` counter.

**Webhook idempotency:** Every webhook handler checks current state before acting. E.g., if `orders.status` is already `'paid'`, `checkout.session.completed` is a no-op. Uses `stripe_checkout_session_id` as idempotency key to prevent duplicate enrollments, emails, or commission records.

**Landing page order flow:** `stripe-landing` creates order with `user_id = NULL` and stores email in `orders.metadata.email`. On `checkout.session.completed`, webhook creates user (if new), then backfills `orders.user_id`.

### Kiwify Compatibility

The existing `kiwify-webhook` Edge Function continues operating. Products can be migrated gradually: new products on Stripe, existing on Kiwify until they expire. `student_classes.source` distinguishes origin (`'kiwify'` vs `'stripe'`).

### Kiwify Migration Strategy

Existing Kiwify students are NOT migrated to `orders` — their `student_classes` records remain with `source='kiwify'`. When their access expires (or if they need renewal), they go through Stripe checkout. No backfill needed. New products are created in Stripe only; Kiwify products stay active until all enrolled students expire.

## 2. Database Schema

### New Tables

#### stripe_products

Maps Stripe products/prices to Everest classes. Supports bundles via `stripe_product_classes` join table.

```sql
CREATE TABLE stripe_products (
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

-- Join table: supports single class OR bundles (multiple classes per product)
CREATE TABLE stripe_product_classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_product_id UUID NOT NULL REFERENCES stripe_products(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  UNIQUE(stripe_product_id, class_id)
);
CREATE INDEX idx_spc_product ON stripe_product_classes(stripe_product_id);
CREATE INDEX idx_spc_class ON stripe_product_classes(class_id);
```

#### orders

```sql
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
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
  coupon_id UUID REFERENCES coupons(id),
  affiliate_id UUID REFERENCES affiliates(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_orders_stripe_session ON orders(stripe_checkout_session_id);
```

#### order_items

```sql
CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  stripe_product_id UUID NOT NULL REFERENCES stripe_products(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  price_cents INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1
);
CREATE INDEX idx_order_items_order ON order_items(order_id);
```

#### payments

```sql
CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id),
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
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_intent ON payments(stripe_payment_intent_id);
```

#### refunds

```sql
CREATE TABLE refunds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES payments(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  stripe_refund_id TEXT,
  amount_cents INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','succeeded','failed')),
  admin_user_id UUID REFERENCES users(id),
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### coupons

```sql
CREATE TABLE coupons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  stripe_coupon_id TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value INTEGER NOT NULL,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  applicable_products UUID[], -- references stripe_products.id; validated in application code (no FK on arrays)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### affiliates

```sql
CREATE TABLE affiliates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
  affiliate_code TEXT NOT NULL UNIQUE,
  commission_percent INTEGER NOT NULL DEFAULT 10,
  total_earned_cents INTEGER DEFAULT 0,
  total_paid_cents INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### affiliate_commissions

```sql
CREATE TABLE affiliate_commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES affiliates(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  commission_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','paid','reversed')),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_aff_comm_affiliate ON affiliate_commissions(affiliate_id);
CREATE INDEX idx_aff_comm_order ON affiliate_commissions(order_id);
```

#### abandoned_carts

```sql
CREATE TABLE abandoned_carts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  stripe_checkout_session_id TEXT,
  products JSONB NOT NULL,
  total_cents INTEGER NOT NULL,
  recovery_email_sent BOOLEAN DEFAULT false,
  recovery_token TEXT DEFAULT encode(gen_random_bytes(32), 'hex'),
  recovered_order_id UUID REFERENCES orders(id),
  abandoned_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_abandoned_carts_email ON abandoned_carts(email, recovery_email_sent);
CREATE INDEX idx_abandoned_carts_token ON abandoned_carts(recovery_token);
```

### Altered Tables

#### student_classes

```sql
-- student_classes already has subscription_expires_at — reuse it for Stripe access expiration.
-- No new column needed for expiration.
ALTER TABLE student_classes ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id);

-- Add 'stripe' to the source CHECK constraint
ALTER TABLE student_classes DROP CONSTRAINT IF EXISTS student_classes_source_check;
ALTER TABLE student_classes
  ADD CONSTRAINT student_classes_source_check
  CHECK (source IN ('manual', 'memberkit', 'kiwify', 'invite', 'tasting', 'stripe'));
```

**`subscription_expires_at` source of truth:** `student_classes.subscription_expires_at` is the canonical field checked by RLS, hooks, and pg_cron. This column already exists and is used by invites/tasting. Stripe enrollment sets `subscription_expires_at = now() + access_days`. Admin `extend-access` action updates only `student_classes.subscription_expires_at`.

### RLS Policies

- **orders, payments, refunds:** Students see own records only. Admins see all.
- **coupons:** Public read (active only, for checkout validation). Admin write.
- **affiliates:** Affiliate sees own record. Admin sees all + write.
- **affiliate_commissions:** Affiliate sees own. Admin sees all + write.
- **abandoned_carts:** Admin only.
- **stripe_products:** Public read (active only). Admin write.
- **No DELETE on financial tables** — use status fields for soft delete.

## 3. Edge Functions

### stripe-checkout

**Route:** `POST /functions/v1/stripe-checkout`
**Called by:** Frontend (authenticated user in app)
**Auth:** Requires valid Supabase JWT

Responsibilities:
1. Create/find Stripe Customer by email
2. Create Checkout Session or PaymentIntent
3. Support card (with installments), PIX, and split card (2 PaymentIntents)
4. Validate and apply coupon (check DB)
5. Record affiliate_code if present
6. Create `orders` record with status `pending`
7. Return `client_secret` to frontend

**Split card flow:** Frontend sends `[{amount, card_token}, {amount, card_token}]`. Edge Function creates 2 PaymentIntents, marks order as `split_card` with `split_payments_expected=2`.

**Split card failure recovery:** If first intent succeeds but second fails:
1. Order stays in `partial` status (not `paid`)
2. No enrollment granted
3. Frontend shows error: "O segundo cartão foi recusado. O primeiro pagamento de R$X será estornado automaticamente."
4. Auto-refund the first successful PaymentIntent via Stripe API
5. Student can retry with different cards

### stripe-webhook

**Route:** `POST /functions/v1/stripe-webhook`
**Called by:** Stripe (configured in Stripe Dashboard)
**Auth:** Validated via `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET`

Events processed:

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Payment confirmed → create account + enrollment + welcome email |
| `payment_intent.succeeded` | Update `payments` with charge_id, fees, card info |
| `payment_intent.payment_failed` | Mark order as `failed`, send failure email |
| `charge.refunded` | Create `refunds` record, revoke access, deactivate enrollment |
| `customer.subscription.created/updated/deleted` | Manage recurring subscriptions (Phase 2 — see note below) |
| `checkout.session.expired` | Record in `abandoned_carts` |
| `charge.dispute.created` | Alert admin (chargeback), temporarily block access |

**Subscriptions (Phase 2):** Recurring subscriptions (monthly/annual auto-renewal) are supported by the schema but implementation is deferred to Phase 2. Phase 1 focuses on one-time payments with 1-year access. The webhook handler stubs the subscription events with logging only. A `subscriptions` table will be designed in the Phase 2 spec.

### stripe-admin

**Route:** `POST /functions/v1/stripe-admin`
**Called by:** Admin dashboard (role=administrator only)
**Auth:** Requires valid Supabase JWT with admin role

Actions:
- `refund` — Full or partial refund via Stripe API
- `create-coupon` — Create coupon in Stripe + local DB
- `deactivate-coupon` — Deactivate coupon
- `extend-access` — Extend student's expiration date
- `cancel-subscription` — Cancel recurring subscription
- `resend-welcome` — Resend welcome email

### stripe-landing

**Route:** `POST /functions/v1/stripe-landing`
**Called by:** External landing page (no auth required)
**Auth:** Rate limited (5 req/min per IP)

Differences from stripe-checkout:
- No authentication required (new student, no account)
- Receives email + name in body alongside payment data
- Looks up product by `landing_page_slug`
- Captures `?ref=AFFILIATE_CODE` from URL

## 4. pg_cron Jobs

| Job | Schedule | Action |
|-----|----------|--------|
| Access expiration | Daily 00:00 | Deactivate `student_classes` where `access_expires_at < now()` |
| Abandoned cart email | Every 2h | Send recovery email for carts without `recovery_email_sent` |
| PIX cleanup | Every 30min | Expire unpaid PIX orders based on `payments.pix_expiration` (configurable in Stripe, typically 30min-24h) |
| Expiration warning 30d | Daily 08:00 | Email + notification for access expiring in 30 days |
| Expiration warning 7d | Daily 08:00 | Email + notification for access expiring in 7 days |

## 5. Frontend Pages

### New Pages — Admin

| Route | Page | Description |
|-------|------|-------------|
| `/admin/financeiro` | FinancialDashboardPage | 7 KPIs + revenue chart 12 months + PageTabs |
| `/admin/financeiro/vendas` | SalesListPage | All orders with filters (status, method, period), search, CSV export |
| `/admin/financeiro/cupons` | CouponsPage | CRUD coupons: code, type, value, uses, validity, applicable products |
| `/admin/financeiro/afiliados` | AffiliatesPage | CRUD affiliates: code, commission %, sales, earnings, pay button |
| `/admin/financeiro/relatorios` | ReportsPage | Charts, metrics (MRR, ticket médio, churn, LTV), month comparison, CSV/PDF export |

### Dashboard KPIs

1. Receita Total (+ % vs mês anterior)
2. Vendas do Mês (+ delta)
3. Ticket Médio (+ parcelas comuns)
4. Reembolsos (count + value + %)
5. Taxa de Conversão
6. Carrinhos Abandonados
7. Comissões Pendentes

### PageTabs

All financial pages share a PageTabs navigation bar (same pattern as other admin pages). Each tab is a separate route under `/admin/financeiro/*`. The full tabs:

Dashboard | Vendas | Reembolsos | Carrinhos Abandonados | Cupons | Afiliados | Relatórios

Note: Reembolsos and Carrinhos Abandonados are sub-tabs within the main page (client-side filtering on the sales/dashboard data), not separate routes.

### New Pages — Student/Checkout

| Route | Page | Description |
|-------|------|-------------|
| `/checkout/:slug` | CheckoutPage | Order summary + coupon input + Stripe Elements (card/PIX/2 cards) + installment selector. Green buy button (#16a34a). |

### Modified Pages

| Page | Change |
|------|--------|
| Course catalog (student) | Non-enrolled courses show price + green "Comprar" button → `/checkout/:slug` |
| Admin sidebar | New "Financeiro" section with DollarSign icon. Sub-items: Dashboard, Vendas, Cupons, Afiliados, Relatórios |

### Removed from Scope

- Landing page `/comprar/:slug` — client already has external sales page. Stripe Elements can be embedded there or link to `/checkout/:slug`.

## 6. Transactional Emails (via Resend)

| Trigger | Email | Content |
|---------|-------|---------|
| Payment succeeded | Welcome + Access | Name, course, magic link login, expiration date. Same Everest branding template. |
| Payment failed | Payment Failed | Warning + retry link to same checkout |
| Refund processed | Refund Confirmation | Amount, reason, 5-10 business days for chargeback |
| Cart abandoned (2h) | Cart Recovery | "Você deixou algo no carrinho!" + link with signed `recovery_token` → `/checkout/:slug?recover=TOKEN` pre-fills product. Max 1 per session. |
| 30 days before expiry | Access Expiring | Warning + renewal link (with renewal discount?) |
| Access expired | Access Expired | Notification + renewal link. Friendly tone. |

## 7. Access Lifecycle (1 Year)

| Day | Event | Action |
|-----|-------|--------|
| 0 | Purchase confirmed | Create account (if new) + enroll in class + welcome email. `access_expires_at = now() + 365 days`. Affiliate commission registered. |
| 1-335 | Active access | Normal access. No automated actions. |
| 335 | 30-day warning | Email + in-app notification + yellow dashboard banner |
| 358 | 7-day warning | Email + red dashboard banner |
| 365 | Access expired | pg_cron deactivates enrollment. Email sent. Student sees renewal screen. **Progress data preserved.** |
| 365+ | Renewal | Same checkout, detects existing user. Reactivates enrollment, new `access_expires_at`. Previous progress kept. |

## 8. Security

### Stripe
- Webhook validated via `stripe.webhooks.constructEvent()`
- Stripe Elements = PCI DSS compliant (card data never touches server)
- API keys only in Edge Functions (server-side)
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Supabase Secrets

### Database
- RLS on all financial tables
- Students see only their own orders/payments
- Only admins can view all data + perform refunds
- Affiliates see only their own commissions
- Financial tables: no DELETE (soft delete via status)

### Anti-fraud
- Stripe Radar (built-in) for fraud detection
- Rate limit on stripe-landing (5 req/min per IP)
- Idempotency key on PaymentIntents (prevents double charge)
- Chargeback: blocks access + alerts admin

### Emails
- Templates with Everest branding (same current pattern)
- Sent via Resend API (already configured)
- Abandoned cart: max 1 email per session
- Expiration: 2 emails (30 days + 7 days before)

## 9. Supabase Secrets Required

| Secret | Description |
|--------|-------------|
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret |
| `STRIPE_PUBLISHABLE_KEY` | Public key (also in frontend .env) |

## 10. Frontend Environment Variables

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

## 11. Services (Frontend)

| Service | File | Description |
|---------|------|-------------|
| Stripe checkout | `src/services/stripeService.ts` | Create checkout session, confirm payment |
| Financial data | `src/services/financialService.ts` | Orders, payments, refunds, stats queries |
| Coupons | `src/services/couponService.ts` | Validate, apply coupons |
| Affiliates | `src/services/affiliateService.ts` | CRUD affiliates, commissions |

## 12. Dependencies

```json
{
  "@stripe/stripe-js": "^5.x",
  "@stripe/react-stripe-js": "^3.x"
}
```

Server-side (Edge Functions):
```json
{
  "stripe": "https://esm.sh/stripe@17"
}
```
