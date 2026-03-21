import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

/** Returns true if the error is about a missing table/relation (not deployed yet) */
const isTableMissing = (error: any) =>
  error?.message?.includes('does not exist') ||
  error?.message?.includes('relation') ||
  error?.code === '42P01'

// Types
export interface Order {
  id: string
  user_id: string | null
  stripe_checkout_session_id: string | null
  status: string
  total_cents: number
  currency: string
  payment_method: string | null
  installments: number | null
  created_at: string
  metadata: Record<string, unknown>
  // Joined
  user?: { first_name: string; last_name: string; email: string }
  order_items?: { stripe_products: { product_name: string } }[]
  coupon?: { code: string } | null
}

export interface FinancialStats {
  totalRevenue: number
  salesCount: number
  avgTicket: number
  refundsCount: number
  refundsTotal: number
  conversionRate: number
  abandonedCarts: number
  pendingCommissions: number
}

// Get orders with filters
export const getOrders = async (filters?: {
  status?: string
  paymentMethod?: string
  search?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}) => {
  let query = supabase
    .from('orders')
    .select(`
      *,
      user:users(first_name, last_name, email),
      order_items(*, stripe_products:stripe_products(product_name)),
      coupon:coupons(code)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.paymentMethod) query = query.eq('payment_method', filters.paymentMethod)
  if (filters?.startDate) query = query.gte('created_at', filters.startDate)
  if (filters?.endDate) query = query.lte('created_at', filters.endDate)
  if (filters?.search) query = query.or(`metadata->>email.ilike.%${filters.search}%,user.email.ilike.%${filters.search}%`)

  const page = filters?.page || 1
  const limit = filters?.limit || 20
  query = query.range((page - 1) * limit, page * limit - 1)

  const { data, error, count } = await query
  if (error) {
    if (isTableMissing(error)) return { orders: [], total: 0 }
    logger.error('getOrders error:', error); throw error
  }
  return { orders: data || [], total: count || 0 }
}

// Get single order with full details
export const getOrderById = async (orderId: string) => {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      user:users(first_name, last_name, email),
      order_items(*, stripe_products:stripe_products(product_name, price_cents)),
      payments(*),
      refunds(*),
      coupon:coupons(code, discount_type, discount_value),
      affiliate:affiliates(affiliate_code, commission_percent, user:users(first_name, last_name))
    `)
    .eq('id', orderId)
    .single()

  if (error) {
    if (isTableMissing(error)) return null
    logger.error('getOrderById error:', error); throw error
  }
  return data
}

// Get financial stats for dashboard
export const getFinancialStats = async (month?: string, dateRange?: { startDate: string; endDate: string }): Promise<FinancialStats> => {
  const emptyStats: FinancialStats = {
    totalRevenue: 0, salesCount: 0, avgTicket: 0,
    refundsCount: 0, refundsTotal: 0, conversionRate: 0,
    abandonedCarts: 0, pendingCommissions: 0,
  }

  try {
    let startDate: string
    let endDate: string

    if (dateRange) {
      startDate = dateRange.startDate
      endDate = dateRange.endDate
    } else {
      const startOfMonth = month ? `${month}-01` : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      startDate = startOfMonth
      endDate = month
        ? new Date(new Date(startOfMonth).getFullYear(), new Date(startOfMonth).getMonth() + 1, 0).toISOString()
        : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString()
    }

    const [ordersRes, refundsRes, cartsRes, commissionsRes] = await Promise.all([
      supabase.from('orders').select('total_cents, status').gte('created_at', startDate).lte('created_at', endDate),
      supabase.from('refunds').select('amount_cents').eq('status', 'succeeded').gte('created_at', startDate).lte('created_at', endDate),
      supabase.from('abandoned_carts').select('id', { count: 'exact', head: true }).gte('created_at', startDate).lte('created_at', endDate),
      supabase.from('affiliate_commissions').select('commission_cents').eq('status', 'pending'),
    ])

    // If any table doesn't exist, return empty stats silently
    if ([ordersRes, refundsRes, cartsRes, commissionsRes].some(r => r.error && isTableMissing(r.error))) {
      return emptyStats
    }

    const orders = ordersRes.data || []
    const paidOrders = orders.filter(o => o.status === 'paid')
    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total_cents, 0)
    const refunds = refundsRes.data || []
    const refundsTotal = refunds.reduce((sum, r) => sum + r.amount_cents, 0)
    const pendingCommissions = (commissionsRes.data || []).reduce((sum, c) => sum + c.commission_cents, 0)

    return {
      totalRevenue,
      salesCount: paidOrders.length,
      avgTicket: paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0,
      refundsCount: refunds.length,
      refundsTotal,
      conversionRate: orders.length > 0 ? Math.round((paidOrders.length / orders.length) * 100) : 0,
      abandonedCarts: cartsRes.count || 0,
      pendingCommissions,
    }
  } catch (error: any) {
    if (isTableMissing(error)) return emptyStats
    throw error
  }
}

// Get revenue by month (last 12 months)
export const getRevenueByMonth = async () => {
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  const { data, error } = await supabase
    .from('orders')
    .select('total_cents, created_at')
    .eq('status', 'paid')
    .gte('created_at', twelveMonthsAgo.toISOString())

  if (error) {
    if (isTableMissing(error)) return []
    logger.error('getRevenueByMonth error:', error); throw error
  }

  // Group by month
  const months: Record<string, number> = {}
  for (const order of (data || [])) {
    const month = order.created_at.substring(0, 7) // YYYY-MM
    months[month] = (months[month] || 0) + order.total_cents
  }

  return Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }))
}

// Get abandoned carts
export const getAbandonedCarts = async () => {
  const { data, error } = await supabase
    .from('abandoned_carts')
    .select('*')
    .order('abandoned_at', { ascending: false })

  if (error) {
    if (isTableMissing(error)) return []
    logger.error('getAbandonedCarts error:', error); throw error
  }
  return data || []
}

// Get refunds
export const getRefunds = async () => {
  const { data, error } = await supabase
    .from('refunds')
    .select(`
      *,
      order:orders(total_cents, user:users(first_name, last_name, email), order_items(stripe_products:stripe_products(product_name))),
      admin:users!refunds_admin_user_id_fkey(first_name, last_name)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    if (isTableMissing(error)) return []
    logger.error('getRefunds error:', error); throw error
  }
  return data || []
}

// Admin actions via Edge Function
export const adminRefund = async (orderId: string, amountCents?: number, reason?: string) => {
  const { data: { session } } = await supabase.auth.getSession()
  const { data, error } = await supabase.functions.invoke('stripe-admin', {
    body: { action: 'refund', order_id: orderId, amount_cents: amountCents, reason },
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
  })
  if (error) throw new Error(error.message || 'Erro ao processar reembolso')
  return data
}

export const adminExtendAccess = async (studentClassId: string, newExpiresAt: string) => {
  const { data: { session } } = await supabase.auth.getSession()
  const { data, error } = await supabase.functions.invoke('stripe-admin', {
    body: { action: 'extend-access', student_class_id: studentClassId, new_expires_at: newExpiresAt },
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
  })
  if (error) throw new Error(error.message || 'Erro ao estender acesso')
  return data
}

export const adminResendWelcome = async (orderId: string) => {
  const { data: { session } } = await supabase.auth.getSession()
  const { data, error } = await supabase.functions.invoke('stripe-admin', {
    body: { action: 'resend-welcome', order_id: orderId },
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
  })
  if (error) throw new Error(error.message || 'Erro ao reenviar email')
  return data
}
