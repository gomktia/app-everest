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
-- NOTE: FOR ALL creates SELECT+INSERT+UPDATE+DELETE. Admin's SELECT from FOR ALL
-- overlaps with the public SELECT policy. PostgreSQL uses OR semantics, so admins
-- can read both active AND inactive products. This is intentional.
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
-- NOTE: Edge Functions use service_role key which bypasses RLS entirely.
-- No INSERT/UPDATE policies needed for service role operations.
CREATE POLICY "Users see own orders" ON public.orders
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can manage orders" ON public.orders
  FOR ALL USING (public.get_auth_user_role() = 'administrator');

-- order_items: follow orders access
CREATE POLICY "Users see own order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  );
CREATE POLICY "Admins can manage order items" ON public.order_items
  FOR ALL USING (public.get_auth_user_role() = 'administrator');

-- payments: student sees own, admin sees all
CREATE POLICY "Users see own payments" ON public.payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = payments.order_id AND orders.user_id = auth.uid())
  );
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
CREATE POLICY "Admins can manage commissions" ON public.affiliate_commissions
  FOR ALL USING (public.get_auth_user_role() = 'administrator');

-- abandoned_carts: admin only
CREATE POLICY "Admins see abandoned carts" ON public.abandoned_carts
  FOR SELECT USING (public.get_auth_user_role() = 'administrator');
CREATE POLICY "Admins can manage abandoned carts" ON public.abandoned_carts
  FOR ALL USING (public.get_auth_user_role() = 'administrator');
