import { supabase } from '@/lib/supabase/client'

export interface ModuleRule {
  id?: string
  class_id: string
  module_id: string
  rule_type: 'free' | 'scheduled_date' | 'days_after_enrollment' | 'hidden' | 'blocked' | 'module_completed'
  rule_value?: string | null
}

export interface LessonRule {
  id?: string
  class_id: string
  lesson_id: string
  rule_type: ModuleRule['rule_type']
  rule_value?: string | null
}

export async function getModuleRulesForClass(classId: string): Promise<ModuleRule[]> {
  const { data, error } = await supabase
    .from('class_module_rules')
    .select('*')
    .eq('class_id', classId)

  if (error) throw error
  return data || []
}

export async function saveAllModuleRules(classId: string, rules: ModuleRule[]): Promise<void> {
  // Delete existing rules for this class
  const { error: deleteError } = await supabase.from('class_module_rules').delete().eq('class_id', classId)
  if (deleteError) throw deleteError

  // Insert only non-free rules (free is the default, no need to store)
  const nonFreeRules = rules.filter(r => r.rule_type !== 'free')
  if (nonFreeRules.length === 0) return

  const { error } = await supabase
    .from('class_module_rules')
    .insert(nonFreeRules.map(r => ({
      class_id: classId,
      module_id: r.module_id,
      rule_type: r.rule_type,
      rule_value: r.rule_value || null
    })))

  if (error) throw error
}

export async function getLessonRulesForClass(classId: string): Promise<LessonRule[]> {
  const { data, error } = await supabase
    .from('class_lesson_rules')
    .select('*')
    .eq('class_id', classId)

  if (error) throw error
  return data || []
}

export async function upsertLessonRule(rule: LessonRule): Promise<void> {
  const { error } = await supabase
    .from('class_lesson_rules')
    .upsert({
      class_id: rule.class_id,
      lesson_id: rule.lesson_id,
      rule_type: rule.rule_type,
      rule_value: rule.rule_value || null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'class_id,lesson_id' })

  if (error) throw error
}

export async function deleteLessonRule(classId: string, lessonId: string): Promise<void> {
  const { error } = await supabase
    .from('class_lesson_rules')
    .delete()
    .eq('class_id', classId)
    .eq('lesson_id', lessonId)

  if (error) throw error
}

// Circular dependency check for module_completed rules
export function checkCircularDependency(
  rules: ModuleRule[],
  moduleId: string,
  dependsOnModuleId: string
): boolean {
  const visited = new Set<string>()
  const check = (currentId: string): boolean => {
    if (currentId === moduleId) return true // circular!
    if (visited.has(currentId)) return false
    visited.add(currentId)
    const rule = rules.find(r => r.module_id === currentId && r.rule_type === 'module_completed')
    if (rule?.rule_value) return check(rule.rule_value)
    return false
  }
  return check(dependsOnModuleId)
}
