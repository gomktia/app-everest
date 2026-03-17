import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { QuizzesTutorial } from '@/components/quizzes/QuizzesTutorial'
import { useToast } from '@/hooks/use-toast'
import { cn, getCategoryColor } from '@/lib/utils'
import {
  ChevronRight,
  BookOpen,
  Brain,
  Target,
  Layers,
  Lock,
  HelpCircle,
  PlusCircle,
} from 'lucide-react'
import { quizService, type QuizSubject } from '@/services/quizService'
import { SectionLoader } from '@/components/SectionLoader'
import { useAuth } from '@/hooks/use-auth'
import { useFeaturePermissions } from '@/hooks/use-feature-permissions'
import { useContentAccess } from '@/hooks/useContentAccess'
import { FEATURE_KEYS } from '@/services/classPermissionsService'
import { logger } from '@/lib/logger'
import { cachedFetch } from '@/lib/offlineCache'
import { OfflineBanner } from '@/components/OfflineBanner'

export default function QuizzesPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { isStudent, isAdmin, isTeacher } = useAuth()
  const { hasFeature, loading: permissionsLoading } = useFeaturePermissions()
  const { isRestricted, isAllowed, loading: contentAccessLoading } = useContentAccess('quiz_topic')
  const [subjects, setSubjects] = useState<QuizSubject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showTutorial, setShowTutorial] = useState(false)
  const [fromCache, setFromCache] = useState(false)

  useEffect(() => {
    cachedFetch('quiz-subjects', () => quizService.getQuizSubjects())
      .then((result) => {
        setSubjects(result.data)
        setFromCache(result.fromCache)
      })
      .catch((error) => logger.error('Error fetching quiz subjects:', error))
      .finally(() => setIsLoading(false))
  }, [])

  // Mark topics as locked/unlocked
  const filteredSubjects = subjects.map(subject => ({
    ...subject,
    topics: subject.topics.map(topic => ({
      ...topic,
      _locked: isStudent && isRestricted && !isAllowed(topic.id),
    })),
  }))

  const totalTopics = filteredSubjects.reduce((total, s) => total + s.topics.length, 0)
  const totalQuestions = filteredSubjects.reduce((total, s) =>
    total + s.topics.reduce((sum, t) => sum + t.questionCount, 0), 0)
  const totalQuizzes = filteredSubjects.reduce((total, s) =>
    total + s.topics.reduce((sum, t) => sum + t.quizzes.length, 0), 0)

  if (permissionsLoading || isLoading || contentAccessLoading) {
    return <SectionLoader />
  }

  if (isStudent && !hasFeature(FEATURE_KEYS.QUIZ)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quizzes</h1>
          <p className="text-sm text-muted-foreground mt-1">Recurso bloqueado</p>
        </div>
        <Card className="border-border shadow-sm">
          <CardContent className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Recurso Bloqueado</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              O sistema de quizzes não está disponível para sua turma. Entre em contato com seu professor ou administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quizzes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Teste seus conhecimentos com quizzes interativos
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowTutorial(true)} className="gap-2 w-fit">
          <HelpCircle className="h-4 w-4" />
          Ajuda
        </Button>
      </div>

      <OfflineBanner fromCache={fromCache} />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-blue-500/30">
          <CardContent className="p-2.5 sm:p-4 text-center">
            <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 mx-auto mb-1" />
            <div className="text-lg sm:text-xl font-bold text-foreground">{filteredSubjects.length}</div>
            <div className="text-[11px] sm:text-xs text-muted-foreground">Matérias</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-purple-500/30">
          <CardContent className="p-2.5 sm:p-4 text-center">
            <Target className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 mx-auto mb-1" />
            <div className="text-lg sm:text-xl font-bold text-foreground">{totalTopics}</div>
            <div className="text-[11px] sm:text-xs text-muted-foreground">Tópicos</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-green-500/30">
          <CardContent className="p-2.5 sm:p-4 text-center">
            <Brain className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mx-auto mb-1" />
            <div className="text-lg sm:text-xl font-bold text-foreground">{totalQuestions}</div>
            <div className="text-[11px] sm:text-xs text-muted-foreground">Questões</div>
          </CardContent>
        </Card>
      </div>

      {filteredSubjects.length === 0 ? (
        <Card className="border-border shadow-sm">
          <CardContent className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Target className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Nenhuma matéria encontrada</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Parece que não há quizzes disponíveis no momento.
            </p>
            {(isAdmin || isTeacher) && (
              <Button onClick={() => navigate('/admin/quizzes/new')}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Criar Primeiro Quiz
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredSubjects.map((subject, idx) => {
            const subjectTopics = subject.topics || []
            const subjectQuestions = subjectTopics.reduce((sum, t) => sum + t.questionCount, 0)
            const subjectQuizzes = subjectTopics.reduce((sum, t) => sum + t.quizzes.length, 0)
            const lockedTopics = subjectTopics.filter((t: any) => t._locked).length
            const previewTopics = subjectTopics.slice(0, 4)
            const colors = getCategoryColor(idx)

            return (
              <Link
                to={`/quizzes/${subject.id}`}
                key={subject.id}
                className={cn(
                  'group relative flex flex-col rounded-xl border bg-card p-5 transition-all duration-200 shadow-sm hover:shadow-lg',
                  colors.border, colors.hoverBorder
                )}
              >
                {/* Badge flutuante */}
                <div
                  className={cn(
                    'absolute -top-3 left-4 inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold text-white',
                    colors.badge
                  )}
                >
                  Matéria {idx + 1}
                </div>

                {/* Título */}
                <h3 className="mt-2 font-semibold text-foreground leading-snug line-clamp-2">
                  {subject.name}
                </h3>

                {/* Stats inline */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{subjectTopics.length} tópicos · {subjectQuestions} questões</span>
                    <span className="font-semibold text-foreground">{subjectQuizzes} quizzes</span>
                  </div>
                </div>

                {/* Preview de tópicos */}
                <ul className="mt-4 flex-1 space-y-1.5">
                  {previewTopics.map((topic) => {
                    const topicLocked = (topic as any)._locked
                    return (
                      <li key={topic.id} className={cn('flex items-center gap-2 min-w-0', topicLocked && 'opacity-50')}>
                        {topicLocked
                          ? <Lock className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                          : <Layers className={cn('h-3.5 w-3.5 flex-shrink-0', colors.text)} />
                        }
                        <span className={cn('truncate text-xs', topicLocked ? 'text-muted-foreground' : 'text-foreground')}>
                          {topic.name}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground shrink-0">
                          {topicLocked ? <Lock className="h-3 w-3" /> : `${topic.questionCount}q`}
                        </span>
                      </li>
                    )
                  })}
                  {subjectTopics.length > 4 && (
                    <li className="text-xs text-muted-foreground pl-5.5">
                      +{subjectTopics.length - 4} tópico{subjectTopics.length - 4 !== 1 ? 's' : ''}
                    </li>
                  )}
                </ul>

                {/* Botão */}
                <div
                  className={cn(
                    'mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 text-white hover:shadow-md',
                    colors.btn
                  )}
                >
                  Ver Quizzes
                  <ChevronRight className="h-4 w-4" />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {showTutorial && <QuizzesTutorial onClose={() => setShowTutorial(false)} />}
    </div>
  )
}
