import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  ChevronRight,
  BookOpen,
  Code,
  AlertTriangle,
  Lightbulb,
  Scale,
  ShieldAlert,
} from 'lucide-react'
import type { MindMapNode } from '@/services/mindMapService'

export type { MindMapNode }

interface MindMapCardProps {
  node: MindMapNode
  level: number
  color: string
  defaultExpanded?: boolean
}

const colorStyles: Record<
  string,
  {
    root: string
    l1Bg: string
    l1Border: string
    l2Border: string
    l3Border: string
    badge: string
    chevron: string
    count: string
  }
> = {
  blue: {
    root: 'from-blue-600 to-blue-500',
    l1Bg: 'bg-blue-50 dark:bg-blue-950/60',
    l1Border: 'border-blue-500',
    l2Border: 'border-blue-400 dark:border-blue-500',
    l3Border: 'border-blue-300 dark:border-blue-600',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-800/60 dark:text-blue-200',
    chevron: 'text-blue-500 dark:text-blue-400',
    count: 'text-blue-500 dark:text-blue-400',
  },
  purple: {
    root: 'from-purple-600 to-purple-500',
    l1Bg: 'bg-purple-50 dark:bg-purple-950/60',
    l1Border: 'border-purple-500',
    l2Border: 'border-purple-400 dark:border-purple-500',
    l3Border: 'border-purple-300 dark:border-purple-600',
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-800/60 dark:text-purple-200',
    chevron: 'text-purple-500 dark:text-purple-400',
    count: 'text-purple-500 dark:text-purple-400',
  },
  red: {
    root: 'from-red-600 to-red-500',
    l1Bg: 'bg-red-50 dark:bg-red-950/60',
    l1Border: 'border-red-500',
    l2Border: 'border-red-400 dark:border-red-500',
    l3Border: 'border-red-300 dark:border-red-600',
    badge: 'bg-red-100 text-red-700 dark:bg-red-800/60 dark:text-red-200',
    chevron: 'text-red-500 dark:text-red-400',
    count: 'text-red-500 dark:text-red-400',
  },
  emerald: {
    root: 'from-emerald-600 to-emerald-500',
    l1Bg: 'bg-emerald-50 dark:bg-emerald-950/60',
    l1Border: 'border-emerald-500',
    l2Border: 'border-emerald-400 dark:border-emerald-500',
    l3Border: 'border-emerald-300 dark:border-emerald-600',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-800/60 dark:text-emerald-200',
    chevron: 'text-emerald-500 dark:text-emerald-400',
    count: 'text-emerald-500 dark:text-emerald-400',
  },
  cyan: {
    root: 'from-cyan-600 to-cyan-500',
    l1Bg: 'bg-cyan-50 dark:bg-cyan-950/60',
    l1Border: 'border-cyan-500',
    l2Border: 'border-cyan-400 dark:border-cyan-500',
    l3Border: 'border-cyan-300 dark:border-cyan-600',
    badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-800/60 dark:text-cyan-200',
    chevron: 'text-cyan-500 dark:text-cyan-400',
    count: 'text-cyan-500 dark:text-cyan-400',
  },
  orange: {
    root: 'from-orange-600 to-orange-500',
    l1Bg: 'bg-orange-50 dark:bg-orange-950/60',
    l1Border: 'border-orange-500',
    l2Border: 'border-orange-400 dark:border-orange-500',
    l3Border: 'border-orange-300 dark:border-orange-600',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-800/60 dark:text-orange-200',
    chevron: 'text-orange-500 dark:text-orange-400',
    count: 'text-orange-500 dark:text-orange-400',
  },
  amber: {
    root: 'from-amber-600 to-amber-500',
    l1Bg: 'bg-amber-50 dark:bg-amber-950/60',
    l1Border: 'border-amber-500',
    l2Border: 'border-amber-400 dark:border-amber-500',
    l3Border: 'border-amber-300 dark:border-amber-600',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-800/60 dark:text-amber-200',
    chevron: 'text-amber-500 dark:text-amber-400',
    count: 'text-amber-500 dark:text-amber-400',
  },
  rose: {
    root: 'from-rose-600 to-rose-500',
    l1Bg: 'bg-rose-50 dark:bg-rose-950/60',
    l1Border: 'border-rose-500',
    l2Border: 'border-rose-400 dark:border-rose-500',
    l3Border: 'border-rose-300 dark:border-rose-600',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-800/60 dark:text-rose-200',
    chevron: 'text-rose-500 dark:text-rose-400',
    count: 'text-rose-500 dark:text-rose-400',
  },
}

const typeMeta: Record<
  NonNullable<MindMapNode['type']>,
  { icon: React.ReactNode; label: string; className: string }
> = {
  concept: {
    icon: <BookOpen className="w-3 h-3" />,
    label: 'Conceito',
    className:
      'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-800/60 dark:text-blue-200 dark:border-blue-700',
  },
  example: {
    icon: <Code className="w-3 h-3" />,
    label: 'Exemplo',
    className:
      'bg-green-100 text-green-700 border-green-200 dark:bg-green-800/60 dark:text-green-200 dark:border-green-700',
  },
  exception: {
    icon: <AlertTriangle className="w-3 h-3" />,
    label: 'Exceção',
    className:
      'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-800/60 dark:text-orange-200 dark:border-orange-700',
  },
  tip: {
    icon: <Lightbulb className="w-3 h-3" />,
    label: 'Dica',
    className:
      'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-800/60 dark:text-purple-200 dark:border-purple-700',
  },
  rule: {
    icon: <Scale className="w-3 h-3" />,
    label: 'Regra',
    className:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700/60 dark:text-slate-200 dark:border-slate-600',
  },
  warning: {
    icon: <ShieldAlert className="w-3 h-3" />,
    label: 'Atenção',
    className:
      'bg-red-100 text-red-700 border-red-200 dark:bg-red-800/60 dark:text-red-200 dark:border-red-700',
  },
}

export function MindMapCard({
  node,
  level,
  color,
  defaultExpanded = true,
}: MindMapCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const styles = colorStyles[color] ?? colorStyles.blue
  const hasChildren = node.children && node.children.length > 0
  const childCount = node.children?.length ?? 0
  const typeDef = node.type ? typeMeta[node.type] : null

  const handleToggle = () => {
    if (hasChildren) setExpanded((prev) => !prev)
  }

  // ── Level 0: root card ──────────────────────────────────────────────────
  if (level === 0) {
    return (
      <div className="w-full">
        <div
          onClick={handleToggle}
          className={cn(
            'w-full p-5 rounded-2xl shadow-lg text-white',
            'bg-gradient-to-r',
            styles.root,
            hasChildren && 'cursor-pointer select-none',
            'transition-all duration-200',
            hasChildren && 'hover:shadow-xl hover:brightness-105',
          )}
        >
          <div className="flex items-center gap-3">
            {node.icon && (
              <span className="text-2xl flex-shrink-0" role="img" aria-label="">
                {node.icon}
              </span>
            )}
            <span className="text-lg font-bold leading-snug flex-1">{node.label}</span>

            {hasChildren && (
              <ChevronRight
                className={cn(
                  'w-5 h-5 flex-shrink-0 opacity-80 transition-transform duration-200',
                  expanded && 'rotate-90',
                )}
              />
            )}
          </div>

          {node.detail && expanded && (
            <p className="mt-2 text-sm text-white/80 leading-relaxed">{node.detail}</p>
          )}

          {!expanded && hasChildren && (
            <p className="mt-1.5 text-xs text-white/60">
              {childCount} {childCount === 1 ? 'subtópico' : 'subtópicos'}
            </p>
          )}
        </div>

        {/* Children */}
        {hasChildren && (
          <div
            className="grid transition-all duration-300 ease-in-out"
            style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <div className="mt-3 space-y-2 pl-4 border-l-2 border-dashed border-muted-foreground/20 dark:border-muted-foreground/40">
                {node.children!.map((child) => (
                  <MindMapCard
                    key={child.id}
                    node={child}
                    level={1}
                    color={color}
                    defaultExpanded={defaultExpanded}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Level 1 ─────────────────────────────────────────────────────────────
  if (level === 1) {
    return (
      <div className="w-full">
        <div
          onClick={handleToggle}
          className={cn(
            'w-full p-4 rounded-xl shadow-sm',
            styles.l1Bg,
            'border-l-4',
            styles.l1Border,
            hasChildren && 'cursor-pointer select-none',
            'transition-all duration-200',
            hasChildren &&
              'hover:shadow-md hover:brightness-[0.97] dark:hover:brightness-110',
          )}
        >
          <div className="flex items-start gap-2">
            {node.icon && (
              <span className="text-lg flex-shrink-0 mt-0.5" role="img" aria-label="">
                {node.icon}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold leading-snug">{node.label}</span>
                {typeDef && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border',
                      typeDef.className,
                    )}
                  >
                    {typeDef.icon}
                    {typeDef.label}
                  </span>
                )}
                {!expanded && hasChildren && (
                  <span className={cn('text-xs', styles.count)}>
                    ({childCount} {childCount === 1 ? 'subtópico' : 'subtópicos'})
                  </span>
                )}
              </div>
              {node.detail && expanded && (
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {node.detail}
                </p>
              )}
            </div>
            {hasChildren && (
              <ChevronRight
                className={cn(
                  'w-4 h-4 flex-shrink-0 mt-0.5 transition-transform duration-200',
                  styles.chevron,
                  expanded && 'rotate-90',
                )}
              />
            )}
          </div>
        </div>

        {hasChildren && (
          <div
            className="grid transition-all duration-300 ease-in-out"
            style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <div className="mt-2 space-y-1.5 pl-4 border-l-2 border-dashed border-muted-foreground/20 dark:border-muted-foreground/40">
                {node.children!.map((child) => (
                  <MindMapCard
                    key={child.id}
                    node={child}
                    level={2}
                    color={color}
                    defaultExpanded={defaultExpanded}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Level 2 ─────────────────────────────────────────────────────────────
  if (level === 2) {
    return (
      <div className="w-full">
        <div
          onClick={handleToggle}
          className={cn(
            'w-full p-3 rounded-lg bg-muted/30 dark:bg-muted/50',
            'border-l-2',
            styles.l2Border,
            hasChildren && 'cursor-pointer select-none',
            'transition-all duration-200',
            hasChildren && 'hover:bg-muted/50 dark:hover:bg-muted/60',
          )}
        >
          <div className="flex items-start gap-2">
            {node.icon && (
              <span className="text-base flex-shrink-0" role="img" aria-label="">
                {node.icon}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-medium leading-snug">{node.label}</span>
                {typeDef && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border',
                      typeDef.className,
                    )}
                  >
                    {typeDef.icon}
                    {typeDef.label}
                  </span>
                )}
                {!expanded && hasChildren && (
                  <span className={cn('text-xs', styles.count)}>
                    ({childCount})
                  </span>
                )}
              </div>
              {node.detail && expanded && (
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {node.detail}
                </p>
              )}
            </div>
            {hasChildren && (
              <ChevronRight
                className={cn(
                  'w-3.5 h-3.5 flex-shrink-0 mt-0.5 transition-transform duration-200',
                  styles.chevron,
                  expanded && 'rotate-90',
                )}
              />
            )}
          </div>
        </div>

        {hasChildren && (
          <div
            className="grid transition-all duration-300 ease-in-out"
            style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <div className="mt-1.5 space-y-1 pl-3.5 border-l border-dashed border-muted-foreground/20 dark:border-muted-foreground/40">
                {node.children!.map((child) => (
                  <MindMapCard
                    key={child.id}
                    node={child}
                    level={3}
                    color={color}
                    defaultExpanded={defaultExpanded}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Level 3+ ─────────────────────────────────────────────────────────────
  return (
    <div className="w-full">
      <div
        onClick={handleToggle}
        className={cn(
          'w-full p-2.5 rounded-md bg-muted/20 dark:bg-muted/40',
          'border-l',
          styles.l3Border,
          hasChildren && 'cursor-pointer select-none',
          'transition-all duration-200',
          hasChildren && 'hover:bg-muted/40 dark:hover:bg-muted/50',
        )}
      >
        <div className="flex items-start gap-1.5">
          {node.icon && (
            <span className="text-sm flex-shrink-0" role="img" aria-label="">
              {node.icon}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm leading-snug">{node.label}</span>
              {typeDef && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-medium border',
                    typeDef.className,
                  )}
                >
                  {typeDef.icon}
                  {typeDef.label}
                </span>
              )}
              {!expanded && hasChildren && (
                <span className={cn('text-xs', styles.count)}>({childCount})</span>
              )}
            </div>
            {node.detail && expanded && (
              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                {node.detail}
              </p>
            )}
          </div>
          {hasChildren && (
            <ChevronRight
              className={cn(
                'w-3 h-3 flex-shrink-0 mt-0.5 transition-transform duration-200',
                styles.chevron,
                expanded && 'rotate-90',
              )}
            />
          )}
        </div>
      </div>

      {hasChildren && (
        <div
          className="grid transition-all duration-300 ease-in-out"
          style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="mt-1 space-y-1 pl-3 border-l border-dashed border-muted-foreground/20 dark:border-muted-foreground/35">
              {node.children!.map((child) => (
                <MindMapCard
                  key={child.id}
                  node={child}
                  level={level + 1}
                  color={color}
                  defaultExpanded={defaultExpanded}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
