import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { FlashcardsTutorial } from '@/components/flashcards/FlashcardsTutorial'
import { useToast } from '@/hooks/use-toast'
import { cn, getCategoryColor } from '@/lib/utils'
import {
  Play,
  ChevronRight,
  BookOpen,
  Brain,
  Lock,
  HelpCircle,
  PlusCircle,
  Target,
  Layers,
} from 'lucide-react'
import { getSubjectsWithProgress } from '@/services/subjectService'
import { SectionLoader } from '@/components/SectionLoader'
import { logger } from '@/lib/logger'
import { useAuth } from '@/hooks/use-auth'
import { useFeaturePermissions } from '@/hooks/use-feature-permissions'
import { useContentAccess } from '@/hooks/useContentAccess'
import { FEATURE_KEYS } from '@/services/classPermissionsService'
import { cachedFetch } from '@/lib/offlineCache'
import { OfflineBanner } from '@/components/OfflineBanner'
import { TourButton } from '@/components/TourButton'
import type { DriveStep } from 'driver.js'

const FLASHCARDS_TOUR_STEPS: DriveStep[] = [
  { element: '[data-tour="flashcards-stats"]', popover: { title: 'Estatísticas', description: 'Veja quantas matérias, tópicos e cards estão disponíveis para estudo.' } },
  { element: '[data-tour="flashcards-subject"]', popover: { title: 'Card de Matéria', description: 'Cada card representa uma matéria com seus tópicos e quantidade de flashcards.' } },
  { element: '[data-tour="flashcards-progress"]', popover: { title: 'Progresso por Matéria', description: 'A barra mostra quanto você já revisou dos cards desta matéria.' } },
  { element: '[data-tour="flashcards-study"]', popover: { title: 'Estudar Cards', description: 'Clique para iniciar a sessão de estudo com os flashcards desta matéria.' } },
  { element: '[data-tour="flashcards-locked"]', popover: { title: 'Tópicos Bloqueados', description: 'Tópicos com cadeado não estão liberados para sua turma. Fale com seu professor.' } },
]

interface Subject {
  id: string
  name: string
  description: string
  image_url?: string
  topics?: Array<{
    id: string
    name: string
    flashcard_count?: number
  }>
  progress?: number
}

export default function FlashcardsPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user, isStudent, isAdmin, isTeacher } = useAuth()
  const { hasFeature, loading: permissionsLoading } = useFeaturePermissions()
  const { isRestricted, isAllowed, loading: contentAccessLoading } = useContentAccess('flashcard_topic')
  const [subjectList, setSubjectList] = useState<Subject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showTutorial, setShowTutorial] = useState(false)
  const [fromCache, setFromCache] = useState(false)

  const handleCloseTutorial = () => {
    setShowTutorial(false)
  }

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const result = await cachedFetch(`flashcards-${user?.id || 'anon'}`, () =>
          getSubjectsWithProgress(user?.id || null)
        )
        setSubjectList(result.data)
        setFromCache(result.fromCache)
      } catch (error) {
        logger.error('Error fetching subjects:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSubjects()
  }, [user?.id])

  if (permissionsLoading || isLoading || contentAccessLoading) {
    return <SectionLoader />
  }

  // Mark topics as locked/unlocked (show all, but indicate which are restricted)
  const filteredSubjects = subjectList.map(subject => ({
    ...subject,
    topics: subject.topics?.map(topic => ({
      ...topic,
      _locked: isStudent && isRestricted && !isAllowed(topic.id),
    })),
  }))

  if (isStudent && !hasFeature(FEATURE_KEYS.FLASHCARDS)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Flashcards</h1>
          <p className="text-sm text-muted-foreground mt-1">Recurso bloqueado</p>
        </div>
        <Card className="border-border shadow-sm">
          <CardContent className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Recurso Bloqueado</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              O sistema de flashcards não está disponível para sua turma. Entre em contato com seu professor ou administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalCards = filteredSubjects.reduce(
    (total, subject) => total + (subject.topics?.reduce((sum, topic) => sum + (topic.flashcard_count || 0), 0) || 0),
    0,
  )
  const totalTopics = filteredSubjects.reduce((total, subject) => total + (subject.topics?.length || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Flashcards</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Domine qualquer assunto com flashcards inteligentes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TourButton steps={FLASHCARDS_TOUR_STEPS} />
          <Button variant="outline" size="sm" onClick={() => setShowTutorial(true)} className="gap-2 w-fit">
            <HelpCircle className="h-4 w-4" />
            Ajuda
          </Button>
        </div>
      </div>

      <OfflineBanner fromCache={fromCache} />

      {/* Stats */}
      <div data-tour="flashcards-stats" className="grid grid-cols-3 gap-2 sm:gap-4">
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
            <div className="text-lg sm:text-xl font-bold text-foreground">{totalCards}</div>
            <div className="text-[11px] sm:text-xs text-muted-foreground">Cards</div>
          </CardContent>
        </Card>
      </div>

      {filteredSubjects.length === 0 ? (
        <Card className="border-border shadow-sm">
          <CardContent className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Brain className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Nenhuma matéria encontrada</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Parece que não há flashcards disponíveis no momento.
            </p>
            {(isAdmin || isTeacher) && (
              <Button onClick={() => navigate('/admin/flashcards/new')}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Criar Primeiro Flashcard
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredSubjects
            .filter((s) => (s.topics?.reduce((sum, t) => sum + (t.flashcard_count || 0), 0) || 0) > 0)
            .map((subject, idx) => {
            const subjectTopics = subject.topics || []
            const subjectCards = subjectTopics.reduce((sum, topic) => sum + (topic.flashcard_count || 0), 0)
            const progress = subject.progress || 0
            const allDone = progress === 100
            const lockedTopics = subjectTopics.filter((t: any) => t._locked).length
            const allLocked = lockedTopics > 0 && lockedTopics === subjectTopics.length
            const previewTopics = subjectTopics.slice(0, 4)
            const colors = getCategoryColor(idx)

            return (
              <Link
                to={`/flashcards/${subject.id}`}
                key={subject.id}
                {...(idx === 0 ? { 'data-tour': 'flashcards-subject' } : {})}
                className={cn(
                  'group relative flex flex-col rounded-xl border bg-card p-5 transition-all duration-200 shadow-sm hover:shadow-lg',
                  colors.border, colors.hoverBorder,
                  allLocked && 'opacity-50 grayscale-[30%]'
                )}
              >
                {/* Badge flutuante */}
                <div
                  className={cn(
                    'absolute -top-3 left-4 inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold text-white',
                    allDone ? 'bg-green-500' : colors.badge
                  )}
                >
                  Matéria {idx + 1}
                </div>

                {/* Título */}
                <h3 className="mt-2 font-semibold text-foreground leading-snug line-clamp-2">
                  {subject.name}
                </h3>

                {/* Progress */}
                <div {...(idx === 0 ? { 'data-tour': 'flashcards-progress' } : {})} className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{subjectTopics.length} tópicos · {subjectCards} cards</span>
                    <span className={cn('font-semibold', allDone ? 'text-green-500' : 'text-foreground')}>
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <Progress value={progress} className="h-1.5 bg-muted [&>div]:bg-blue-500" />
                </div>

                {/* Preview de tópicos */}
                <ul className="mt-4 flex-1 space-y-1.5">
                  {previewTopics.map((topic) => {
                    const topicLocked = (topic as any)._locked
                    return (
                      <li key={topic.id} {...(topicLocked ? { 'data-tour': 'flashcards-locked' } : {})} className={cn('flex items-center gap-2 min-w-0', topicLocked && 'opacity-50')}>
                        {topicLocked
                          ? <Lock className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                          : <Layers className={cn('h-3.5 w-3.5 flex-shrink-0', colors.text)} />
                        }
                        <span className={cn('truncate text-xs', topicLocked ? 'text-muted-foreground' : 'text-foreground')}>
                          {topic.name}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground shrink-0">
                          {topicLocked ? <Lock className="h-3 w-3" /> : (topic.flashcard_count || 0)}
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
                  {...(idx === 0 ? { 'data-tour': 'flashcards-study' } : {})}
                  className={cn(
                    'mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 text-white hover:shadow-md',
                    colors.btn
                  )}
                >
                  Estudar Cards
                  <ChevronRight className="h-4 w-4" />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {showTutorial && <FlashcardsTutorial onClose={handleCloseTutorial} />}
    </div>
  )
}
