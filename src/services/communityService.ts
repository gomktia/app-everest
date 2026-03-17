import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { addXP } from '@/services/gamificationService'
import { rankingService } from '@/services/rankingService'

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface CommunitySpace {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string
  color: string
  order: number
  is_archived: boolean
  created_by: string | null
  space_type: string
  class_id: string | null
  created_at: string
}

export interface CommunityPost {
  id: string
  title: string
  content: string
  space_id: string | null
  user_id: string
  is_pinned: boolean
  is_locked: boolean
  views: number
  type: string
  is_resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  mentions: string[]
  link_preview: any
  xp_awarded: number
  likes_count: number
  comments_count: number
  created_at: string
  updated_at: string
  author?: { first_name: string; last_name: string; role?: string }
  space?: CommunitySpace
  attachments?: CommunityAttachment[]
  reactions?: ReactionSummary[]
  poll_options?: PollOption[]
}

export interface CommunityComment {
  id: string
  post_id: string
  user_id: string
  content: string
  parent_comment_id: string | null
  is_best_answer: boolean
  is_official: boolean
  likes_count: number
  created_at: string
  updated_at: string
  author?: { first_name: string; last_name: string; role?: string }
  attachments?: CommunityAttachment[]
  reactions?: ReactionSummary[]
  replies?: CommunityComment[]
}

export interface CommunityAttachment {
  id: string
  post_id: string | null
  comment_id: string | null
  user_id: string
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  mime_type: string
  created_at: string
}

export interface CommunityReaction {
  id: string
  user_id: string
  target_type: string
  target_id: string
  emoji: string
  created_at: string
}

export interface ReactionSummary {
  emoji: string
  count: number
  reacted: boolean
}

export interface CommunityReport {
  id: string
  reporter_id: string
  target_type: string
  target_id: string
  reason: string
  description: string | null
  status: string
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  reporter?: { first_name: string; last_name: string }
}

export interface CommunityMute {
  id: string
  user_id: string
  muted_by: string
  reason: string | null
  muted_until: string
  created_at: string
}

export interface PollOption {
  id: string
  post_id: string
  text: string
  order: number
  votes_count: number
  user_voted?: boolean
}

export interface PollVote {
  id: string
  option_id: string
  user_id: string
  created_at: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function determineFileType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'document'
}

function todayRange(): { start: string; end: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
  return { start, end }
}

// ── Service ─────────────────────────────────────────────────────────────────

async function checkDailyParticipation(userId: string): Promise<boolean> {
  try {
    const { start, end } = todayRange()

    const { count: postCount } = await supabase
      .from('community_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', start)
      .lt('created_at', end)

    if ((postCount || 0) > 0) return true

    const { count: commentCount } = await supabase
      .from('community_comments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', start)
      .lt('created_at', end)

    return (commentCount || 0) > 0
  } catch (error) {
    logger.error('checkDailyParticipation failed', error)
    return false
  }
}

export const communityService = {

  // ── Spaces ──────────────────────────────────────────────────────────────

  async getSpaces(): Promise<CommunitySpace[]> {
    try {
      const { data, error } = await supabase
        .from('community_spaces')
        .select('*')
        .eq('is_archived', false)
        .order('order', { ascending: true })

      if (error) throw error
      return data as CommunitySpace[]
    } catch (error) {
      logger.error('getSpaces failed', error)
      throw error
    }
  },

  async getSpaceBySlug(slug: string): Promise<CommunitySpace | null> {
    try {
      const { data, error } = await supabase
        .from('community_spaces')
        .select('*')
        .eq('slug', slug)
        .single()

      if (error) throw error
      return data as CommunitySpace
    } catch (error) {
      logger.error('getSpaceBySlug failed', error)
      throw error
    }
  },

  async createSpace(data: Omit<CommunitySpace, 'id' | 'created_at'>): Promise<CommunitySpace> {
    try {
      const { data: space, error } = await supabase
        .from('community_spaces')
        .insert(data)
        .select()
        .single()

      if (error) throw error
      return space as CommunitySpace
    } catch (error) {
      logger.error('createSpace failed', error)
      throw error
    }
  },

  async updateSpace(id: string, data: Partial<CommunitySpace>): Promise<CommunitySpace> {
    try {
      const { data: space, error } = await supabase
        .from('community_spaces')
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return space as CommunitySpace
    } catch (error) {
      logger.error('updateSpace failed', error)
      throw error
    }
  },

  async deleteSpace(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('community_spaces')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      logger.error('deleteSpace failed', error)
      throw error
    }
  },

  // ── Posts ───────────────────────────────────────────────────────────────

  async getPosts(options: {
    spaceId?: string
    allowedSpaceIds?: string[]
    sort?: 'recent' | 'popular' | 'unanswered'
    type?: string
    search?: string
    page?: number
    limit?: number
  } = {}): Promise<{ posts: CommunityPost[]; total: number }> {
    try {
      const { spaceId, allowedSpaceIds, sort = 'recent', type, search, page = 1, limit = 20 } = options
      const from = (page - 1) * limit
      const to = from + limit - 1

      let query = supabase
        .from('community_posts')
        .select(`
          *,
          author:users!forum_topics_user_id_fkey(first_name, last_name, role),
          space:community_spaces!forum_topics_category_id_fkey(*)
        `, { count: 'exact' })

      if (spaceId) {
        query = query.eq('space_id', spaceId)
      } else if (allowedSpaceIds && allowedSpaceIds.length > 0) {
        // Filter posts to only show from allowed spaces
        query = query.in('space_id', allowedSpaceIds)
      }

      if (type) {
        query = query.eq('type', type)
      }

      if (search) {
        query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`)
      }

      if (sort === 'recent') {
        query = query.order('is_pinned', { ascending: false }).order('created_at', { ascending: false })
      } else if (sort === 'popular') {
        query = query.order('is_pinned', { ascending: false }).order('likes_count', { ascending: false })
      } else if (sort === 'unanswered') {
        query = query.eq('comments_count', 0).order('created_at', { ascending: false })
      }

      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) throw error

      const posts = (data || []).map((post: any) => ({
        ...post,
        author: post.author || undefined,
        space: post.space || undefined,
      })) as CommunityPost[]

      return { posts, total: count || 0 }
    } catch (error) {
      logger.error('getPosts failed', error)
      throw error
    }
  },

  async getPostById(id: string, userId?: string): Promise<CommunityPost | null> {
    try {
      // Increment views
      await supabase.rpc('increment', { row_id: id, table_name: 'community_posts', column_name: 'views' }).catch(() => {
        // Fallback: manual increment if RPC not available
        return supabase
          .from('community_posts')
          .select('views')
          .eq('id', id)
          .single()
          .then(({ data }) => {
            if (data) {
              return supabase
                .from('community_posts')
                .update({ views: (data.views || 0) + 1 })
                .eq('id', id)
            }
          })
      })

      const { data, error } = await supabase
        .from('community_posts')
        .select(`
          *,
          author:users!forum_topics_user_id_fkey(first_name, last_name, role),
          space:community_spaces!forum_topics_category_id_fkey(*),
          attachments:community_attachments(*)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      if (!data) return null

      const post = {
        ...data,
        author: data.author || undefined,
        space: data.space || undefined,
        attachments: data.attachments || [],
      } as CommunityPost

      // Get reactions
      post.reactions = await communityService.getReactions('post', id, userId)

      // Get poll options if poll type
      if (post.type === 'poll') {
        post.poll_options = await communityService.getPollResults(id, userId)
      }

      return post
    } catch (error) {
      logger.error('getPostById failed', error)
      throw error
    }
  },

  async createPost(data: {
    title: string
    content: string
    space_id: string
    user_id: string
    type: string
    mentions?: string[]
    link_preview?: any
  }): Promise<CommunityPost> {
    try {
      const isFirstToday = !(await checkDailyParticipation(data.user_id))

      const { data: post, error } = await supabase
        .from('community_posts')
        .insert({
          title: data.title,
          content: data.content,
          space_id: data.space_id,
          user_id: data.user_id,
          type: data.type || 'text',
          mentions: data.mentions || [],
          link_preview: data.link_preview || null,
          xp_awarded: 5,
        })
        .select(`
          *,
          author:users!forum_topics_user_id_fkey(first_name, last_name, role),
          space:community_spaces!forum_topics_category_id_fkey(*)
        `)
        .single()

      if (error) throw error

      // Award XP: +5 for creating post
      await addXP(data.user_id, 5, 'community_post', post.id).catch((err) => {
        logger.error('Failed to award post creation XP', err)
      })

      // +2 daily first participation bonus
      if (isFirstToday) {
        await addXP(data.user_id, 2, 'community_daily_bonus', post.id).catch((err) => {
          logger.error('Failed to award daily bonus XP', err)
        })
      }

      // Check achievements after community activity
      rankingService.checkAndGrantAchievements(data.user_id).catch(() => {})

      return post as CommunityPost
    } catch (error) {
      logger.error('createPost failed', error)
      throw error
    }
  },

  async updatePost(id: string, data: Partial<CommunityPost>): Promise<CommunityPost> {
    try {
      const { data: post, error } = await supabase
        .from('community_posts')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return post as CommunityPost
    } catch (error) {
      logger.error('updatePost failed', error)
      throw error
    }
  },

  async deletePost(id: string): Promise<void> {
    try {
      // Get attachments to delete from storage
      const { data: attachments } = await supabase
        .from('community_attachments')
        .select('file_url')
        .eq('post_id', id)

      if (attachments && attachments.length > 0) {
        const filePaths = attachments.map((a) => {
          const url = new URL(a.file_url)
          const pathParts = url.pathname.split('/storage/v1/object/public/community-attachments/')
          return pathParts[1] || ''
        }).filter(Boolean)

        if (filePaths.length > 0) {
          await supabase.storage.from('community-attachments').remove(filePaths)
        }
      }

      const { error } = await supabase
        .from('community_posts')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      logger.error('deletePost failed', error)
      throw error
    }
  },

  async togglePinPost(id: string): Promise<CommunityPost> {
    try {
      const { data: current, error: fetchError } = await supabase
        .from('community_posts')
        .select('is_pinned')
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError

      const { data: post, error } = await supabase
        .from('community_posts')
        .update({ is_pinned: !current.is_pinned })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return post as CommunityPost
    } catch (error) {
      logger.error('togglePinPost failed', error)
      throw error
    }
  },

  async toggleLockPost(id: string): Promise<CommunityPost> {
    try {
      const { data: current, error: fetchError } = await supabase
        .from('community_posts')
        .select('is_locked')
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError

      const { data: post, error } = await supabase
        .from('community_posts')
        .update({ is_locked: !current.is_locked })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return post as CommunityPost
    } catch (error) {
      logger.error('toggleLockPost failed', error)
      throw error
    }
  },

  // ── Comments ────────────────────────────────────────────────────────────

  async getComments(postId: string, userId?: string): Promise<CommunityComment[]> {
    try {
      const { data, error } = await supabase
        .from('community_comments')
        .select(`
          *,
          author:users!forum_posts_user_id_fkey(first_name, last_name, role),
          attachments:community_attachments(*)
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true })

      if (error) throw error

      const allComments = data || []

      // Build threaded structure
      const commentMap = new Map<string, CommunityComment>()
      const topLevel: CommunityComment[] = []

      // First pass: enrich all comments with reactions
      const enriched = await Promise.all(
        allComments.map(async (c: any) => {
          const reactions = await communityService.getReactions('comment', c.id, userId)
          return {
            ...c,
            author: c.author || undefined,
            attachments: c.attachments || [],
            reactions,
            replies: [],
          } as CommunityComment
        })
      )

      // Second pass: build tree
      for (const comment of enriched) {
        commentMap.set(comment.id, comment)
      }

      for (const comment of enriched) {
        if (comment.parent_comment_id && commentMap.has(comment.parent_comment_id)) {
          const parent = commentMap.get(comment.parent_comment_id)!
          if (!parent.replies) parent.replies = []
          parent.replies.push(comment)
        } else {
          topLevel.push(comment)
        }
      }

      return topLevel
    } catch (error) {
      logger.error('getComments failed', error)
      throw error
    }
  },

  async createComment(data: {
    post_id: string
    content: string
    user_id: string
    parent_comment_id?: string
  }): Promise<CommunityComment> {
    try {
      const isFirstToday = !(await checkDailyParticipation(data.user_id))

      const { data: comment, error } = await supabase
        .from('community_comments')
        .insert({
          post_id: data.post_id,
          content: data.content,
          user_id: data.user_id,
          parent_comment_id: data.parent_comment_id || null,
        })
        .select(`
          *,
          author:users!forum_posts_user_id_fkey(first_name, last_name, role)
        `)
        .single()

      if (error) throw error

      // Increment post comments_count
      const { data: postData } = await supabase
        .from('community_posts')
        .select('comments_count')
        .eq('id', data.post_id)
        .single()

      if (postData) {
        await supabase
          .from('community_posts')
          .update({ comments_count: (postData.comments_count || 0) + 1 })
          .eq('id', data.post_id)
      }

      // Award XP: +3 for comment
      await addXP(data.user_id, 3, 'community_comment', comment.id).catch((err) => {
        logger.error('Failed to award comment XP', err)
      })

      // +2 daily first participation bonus
      if (isFirstToday) {
        await addXP(data.user_id, 2, 'community_daily_bonus', comment.id).catch((err) => {
          logger.error('Failed to award daily bonus XP', err)
        })
      }

      // Check achievements after community activity
      rankingService.checkAndGrantAchievements(data.user_id).catch(() => {})

      return comment as CommunityComment
    } catch (error) {
      logger.error('createComment failed', error)
      throw error
    }
  },

  async deleteComment(id: string): Promise<void> {
    try {
      // Get the comment to find its post_id
      const { data: comment, error: fetchError } = await supabase
        .from('community_comments')
        .select('post_id')
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError

      const { error } = await supabase
        .from('community_comments')
        .delete()
        .eq('id', id)

      if (error) throw error

      // Decrement post comments_count
      if (comment) {
        const { data: postData } = await supabase
          .from('community_posts')
          .select('comments_count')
          .eq('id', comment.post_id)
          .single()

        if (postData) {
          await supabase
            .from('community_posts')
            .update({ comments_count: Math.max(0, (postData.comments_count || 0) - 1) })
            .eq('id', comment.post_id)
        }
      }
    } catch (error) {
      logger.error('deleteComment failed', error)
      throw error
    }
  },

  // ── Reactions ───────────────────────────────────────────────────────────

  async toggleReaction(
    userId: string,
    targetType: 'post' | 'comment',
    targetId: string,
    emoji: string
  ): Promise<{ reacted: boolean }> {
    try {
      // Check if reaction exists
      const { data: existing } = await supabase
        .from('community_reactions')
        .select('id')
        .eq('user_id', userId)
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .eq('emoji', emoji)
        .maybeSingle()

      const likesTable = targetType === 'post' ? 'community_posts' : 'community_comments'

      if (existing) {
        // Remove reaction
        await supabase
          .from('community_reactions')
          .delete()
          .eq('id', existing.id)

        // Decrement likes_count
        const { data: current } = await supabase
          .from(likesTable)
          .select('likes_count')
          .eq('id', targetId)
          .single()

        if (current) {
          await supabase
            .from(likesTable)
            .update({ likes_count: Math.max(0, (current.likes_count || 0) - 1) })
            .eq('id', targetId)
        }

        return { reacted: false }
      } else {
        // Add reaction
        await supabase
          .from('community_reactions')
          .insert({
            user_id: userId,
            target_type: targetType,
            target_id: targetId,
            emoji,
          })

        // Increment likes_count
        const { data: current } = await supabase
          .from(likesTable)
          .select('likes_count')
          .eq('id', targetId)
          .single()

        if (current) {
          await supabase
            .from(likesTable)
            .update({ likes_count: (current.likes_count || 0) + 1 })
            .eq('id', targetId)
        }

        // Award XP for reacting (only when adding, not removing)
        await addXP(userId, 1, 'community_reaction', targetId).catch(() => {})

        return { reacted: true }
      }
    } catch (error) {
      logger.error('toggleReaction failed', error)
      throw error
    }
  },

  async getReactions(
    targetType: string,
    targetId: string,
    userId?: string
  ): Promise<ReactionSummary[]> {
    try {
      const { data, error } = await supabase
        .from('community_reactions')
        .select('emoji, user_id')
        .eq('target_type', targetType)
        .eq('target_id', targetId)

      if (error) throw error

      const grouped = new Map<string, { count: number; reacted: boolean }>()

      for (const reaction of data || []) {
        const existing = grouped.get(reaction.emoji) || { count: 0, reacted: false }
        existing.count++
        if (userId && reaction.user_id === userId) {
          existing.reacted = true
        }
        grouped.set(reaction.emoji, existing)
      }

      return Array.from(grouped.entries()).map(([emoji, info]) => ({
        emoji,
        count: info.count,
        reacted: info.reacted,
      }))
    } catch (error) {
      logger.error('getReactions failed', error)
      return []
    }
  },

  // ── Best / Official Answers ─────────────────────────────────────────────

  async markBestAnswer(commentId: string, postId: string, resolvedBy: string): Promise<void> {
    try {
      // Unmark any existing best answer on this post
      await supabase
        .from('community_comments')
        .update({ is_best_answer: false })
        .eq('post_id', postId)
        .eq('is_best_answer', true)

      // Mark this comment as best answer
      const { data: comment, error } = await supabase
        .from('community_comments')
        .update({ is_best_answer: true })
        .eq('id', commentId)
        .select('user_id')
        .single()

      if (error) throw error

      // Mark post as resolved
      await supabase
        .from('community_posts')
        .update({
          is_resolved: true,
          resolved_by: resolvedBy,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', postId)

      // Award +15 XP to comment author
      if (comment) {
        await addXP(comment.user_id, 15, 'community_best_answer', commentId).catch((err) => {
          logger.error('Failed to award best answer XP', err)
        })
      }
    } catch (error) {
      logger.error('markBestAnswer failed', error)
      throw error
    }
  },

  async markOfficialAnswer(commentId: string): Promise<void> {
    try {
      const { data: comment, error } = await supabase
        .from('community_comments')
        .update({ is_official: true })
        .eq('id', commentId)
        .select('user_id')
        .single()

      if (error) throw error

      // Award +10 XP to comment author
      if (comment) {
        await addXP(comment.user_id, 10, 'community_official_answer', commentId).catch((err) => {
          logger.error('Failed to award official answer XP', err)
        })
      }
    } catch (error) {
      logger.error('markOfficialAnswer failed', error)
      throw error
    }
  },

  // ── Attachments ─────────────────────────────────────────────────────────

  async uploadAttachment(
    file: File,
    spaceId: string,
    postOrCommentId: string
  ): Promise<CommunityAttachment> {
    try {
      const filePath = `${spaceId}/${postOrCommentId}/${file.name}`

      const { error: uploadError } = await supabase.storage
        .from('community-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('community-attachments')
        .getPublicUrl(filePath)

      const fileType = determineFileType(file.type)

      const { data: attachment, error } = await supabase
        .from('community_attachments')
        .insert({
          post_id: postOrCommentId,
          comment_id: null,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: fileType,
          file_size: file.size,
          mime_type: file.type,
        })
        .select()
        .single()

      if (error) throw error
      return attachment as CommunityAttachment
    } catch (error) {
      logger.error('uploadAttachment failed', error)
      throw error
    }
  },

  async deleteAttachment(id: string, filePath: string): Promise<void> {
    try {
      const { error: storageError } = await supabase.storage
        .from('community-attachments')
        .remove([filePath])

      if (storageError) throw storageError

      const { error } = await supabase
        .from('community_attachments')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      logger.error('deleteAttachment failed', error)
      throw error
    }
  },

  // ── Reports ─────────────────────────────────────────────────────────────

  async createReport(data: {
    reporter_id: string
    target_type: string
    target_id: string
    reason: string
    description?: string
  }): Promise<CommunityReport> {
    try {
      const { data: report, error } = await supabase
        .from('community_reports')
        .insert({
          reporter_id: data.reporter_id,
          target_type: data.target_type,
          target_id: data.target_id,
          reason: data.reason,
          description: data.description || null,
          status: 'pending',
        })
        .select()
        .single()

      if (error) throw error
      return report as CommunityReport
    } catch (error) {
      logger.error('createReport failed', error)
      throw error
    }
  },

  async getReports(status?: string): Promise<CommunityReport[]> {
    try {
      let query = supabase
        .from('community_reports')
        .select(`
          *,
          reporter:users!community_reports_reporter_id_users_fkey(first_name, last_name)
        `)
        .order('created_at', { ascending: false })

      if (status) {
        query = query.eq('status', status)
      }

      const { data, error } = await query

      if (error) throw error

      return (data || []).map((r: any) => ({
        ...r,
        reporter: r.reporter || undefined,
      })) as CommunityReport[]
    } catch (error) {
      logger.error('getReports failed', error)
      throw error
    }
  },

  async updateReport(id: string, status: string, reviewedBy: string): Promise<CommunityReport> {
    try {
      const { data: report, error } = await supabase
        .from('community_reports')
        .update({
          status,
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return report as CommunityReport
    } catch (error) {
      logger.error('updateReport failed', error)
      throw error
    }
  },

  // ── Mutes ───────────────────────────────────────────────────────────────

  async muteUser(
    userId: string,
    mutedBy: string,
    reason: string,
    durationMinutes: number
  ): Promise<CommunityMute> {
    try {
      const mutedUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()

      const { data: mute, error } = await supabase
        .from('community_mutes')
        .insert({
          user_id: userId,
          muted_by: mutedBy,
          reason,
          muted_until: mutedUntil,
        })
        .select()
        .single()

      if (error) throw error
      return mute as CommunityMute
    } catch (error) {
      logger.error('muteUser failed', error)
      throw error
    }
  },

  async unmuteUser(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('community_mutes')
        .delete()
        .eq('user_id', userId)
        .gte('muted_until', new Date().toISOString())

      if (error) throw error
    } catch (error) {
      logger.error('unmuteUser failed', error)
      throw error
    }
  },

  async isUserMuted(userId: string): Promise<{ muted: boolean; until?: string; reason?: string }> {
    try {
      const { data, error } = await supabase
        .from('community_mutes')
        .select('muted_until, reason')
        .eq('user_id', userId)
        .gt('muted_until', new Date().toISOString())
        .order('muted_until', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error

      if (data) {
        return { muted: true, until: data.muted_until, reason: data.reason || undefined }
      }

      return { muted: false }
    } catch (error) {
      logger.error('isUserMuted failed', error)
      return { muted: false }
    }
  },

  // ── Word Filter ─────────────────────────────────────────────────────────

  async getWordFilter(): Promise<{ id: string; word: string; created_by: string; created_at: string }[]> {
    try {
      const { data, error } = await supabase
        .from('community_word_filter')
        .select('*')
        .order('word', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('getWordFilter failed', error)
      throw error
    }
  },

  async addFilterWord(word: string, createdBy: string): Promise<{ id: string; word: string; created_by: string; created_at: string }> {
    try {
      const { data, error } = await supabase
        .from('community_word_filter')
        .insert({ word: word.toLowerCase().trim(), created_by: createdBy })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      logger.error('addFilterWord failed', error)
      throw error
    }
  },

  async removeFilterWord(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('community_word_filter')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      logger.error('removeFilterWord failed', error)
      throw error
    }
  },

  checkWordFilter(text: string, wordList?: { word: string }[]): string[] {
    if (!wordList || wordList.length === 0) return []
    const lowerText = text.toLowerCase()
    return wordList
      .filter((w) => lowerText.includes(w.word.toLowerCase()))
      .map((w) => w.word)
  },

  // ── Polls ───────────────────────────────────────────────────────────────

  async createPoll(postId: string, options: string[]): Promise<PollOption[]> {
    try {
      const records = options.map((text, index) => ({
        post_id: postId,
        text,
        order: index,
        votes_count: 0,
      }))

      const { data, error } = await supabase
        .from('community_poll_options')
        .insert(records)
        .select()

      if (error) throw error
      return data as PollOption[]
    } catch (error) {
      logger.error('createPoll failed', error)
      throw error
    }
  },

  async votePoll(optionId: string, userId: string): Promise<void> {
    try {
      const { error: voteError } = await supabase
        .from('community_poll_votes')
        .insert({ option_id: optionId, user_id: userId })

      if (voteError) throw voteError

      // Increment votes_count
      const { data: option } = await supabase
        .from('community_poll_options')
        .select('votes_count')
        .eq('id', optionId)
        .single()

      if (option) {
        await supabase
          .from('community_poll_options')
          .update({ votes_count: (option.votes_count || 0) + 1 })
          .eq('id', optionId)
      }
    } catch (error) {
      logger.error('votePoll failed', error)
      throw error
    }
  },

  async removePollVote(optionId: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('community_poll_votes')
        .delete()
        .eq('option_id', optionId)
        .eq('user_id', userId)

      if (error) throw error

      // Decrement votes_count
      const { data: option } = await supabase
        .from('community_poll_options')
        .select('votes_count')
        .eq('id', optionId)
        .single()

      if (option) {
        await supabase
          .from('community_poll_options')
          .update({ votes_count: Math.max(0, (option.votes_count || 0) - 1) })
          .eq('id', optionId)
      }
    } catch (error) {
      logger.error('removePollVote failed', error)
      throw error
    }
  },

  async getPollResults(postId: string, userId?: string): Promise<PollOption[]> {
    try {
      const { data: options, error } = await supabase
        .from('community_poll_options')
        .select('*')
        .eq('post_id', postId)
        .order('order', { ascending: true })

      if (error) throw error
      if (!options || options.length === 0) return []

      if (!userId) {
        return options.map((o: any) => ({ ...o, user_voted: false })) as PollOption[]
      }

      // Check which options the user voted on
      const optionIds = options.map((o: any) => o.id)
      const { data: userVotes } = await supabase
        .from('community_poll_votes')
        .select('option_id')
        .eq('user_id', userId)
        .in('option_id', optionIds)

      const votedOptionIds = new Set((userVotes || []).map((v: any) => v.option_id))

      return options.map((o: any) => ({
        ...o,
        user_voted: votedOptionIds.has(o.id),
      })) as PollOption[]
    } catch (error) {
      logger.error('getPollResults failed', error)
      throw error
    }
  },

  // ── User Search ─────────────────────────────────────────────────────────

  async searchUsers(query: string): Promise<{ id: string; first_name: string; last_name: string; avatar_url: string | null }[]> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, avatar_url')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .limit(10)

      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('searchUsers failed', error)
      throw error
    }
  },
}
