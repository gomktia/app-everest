import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useStaggeredAnimation } from '@/hooks/useAnimations'
import { QuizzesTutorial } from '@/components/quizzes/QuizzesTutorial'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Play, Target, Clock, TrendingUp, ArrowRight, BookOpen, Brain, Star, Award, Users, Zap, Lock, HelpCircle } from 'lucide-react'
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

  const handleCloseTutorial = () => {
    setShowTutorial(false)
  }

  useEffect(() => {
    cachedFetch('quiz-subjects', () => quizService.getQuizSubjects())
      .then((result) => {
        setSubjects(result.data)
        setFromCache(result.fromCache)
      })
      .catch((error) => logger.error('Error fetching quiz subjects:', error))
      .finally(() => setIsLoading(false))
  }, [])

  // Filter subjects based on content access restrictions
  const filteredSubjects = isStudent && isRestricted
    ? subjects
        .map(subject => ({
          ...subject,
          topics: subject.topics.filter(topic => isAllowed(topic.id))
        }))
        .filter(subject => subject.topics.length > 0)
    : subjects

  const totalTopicsAvailable = filteredSubjects.reduce((total, subject) => total + subject.topics.length, 0)
  const totalQuestionsAvailable = filteredSubjects.reduce((total, subject) =>
    total + subject.topics.reduce((topicTotal, topic) =>
      topicTotal + topic.questionCount, 0), 0)
  const totalQuizzesAvailable = filteredSubjects.reduce((total, subject) =>
    total + subject.topics.reduce((topicTotal, topic) =>
      topicTotal + topic.quizzes.length, 0), 0)

  const delays = useStaggeredAnimation(filteredSubjects.length, 100)

  if (permissionsLoading || isLoading || contentAccessLoading) {
    return <SectionLoader />
  }

  // Se for aluno e não tiver permissão, mostra página bloqueada
  if (isStudent && !hasFeature(FEATURE_KEYS.QUIZ)) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Quizzes</h1>
        <Card className="border-border shadow-sm">
          <CardContent className="text-center py-16">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 mx-auto mb-8 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Recurso Bloqueado
              </h3>
              <p className="text-muted-foreground mb-8">
                Este recurso não está disponível para sua turma. Entre em contato com seu professor ou administrador para mais informações.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Quizzes</h1>

      <OfflineBanner fromCache={fromCache} />

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Stats */}
        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="space-y-4 md:space-y-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-primary/10">
                    <Target className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">
                      Sistema de Quizzes
                    </h1>
                    <p className="text-muted-foreground text-sm md:text-base lg:text-lg">
                      Teste seus conhecimentos com nossos quizzes interativos
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTutorial(true)}
                    className="gap-2"
                  >
                    <HelpCircle className="h-4 w-4" />
                    <span className="hidden md:inline">Ajuda</span>
                  </Button>
                  <div className="hidden md:flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full bg-primary/10 border border-primary/20">
                    <Star className="h-3 w-3 md:h-4 md:w-4 text-primary" />
                    <span className="text-xs md:text-sm font-medium">Sistema Inteligente</span>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                <div className="text-center p-2.5 sm:p-3 md:p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <Target className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500 mx-auto mb-1.5" />
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600">{totalTopicsAvailable}</div>
                  <div className="text-[11px] sm:text-xs md:text-sm text-muted-foreground">Tópicos</div>
                </div>
                <div className="text-center p-2.5 sm:p-3 md:p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <Brain className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-green-500 mx-auto mb-1.5" />
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">{totalQuestionsAvailable}</div>
                  <div className="text-[11px] sm:text-xs md:text-sm text-muted-foreground">Questões</div>
                </div>
                <div className="text-center p-2.5 sm:p-3 md:p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-purple-500 mx-auto mb-1.5" />
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-purple-600">{filteredSubjects.length}</div>
                  <div className="text-[11px] sm:text-xs md:text-sm text-muted-foreground">Matérias</div>
                </div>
                <div className="text-center p-2.5 sm:p-3 md:p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                  <Zap className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-orange-500 mx-auto mb-1.5" />
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-orange-600">{totalQuizzesAvailable}</div>
                  <div className="text-[11px] sm:text-xs md:text-sm text-muted-foreground">Quizzes</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {filteredSubjects.length === 0 ? (
          <Card className="border-border shadow-sm">
            <CardContent className="text-center py-16">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 mx-auto mb-8 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Target className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Nenhuma matéria de Quiz encontrada
                </h3>
                <p className="text-muted-foreground mb-8">
                  Parece que não há quizzes disponíveis no momento. Que tal criar um novo?
                </p>
                <Button
                  onClick={() => {
                    if (isAdmin || isTeacher) {
                      navigate('/admin/quizzes/new')
                    } else {
                      toast({
                        title: 'Acesso Restrito',
                        description: 'Apenas professores e administradores podem criar novos quizzes.',
                        variant: 'default',
                      })
                    }
                  }}
                  className="text-white px-8 py-3 rounded-2xl font-medium hover:shadow-md"
                >
                  Criar Primeiro Quiz
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Category Header */}
            <Card className="border-border shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Matérias de Quizzes</h2>
                    <p className="text-muted-foreground">
                      {filteredSubjects.length} matérias disponíveis
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quizzes Grid */}
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {filteredSubjects
                .filter(subject => !subject.name.includes('Regulamentos Militares'))
                .map((subject, index) => {
                  const totalQuestions = subject.topics.reduce((sum, topic) => sum + topic.questionCount, 0)
                  const totalQuizzes = subject.topics.reduce((sum, topic) => sum + topic.quizzes.length, 0)

                  logger.debug(`🎯 Card render - ${subject.name}: Topics=${subject.topics.length}, Quizzes=${totalQuizzes}, Questions=${totalQuestions}`)

                  // Progress will be calculated from real user data later
                  // For now, showing 0 instead of fake random progress
                  const progress = 0

                  return (
                    <Link
                      to={`/quizzes/${subject.id}`}
                      key={subject.id}
                      className="group block"
                    >
                      <Card
                        className="border-border shadow-sm flex flex-col overflow-hidden transition-colors duration-300 hover:shadow-md h-full"
                        style={{ animationDelay: `${delays[index]}ms` }}
                      >
                        {/* Image Header - Reduzida e mais proporcionada */}
                        <div className="relative h-36 sm:h-40 overflow-hidden">
                          <img
                            src={
                              subject.name.toLowerCase().includes('português') ||
                                subject.name.toLowerCase().includes('portugues')
                                ? '/quiz-cover.png'
                                : subject.image ||
                                `https://img.usecurling.com/p/600/300?q=${encodeURIComponent(
                                  subject.name,
                                )}`
                            }
                            alt={subject.name}
                            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-110"
                          />

                          {/* Overlay com gradiente mais suave */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                          {/* Progress Badge - Mais discreto */}
                          <div className="absolute top-3 right-3">
                            <div className="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-sm shadow-lg">
                              <span className="text-xs font-bold text-foreground">{Math.round(progress)}%</span>
                            </div>
                          </div>

                          {/* Title - Mais limpo */}
                          <div className="absolute bottom-3 left-3 right-3">
                            <h3 className="text-white text-lg font-bold mb-0.5 drop-shadow-lg line-clamp-1">
                              {subject.name}
                            </h3>
                            <p className="text-white/90 text-xs line-clamp-1">
                              {subject.description || `Quizzes sobre ${subject.name}`}
                            </p>
                          </div>
                        </div>

                        {/* Content - Mais compacto */}
                        <div className="flex-1 flex flex-col p-4">
                          {/* Stats - Inline para economizar espaço */}
                          <div className="flex items-center justify-around gap-2 mb-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <Target className="w-4 h-4 text-blue-600" />
                              </div>
                              <div>
                                <div className="text-sm font-bold text-blue-600">{subject.topics.length}</div>
                                <div className="text-xs text-muted-foreground">Tópicos</div>
                              </div>
                            </div>

                            <div className="w-px h-10 bg-border" />

                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                                <Zap className="w-4 h-4 text-green-600" />
                              </div>
                              <div>
                                <div className="text-sm font-bold text-green-600">{totalQuizzes}</div>
                                <div className="text-xs text-muted-foreground">Quizzes</div>
                              </div>
                            </div>
                          </div>

                          {/* Progress - Mais limpo */}
                          <div className="space-y-1.5 mb-4">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground font-medium">Progresso</span>
                              <span className="text-xs font-bold text-purple-600">{Math.round(progress)}%</span>
                            </div>
                            <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-purple-500 rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>

                          {/* Action Button - Mais destacado */}
                          <Button className="w-full text-white transition-colors duration-300 py-2.5 text-sm font-semibold rounded-lg shadow-sm hover:shadow-md">
                            <div className="flex items-center justify-center gap-2">
                              <Play className="w-4 h-4 fill-current" />
                              Iniciar Quiz
                              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                            </div>
                          </Button>
                        </div>
                      </Card>
                    </Link>
                  )
                })}
            </div>
          </div>
        )}
      </div>

      {/* Tutorial */}
      {showTutorial && <QuizzesTutorial onClose={handleCloseTutorial} />}
    </div>
  )
}
