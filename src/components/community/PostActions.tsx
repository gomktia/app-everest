import { useState } from 'react'
import { MoreHorizontal, Pin, Lock, Pencil, Trash2, Flag, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { communityService, type CommunityPost } from '@/services/communityService'
import { logger } from '@/lib/logger'
import { ReportDialog } from './ReportDialog'

interface PostActionsProps {
  post: CommunityPost
  onAction: () => void
}

export function PostActions({ post, onAction }: PostActionsProps) {
  const { getUserId, isTeacher, isAdmin } = useAuth()
  const { toast } = useToast()
  const [reportOpen, setReportOpen] = useState(false)

  const userId = getUserId()
  const isAuthor = userId === post.user_id
  const canModerate = isTeacher || isAdmin

  const handleTogglePin = async () => {
    try {
      await communityService.togglePinPost(post.id)
      toast({ title: post.is_pinned ? 'Post desfixado' : 'Post fixado' })
      onAction()
    } catch (error) {
      logger.error('Failed to toggle pin', error)
      toast({ title: 'Erro', variant: 'destructive' })
    }
  }

  const handleToggleLock = async () => {
    try {
      await communityService.toggleLockPost(post.id)
      toast({ title: post.is_locked ? 'Post destrancado' : 'Post trancado' })
      onAction()
    } catch (error) {
      logger.error('Failed to toggle lock', error)
      toast({ title: 'Erro', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    try {
      await communityService.deletePost(post.id)
      toast({ title: 'Post excluido' })
      onAction()
    } catch (error) {
      logger.error('Failed to delete post', error)
      toast({ title: 'Erro ao excluir', variant: 'destructive' })
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()} aria-label="Mais opcoes">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Author actions */}
          {isAuthor && (
            <>
              <DropdownMenuItem onClick={() => {
                if (window.confirm('Tem certeza que deseja excluir este post? Esta ação não pode ser desfeita.')) {
                  handleDelete()
                }
              }} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {/* Moderation actions */}
          {canModerate && (
            <>
              <DropdownMenuItem onClick={handleTogglePin}>
                <Pin className="h-4 w-4 mr-2" />
                {post.is_pinned ? 'Desfixar' : 'Fixar'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleLock}>
                {post.is_locked ? (
                  <>
                    <Unlock className="h-4 w-4 mr-2" />
                    Destrancar
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Trancar
                  </>
                )}
              </DropdownMenuItem>
              {!isAuthor && (
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}

          {/* Everyone */}
          <DropdownMenuItem onClick={() => setReportOpen(true)}>
            <Flag className="h-4 w-4 mr-2" />
            Denunciar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="post"
        targetId={post.id}
      />
    </>
  )
}
