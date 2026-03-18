import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

const isTableMissing = (error: any) =>
  error?.message?.includes('does not exist') ||
  error?.message?.includes('relation') ||
  error?.code === '42P01'

export interface Affiliate {
  id: string
  user_id: string
  affiliate_code: string
  commission_percent: number
  total_earned_cents: number
  total_paid_cents: number
  is_active: boolean
  created_at: string
  user?: { first_name: string; last_name: string; email: string }
}

export interface AffiliateCommission {
  id: string
  affiliate_id: string
  order_id: string
  commission_cents: number
  status: string
  approved_at: string | null
  paid_at: string | null
  created_at: string
  order?: { total_cents: number; created_at: string; user: { first_name: string; last_name: string } }
}

export const getAffiliates = async () => {
  const { data, error } = await supabase
    .from('affiliates')
    .select('*, user:users(first_name, last_name, email)')
    .order('created_at', { ascending: false })
  if (error) {
    if (isTableMissing(error)) return [] as Affiliate[]
    logger.error('getAffiliates error:', error); throw error
  }
  return (data || []) as Affiliate[]
}

export const createAffiliate = async (userId: string, affiliateCode: string, commissionPercent: number) => {
  const { data, error } = await supabase
    .from('affiliates')
    .insert({ user_id: userId, affiliate_code: affiliateCode.toUpperCase().trim(), commission_percent: commissionPercent })
    .select()
    .single()
  if (error) {
    if (isTableMissing(error)) throw new Error('Afiliados indisponíveis no momento')
    logger.error('createAffiliate error:', error); throw error
  }
  return data
}

export const updateAffiliate = async (id: string, updates: { commission_percent?: number; is_active?: boolean }) => {
  const { data, error } = await supabase
    .from('affiliates')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    if (isTableMissing(error)) throw new Error('Afiliados indisponíveis no momento')
    logger.error('updateAffiliate error:', error); throw error
  }
  return data
}

export const getCommissions = async (affiliateId?: string) => {
  let query = supabase
    .from('affiliate_commissions')
    .select('*, order:orders(total_cents, created_at, user:users(first_name, last_name))')
    .order('created_at', { ascending: false })

  if (affiliateId) query = query.eq('affiliate_id', affiliateId)

  const { data, error } = await query
  if (error) {
    if (isTableMissing(error)) return [] as AffiliateCommission[]
    logger.error('getCommissions error:', error); throw error
  }
  return (data || []) as AffiliateCommission[]
}

export const markCommissionPaid = async (commissionId: string) => {
  const { data, error } = await supabase
    .from('affiliate_commissions')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', commissionId)
    .select()
    .single()
  if (error) {
    if (isTableMissing(error)) throw new Error('Comissões indisponíveis no momento')
    logger.error('markCommissionPaid error:', error); throw error
  }
  return data
}

export const getAffiliateStats = async () => {
  const emptyStats = { activeAffiliates: 0, salesViaAffiliates: 0, pendingCommissions: 0 }

  try {
    const [affiliatesRes, commissionsRes] = await Promise.all([
      supabase.from('affiliates').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('affiliate_commissions').select('commission_cents, status'),
    ])

    if ([affiliatesRes, commissionsRes].some(r => r.error && isTableMissing(r.error))) {
      return emptyStats
    }

    const commissions = commissionsRes.data || []
    const salesViaAffiliates = commissions.length
    const pendingTotal = commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.commission_cents, 0)

    return {
      activeAffiliates: affiliatesRes.count || 0,
      salesViaAffiliates,
      pendingCommissions: pendingTotal,
    }
  } catch (error: any) {
    if (isTableMissing(error)) return emptyStats
    throw error
  }
}
