import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

const isTableMissing = (error: any) =>
  error?.message?.includes('does not exist') ||
  error?.message?.includes('relation') ||
  error?.code === '42P01'

export interface Coupon {
  id: string
  code: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  max_uses: number | null
  current_uses: number
  valid_from: string
  valid_until: string | null
  applicable_products: string[] | null
  is_active: boolean
  created_at: string
}

export const getCoupons = async () => {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    if (isTableMissing(error)) return []
    logger.error('getCoupons error:', error); throw error
  }
  return data || []
}

export const validateCoupon = async (code: string, productId?: string) => {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('is_active', true)
    .single()

  if (error) {
    if (isTableMissing(error)) return { valid: false, message: 'Cupons indisponíveis no momento' }
    return { valid: false, message: 'Cupom não encontrado' }
  }
  if (!data) return { valid: false, message: 'Cupom não encontrado' }
  if (data.valid_until && new Date(data.valid_until) < new Date()) return { valid: false, message: 'Cupom expirado' }
  if (data.max_uses && data.current_uses >= data.max_uses) return { valid: false, message: 'Cupom esgotado' }
  if (productId && data.applicable_products?.length && !data.applicable_products.includes(productId)) {
    return { valid: false, message: 'Cupom não aplicável a este produto' }
  }

  return { valid: true, coupon: data }
}

export const adminCreateCoupon = async (params: {
  code: string; discount_type: 'percent'|'fixed'; discount_value: number;
  max_uses?: number; valid_until?: string; applicable_products?: string[]
}) => {
  const { data: { session } } = await supabase.auth.getSession()
  const { data, error } = await supabase.functions.invoke('stripe-admin', {
    body: { action: 'create-coupon', ...params },
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
  })
  if (error) throw new Error(error.message || 'Erro ao criar cupom')
  return data
}

export const adminUpdateCoupon = async (params: {
  coupon_id: string; discount_type: 'percent'|'fixed'; discount_value: number;
  max_uses?: number; valid_until?: string; applicable_products?: string[]
}) => {
  const { data: { session } } = await supabase.auth.getSession()
  const { data, error } = await supabase.functions.invoke('stripe-admin', {
    body: { action: 'update-coupon', ...params },
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
  })
  if (error) throw new Error(error.message || 'Erro ao atualizar cupom')
  return data
}

export const adminDeactivateCoupon = async (couponId: string) => {
  const { data: { session } } = await supabase.auth.getSession()
  const { data, error } = await supabase.functions.invoke('stripe-admin', {
    body: { action: 'deactivate-coupon', coupon_id: couponId },
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
  })
  if (error) throw new Error(error.message || 'Erro ao desativar cupom')
  return data
}
