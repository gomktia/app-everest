import { useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { LessonRatingStats } from '@/services/lessonInteractionService'
import {
  CheckCircle,
  Lock,
  Play,
  ChevronDown,
  Clock,
  Search,
  Star,
  ListVideo,
  X,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ModuleData {
  id: string
  name: string
  order_index: number
  lessons: Array<{
    id: string
    title: string
    duration_seconds?: number
    order_index: number
    completed?: boolean
    is_preview?: boolean
  }>
}

export interface LessonSidebarProps {
  courseId: string
  lessonId: string
  sortedModules: ModuleData[]
  currentModule: ModuleData | null
  currentModuleIndex: number
  selectedModuleId: string | null
  onSelectModule: (moduleId: string) => void
  blockedModuleIds: Set<string>
  isLessonAccessible: (lessonId: string, moduleId: string) => boolean
  ratingStats: LessonRatingStats
  hoverRating: number
  onHoverRating: (rating: number) => void
  onRate: (rating: number) => void
  /** Mobile sidebar controls */
  isMobile: boolean
  onCloseMobile?: () => void
  cleanTitle: (title: string) => string
  formatDuration: (seconds?: number) => string
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function LessonSidebar({
  courseId,
  lessonId,
  sortedModules,
  currentModule,
  currentModuleIndex,
  selectedModuleId,
  onSelectModule,
  blockedModuleIds,
  isLessonAccessible,
  ratingStats,
  hoverRating,
  onHoverRating,
  onRate,
  isMobile,
  onCloseMobile,
  cleanTitle,
  formatDuration,
}: LessonSidebarProps) {
  const [showModuleSelector, setShowModuleSelector] = useState(false)
  const [lessonSearch, setLessonSearch] = useState('')
  const currentLessonRef = useRef<HTMLAnchorElement>(null)

  const modCompleted = currentModule?.lessons.filter((l) => l.completed).length || 0
  const modTotal = currentModule?.lessons.length || 0

  const currentModuleLessons = useMemo(() => {
    if (!currentModule) return []
    return [...currentModule.lessons].sort((a, b) => a.order_index - b.order_index)
  }, [currentModule])

  const filteredLessons = useMemo(() => {
    if (!lessonSearch.trim()) return currentModuleLessons
    const q = lessonSearch.toLowerCase()
    return currentModuleLessons.filter(l => l.title.toLowerCase().includes(q))
  }, [currentModuleLessons, lessonSearch])

  /* ---- Module selector ---- */
  const moduleSelector = (
    <div className="shrink-0 relative">
      <button onClick={() => setShowModuleSelector((v) => !v)}
        className={cn(
          "w-full px-3 flex items-center gap-2 transition-colors border-b border-border",
          "py-1.5",
          showModuleSelector ? "bg-muted/30" : "hover:bg-muted/20"
        )}>
        <div className={cn(
          "rounded-md flex items-center justify-center shrink-0 font-bold w-6 h-6 text-[10px]",
          modCompleted === modTotal && modTotal > 0
            ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600"
            : "bg-primary/10 text-primary"
        )}>
          {modCompleted === modTotal && modTotal > 0 ? (
            <CheckCircle className="h-3 w-3" />
          ) : (
            <span>{currentModuleIndex + 1}</span>
          )}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="text-xs font-semibold text-foreground truncate">
            {currentModule?.name}
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">{modCompleted}/{modTotal} concluidas</span>
        </div>
        <ChevronDown className={cn(
          "text-muted-foreground shrink-0 transition-transform duration-200 h-3 w-3",
          showModuleSelector ? "rotate-180" : ""
        )} />
      </button>
      {showModuleSelector && (
        <div className="absolute left-0 right-0 top-full z-20 bg-card border-b border-border shadow-md max-h-[400px] overflow-y-auto">
          <div className="p-2 space-y-0.5">
            {sortedModules.map((mod, idx) => {
              const modBlocked = blockedModuleIds.has(mod.id)
              const mc = mod.lessons.filter((l) => l.completed).length
              const mt = mod.lessons.length
              const modProgress = mt > 0 ? Math.round((mc / mt) * 100) : 0
              const isSel = mod.id === currentModule?.id
              return (
                <button key={mod.id}
                  onClick={() => { onSelectModule(mod.id); setShowModuleSelector(false) }}
                  className={cn(
                    "w-full px-3 py-3 flex items-center gap-3 text-left rounded-lg transition-all group/mod",
                    modBlocked && "opacity-50",
                    isSel ? "bg-primary/5 border border-primary/15" : "border border-transparent hover:bg-muted/40"
                  )}>
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold transition-all",
                    modBlocked
                      ? "bg-muted text-muted-foreground border border-transparent"
                      : modProgress === 100
                        ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 border border-emerald-300 dark:border-emerald-800"
                        : isSel
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "bg-muted text-muted-foreground group-hover/mod:bg-primary/10 group-hover/mod:text-primary group-hover/mod:border-primary/20 border border-transparent"
                  )}>
                    {modBlocked ? <Lock className="h-3.5 w-3.5" /> : modProgress === 100 ? <CheckCircle className="h-4 w-4" /> : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={cn(
                      "text-[13px] truncate block tracking-tight transition-colors",
                      isSel ? "text-foreground font-semibold" : "text-foreground/80 group-hover/mod:text-foreground font-medium"
                    )}>{mod.name}</span>
                    <div className="flex items-center gap-2.5 mt-1.5">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[140px]">
                        <div className={cn(
                          "h-full rounded-full transition-all duration-500",
                          modProgress === 100 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : isSel ? "bg-gradient-to-r from-primary to-primary/70" : "bg-muted-foreground/30 group-hover/mod:bg-primary"
                        )} style={{ width: `${modProgress}%` }} />
                      </div>
                      <span className={cn(
                        "text-[10px] font-medium tabular-nums shrink-0",
                        modProgress === 100 ? "text-emerald-500" : "text-muted-foreground"
                      )}>{modProgress}%</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  /* ---- Lesson list ---- */
  const lessonList = (
    <>
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* Search */}
        <div className="px-3 py-2 shrink-0 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <input
              type="text"
              value={lessonSearch}
              onChange={(e) => setLessonSearch(e.target.value)}
              placeholder="Buscar aula..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/40 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary focus:bg-muted/60 text-foreground placeholder:text-muted-foreground/50 transition-all"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredLessons.map((lesson, idx) => {
            const isCurrent = lesson.id === lessonId
            const isLast = idx === filteredLessons.length - 1
            const prevCompleted = idx > 0 && filteredLessons[idx - 1]?.completed
            const lessonLocked = currentModule ? !isLessonAccessible(lesson.id, currentModule.id) : false
            return (
              <Link key={lesson.id}
                ref={isCurrent ? currentLessonRef : undefined}
                to={lessonLocked ? '#' : `/courses/${courseId}/lessons/${lesson.id}`}
                onClick={(e) => {
                  if (lessonLocked) { e.preventDefault(); return }
                  if (isMobile && onCloseMobile) onCloseMobile()
                }}
                className={cn(
                  "group/lesson relative flex items-start gap-3 pl-4 pr-4 py-0 transition-all",
                  lessonLocked && "opacity-40 cursor-not-allowed",
                  isCurrent
                    ? "bg-primary/10"
                    : "hover:bg-muted/40"
                )}>
                {/* Timeline node + lines */}
                <div className="relative shrink-0 w-6 flex flex-col items-center self-stretch">
                  {/* Line above */}
                  {idx > 0 ? (
                    <div className={cn(
                      "w-0.5 h-3",
                      prevCompleted && lesson.completed ? "bg-emerald-500"
                        : prevCompleted || (idx > 0 && filteredLessons[idx - 1]?.completed) ? "bg-emerald-500/30"
                        : "bg-border"
                    )} />
                  ) : (
                    <div className="h-3" />
                  )}
                  {/* Node */}
                  <div className={cn(
                    "relative z-10 flex items-center justify-center rounded-full shrink-0 transition-all duration-200",
                    isMobile ? "w-5 h-5" : "w-7 h-7",
                    lessonLocked
                      ? "border-2 border-muted-foreground/10 bg-muted text-muted-foreground"
                      : lesson.completed
                        ? "bg-emerald-500 text-white border-2 border-emerald-500"
                        : isCurrent
                          ? "bg-primary text-white border-2 border-primary"
                          : "border-2 border-muted-foreground/20 bg-card group-hover/lesson:border-primary/40"
                  )}>
                    {lessonLocked ? (
                      <Lock className={cn(isMobile ? "h-2.5 w-2.5" : "h-3 w-3")} />
                    ) : lesson.completed ? (
                      <CheckCircle className={cn(isMobile ? "h-3 w-3" : "h-3.5 w-3.5")} />
                    ) : isCurrent ? (
                      <Play className={cn(isMobile ? "h-2.5 w-2.5" : "h-3 w-3", "ml-px")} />
                    ) : (
                      <span className="text-[9px] font-bold text-muted-foreground tabular-nums">{idx + 1}</span>
                    )}
                  </div>
                  {/* Line below */}
                  {!isLast ? (
                    <div className={cn(
                      "w-0.5 flex-1 min-h-[12px]",
                      lesson.completed ? "bg-emerald-500" : "bg-border"
                    )} />
                  ) : (
                    <div className="h-3" />
                  )}
                </div>
                <div className="flex-1 min-w-0 py-2">
                  <div className={cn(
                    "truncate leading-tight",
                    isMobile ? "text-xs" : "text-[13px]",
                    isCurrent ? "text-primary font-semibold" : lesson.completed ? "text-foreground/60" : "text-foreground/80 group-hover/lesson:text-foreground"
                  )}>
                    {cleanTitle(lesson.title)}
                  </div>
                  {lesson.duration_seconds != null && lesson.duration_seconds > 0 && (
                    <div className="text-[11px] text-muted-foreground/70 mt-0.5 tabular-nums">
                      {formatDuration(lesson.duration_seconds)}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
          {filteredLessons.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground/60">Nenhuma aula encontrada</div>
          )}
        </div>
      </div>
      {/* Sidebar footer - rating */}
      <div data-tour="rating" className="shrink-0 border-t border-border bg-muted/20 px-4 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground font-medium">Avalie esta aula</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => onRate(star)}
                onMouseEnter={() => onHoverRating(star)}
                onMouseLeave={() => onHoverRating(0)}
                className="p-0.5 transition-transform hover:scale-110"
              >
                <Star className={cn(
                  "h-5 w-5 transition-colors",
                  (hoverRating || ratingStats.userRating || 0) >= star
                    ? "text-amber-500 fill-amber-500"
                    : "text-muted-foreground/25"
                )} />
              </button>
            ))}
          </div>
        </div>
        {ratingStats.total > 0 && (
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
            <span>{ratingStats.average.toFixed(1)} media</span>
            <span>·</span>
            <span>{ratingStats.total} {ratingStats.total === 1 ? 'voto' : 'votos'}</span>
          </div>
        )}
      </div>
    </>
  )

  /* ---- Mobile wrapper ---- */
  if (isMobile) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onCloseMobile} />
        <aside
          className="fixed inset-y-0 right-0 z-50 w-[85%] max-w-[360px] lg:hidden bg-card border-l border-border shadow-lg flex flex-col"
          style={{ animation: 'lp-slide-in 0.2s ease-out' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <ListVideo className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Aulas</span>
            </div>
            <button onClick={onCloseMobile}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center">
              <X className="h-4 w-4" />
            </button>
          </div>
          {moduleSelector}
          {lessonList}
        </aside>
      </>
    )
  }

  /* ---- Desktop ---- */
  return (
    <div className="sticky top-16 flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {moduleSelector}
      {lessonList}
      <div className="shrink-0 h-[0.80rem]" />
    </div>
  )
}
