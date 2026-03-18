import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

export interface LessonComment {
  id: string
  lesson_id: string
  user_id: string
  content: string
  parent_id: string | null
  created_at: string
  updated_at: string
  // joined from user_profiles
  user_name?: string
  user_avatar?: string
  replies?: LessonComment[]
}

export interface LessonRating {
  id: string
  lesson_id: string
  user_id: string
  rating: number
  created_at: string
}

export interface LessonRatingStats {
  average: number
  total: number
  userRating: number | null
}

export const lessonInteractionService = {
  // ---- COMMENTS ----

  async getComments(lessonId: string): Promise<LessonComment[]> {
    try {
      const { data, error } = await supabase
        .from('lesson_comments')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('created_at', { ascending: true })

      if (error) throw error

      const comments = (data || []) as LessonComment[]

      // Get unique user IDs and fetch profiles
      const userIds = [...new Set(comments.map(c => c.user_id))]
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds)

        const profileMap = new Map(
          (profiles || []).map(p => [p.id, { name: p.full_name, avatar: p.avatar_url }])
        )

        comments.forEach(c => {
          const profile = profileMap.get(c.user_id)
          c.user_name = profile?.name || 'Aluno'
          c.user_avatar = profile?.avatar || undefined
        })
      }

      // Nest replies under parent comments
      const topLevel: LessonComment[] = []
      const replyMap = new Map<string, LessonComment[]>()

      comments.forEach(c => {
        if (c.parent_id) {
          if (!replyMap.has(c.parent_id)) replyMap.set(c.parent_id, [])
          replyMap.get(c.parent_id)!.push(c)
        } else {
          topLevel.push(c)
        }
      })

      topLevel.forEach(c => {
        c.replies = replyMap.get(c.id) || []
      })

      return topLevel
    } catch (error) {
      logger.error('Error fetching comments:', error)
      return []
    }
  },

  async addComment(lessonId: string, userId: string, content: string, parentId?: string): Promise<LessonComment | null> {
    try {
      const { data, error } = await supabase
        .from('lesson_comments')
        .insert({
          lesson_id: lessonId,
          user_id: userId,
          content: content.trim(),
          parent_id: parentId || null,
        })
        .select()
        .single()

      if (error) throw error
      return data as LessonComment
    } catch (error) {
      logger.error('Error adding comment:', error)
      return null
    }
  },

  async deleteComment(commentId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('lesson_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', userId)

      if (error) throw error
      return true
    } catch (error) {
      logger.error('Error deleting comment:', error)
      return false
    }
  },

  // ---- RATINGS ----

  async getRatingStats(lessonId: string, userId?: string): Promise<LessonRatingStats> {
    try {
      const { data: ratings, error } = await supabase
        .from('lesson_ratings')
        .select('rating, user_id')
        .eq('lesson_id', lessonId)

      if (error) throw error

      const all = ratings || []
      const total = all.length
      const average = total > 0
        ? all.reduce((sum, r) => sum + r.rating, 0) / total
        : 0

      const userRating = userId
        ? all.find(r => r.user_id === userId)?.rating ?? null
        : null

      return { average: Math.round(average * 10) / 10, total, userRating }
    } catch (error) {
      logger.error('Error fetching ratings:', error)
      return { average: 0, total: 0, userRating: null }
    }
  },

  async rateLesson(lessonId: string, userId: string, rating: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('lesson_ratings')
        .upsert({
          lesson_id: lessonId,
          user_id: userId,
          rating,
        })

      if (error) throw error
      return true
    } catch (error) {
      logger.error('Error rating lesson:', error)
      return false
    }
  },

  // ---- NOTES ----

  async getNote(lessonId: string, userId: string): Promise<{ content: string; drawingData: string | null }> {
    try {
      const { data, error } = await supabase
        .from('lesson_notes')
        .select('content, drawing_data')
        .eq('lesson_id', lessonId)
        .eq('user_id', userId)
        .maybeSingle()

      if (error) throw error
      return {
        content: data?.content || '',
        drawingData: (data as any)?.drawing_data || null,
      }
    } catch (error) {
      logger.error('Error fetching note:', error)
      return { content: '', drawingData: null }
    }
  },

  async saveNote(lessonId: string, userId: string, content: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('lesson_notes')
        .upsert(
          { lesson_id: lessonId, user_id: userId, content },
          { onConflict: 'lesson_id,user_id', ignoreDuplicates: false }
        )
      if (error) throw error
      return true
    } catch (error) {
      logger.error('Error saving note:', error)
      return false
    }
  },

  async saveDrawing(lessonId: string, userId: string, drawingData: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('lesson_notes')
        .upsert(
          { lesson_id: lessonId, user_id: userId, drawing_data: drawingData } as any,
          { onConflict: 'lesson_id,user_id', ignoreDuplicates: false }
        )
      if (error) throw error
      return true
    } catch (error) {
      logger.error('Error saving drawing:', error)
      return false
    }
  },
}
