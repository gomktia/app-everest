import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  BookOpen,
  Code,
  AlertTriangle,
  Lightbulb,
  Scale,
  ShieldAlert,
  Maximize2,
  Minimize2,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MindMapNode } from '@/services/mindMapService'

// ─── Color themes (inspired by Lulu's maps) ────────────────────────────────

const THEMES: Record<string, {
  titleBg: string
  titleText: string
  subtitleBg: string
  cardBg: string
  cardBorder: string
  accentBg: string
  accentText: string
  lineBg: string
  highlightBg: string
  highlightText: string
}> = {
  blue: {
    titleBg: 'bg-blue-100 dark:bg-blue-900/60',
    titleText: 'text-blue-800 dark:text-blue-100',
    subtitleBg: 'bg-blue-500',
    cardBg: 'bg-blue-50/80 dark:bg-blue-950/40',
    cardBorder: 'border-blue-300 dark:border-blue-700',
    accentBg: 'bg-blue-100 dark:bg-blue-900/50',
    accentText: 'text-blue-700 dark:text-blue-200',
    lineBg: 'bg-blue-300 dark:bg-blue-700',
    highlightBg: 'bg-blue-200/60 dark:bg-blue-800/40',
    highlightText: 'text-blue-900 dark:text-blue-100',
  },
  purple: {
    titleBg: 'bg-purple-100 dark:bg-purple-900/60',
    titleText: 'text-purple-800 dark:text-purple-100',
    subtitleBg: 'bg-purple-500',
    cardBg: 'bg-purple-50/80 dark:bg-purple-950/40',
    cardBorder: 'border-purple-300 dark:border-purple-700',
    accentBg: 'bg-purple-100 dark:bg-purple-900/50',
    accentText: 'text-purple-700 dark:text-purple-200',
    lineBg: 'bg-purple-300 dark:bg-purple-700',
    highlightBg: 'bg-purple-200/60 dark:bg-purple-800/40',
    highlightText: 'text-purple-900 dark:text-purple-100',
  },
  red: {
    titleBg: 'bg-red-100 dark:bg-red-900/60',
    titleText: 'text-red-800 dark:text-red-100',
    subtitleBg: 'bg-red-500',
    cardBg: 'bg-red-50/80 dark:bg-red-950/40',
    cardBorder: 'border-red-300 dark:border-red-700',
    accentBg: 'bg-red-100 dark:bg-red-900/50',
    accentText: 'text-red-700 dark:text-red-200',
    lineBg: 'bg-red-300 dark:bg-red-700',
    highlightBg: 'bg-red-200/60 dark:bg-red-800/40',
    highlightText: 'text-red-900 dark:text-red-100',
  },
  emerald: {
    titleBg: 'bg-emerald-100 dark:bg-emerald-900/60',
    titleText: 'text-emerald-800 dark:text-emerald-100',
    subtitleBg: 'bg-emerald-500',
    cardBg: 'bg-emerald-50/80 dark:bg-emerald-950/40',
    cardBorder: 'border-emerald-300 dark:border-emerald-700',
    accentBg: 'bg-emerald-100 dark:bg-emerald-900/50',
    accentText: 'text-emerald-700 dark:text-emerald-200',
    lineBg: 'bg-emerald-300 dark:bg-emerald-700',
    highlightBg: 'bg-emerald-200/60 dark:bg-emerald-800/40',
    highlightText: 'text-emerald-900 dark:text-emerald-100',
  },
  cyan: {
    titleBg: 'bg-cyan-100 dark:bg-cyan-900/60',
    titleText: 'text-cyan-800 dark:text-cyan-100',
    subtitleBg: 'bg-cyan-500',
    cardBg: 'bg-cyan-50/80 dark:bg-cyan-950/40',
    cardBorder: 'border-cyan-300 dark:border-cyan-700',
    accentBg: 'bg-cyan-100 dark:bg-cyan-900/50',
    accentText: 'text-cyan-700 dark:text-cyan-200',
    lineBg: 'bg-cyan-300 dark:bg-cyan-700',
    highlightBg: 'bg-cyan-200/60 dark:bg-cyan-800/40',
    highlightText: 'text-cyan-900 dark:text-cyan-100',
  },
  orange: {
    titleBg: 'bg-orange-100 dark:bg-orange-900/60',
    titleText: 'text-orange-800 dark:text-orange-100',
    subtitleBg: 'bg-orange-500',
    cardBg: 'bg-orange-50/80 dark:bg-orange-950/40',
    cardBorder: 'border-orange-300 dark:border-orange-700',
    accentBg: 'bg-orange-100 dark:bg-orange-900/50',
    accentText: 'text-orange-700 dark:text-orange-200',
    lineBg: 'bg-orange-300 dark:bg-orange-700',
    highlightBg: 'bg-orange-200/60 dark:bg-orange-800/40',
    highlightText: 'text-orange-900 dark:text-orange-100',
  },
  amber: {
    titleBg: 'bg-amber-100 dark:bg-amber-900/60',
    titleText: 'text-amber-800 dark:text-amber-100',
    subtitleBg: 'bg-amber-500',
    cardBg: 'bg-amber-50/80 dark:bg-amber-950/40',
    cardBorder: 'border-amber-300 dark:border-amber-700',
    accentBg: 'bg-amber-100 dark:bg-amber-900/50',
    accentText: 'text-amber-700 dark:text-amber-200',
    lineBg: 'bg-amber-300 dark:bg-amber-700',
    highlightBg: 'bg-amber-200/60 dark:bg-amber-800/40',
    highlightText: 'text-amber-900 dark:text-amber-100',
  },
  rose: {
    titleBg: 'bg-rose-100 dark:bg-rose-900/60',
    titleText: 'text-rose-800 dark:text-rose-100',
    subtitleBg: 'bg-rose-500',
    cardBg: 'bg-rose-50/80 dark:bg-rose-950/40',
    cardBorder: 'border-rose-300 dark:border-rose-700',
    accentBg: 'bg-rose-100 dark:bg-rose-900/50',
    accentText: 'text-rose-700 dark:text-rose-200',
    lineBg: 'bg-rose-300 dark:bg-rose-700',
    highlightBg: 'bg-rose-200/60 dark:bg-rose-800/40',
    highlightText: 'text-rose-900 dark:text-rose-100',
  },
}

const TYPE_ICONS: Record<string, { icon: React.ReactNode; label: string; badgeCls: string }> = {
  concept:   { icon: <BookOpen className="w-3.5 h-3.5" />,       label: 'Conceito',  badgeCls: 'bg-blue-100 text-blue-700 dark:bg-blue-800/50 dark:text-blue-200 border-blue-200 dark:border-blue-700' },
  example:   { icon: <Code className="w-3.5 h-3.5" />,           label: 'Exemplo',   badgeCls: 'bg-green-100 text-green-700 dark:bg-green-800/50 dark:text-green-200 border-green-200 dark:border-green-700' },
  exception: { icon: <AlertTriangle className="w-3.5 h-3.5" />,  label: 'Exceção',   badgeCls: 'bg-orange-100 text-orange-700 dark:bg-orange-800/50 dark:text-orange-200 border-orange-200 dark:border-orange-700' },
  tip:       { icon: <Lightbulb className="w-3.5 h-3.5" />,      label: 'Dica',      badgeCls: 'bg-purple-100 text-purple-700 dark:bg-purple-800/50 dark:text-purple-200 border-purple-200 dark:border-purple-700' },
  rule:      { icon: <Scale className="w-3.5 h-3.5" />,          label: 'Regra',     badgeCls: 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200 border-slate-200 dark:border-slate-600' },
  warning:   { icon: <ShieldAlert className="w-3.5 h-3.5" />,    label: 'Atenção',   badgeCls: 'bg-red-100 text-red-700 dark:bg-red-800/50 dark:text-red-200 border-red-200 dark:border-red-700' },
}

// ─── Card component (recursive) ────────────────────────────────────────────

function LuluCard({ node, theme, level = 0 }: { node: MindMapNode; theme: typeof THEMES.blue; level?: number }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children && node.children.length > 0
  const typeDef = node.type ? TYPE_ICONS[node.type] : null

  // Level 0: section header card (like Lulu's big boxes)
  if (level === 0) {
    return (
      <div className={cn('rounded-xl border-2 overflow-hidden', theme.cardBorder)}>
        {/* Section header */}
        <div
          onClick={() => hasChildren && setExpanded(!expanded)}
          className={cn(
            'px-5 py-3 flex items-center gap-3',
            theme.accentBg,
            hasChildren && 'cursor-pointer',
          )}
        >
          {node.icon && <span className="text-xl">{node.icon}</span>}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={cn('font-bold text-base uppercase tracking-wide', theme.accentText)}>
                {node.label}
              </h3>
              {typeDef && (
                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border', typeDef.badgeCls)}>
                  {typeDef.icon}{typeDef.label}
                </span>
              )}
            </div>
            {node.detail && (
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{node.detail}</p>
            )}
          </div>
          {hasChildren && (
            <ChevronRight className={cn('w-5 h-5 shrink-0 transition-transform duration-200', theme.accentText, expanded && 'rotate-90')} />
          )}
        </div>

        {/* Children content */}
        {hasChildren && expanded && (
          <div className={cn('px-5 py-4 space-y-3', theme.cardBg)}>
            {node.children!.map(child => (
              <LuluItem key={child.id} node={child} theme={theme} level={1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return null
}

function LuluItem({ node, theme, level }: { node: MindMapNode; theme: typeof THEMES.blue; level: number }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children && node.children.length > 0
  const typeDef = node.type ? TYPE_ICONS[node.type] : null

  const isExample = node.type === 'example'
  const isWarning = node.type === 'warning' || node.type === 'exception'
  const isTip = node.type === 'tip'

  return (
    <div className="w-full">
      <div
        onClick={() => hasChildren && setExpanded(!expanded)}
        className={cn(
          'rounded-lg px-4 py-2.5 transition-all duration-150',
          hasChildren && 'cursor-pointer',
          isWarning && 'bg-red-50/80 dark:bg-red-950/30 border-l-4 border-l-red-400',
          isExample && 'bg-green-50/80 dark:bg-green-950/30 border-l-4 border-l-green-400',
          isTip && 'bg-purple-50/80 dark:bg-purple-950/30 border-l-4 border-l-purple-400',
          !isWarning && !isExample && !isTip && level === 1 && cn('border-l-4', theme.cardBorder),
          !isWarning && !isExample && !isTip && level > 1 && 'border-l-2 border-l-muted-foreground/20',
          'hover:bg-muted/30 dark:hover:bg-muted/10',
        )}
      >
        <div className="flex items-start gap-2">
          {node.icon && <span className="text-base shrink-0 mt-0.5">{node.icon}</span>}
          {isWarning && !node.icon && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
          {isTip && !node.icon && <Lightbulb className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={cn(
                'font-semibold leading-snug',
                level === 1 ? 'text-sm' : 'text-[13px]',
                isWarning && 'text-red-700 dark:text-red-300',
                isExample && 'text-green-700 dark:text-green-300',
                isTip && 'text-purple-700 dark:text-purple-300',
              )}>
                {node.label}
              </span>
              {typeDef && (
                <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border', typeDef.badgeCls)}>
                  {typeDef.icon}{typeDef.label}
                </span>
              )}
              {!expanded && hasChildren && (
                <span className="text-xs text-muted-foreground">({node.children!.length})</span>
              )}
            </div>
            {node.detail && (
              <p className={cn(
                'mt-1 leading-relaxed text-muted-foreground',
                level === 1 ? 'text-sm' : 'text-xs',
              )}>
                {node.detail}
              </p>
            )}
          </div>
          {hasChildren && (
            <ChevronRight className={cn('w-4 h-4 shrink-0 mt-0.5 transition-transform duration-200 text-muted-foreground', expanded && 'rotate-90')} />
          )}
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="ml-4 mt-1.5 space-y-1.5 pl-3 border-l border-dashed border-muted-foreground/20">
          {node.children!.map(child => (
            <LuluItem key={child.id} node={child} theme={theme} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

interface MindMapVisualProps {
  title: string
  subject: string
  color: string
  nodes: MindMapNode[]
}

export function MindMapVisual({ title, subject, color, nodes }: MindMapVisualProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const theme = THEMES[color] || THEMES.blue

  // The root node contains children that become section cards
  // If there's a single root, use its children as sections
  const sections = nodes.length === 1 && nodes[0].children?.length
    ? nodes[0].children
    : nodes

  const rootDetail = nodes.length === 1 ? nodes[0].detail : null

  const toggleFullscreen = () => {
    const el = document.getElementById('lulu-map-container')
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  return (
    <div
      id="lulu-map-container"
      className={cn(
        'w-full rounded-2xl overflow-hidden border border-border/60 shadow-sm bg-background',
        isFullscreen && 'rounded-none overflow-y-auto',
      )}
    >
      {/* ── Title area (Lulu style) ─────────────────────────────────────── */}
      <div className="relative py-8 px-6 text-center overflow-hidden">
        {/* Background decoration */}
        <div className={cn('absolute inset-0 opacity-30', theme.titleBg)} />
        <div className={cn('absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-16 -rotate-2 opacity-20', theme.subtitleBg)} />

        <div className="relative">
          <h1 className={cn('text-3xl md:text-4xl font-black uppercase tracking-widest', theme.titleText)}>
            {title}
          </h1>
          {rootDetail && (
            <p className="mt-2 text-sm text-muted-foreground max-w-xl mx-auto">{rootDetail}</p>
          )}
          <div className="mt-3 flex items-center justify-center gap-3">
            <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white', theme.subtitleBg)}>
              <BookOpen className="w-3.5 h-3.5" />
              {subject}
            </span>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              {isFullscreen ? 'Sair' : 'Tela Cheia'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Subtitle bar ────────────────────────────────────────────────── */}
      {nodes.length === 1 && nodes[0].label !== title && (
        <div className="flex justify-center -mt-2 mb-4 px-6">
          <div className={cn('inline-flex items-center px-5 py-1.5 rounded-full text-sm font-bold text-white shadow-md', theme.subtitleBg)}>
            = {nodes[0].label} =
          </div>
        </div>
      )}

      {/* ── Section cards grid (Lulu style layout) ──────────────────────── */}
      <div className="px-4 md:px-6 pb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sections.map(section => (
            <LuluCard key={section.id} node={section} theme={theme} level={0} />
          ))}
        </div>
      </div>
    </div>
  )
}
