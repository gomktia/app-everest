import { useState, useEffect } from 'react'
import { MessageCircle, Reply, MoreHorizontal, Award, ShieldCheck, Loader2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { communityService, type CommunityComment } from '@/services/communityService'
import { logger } from '@/lib/logger'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import DOMPurify from 'dompurify'
import { ReactionBar } from './ReactionBar'
import { AttachmentPreview } from './AttachmentPreview'
import { BestAnswerBadge } from './BestAnswerBadge'
import { OfficialBadge } from './OfficialBadge'
import { CommentEditor } from './CommentEditor'

interface CommentThreadProps {
  postId: string
  onUpdate: () => void
}

function getInitials(firstName?: string, lastName?: string): string {
  return ((firstName?.[0] || '') + (lastName?.[0] || '')).toUpperCase() || '?'
}

function getRoleBadge(role?: string) {
  if (role === 'teacher') {
    return <Badge variant="secondary" className="bg-blue-100 text-blue-600 border-blue-300 text-[10px] px-1.5 py-0">Professor</Badge>
  }
  if (role === 'administrator') {
    return <Badge variant="secondary" className="bg-purple-100 text-purple-600 border-purple-300 text-[10px] px-1.5 py-0">Admin</Badge>
  }
  return null
}

/**
 * Renders comment content with basic markdown support.
 * Content is sanitized via DOMPurify to prevent XSS.
 */
function renderContent(content: string): string {
  let html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-sm">$1</code>')
    .replace(/\n/g, '<br />')

  // Sanitize with DOMPurify to prevent XSS attacks
  return DOMPurify.sanitize(html)
}

interface SingleCommentProps {
  comment: CommunityComment
  postId: string
  isReply?: boolean
  onUpdate: () => void
}

function SingleComment({ comment, postId, isReply = false, onUpdate }: SingleCommentProps) {
  const { getUserId, isTeacher, isAdmin } = useAuth()
  const { toast } = useToast()
  const [showReplyEditor, setShowReplyEditor] = useState(false)
  const [markingBest, setMarkingBest] = useState(false)
  const [markingOfficial, setMarkingOfficial] = useState(false)

  const userId = getUserId()
  const canModerate = isTeacher || isAdmin

  const handleMarkBestAnswer = async () => {
    if (!userId) return
    setMarkingBest(true)
    try {
      await communityService.markBestAnswer(comment.id, postId, userId)
      toast({ title: 'Melhor resposta marcada!' })
      onUpdate()
    } catch (error) {
      logger.error('Failed to mark best answer', error)
      toast({ title: 'Erro', description: 'Tente novamente.', variant: 'destructive' })
    } finally {
      setMarkingBest(false)
    }
  }

  const handleMarkOfficial = async () => {
    setMarkingOfficial(true)
    try {
      await communityService.markOfficialAnswer(comment.id)
      toast({ title: 'Resposta oficial marcada!' })
      onUpdate()
    } catch (error) {
      logger.error('Failed to mark official answer', error)
      toast({ title: 'Erro', description: 'Tente novamente.', variant: 'destructive' })
    } finally {
      setMarkingOfficial(false)
    }
  }

  const handleDelete = async () => {
    try {
      await communityService.deleteComment(comment.id)
      toast({ title: 'Comentario excluido' })
      onUpdate()
    } catch (error) {
      logger.error('Failed to delete comment', error)
      toast({ title: 'Erro ao excluir', variant: 'destructive' })
    }
  }

  // Content is sanitized with DOMPurify in renderContent()
  const sanitizedHtml = renderContent(comment.content)

  return (
    <div className={cn('space-y-2', isReply && 'ml-10 pl-4 border-l-2 border-border')}>
      <div className="flex items-start gap-3">
        <Avatar className="h-7 w-7 shrink-0 mt-0.5">
          <AvatarImage src={comment.author?.avatar_url || undefined} />
          <AvatarFallback className="text-[10px]">
            {getInitials(comment.author?.first_name, comment.author?.last_name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          {/* Author line */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-foreground">
              {comment.author?.first_name} {comment.author?.last_name}
            </span>
            {getRoleBadge(comment.author?.role)}
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
            </span>
            {comment.is_best_answer && <BestAnswerBadge />}
            {comment.is_official && <OfficialBadge />}
          </div>

          {/* Content - sanitized with DOMPurify */}
          <div
            className="text-sm text-foreground mt-1 prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />

          {/* Attachments */}
          {comment.attachments && comment.attachments.length > 0 && (
            <div className="mt-2">
              <AttachmentPreview attachments={comment.attachments} compact />
            </div>
          )}

          {/* Reactions + actions */}
          <div className="flex items-center gap-3 mt-2">
            <ReactionBar
              targetType="comment"
              targetId={comment.id}
              reactions={comment.reactions || []}
              onReactionChange={onUpdate}
            />

            {!isReply && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => setShowReplyEditor(!showReplyEditor)}
              >
                <Reply className="h-3 w-3 mr-1" />
                Responder
              </Button>
            )}

            {/* Moderation actions */}
            {(canModerate || userId === comment.user_id) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canModerate && !comment.is_best_answer && (
                    <DropdownMenuItem onClick={handleMarkBestAnswer} disabled={markingBest}>
                      <Award className="h-4 w-4 mr-2" />
                      Marcar Melhor Resposta
                    </DropdownMenuItem>
                  )}
                  {canModerate && !comment.is_official && (
                    <DropdownMenuItem onClick={handleMarkOfficial} disabled={markingOfficial}>
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Resposta Oficial
                    </DropdownMenuItem>
                  )}
                  {(userId === comment.user_id || canModerate) && (
                    <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                      Excluir
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Reply editor */}
          {showReplyEditor && (
            <div className="mt-3">
              <CommentEditor
                postId={postId}
                parentCommentId={comment.id}
                onSuccess={() => {
                  setShowReplyEditor(false)
                  onUpdate()
                }}
                autoFocus
              />
            </div>
          )}
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-3 mt-2">
          {comment.replies.map((reply) => (
            <SingleComment
              key={reply.id}
              comment={reply}
              postId={postId}
              isReply
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function CommentThread({ postId, onUpdate }: CommentThreadProps) {
  const { getUserId } = useAuth()
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [loading, setLoading] = useState(true)

  const fetchComments = async () => {
    try {
      const userId = getUserId() || undefined
      const data = await communityService.getComments(postId, userId)
      setComments(data)
    } catch (error) {
      logger.error('Failed to fetch comments', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchComments()
  }, [postId])

  const handleUpdate = () => {
    fetchComments()
    onUpdate()
  }

  const totalComments = comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">
          {totalComments} {totalComments === 1 ? 'comentario' : 'comentarios'}
        </h3>
      </div>

      {/* Comment editor */}
      <CommentEditor postId={postId} onSuccess={handleUpdate} />

      {/* Comments list */}
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum comentario ainda. Seja o primeiro!
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <SingleComment
              key={comment.id}
              comment={comment}
              postId={postId}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
