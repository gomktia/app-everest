-- Enable pg_cron extension (if not already)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Send expiration notification for expired Stripe access (daily at midnight BRT)
SELECT cron.schedule(
  'notify-expired-stripe-access',
  '0 3 * * *',
  $$
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT sc.user_id, 'Acesso expirado', 'Seu acesso ao curso expirou. Renove para continuar.', 'warning'
    FROM public.student_classes sc
    WHERE sc.subscription_expires_at IS NOT NULL
      AND sc.subscription_expires_at < now()
      AND sc.subscription_expires_at > now() - interval '1 day'
      AND sc.source = 'stripe';
  $$
);

-- 2. Expire unpaid PIX orders (every 30 min)
SELECT cron.schedule(
  'expire-pix-orders',
  '*/30 * * * *',
  $$
    UPDATE public.orders
    SET status = 'expired'
    WHERE status = 'pending'
      AND payment_method = 'pix'
      AND created_at < now() - interval '24 hours';
  $$
);
