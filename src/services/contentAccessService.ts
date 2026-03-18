import { supabase } from '@/lib/supabase/client'

export async function getContentAccess(classId: string, contentType: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('class_content_access')
    .select('content_id')
    .eq('class_id', classId)
    .eq('content_type', contentType)

  if (error) throw error
  return (data || []).map(r => r.content_id)
}

export async function getAllContentAccessForClass(classId: string): Promise<Record<string, string[]>> {
  const { data, error } = await supabase
    .from('class_content_access')
    .select('content_type, content_id')
    .eq('class_id', classId)

  if (error) throw error

  const result: Record<string, string[]> = {}
  for (const row of data || []) {
    if (!result[row.content_type]) result[row.content_type] = []
    result[row.content_type].push(row.content_id)
  }
  return result
}

export async function saveContentAccess(classId: string, contentType: string, contentIds: string[]): Promise<void> {
  // Delete existing entries for this class + content_type
  const { error: deleteError } = await supabase
    .from('class_content_access')
    .delete()
    .eq('class_id', classId)
    .eq('content_type', contentType)

  if (deleteError) throw deleteError

  // If empty array = everything is free (no restrictions)
  if (contentIds.length === 0) return

  // Insert new entries
  const { error } = await supabase
    .from('class_content_access')
    .insert(contentIds.map(id => ({
      class_id: classId,
      content_type: contentType,
      content_id: id
    })))

  if (error) throw error
}

