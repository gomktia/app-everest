import { memo } from 'react'
import DOMPurify from 'dompurify'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { LessonComment } from '@/services/lessonInteractionService'
import {
  MessageSquare,
  Send,
  Trash2,
  Reply,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface LessonCommentsProps {
  comments: LessonComment[]
  commentText: string
  onCommentTextChange: (text: string) => void
  replyingTo: string | null
  onReplyingToChange: (commentId: string | null) => void
  replyText: string
  onReplyTextChange: (text: string) => void
  submittingComment: boolean
  onSubmitComment: (parentId?: string) => void
  onDeleteComment: (commentId: string) => void
  userEmail?: string
  userId?: string
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const LessonComments = memo(function LessonComments({
  comments,
  commentText,
  onCommentTextChange,
  replyingTo,
  onReplyingToChange,
  replyText,
  onReplyTextChange,
  submittingComment,
  onSubmitComment,
  onDeleteComment,
  userEmail,
  userId,
}: LessonCommentsProps) {
  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Comment input */}
      <div className="flex gap-3 bg-white dark:bg-card rounded-2xl p-4 border border-border/40 shadow">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shrink-0 shadow-sm">
          <span className="text-sm font-bold text-white">
            {userEmail?.[0]?.toUpperCase() || 'A'}
          </span>
        </div>
        <div className="flex-1">
          <textarea
            value={commentText}
            onChange={(e) => onCommentTextChange(e.target.value)}
            placeholder="Compartilhe sua duvida ou comentario sobre esta aula..."
            rows={2}
            maxLength={2000}
            className="w-full px-4 py-3 text-sm bg-muted/30 border-0 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-muted/50 text-foreground placeholder:text-muted-foreground/50 transition-all"
          />
          {commentText.trim() && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-muted-foreground tabular-nums">{commentText.length}/2000</span>
              <Button
                size="sm"
                onClick={() => onSubmitComment()}
                disabled={submittingComment || !commentText.trim()}
                className="h-9 px-4 text-xs gap-2 bg-primary hover:bg-primary/90"
              >
                <Send className="h-3.5 w-3.5" />
                Enviar
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Comments list */}
      {comments.length === 0 ? (
        <div className="text-center py-14 bg-white dark:bg-card rounded-2xl border border-border/40 shadow">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="h-7 w-7 text-primary/60" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1.5">Nenhum comentario ainda</h3>
          <p className="text-sm text-muted-foreground max-w-[300px] mx-auto leading-relaxed">Seja o primeiro a comentar! Compartilhe suas duvidas ou insights sobre esta aula.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {comments.map((comment) => (
            <div key={comment.id} className="bg-white dark:bg-card rounded-xl border border-border/40 shadow overflow-hidden">
              {/* Main comment */}
              <div className="flex gap-3 p-4 group">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0 shadow-sm">
                  {comment.user_avatar ? (
                    <img src={comment.user_avatar} alt={`Avatar de ${comment.user_name || 'Aluno'}`} className="w-9 h-9 rounded-full object-cover" loading="lazy" />
                  ) : (
                    <span className="text-xs font-bold text-white">
                      {(comment.user_name || 'A')[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{comment.user_name || 'Aluno'}</span>
                    <span className="text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                      {new Date(comment.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words leading-relaxed">{DOMPurify.sanitize(comment.content, { ALLOWED_TAGS: [] })}</p>
                  <div className="flex items-center gap-3 mt-2.5">
                    <button
                      onClick={() => onReplyingToChange(replyingTo === comment.id ? null : comment.id)}
                      className="flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary transition-colors font-semibold"
                    >
                      <Reply className="h-3.5 w-3.5" />
                      Responder
                    </button>
                    {comment.user_id === userId && (
                      <button
                        onClick={() => onDeleteComment(comment.id)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 font-medium"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir
                      </button>
                    )}
                  </div>

                  {/* Reply input */}
                  {replyingTo === comment.id && (
                    <div className="flex gap-2 mt-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                      <input
                        value={replyText}
                        onChange={(e) => onReplyTextChange(e.target.value)}
                        placeholder="Escreva uma resposta..."
                        maxLength={2000}
                        className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground/50"
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmitComment(comment.id) } }}
                      />
                      <Button
                        size="sm"
                        onClick={() => onSubmitComment(comment.id)}
                        disabled={submittingComment || !replyText.trim()}
                        className="h-9 px-3 text-xs"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="ml-12 mr-4 mb-3 border-l-2 border-primary/15 pl-4 space-y-1 bg-muted/20 rounded-r-lg py-2">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="flex gap-3 p-3 rounded-lg hover:bg-background/60 transition-colors group">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shrink-0">
                        {reply.user_avatar ? (
                          <img src={reply.user_avatar} alt={`Avatar de ${reply.user_name || 'Aluno'}`} className="w-7 h-7 rounded-full object-cover" loading="lazy" />
                        ) : (
                          <span className="text-[10px] font-bold text-white">
                            {(reply.user_name || 'A')[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-foreground">{reply.user_name || 'Aluno'}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(reply.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/80 whitespace-pre-wrap break-words leading-relaxed">{DOMPurify.sanitize(reply.content, { ALLOWED_TAGS: [] })}</p>
                        {reply.user_id === userId && (
                          <button
                            onClick={() => onDeleteComment(reply.id)}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 mt-1 font-medium"
                          >
                            <Trash2 className="h-3 w-3" />
                            Excluir
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
