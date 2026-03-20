import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pin, Lock, MessageCircle, Eye } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import DOMPurify from 'dompurify'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { CommunityPost } from '@/services/communityService'
import { ReactionBar } from './ReactionBar'
import { AttachmentPreview } from './AttachmentPreview'
import { PollDisplay } from './PollDisplay'

interface PostCardProps {
  post: CommunityPost
  onReactionChange: () => void
}

function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName?.[0] || ''
  const last = lastName?.[0] || ''
  return (first + last).toUpperCase() || '?'
}

function stripMarkdown(text: string): string {
  return text
    .replace(/[#*_~`>[\]()!]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
}

function getRoleBadge(role?: string) {
  if (role === 'teacher') {
    return <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-950/50 text-blue-600 border-blue-300 dark:border-blue-800 text-[10px] px-1.5 py-0">Professor</Badge>
  }
  if (role === 'administrator') {
    return <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-950/50 text-purple-600 border-purple-300 dark:border-purple-800 text-[10px] px-1.5 py-0">Admin</Badge>
  }
  return null
}

export const PostCard = memo(function PostCard({ post, onReactionChange }: PostCardProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate(`/comunidade/post/${post.id}`)
  }

  return (
    <Card
      className="border-border shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200 cursor-pointer"
      onClick={handleClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header: Author info */}
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={post.author?.avatar_url || undefined} />
            <AvatarFallback className="text-xs">
              {getInitials(post.author?.first_name, post.author?.last_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-sm font-medium text-foreground truncate">
              {post.author?.first_name} {post.author?.last_name}
            </span>
            {getRoleBadge(post.author?.role)}
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {post.space && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {post.space.name}
              </Badge>
            )}
            {post.is_pinned && <Pin className="h-3.5 w-3.5 text-amber-500" />}
            {post.is_locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-lg text-foreground leading-tight">{DOMPurify.sanitize(post.title, { ALLOWED_TAGS: [] })}</h3>

        {/* Content preview */}
        <p className="text-sm text-muted-foreground line-clamp-3">
          {DOMPurify.sanitize(stripMarkdown(post.content), { ALLOWED_TAGS: [] })}
        </p>

        {/* Attachments (compact) */}
        {post.attachments && post.attachments.length > 0 && (
          <div onClick={(e) => e.stopPropagation()}>
            <AttachmentPreview attachments={post.attachments} compact />
          </div>
        )}

        {/* Poll */}
        {post.type === 'poll' && post.poll_options && post.poll_options.length > 0 && (
          <div onClick={(e) => e.stopPropagation()}>
            <PollDisplay postId={post.id} options={post.poll_options} onVote={onReactionChange} />
          </div>
        )}

        {/* Footer: Reactions + stats */}
        <div className="flex items-center justify-between pt-1" onClick={(e) => e.stopPropagation()}>
          <ReactionBar
            targetType="post"
            targetId={post.id}
            reactions={post.reactions || []}
            onReactionChange={onReactionChange}
          />
          <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              {post.comments_count || 0}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {post.views || 0}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
