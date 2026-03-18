import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Eye, MessageSquare, Lock, Hash } from 'lucide-react'
import DOMPurify from 'dompurify'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SectionLoader } from '@/components/SectionLoader'
import { ReactionBar } from '@/components/community/ReactionBar'
import { PostActions } from '@/components/community/PostActions'
import { AttachmentPreview } from '@/components/community/AttachmentPreview'
import { PollDisplay } from '@/components/community/PollDisplay'
import { LinkPreview } from '@/components/community/LinkPreview'
import { CommentThread } from '@/components/community/CommentThread'
import { CommentEditor } from '@/components/community/CommentEditor'
import { useAuth } from '@/hooks/use-auth'
import { communityService, type CommunityPost } from '@/services/communityService'
import { logger } from '@/lib/logger'

const ROLE_LABELS: Record<string, string> = {
  administrator: 'Admin',
  teacher: 'Professor',
  student: 'Aluno',
}

export default function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>()
  const { user } = useAuth()
  const [post, setPost] = useState<CommunityPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const fetchPost = useCallback(async (isRefresh = false) => {
    if (!postId) return
    try {
      if (!isRefresh) setLoading(true)
      const data = await communityService.getPostById(postId, user?.id)
      if (!data) {
        setNotFound(true)
        return
      }
      setPost(data)
    } catch (error) {
      logger.error('Failed to load post', error)
      if (!isRefresh) setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [postId, user?.id])

  useEffect(() => {
    fetchPost()
  }, [fetchPost])

  const handleReactionChange = () => {
    fetchPost(true)
  }

  const handleCommentUpdate = () => {
    fetchPost(true)
  }

  const handlePostAction = () => {
    fetchPost(true)
  }

  if (loading) return <SectionLoader />

  if (notFound || !post) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Post nao encontrado</h1>
          <p className="text-sm text-muted-foreground mt-1">
            O post que voce procura nao existe ou foi removido.
          </p>
        </div>
        <Link to="/comunidade">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para a Comunidade
          </Button>
        </Link>
      </div>
    )
  }

  const backLink = post.space ? `/comunidade/${post.space.slug}` : '/comunidade'
  const authorName = post.author
    ? `${post.author.first_name} ${post.author.last_name}`
    : 'Usuario'
  const authorInitials = post.author
    ? `${post.author.first_name?.[0] || ''}${post.author.last_name?.[0] || ''}`
    : 'U'
  const authorRole = post.author?.role || 'student'
  // Content is sanitized with DOMPurify to prevent XSS before rendering
  const sanitizedContent = DOMPurify.sanitize(post.content)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back button */}
      <Link to={backLink}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </Link>

      {/* Post card */}
      <Card>
        <CardContent className="pt-6">
          {/* Post header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground">{DOMPurify.sanitize(post.title, { ALLOWED_TAGS: [] })}</h1>

              <div className="flex flex-wrap items-center gap-3 mt-3">
                {/* Author */}
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={post.author?.avatar_url} alt={authorName} />
                    <AvatarFallback className="text-xs">{authorInitials}</AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{authorName}</span>
                    <Badge variant="secondary" className="text-xs">
                      {ROLE_LABELS[authorRole] || 'Aluno'}
                    </Badge>
                  </div>
                </div>

                {/* Timestamp */}
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>

                {/* Space badge */}
                {post.space && (
                  <Link to={`/comunidade/${post.space.slug}`}>
                    <Badge variant="outline" className="text-xs gap-1">
                      <span
                        className="h-2 w-2 rounded-full inline-block"
                        style={{ backgroundColor: post.space.color }}
                      />
                      <Hash className="h-3 w-3" />
                      {post.space.name}
                    </Badge>
                  </Link>
                )}

                {/* Metadata */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {post.views}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {post.comments_count}
                  </span>
                </div>

                {/* Pinned / Locked badges */}
                {post.is_pinned && (
                  <Badge variant="default" className="text-xs">Fixado</Badge>
                )}
                {post.is_locked && (
                  <Badge variant="destructive" className="text-xs gap-1">
                    <Lock className="h-3 w-3" />
                    Trancado
                  </Badge>
                )}
              </div>
            </div>

            {/* Actions dropdown */}
            <PostActions post={post} onAction={handlePostAction} />
          </div>

          {/* Post content - sanitized with DOMPurify to prevent XSS */}
          <div
            className="prose prose-sm dark:prose-invert max-w-none mt-6"
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          />

          {/* Attachments */}
          {post.attachments && post.attachments.length > 0 && (
            <div className="mt-6">
              <AttachmentPreview attachments={post.attachments} />
            </div>
          )}

          {/* Poll */}
          {post.type === 'poll' && post.poll_options && (
            <div className="mt-6">
              <PollDisplay
                postId={post.id}
                options={post.poll_options}
                onVote={handleReactionChange}
              />
            </div>
          )}

          {/* Link preview */}
          {post.link_preview && (
            <div className="mt-6">
              <LinkPreview preview={post.link_preview} />
            </div>
          )}

          {/* Reactions */}
          <div className="mt-6">
            <ReactionBar
              targetType="post"
              targetId={post.id}
              reactions={post.reactions || []}
              onReactionChange={handleReactionChange}
            />
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Comments section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          Comentarios ({post.comments_count})
        </h2>

        <CommentThread postId={post.id} onUpdate={handleCommentUpdate} />

        {post.is_locked ? (
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span className="text-sm">Este post esta trancado. Novos comentarios nao podem ser adicionados.</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <CommentEditor postId={post.id} onSuccess={handleCommentUpdate} />
        )}
      </div>
    </div>
  )
}
