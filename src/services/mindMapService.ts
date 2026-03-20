import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

export interface MindMapNode {
  id: string
  label: string
  detail?: string
  type?: 'concept' | 'example' | 'exception' | 'tip' | 'rule' | 'warning'
  icon?: string
  children?: MindMapNode[]
}

export interface MindMap {
  id: string
  subject: string
  topic: string
  title: string
  data: { nodes: MindMapNode[] }
  icon: string
  color: string
  created_at: string
  updated_at: string
}

export const mindMapService = {
  async getAll(): Promise<MindMap[]> {
    const { data, error } = await supabase
      .from('mind_maps')
      .select('*')
      .order('subject')
      .order('topic')
    if (error) { logger.error('Error fetching mind maps:', error); return [] }
    return data as MindMap[]
  },

  async getBySubject(subject: string): Promise<MindMap[]> {
    const { data, error } = await supabase
      .from('mind_maps')
      .select('*')
      .eq('subject', subject)
      .order('topic')
    if (error) { logger.error('Error fetching mind maps by subject:', error); return [] }
    return data as MindMap[]
  },

  async getById(id: string): Promise<MindMap | null> {
    const { data, error } = await supabase
      .from('mind_maps')
      .select('*')
      .eq('id', id)
      .single()
    if (error) { logger.error('Error fetching mind map:', error); return null }
    return data as MindMap
  },

  async getSubjects(): Promise<string[]> {
    const { data, error } = await supabase
      .from('mind_maps')
      .select('subject')
    if (error) { logger.error('Error fetching subjects:', error); return [] }
    const unique = [...new Set((data || []).map(d => d.subject))]
    return unique.sort()
  },

  async upsert(mindMap: Partial<MindMap> & { subject: string; topic: string; title: string; data: any }): Promise<MindMap | null> {
    const { data, error } = await supabase
      .from('mind_maps')
      .upsert({
        ...mindMap,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (error) { logger.error('Error upserting mind map:', error); throw error }
    return data as MindMap
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('mind_maps').delete().eq('id', id)
    if (error) { logger.error('Error deleting mind map:', error); throw error }
  },

  countNodes(nodes: MindMapNode[]): number {
    let count = 0
    for (const node of nodes) {
      count++
      if (node.children) count += this.countNodes(node.children)
    }
    return count
  },
}
