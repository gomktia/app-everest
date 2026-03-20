import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

export interface AIFeatureSettings {
  master: boolean
  audit: boolean
  lesson_chat: boolean
  quiz_gen: boolean
  study_plan: boolean
  rate_limit_per_minute: number
  cost_alert_threshold: number
}

export interface AIUsageStats {
  total_calls: number
  total_cost: number
  by_feature: Record<string, { calls: number; cost: number }>
}

const DEFAULT_SETTINGS: AIFeatureSettings = {
  master: false,
  audit: false,
  lesson_chat: false,
  quiz_gen: false,
  study_plan: false,
  rate_limit_per_minute: 20,
  cost_alert_threshold: 50,
}

const SETTINGS_KEY = 'ai_features'

export const aiSettingsService = {
  /**
   * Busca as configurações de features de IA do banco.
   * Retorna DEFAULT_SETTINGS se a chave não existir.
   */
  async getSettings(): Promise<AIFeatureSettings> {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', SETTINGS_KEY)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // Linha não existe ainda — retornar defaults
          return { ...DEFAULT_SETTINGS }
        }
        throw error
      }

      return { ...DEFAULT_SETTINGS, ...(data?.value as Partial<AIFeatureSettings>) }
    } catch (err) {
      logger.error('Erro ao buscar configurações de IA:', err)
      return { ...DEFAULT_SETTINGS }
    }
  },

  /**
   * Faz merge das novas configurações com as existentes e persiste via upsert.
   */
  async updateSettings(settings: Partial<AIFeatureSettings>): Promise<AIFeatureSettings> {
    try {
      const current = await aiSettingsService.getSettings()
      const merged: AIFeatureSettings = { ...current, ...settings }

      const { data: userData } = await supabase.auth.getUser()

      const { error } = await supabase
        .from('system_settings')
        .upsert(
          {
            key: SETTINGS_KEY,
            value: merged,
            updated_at: new Date().toISOString(),
            updated_by: userData.user?.id ?? null,
          },
          { onConflict: 'key' }
        )

      if (error) throw error

      return merged
    } catch (err) {
      logger.error('Erro ao atualizar configurações de IA:', err)
      throw err
    }
  },

  /**
   * Retorna true apenas se o master switch e o feature flag específico estiverem habilitados.
   */
  isFeatureEnabled(
    settings: AIFeatureSettings,
    feature: keyof Omit<AIFeatureSettings, 'master' | 'rate_limit_per_minute' | 'cost_alert_threshold'>
  ): boolean {
    return settings.master && settings[feature] === true
  },

  /**
   * Agrega estatísticas de uso de IA dos últimos `days` dias a partir de ai_usage_log.
   */
  async getUsageStats(days = 30): Promise<AIUsageStats> {
    try {
      const since = new Date()
      since.setDate(since.getDate() - days)

      const { data, error } = await supabase
        .from('ai_usage_log')
        .select('feature, cost_estimate_brl, created_at')
        .gte('created_at', since.toISOString())

      if (error) throw error

      const rows = data ?? []

      const by_feature: Record<string, { calls: number; cost: number }> = {}
      let total_calls = 0
      let total_cost = 0

      for (const row of rows) {
        const feature = row.feature as string
        const cost = Number(row.cost_estimate_brl ?? 0)

        total_calls += 1
        total_cost += cost

        if (!by_feature[feature]) {
          by_feature[feature] = { calls: 0, cost: 0 }
        }
        by_feature[feature].calls += 1
        by_feature[feature].cost += cost
      }

      return { total_calls, total_cost, by_feature }
    } catch (err) {
      logger.error('Erro ao buscar estatísticas de uso de IA:', err)
      return { total_calls: 0, total_cost: 0, by_feature: {} }
    }
  },
}
