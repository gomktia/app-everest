import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Play, Target, BookOpen, Lock, Layers, ChevronRight } from 'lucide-react'
import { cn, getCategoryColor } from '@/lib/utils'
import { quizService, type Quiz } from '@/services/quizService'
import { SectionLoader } from '@/components/SectionLoader'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useContentAccess } from '@/hooks/useContentAccess'
import { logger } from '@/lib/logger'
import { usePageTitle } from '@/hooks/usePageTitle'

interface QuizTopic {
  id: string
  name: string
  description: string
  questionCount: number
  quizzes: Quiz[]
}

export default function QuizTopicsPage() {
  const { subjectId } = useParams<{ subjectId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('returnTo')
  const { toast } = useToast()
  const { isStudent } = useAuth()
  const { isAllowed, loading: contentAccessLoading } = useContentAccess('quiz_topic')
  const [subjectName, setSubjectName] = useState('')
  const [topics, setTopics] = useState<QuizTopic[]>([])
  const [isLoading, setIsLoading] = useState(true)
  usePageTitle(subjectName || 'Quizzes')

  useEffect(() => {
    if (!subjectId) return

    const loadTopics = async () => {
      try {
        setIsLoading(true)
        const subjects = await quizService.getQuizSubjects()
        const subject = subjects.find(s => s.id === subjectId)

        if (!subject) {
          toast({
            title: 'Matéria não encontrada',
            description: 'A matéria que você está procurando não existe.',
            variant: 'destructive',
          })
          navigate('/quizzes')
          return
        }

        setSubjectName(subject.name)
        setTopics(subject.topics)
      } catch (error) {
        logger.error('Erro ao carregar tópicos:', error)
        toast({
          title: 'Erro ao carregar tópicos',
          description: 'Não foi possível carregar os tópicos desta matéria.',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadTopics()
  }, [subjectId, navigate, toast])

  if (isLoading || contentAccessLoading) {
    return <SectionLoader />
  }

  const hasQuizzes = topics.some(topic => topic.quizzes && topic.quizzes.length > 0)

  if (topics.length === 0 || !hasQuizzes) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{subjectName || 'Matéria'}</h1>
          <p className="text-sm text-muted-foreground mt-1">Nenhum quiz disponível</p>
        </div>
        <Card className="border-border shadow-sm">
          <CardContent className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Nenhum quiz disponível</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Esta matéria ainda não possui quizzes publicados.
            </p>
            <Button variant="outline" onClick={() => navigate('/quizzes')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Matérias
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalQuestions = topics.reduce((sum, t) => sum + (t.questionCount || 0), 0)
  const totalQuizzesCount = topics.reduce((sum, t) => sum + t.quizzes.length, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{subjectName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione um tópico para iniciar
          </p>
        </div>
        <Button variant="outline" size="sm" className="w-fit" onClick={() => navigate(returnTo || '/quizzes')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {returnTo ? 'Voltar para a Aula' : 'Voltar'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-blue-500/30">
          <CardContent className="p-2.5 sm:p-4 text-center">
            <Target className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 mx-auto mb-1" />
            <div className="text-lg sm:text-xl font-bold text-foreground">{topics.length}</div>
            <div className="text-[11px] sm:text-xs text-muted-foreground">Tópicos</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-purple-500/30">
          <CardContent className="p-2.5 sm:p-4 text-center">
            <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 mx-auto mb-1" />
            <div className="text-lg sm:text-xl font-bold text-foreground">{totalQuizzesCount}</div>
            <div className="text-[11px] sm:text-xs text-muted-foreground">Quizzes</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-green-500/30">
          <CardContent className="p-2.5 sm:p-4 text-center">
            <Layers className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mx-auto mb-1" />
            <div className="text-lg sm:text-xl font-bold text-foreground">{totalQuestions}</div>
            <div className="text-[11px] sm:text-xs text-muted-foreground">Questões</div>
          </CardContent>
        </Card>
      </div>

      {/* Topics Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {topics.map((topic, idx) => {
          const topicQuizzes = topic.quizzes.length
          const topicLocked = isStudent && !isAllowed(topic.id)
          const colors = getCategoryColor(idx)

          return (
            <div
              key={topic.id}
              className={cn(
                'group relative flex flex-col rounded-xl border bg-card p-5 transition-all duration-200 shadow-sm',
                topicLocked ? 'opacity-50 grayscale-[30%]' : 'hover:shadow-lg',
                colors.border, !topicLocked && colors.hoverBorder
              )}
            >
              {/* Badge */}
              <div
                className={cn(
                  'absolute -top-3 left-4 inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold text-white',
                  topicLocked ? 'bg-gray-400' : colors.badge
                )}
              >
                {topicQuizzes} {topicQuizzes === 1 ? 'Quiz' : 'Quizzes'}
              </div>

              {/* Título */}
              <h3 className="mt-2 font-semibold text-foreground leading-snug line-clamp-2">
                {topic.name}
              </h3>

              {/* Description */}
              {topic.description && (
                <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                  {topic.description}
                </p>
              )}

              {/* Stats */}
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{topic.questionCount || 0} questões</span>
                {topicLocked && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Lock className="h-3 w-3" /> Bloqueado
                  </span>
                )}
              </div>

              {/* Quiz list preview */}
              {topicQuizzes > 0 && !topicLocked && (
                <ul className="mt-3 flex-1 space-y-1.5">
                  {topic.quizzes.slice(0, 3).map((quiz) => (
                    <li key={quiz.id} className="flex items-center gap-2 min-w-0">
                      <Layers className={cn('h-3.5 w-3.5 flex-shrink-0', colors.text)} />
                      <span className="truncate text-xs text-foreground">{quiz.title}</span>
                    </li>
                  ))}
                  {topicQuizzes > 3 && (
                    <li className="text-xs text-muted-foreground pl-5.5">
                      +{topicQuizzes - 3} quiz{topicQuizzes - 3 !== 1 ? 'zes' : ''}
                    </li>
                  )}
                </ul>
              )}

              {/* Action */}
              {topicLocked ? (
                <button
                  onClick={() => toast({ title: 'Conteúdo bloqueado', description: 'Adquira o acesso completo para desbloquear.' })}
                  className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold bg-muted text-muted-foreground cursor-not-allowed"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Bloqueado
                </button>
              ) : topicQuizzes > 0 ? (
                <Link
                  to={`/quiz/${topic.quizzes[0].id}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
                  className={cn(
                    'mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 text-white hover:shadow-md',
                    colors.btn
                  )}
                >
                  Iniciar Quiz
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <div className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold bg-muted text-muted-foreground">
                  Em breve
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
