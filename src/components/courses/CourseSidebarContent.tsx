import { Link } from 'react-router-dom'
import { CheckCircle, Circle, Play, Lock, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface Lesson {
  id: string
  title: string
  duration_seconds?: number
  completed?: boolean
  is_preview?: boolean
  order_index: number
}

interface Module {
  id: string
  name: string
  order_index: number
  lessons: Lesson[]
}

interface CourseSidebarContentProps {
  courseId: string
  modules: Module[]
  currentLessonId?: string
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function CourseSidebarContent({ courseId, modules, currentLessonId }: CourseSidebarContentProps) {
  // Track which modules are expanded (default: all expanded)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(modules.map(m => m.id))
  )

  const toggleModule = (moduleId: string) => {
    const newExpanded = new Set(expandedModules)
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId)
    } else {
      newExpanded.add(moduleId)
    }
    setExpandedModules(newExpanded)
  }

  const totalCompleted = modules.reduce((sum, m) => sum + m.lessons.filter(l => l.completed).length, 0)
  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0)
  const overallProgress = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/30">
        <h3 className="font-bold text-sm text-foreground">Conteúdo do Curso</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {totalCompleted} de {totalLessons} aula{totalLessons !== 1 ? 's' : ''} concluída{totalCompleted !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Modules and Lessons */}
      <div className="flex-1 overflow-y-auto">
        {modules.map((module, moduleIndex) => {
          const isExpanded = expandedModules.has(module.id)
          const completedLessons = module.lessons.filter(l => l.completed).length
          const moduleTotalLessons = module.lessons.length
          const moduleProgress = moduleTotalLessons > 0 ? Math.round((completedLessons / moduleTotalLessons) * 100) : 0

          return (
            <div key={module.id}>
              {/* Module Header */}
              <button
                onClick={() => toggleModule(module.id)}
                className={cn(
                  "w-full px-4 py-3 flex items-center gap-3 transition-colors group",
                  "hover:bg-accent/50",
                  isExpanded ? "bg-accent/30" : "bg-transparent",
                  moduleIndex > 0 && "border-t border-border"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center h-7 w-7 rounded-lg text-xs font-bold shrink-0 transition-colors",
                  moduleProgress === 100
                    ? "bg-green-100 dark:bg-green-950/50 text-green-600 dark:text-green-400"
                    : "bg-primary/10 text-primary"
                )}>
                  {moduleProgress === 100 ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <span>{moduleIndex + 1}</span>
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="font-semibold text-[13px] truncate text-foreground group-hover:text-primary transition-colors">
                    {module.name}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden max-w-[80px]">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          moduleProgress === 100 ? "bg-green-500" : "bg-primary"
                        )}
                        style={{ width: `${moduleProgress}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {completedLessons}/{moduleTotalLessons}
                    </span>
                  </div>
                </div>
                <div className={cn(
                  "transition-transform duration-200 text-muted-foreground",
                  isExpanded && "rotate-90"
                )}>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </button>

              {/* Lessons with Timeline */}
              {isExpanded && (
                <div className="relative">
                  {module.lessons
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((lesson, lessonIndex) => {
                      const isCurrent = lesson.id === currentLessonId
                      const isLocked = !lesson.is_preview && !lesson.completed
                      const isLast = lessonIndex === module.lessons.length - 1
                      const prevLesson = lessonIndex > 0 ? module.lessons[lessonIndex - 1] : null
                      const isConnectedFromAbove = prevLesson?.completed && lesson.completed

                      return (
                        <Link
                          key={lesson.id}
                          to={`/courses/${courseId}/lesson/${lesson.id}`}
                          className={cn(
                            'group/lesson relative flex items-start gap-3 py-2.5 pl-6 pr-4 transition-all duration-150',
                            isCurrent
                              ? 'bg-primary/8 dark:bg-primary/15'
                              : 'hover:bg-accent/40',
                            isLocked && 'opacity-50 pointer-events-none'
                          )}
                          onClick={(e) => {
                            if (isLocked) e.preventDefault()
                          }}
                        >
                          {/* Timeline line + node */}
                          <div className="relative flex flex-col items-center shrink-0">
                            {/* Line above */}
                            {lessonIndex > 0 && (
                              <div className={cn(
                                "absolute bottom-[calc(50%+12px)] w-0.5 h-4",
                                isConnectedFromAbove
                                  ? "bg-green-500"
                                  : "bg-border"
                              )} />
                            )}

                            {/* Node */}
                            <div className={cn(
                              "relative z-10 flex items-center justify-center h-6 w-6 rounded-full border-2 transition-all duration-200",
                              lesson.completed
                                ? "border-green-500 bg-green-500 text-white"
                                : isCurrent
                                  ? "border-primary bg-primary text-white shadow-md shadow-primary/30"
                                  : isLocked
                                    ? "border-muted-foreground/30 bg-muted"
                                    : "border-muted-foreground/40 bg-background group-hover/lesson:border-primary/60"
                            )}>
                              {lesson.completed ? (
                                <CheckCircle className="h-3.5 w-3.5" />
                              ) : isCurrent ? (
                                <Play className="h-3 w-3 ml-0.5" />
                              ) : isLocked ? (
                                <Lock className="h-3 w-3" />
                              ) : (
                                <Circle className="h-3 w-3" />
                              )}
                            </div>

                            {/* Line below */}
                            {!isLast && (
                              <div className={cn(
                                "absolute top-[calc(50%+12px)] w-0.5 h-4",
                                lesson.completed && module.lessons[lessonIndex + 1]?.completed
                                  ? "bg-green-500"
                                  : lesson.completed
                                    ? "bg-gradient-to-b from-green-500 to-border"
                                    : "bg-border"
                              )} />
                            )}
                          </div>

                          {/* Lesson Info */}
                          <div className="flex-1 min-w-0 py-0.5">
                            <div
                              className={cn(
                                'text-[13px] font-medium truncate transition-colors',
                                isCurrent
                                  ? 'text-primary font-semibold'
                                  : lesson.completed
                                    ? 'text-foreground/70'
                                    : 'text-foreground group-hover/lesson:text-primary'
                              )}
                            >
                              {lesson.title}
                            </div>
                            {lesson.duration_seconds && (
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                {formatDuration(lesson.duration_seconds)}
                              </div>
                            )}
                          </div>
                        </Link>
                      )
                    })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer with overall progress */}
      <div className="p-4 border-t border-border bg-muted/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-foreground">Progresso Total</span>
          <span className="text-xs font-bold text-primary">
            {overallProgress}%
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              overallProgress === 100
                ? "bg-green-500"
                : "bg-gradient-to-r from-primary to-primary/80"
            )}
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
