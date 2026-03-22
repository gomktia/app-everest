import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

export type SettingsKey = 'general' | 'notifications' | 'security' | 'appearance'

export async function getSettings(key: SettingsKey) {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', key)
    .single()

  if (error) {
    logger.error(`Error fetching settings [${key}]:`, error)
    return null
  }
  return data?.value
}

export async function getAllSettings(): Promise<Record<string, any>> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('key, value')

  if (error) {
    logger.error('Error fetching all settings:', error)
    return {}
  }

  const settings: Record<string, any> = {}
  for (const row of data || []) {
    settings[row.key] = row.value
  }
  return settings
}

export async function updateSettings(key: SettingsKey, value: Record<string, any>) {
  const { error } = await supabase
    .from('system_settings')
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
      updated_by: (await supabase.auth.getUser()).data.user?.id,
    }, { onConflict: 'key' })

  if (error) {
    logger.error(`Error updating settings [${key}]:`, error)
    throw error
  }
}
