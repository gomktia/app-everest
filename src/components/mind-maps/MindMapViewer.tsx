import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Network, Expand, Shrink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MindMapCard, type MindMapNode } from './MindMapCard'

interface MindMapViewerProps {
  title: string
  subject: string
  color: string
  nodes: MindMapNode[]
}

const headerAccent: Record<string, string> = {
  blue: 'from-blue-500/10 to-blue-600/5 border-blue-200/50 dark:border-blue-800/40',
  purple: 'from-purple-500/10 to-purple-600/5 border-purple-200/50 dark:border-purple-800/40',
  red: 'from-red-500/10 to-red-600/5 border-red-200/50 dark:border-red-800/40',
  emerald: 'from-emerald-500/10 to-emerald-600/5 border-emerald-200/50 dark:border-emerald-800/40',
  cyan: 'from-cyan-500/10 to-cyan-600/5 border-cyan-200/50 dark:border-cyan-800/40',
  orange: 'from-orange-500/10 to-orange-600/5 border-orange-200/50 dark:border-orange-800/40',
  amber: 'from-amber-500/10 to-amber-600/5 border-amber-200/50 dark:border-amber-800/40',
  rose: 'from-rose-500/10 to-rose-600/5 border-rose-200/50 dark:border-rose-800/40',
}

const iconColor: Record<string, string> = {
  blue: 'text-blue-500',
  purple: 'text-purple-500',
  red: 'text-red-500',
  emerald: 'text-emerald-500',
  cyan: 'text-cyan-500',
  orange: 'text-orange-500',
  amber: 'text-amber-500',
  rose: 'text-rose-500',
}

const subjectBadgeColor: Record<string, string> = {
  blue: 'border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:bg-blue-950/30',
  purple: 'border-purple-300 text-purple-700 bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:bg-purple-950/30',
  red: 'border-red-300 text-red-700 bg-red-50 dark:border-red-700 dark:text-red-300 dark:bg-red-950/30',
  emerald: 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:bg-emerald-950/30',
  cyan: 'border-cyan-300 text-cyan-700 bg-cyan-50 dark:border-cyan-700 dark:text-cyan-300 dark:bg-cyan-950/30',
  orange: 'border-orange-300 text-orange-700 bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:bg-orange-950/30',
  amber: 'border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:bg-amber-950/30',
  rose: 'border-rose-300 text-rose-700 bg-rose-50 dark:border-rose-700 dark:text-rose-300 dark:bg-rose-950/30',
}

export function MindMapViewer({ title, subject, color, nodes }: MindMapViewerProps) {
  // Use a key to force re-mount of all cards when toggling expand/collapse globally
  const [expandKey, setExpandKey] = useState(0)
  const [allExpanded, setAllExpanded] = useState(true)

  const handleExpandAll = () => {
    setAllExpanded(true)
    setExpandKey((k) => k + 1)
  }

  const handleCollapseAll = () => {
    setAllExpanded(false)
    setExpandKey((k) => k + 1)
  }

  const accent = headerAccent[color] ?? headerAccent.blue
  const brainColor = iconColor[color] ?? iconColor.blue
  const badgeColor = subjectBadgeColor[color] ?? subjectBadgeColor.blue

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-border/60 shadow-sm bg-background">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className={cn(
          'flex items-center gap-3 px-5 py-4 border-b',
          'bg-gradient-to-r',
          accent,
        )}
      >
        <div
          className={cn(
            'flex items-center justify-center w-9 h-9 rounded-xl',
            'bg-white/80 dark:bg-white/10 shadow-sm flex-shrink-0',
          )}
        >
          <Network className={cn('w-5 h-5', brainColor)} />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-foreground leading-tight truncate">
            {title}
          </h2>
          <div className="mt-0.5">
            <span
              className={cn(
                'inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border',
                badgeColor,
              )}
            >
              {subject}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExpandAll}
            disabled={allExpanded}
            className="h-8 gap-1.5 text-xs bg-white/80 dark:bg-white/10 border-border/60 hover:bg-white dark:hover:bg-white/20"
          >
            <Expand className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Expandir Tudo</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCollapseAll}
            disabled={!allExpanded}
            className="h-8 gap-1.5 text-xs bg-white/80 dark:bg-white/10 border-border/60 hover:bg-white dark:hover:bg-white/20"
          >
            <Shrink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Colapsar Tudo</span>
          </Button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="p-5 space-y-4 bg-gradient-to-b from-muted/20 to-background">
        {nodes.map((node) => (
          <MindMapCard
            key={`${node.id}-${expandKey}`}
            node={node}
            level={0}
            color={color}
            defaultExpanded={allExpanded}
          />
        ))}
      </div>
    </div>
  )
}
