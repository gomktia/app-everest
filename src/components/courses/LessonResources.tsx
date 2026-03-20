import { memo } from 'react'
import { cn } from '@/lib/utils'
import {
  FileText,
  Eye,
  Download,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Attachment {
  id: string
  file_name: string
  file_type: string | null
  file_url: string
}

export interface LessonResourcesProps {
  attachments: Attachment[]
  onOpenViewer: (url: string, type?: 'pdf' | 'office') => void
  onCloseDrawer: () => void
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const LessonResources = memo(function LessonResources({
  attachments,
  onOpenViewer,
  onCloseDrawer,
}: LessonResourcesProps) {
  if (attachments.length === 0) return null

  return (
    <div className="max-w-3xl mx-auto">
      <div className="grid gap-3 sm:grid-cols-2">
        {attachments.map((att) => {
          const isPdf = att.file_type?.includes('pdf') || att.file_name?.endsWith('.pdf')
          const ext = att.file_name?.split('.').pop()?.toLowerCase() || ''
          const isOffice = ['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'].includes(ext)
          const isViewable = isPdf || isOffice
          const fileLabel = isPdf ? 'PDF' : isOffice ? ext.toUpperCase() : 'Arquivo'
          const accentColor = isPdf ? 'red' : isOffice ? 'orange' : 'primary'
          return (
            <div key={att.id} className={cn(
              "flex flex-col p-4 rounded-xl border bg-white dark:bg-card transition-all group hover:shadow-lg shadow",
              isViewable ? `border-border/60 hover:border-${accentColor}-500/30` : "border-border/60 hover:border-primary/20"
            )}>
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                  isPdf ? "bg-red-100 dark:bg-red-950/50 text-red-500" : isOffice ? "bg-orange-100 dark:bg-orange-950/50 text-orange-500" : "bg-primary/10 text-primary"
                )}>
                  <FileText className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{att.file_name}</span>
                  <span className={cn(
                    "text-[11px] font-medium mt-1 block",
                    isPdf ? "text-red-500/70" : isOffice ? "text-orange-500/70" : "text-muted-foreground"
                  )}>{fileLabel}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                {isPdf && (
                  <button onClick={() => { onOpenViewer(att.file_url); onCloseDrawer() }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold text-white bg-primary hover:bg-primary/90 transition-all shadow-sm">
                    <Eye className="h-3.5 w-3.5" />
                    Visualizar
                  </button>
                )}
                {isOffice && (
                  <button onClick={() => { onOpenViewer(att.file_url, 'office'); onCloseDrawer() }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-all shadow-sm">
                    <Eye className="h-3.5 w-3.5" />
                    Visualizar
                  </button>
                )}
                <a href={att.file_url} download target="_blank" rel="noopener noreferrer"
                  className={cn(
                    "flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all",
                    isPdf
                      ? "flex-1 text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-border/60"
                      : "flex-1 text-white bg-primary hover:bg-primary/90 shadow-sm"
                  )}>
                  <Download className="h-3.5 w-3.5" />
                  Baixar
                </a>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})
