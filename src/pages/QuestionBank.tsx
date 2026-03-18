import { useState, useEffect, useCallback } from 'react'
import DOMPurify from 'dompurify'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Lightbulb,
  CheckCircle2,
  XCircle,
  BookOpen,
  Layers,
  Target,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Trophy,
  Brain,
  Play,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase/client'
import { SectionLoader } from '@/components/SectionLoader'
import { cn, getCategoryColor } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { useAuth } from '@/hooks/use-auth'
import { useFeaturePermissions } from '@/hooks/use-feature-permissions'
import { FEATURE_KEYS } from '@/services/classPermissionsService'
import { useContentAccess } from '@/hooks/useContentAccess'
import { usePageTitle } from '@/hooks/usePageTitle'
import { TourButton } from '@/components/TourButton'
import type { DriveStep } from 'driver.js'

const QUESTION_BANK_TOUR_STEPS: DriveStep[] = [
  { element: '[data-tour="qb-stats"]', popover: { title: 'Estatísticas', description: 'Veja o total de questões, matérias, tópicos e questões disponíveis com os filtros atuais.' } },
  { element: '[data-tour="qb-subject-select"]', popover: { title: 'Selecionar Matéria', description: 'Escolha uma matéria para filtrar as questões. Você também pode clicar nos cards abaixo.' } },
  { element: '[data-tour="qb-topic-select"]', popover: { title: 'Selecionar Tópico', description: 'Refine ainda mais escolhendo um tópico específico dentro da matéria.' } },
  { element: '[data-tour="qb-quantity"]', popover: { title: 'Quantidade de Questões', description: 'Defina quantas questões deseja responder nesta sessão de estudo.' } },
  { element: '[data-tour="qb-subject-cards"]', popover: { title: 'Cards de Matérias', description: 'Clique em um card para selecionar a matéria rapidamente. O card selecionado fica destacado.' } },
  { element: '[data-tour="qb-start"]', popover: { title: 'Iniciar Estudo', description: 'Quando estiver pronto, clique aqui para começar a sessão de questões.' } },
]

interface Question {
  id: string
  question_text: string
  question_html?: string
  question_image_url?: string
  question_image_caption?: string
  options: string[] | string | null
  correct_answer: string
  explanation: string | null
  explanation_html?: string
  question_type: string
  difficulty?: string
  points: number
  source?: string
  year?: number
  quiz_id: string
  topics: {
    id: string
    name: string
    subjects: {
      name: string
    } | null
  } | null
  reading_text?: {
    id: string
    title: string
    content: string
  } | null
}

/** Safely parse options that may be array, JSON string, or null */
function parseOptions(options: string[] | string | null): string[] {
  if (Array.isArray(options)) return options
  if (typeof options === 'string') {
    try { return JSON.parse(options) } catch { return [] }
  }
  return []
}

type Phase = 'select' | 'study' | 'summary'

const QUANTITY_OPTIONS = [10, 15, 20, 25, 30, 50]

export default function QuestionBankPage() {
  usePageTitle('Banco de Questões')
  const { toast } = useToast()
  const { isStudent } = useAuth()
  const { hasFeature, loading: permissionsLoading } = useFeaturePermissions()
  const { isRestricted, isAllowed, loading: contentAccessLoading } = useContentAccess('quiz_topic')
  const [subjectTopicData, setSubjectTopicData] = useState<{ subjects: string[]; topics: { name: string; subjectName: string; topicId: string }[]; totalCount: number }>({ subjects: [], topics: [], totalCount: 0 })
  const [loading, setLoading] = useState(true)
  const [studyLoading, setStudyLoading] = useState(false)

  // Selection phase
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [selectedTopic, setSelectedTopic] = useState<string>('all')
  const [quantity, setQuantity] = useState<number>(20)

  // Study phase
  const [phase, setPhase] = useState<Phase>('select')
  const [studyQuestions, setStudyQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [showExplanation, setShowExplanation] = useState(false)
  const [readingTextDialog, setReadingTextDialog] = useState<{ title: string; content: string } | null>(null)

  useEffect(() => {
    fetchMetadata()
  }, [])

  const fetchMetadata = async () => {
    try {
      setLoading(true)
      // Only fetch topic/subject metadata, not full question data
      const { data: topicsData, error: topicsError } = await supabase
        .from('topics')
        .select('id, name, subjects ( name )')

      if (topicsError) throw topicsError

      const topics = (topicsData || []).map((t: any) => ({
        name: t.name as string,
        subjectName: t.subjects?.name as string,
        topicId: t.id as string,
      })).filter(t => t.subjectName)

      const subjects = Array.from(new Set(topics.map(t => t.subjectName))) as string[]

      // Get total count efficiently
      const { count, error: countError } = await supabase
        .from('quiz_questions')
        .select('id', { count: 'exact', head: true })

      if (countError) throw countError

      setSubjectTopicData({ subjects, topics, totalCount: count || 0 })
    } catch (error) {
      logger.error('Error fetching question metadata:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStudyQuestions = async (): Promise<Question[]> => {
    try {
      setStudyLoading(true)
      let query = supabase
        .from('quiz_questions')
        .select(`
          *,
          topics (
            id,
            name,
            subjects (
              name
            )
          ),
          reading_text:quiz_reading_texts (
            id,
            title,
            content
          )
        `)

      if (selectedSubject !== 'all') {
        // Filter by subject via topic join
        const topicIds = subjectTopicData.topics
          .filter(t => t.subjectName === selectedSubject)
          .map(t => t.topicId)
        if (topicIds.length > 0) {
          query = query.in('topic_id', topicIds)
        }
        if (selectedTopic !== 'all') {
          const topicId = subjectTopicData.topics.find(t => t.name === selectedTopic && t.subjectName === selectedSubject)?.topicId
          if (topicId) {
            query = query.eq('topic_id', topicId)
          }
        }
      }

      // Fetch more than needed for shuffling, but cap it
      const fetchLimit = Math.min(quantity * 3, 200)
      const { data, error } = await query.limit(fetchLimit)

      if (error) throw error

      const normalized = (data || []).map((q: any) => ({
        ...q,
        reading_text: Array.isArray(q.reading_text) ? q.reading_text[0] || null : q.reading_text,
      }))

      // Filter out questions with no valid options, apply content access
      const filtered = normalized.filter((q: Question) => {
        if (isStudent && isRestricted && q.topics?.id && !isAllowed(q.topics.id)) return false
        if (parseOptions(q.options).length === 0) return false
        return true
      })

      return filtered
    } catch (error) {
      logger.error('Error fetching study questions:', error)
      return []
    } finally {
      setStudyLoading(false)
    }
  }

  // Derive subjects and topics from metadata
  const accessibleTopics = isStudent && isRestricted
    ? subjectTopicData.topics.filter(t => isAllowed(t.topicId))
    : subjectTopicData.topics

  const subjects = Array.from(new Set(accessibleTopics.map(t => t.subjectName)))

  const filteredTopics = selectedSubject === 'all'
    ? Array.from(new Set(accessibleTopics.map(t => t.name)))
    : Array.from(new Set(
        accessibleTopics
          .filter(t => t.subjectName === selectedSubject)
          .map(t => t.name)
      ))

  const totalAccessibleCount = subjectTopicData.totalCount

  // Start study session — fetches questions on demand
  const startStudy = async () => {
    const fetched = await fetchStudyQuestions()
    if (fetched.length === 0) {
      toast({
        title: 'Nenhuma questão disponível',
        description: 'Selecione uma matéria ou tópico que tenha questões.',
        variant: 'destructive',
      })
      return
    }
    const shuffled = [...fetched].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, quantity)
    setStudyQuestions(selected)
    setCurrentIndex(0)
    setAnswers({})
    setShowExplanation(false)
    setPhase('study')
  }

  // Current question helpers
  const currentQuestion = studyQuestions[currentIndex]
  const isAnswered = currentQuestion ? !!answers[currentQuestion.id] : false
  const isCorrect = currentQuestion ? answers[currentQuestion.id] === currentQuestion.correct_answer : false

  const handleOptionSelect = (option: string) => {
    if (!currentQuestion || isAnswered) return
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: option }))
    setShowExplanation(false)
  }

  const goNext = () => {
    setShowExplanation(false)
    if (currentIndex < studyQuestions.length - 1) {
      setCurrentIndex(i => i + 1)
    } else {
      setPhase('summary')
    }
  }

  const goPrev = () => {
    if (currentIndex > 0) {
      setShowExplanation(false)
      setCurrentIndex(i => i - 1)
    }
  }

  const restart = () => {
    setPhase('select')
    setStudyQuestions([])
    setAnswers({})
    setCurrentIndex(0)
    setShowExplanation(false)
  }

  // Summary stats
  const getSummaryStats = useCallback(() => {
    const total = studyQuestions.length
    const answered = Object.keys(answers).length
    const correct = studyQuestions.filter(q => answers[q.id] === q.correct_answer).length
    const wrong = answered - correct
    const percentage = answered > 0 ? Math.round((correct / answered) * 100) : 0
    return { total, answered, correct, wrong, percentage }
  }, [studyQuestions, answers])

  // Safety: if study phase but no question, reset to select
  useEffect(() => {
    if (phase === 'study' && studyQuestions.length > 0 && !currentQuestion) {
      setPhase('select')
    }
  }, [phase, studyQuestions, currentQuestion])

  if (loading || permissionsLoading || contentAccessLoading) return <SectionLoader />

  if (isStudent && !hasFeature(FEATURE_KEYS.QUESTION_BANK)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Banco de Questões</h1>
          <p className="text-sm text-muted-foreground mt-1">Recurso bloqueado</p>
        </div>
        <Card className="border-border shadow-sm">
          <CardContent className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Search className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Recurso Bloqueado</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              O banco de questões não está disponível para sua turma. Entre em contato com seu professor ou administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── SELECTION PHASE ───────────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Banco de Questões</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Selecione o conteúdo e pratique com questões comentadas
            </p>
          </div>
          <TourButton steps={QUESTION_BANK_TOUR_STEPS} />
        </div>

        {/* Stats */}
        <div data-tour="qb-stats" className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-blue-500/30">
            <CardContent className="p-4 text-center">
              <Layers className="h-5 w-5 text-blue-500 mx-auto mb-1.5" />
              <div className="text-xl font-bold text-foreground">{totalAccessibleCount}</div>
              <div className="text-xs text-muted-foreground">Total Questões</div>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-green-500/30">
            <CardContent className="p-4 text-center">
              <BookOpen className="h-5 w-5 text-green-500 mx-auto mb-1.5" />
              <div className="text-xl font-bold text-foreground">{subjects.length}</div>
              <div className="text-xs text-muted-foreground">Matérias</div>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-purple-500/30">
            <CardContent className="p-4 text-center">
              <Target className="h-5 w-5 text-purple-500 mx-auto mb-1.5" />
              <div className="text-xl font-bold text-foreground">{filteredTopics.length}</div>
              <div className="text-xs text-muted-foreground">Tópicos</div>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-orange-500/30">
            <CardContent className="p-4 text-center">
              <Search className="h-5 w-5 text-orange-500 mx-auto mb-1.5" />
              <div className="text-xl font-bold text-foreground">{filteredTopics.length > 0 ? '---' : '0'}</div>
              <div className="text-xs text-muted-foreground">Tópicos Filtrados</div>
            </CardContent>
          </Card>
        </div>

        {/* Filter & Start */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-6 space-y-6">
            <h2 className="text-lg font-semibold text-foreground">Configurar Sessão de Estudo</h2>

            <div className="grid gap-4 md:grid-cols-3">
              <div data-tour="qb-subject-select" className="space-y-2">
                <label className="text-sm font-medium text-foreground">Matéria</label>
                <Select value={selectedSubject} onValueChange={(v) => { setSelectedSubject(v); setSelectedTopic('all') }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as matérias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Matérias</SelectItem>
                    {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div data-tour="qb-topic-select" className="space-y-2">
                <label className="text-sm font-medium text-foreground">Tópico</label>
                <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os tópicos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Tópicos</SelectItem>
                    {filteredTopics.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div data-tour="qb-quantity" className="space-y-2">
                <label className="text-sm font-medium text-foreground">Quantidade</label>
                <Select value={quantity.toString()} onValueChange={v => setQuantity(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUANTITY_OPTIONS.map(n => (
                      <SelectItem key={n} value={n.toString()}>
                        {n} questões
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Subject cards - padrão módulos */}
            {subjects.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Matérias disponíveis</h3>
                <div data-tour="qb-subject-cards" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subjects.map((subjectName, index) => {
                    const subjectTopicEntries = accessibleTopics.filter(t => t.subjectName === subjectName)
                    const subjectTopicNames = Array.from(new Set(subjectTopicEntries.map(t => t.name)))
                    const isSelected = selectedSubject === subjectName
                    const previewTopics = subjectTopicNames.slice(0, 4)
                    const colors = getCategoryColor(index)

                    return (
                      <button
                        key={subjectName}
                        onClick={() => {
                          setSelectedSubject(isSelected ? 'all' : subjectName)
                          setSelectedTopic('all')
                        }}
                        className={cn(
                          'group relative flex flex-col rounded-xl border bg-card p-5 transition-all duration-200 shadow-sm text-left',
                          isSelected
                            ? `${colors.border} shadow-md ring-1 ring-primary/20`
                            : `border-border ${colors.hoverBorder} hover:shadow-lg`
                        )}
                      >
                        <div
                          className={cn(
                            'absolute -top-3 left-4 inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold text-white',
                            isSelected ? 'bg-green-500' : colors.badge
                          )}
                        >
                          {subjectTopicNames.length} tópicos
                        </div>

                        <h3 className="mt-2 font-semibold text-foreground leading-snug line-clamp-2">
                          {subjectName}
                        </h3>

                        <div className="mt-3 text-xs text-muted-foreground">
                          {subjectTopicNames.length} tópicos
                        </div>

                        <ul className="mt-3 flex-1 space-y-1.5">
                          {previewTopics.map(topic => (
                            <li key={topic} className="flex items-center gap-2 min-w-0">
                              <Brain className={cn('h-3.5 w-3.5 flex-shrink-0', colors.text)} />
                              <span className="truncate text-xs text-foreground">{topic}</span>
                            </li>
                          ))}
                          {subjectTopicNames.length > 4 && (
                            <li className="text-xs text-muted-foreground pl-5.5">
                              +{subjectTopicNames.length - 4} tópico{subjectTopicNames.length - 4 !== 1 ? 's' : ''}
                            </li>
                          )}
                        </ul>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <p className="text-sm text-muted-foreground">
                {selectedSubject === 'all' ? 'Todas as matérias' : selectedSubject}
                {selectedTopic !== 'all' ? ` · ${selectedTopic}` : ''} · {quantity} questões
              </p>
              <Button
                data-tour="qb-start"
                onClick={startStudy}
                disabled={studyLoading || subjects.length === 0}
                className="px-6 font-semibold transition-all duration-200 hover:shadow-md hover:bg-green-600"
              >
                {studyLoading ? (
                  <>Carregando...</>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Iniciar Estudo
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── STUDY PHASE ───────────────────────────────────────────────────────
  if (phase === 'study' && currentQuestion && studyQuestions.length > 0) {
    const progressPercent = ((currentIndex + 1) / studyQuestions.length) * 100
    const answeredCount = Object.keys(answers).length
    const correctCount = studyQuestions.filter(q => answers[q.id] === q.correct_answer).length
    const wrongSelection = isAnswered && !isCorrect ? answers[currentQuestion.id] : null

    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        {/* Top bar: progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <button
              onClick={restart}
              className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Sair
            </button>
            <span className="text-muted-foreground">
              Questão <span className="font-bold text-foreground">{currentIndex + 1}</span> de {studyQuestions.length}
            </span>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-green-600 font-medium">{correctCount} acertos</span>
              <span className="text-red-500 font-medium">{answeredCount - correctCount} erros</span>
            </div>
          </div>
          <Progress value={progressPercent} className="h-2 bg-muted [&>div]:bg-blue-500" />
        </div>

        {/* Question card */}
        <Card className={cn(
          'border-border shadow-sm transition-all duration-300',
          isAnswered && isCorrect && 'border-green-500/30',
          isAnswered && !isCorrect && 'border-red-500/30',
        )}>
          <CardContent className="p-6 space-y-5">
            {/* Badges */}
            <div className="flex flex-wrap gap-2 items-center text-xs">
              <Badge variant="outline" className="bg-background/50">
                {currentQuestion.topics?.subjects?.name || 'Geral'}
              </Badge>
              <Badge variant="secondary" className="bg-background/50">
                {currentQuestion.topics?.name || 'Tópico'}
              </Badge>
              {currentQuestion.difficulty && (
                <Badge
                  variant={
                    currentQuestion.difficulty === 'easy' ? 'default'
                    : currentQuestion.difficulty === 'medium' ? 'secondary'
                    : 'destructive'
                  }
                >
                  {currentQuestion.difficulty === 'easy' && 'Fácil'}
                  {currentQuestion.difficulty === 'medium' && 'Médio'}
                  {currentQuestion.difficulty === 'hard' && 'Difícil'}
                  {currentQuestion.difficulty === 'expert' && 'Expert'}
                </Badge>
              )}
              {currentQuestion.source && (
                <span className="text-muted-foreground ml-auto">
                  {currentQuestion.source}{currentQuestion.year ? ` - ${currentQuestion.year}` : ''}
                </span>
              )}
            </div>

            {/* Reading text button */}
            {currentQuestion.reading_text && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 w-full sm:w-auto border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary"
                onClick={() => setReadingTextDialog({
                  title: currentQuestion.reading_text!.title,
                  content: currentQuestion.reading_text!.content
                })}
              >
                <BookOpen className="h-4 w-4" />
                Ler Texto de Apoio
              </Button>
            )}

            {/* Question text */}
            <div className="text-foreground font-medium text-lg leading-relaxed">
              {currentQuestion.question_html ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentQuestion.question_html) }}
                />
              ) : (
                <p className="whitespace-pre-wrap">{currentQuestion.question_text}</p>
              )}
            </div>

            {/* Question image */}
            {currentQuestion.question_image_url && (
              <div className="space-y-2">
                <img
                  src={currentQuestion.question_image_url}
                  alt="Imagem da questão"
                  className="max-w-full h-auto rounded-lg border"
                />
                {currentQuestion.question_image_caption && (
                  <p className="text-sm text-muted-foreground italic">{currentQuestion.question_image_caption}</p>
                )}
              </div>
            )}

            {/* Options */}
            <div className="grid gap-2">
              {parseOptions(currentQuestion.options).map((option: string, optIndex: number) => {
                let optionStyle = 'border-border/50 hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm'
                let icon = null

                if (isAnswered) {
                  if (option === currentQuestion.correct_answer) {
                    optionStyle = 'bg-green-500/10 border-green-500 text-green-700 dark:text-green-300 font-medium'
                    icon = <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  } else if (option === wrongSelection) {
                    optionStyle = 'bg-red-500/10 border-red-500 text-red-700 dark:text-red-300'
                    icon = <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  } else {
                    optionStyle = 'opacity-50 border-transparent'
                  }
                }

                return (
                  <div
                    key={optIndex}
                    onClick={() => handleOptionSelect(option)}
                    className={cn(
                      'relative flex items-center gap-3 p-4 rounded-lg border transition-all text-sm',
                      !isAnswered && 'cursor-pointer',
                      isAnswered && 'cursor-default',
                      optionStyle,
                    )}
                  >
                    <div className={cn(
                      'flex items-center justify-center w-7 h-7 rounded-full border text-xs font-semibold shrink-0',
                      isAnswered && option === currentQuestion.correct_answer
                        ? 'border-green-500 bg-green-500 text-white'
                        : isAnswered && option === wrongSelection
                          ? 'border-red-500 bg-red-500 text-white'
                          : 'border-muted-foreground/30'
                    )}>
                      {String.fromCharCode(65 + optIndex)}
                    </div>
                    <span className="flex-1">{option}</span>
                    {icon}
                  </div>
                )
              })}
            </div>

            {/* Feedback after answering */}
            {isAnswered && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                {/* Result banner */}
                <div className={cn(
                  'flex items-center gap-3 p-4 rounded-lg',
                  isCorrect
                    ? 'bg-green-500/10 border border-green-500/20'
                    : 'bg-red-500/10 border border-red-500/20'
                )}>
                  {isCorrect ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      <span className="font-semibold text-green-700 dark:text-green-300">Resposta correta!</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                      <span className="font-semibold text-red-700 dark:text-red-300">Resposta incorreta</span>
                    </>
                  )}
                </div>

                {/* Explanation toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowExplanation(!showExplanation)}
                  className="gap-2 text-primary transition-all duration-200 hover:bg-primary/10 hover:shadow-sm"
                >
                  <Lightbulb className="h-4 w-4" />
                  {showExplanation ? 'Ocultar Comentário' : 'Ver Comentário do Professor'}
                </Button>

                {showExplanation && (
                  <div className="p-4 bg-muted/50 rounded-lg text-sm leading-relaxed border border-border/50 animate-in fade-in zoom-in-95">
                    <p className="font-semibold mb-2 text-primary">Explicação:</p>
                    {currentQuestion.explanation_html ? (
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentQuestion.explanation_html) }}
                      />
                    ) : (
                      <p>{currentQuestion.explanation || 'Nenhuma explicação cadastrada para esta questão.'}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="gap-2 transition-all duration-200 hover:shadow-md hover:border-primary/30"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>

          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {studyQuestions.length}
          </span>

          {isAnswered ? (
            <Button onClick={goNext} className="gap-2 transition-all duration-200 hover:shadow-md hover:bg-green-600">
              {currentIndex < studyQuestions.length - 1 ? (
                <>
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  Ver Resultado
                  <Trophy className="h-4 w-4" />
                </>
              )}
            </Button>
          ) : (
            <Button variant="ghost" disabled className="gap-2 opacity-50">
              Responda para continuar
            </Button>
          )}
        </div>

        {/* Reading text dialog */}
        <Dialog open={!!readingTextDialog} onOpenChange={(open) => !open && setReadingTextDialog(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                {readingTextDialog?.title || 'Texto de Apoio'}
              </DialogTitle>
            </DialogHeader>
            <div className="prose dark:prose-invert max-w-none leading-relaxed whitespace-pre-wrap">
              {readingTextDialog?.content}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ─── SUMMARY PHASE ─────────────────────────────────────────────────────
  if (phase === 'summary') {
    const stats = getSummaryStats()
    const getGrade = () => {
      if (stats.percentage >= 90) return { label: 'Excelente!', color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/20' }
      if (stats.percentage >= 70) return { label: 'Muito Bom!', color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' }
      if (stats.percentage >= 50) return { label: 'Regular', color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/20' }
      return { label: 'Precisa Melhorar', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' }
    }
    const grade = getGrade()

    // Wrong answers for review
    const wrongQuestions = studyQuestions.filter(q => answers[q.id] && answers[q.id] !== q.correct_answer)

    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Resultado da Sessão</h1>
          <p className="text-sm text-muted-foreground mt-1">Confira seu desempenho nesta sessão de estudo</p>
        </div>

        {/* Main score card */}
        <Card className={cn('border shadow-sm', grade.bg)}>
          <CardContent className="p-8 text-center space-y-4">
            <Trophy className={cn('h-12 w-12 mx-auto', grade.color)} />
            <div>
              <div className={cn('text-5xl font-bold', grade.color)}>{stats.percentage}%</div>
              <div className={cn('text-lg font-semibold mt-1', grade.color)}>{grade.label}</div>
            </div>
            <div className="text-sm text-muted-foreground">
              {stats.correct} acertos de {stats.total} questões
            </div>
          </CardContent>
        </Card>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/30">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Questões</div>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-green-500/30">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.correct}</div>
              <div className="text-xs text-muted-foreground">Acertos</div>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-red-500/30">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-500">{stats.wrong}</div>
              <div className="text-xs text-muted-foreground">Erros</div>
            </CardContent>
          </Card>
        </div>

        {/* Wrong answers review */}
        {wrongQuestions.length > 0 && (
          <Card className="border-border shadow-sm">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Questões que você errou</h3>
              <div className="space-y-3">
                {wrongQuestions.map((q) => (
                  <div key={q.id} className="p-4 rounded-lg bg-red-500/5 border border-red-500/10 space-y-2 transition-all duration-200 hover:bg-red-500/10 hover:border-red-500/20">
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline">{q.topics?.subjects?.name || 'Geral'}</Badge>
                      <Badge variant="secondary">{q.topics?.name || 'Tópico'}</Badge>
                    </div>
                    <p className="text-sm text-foreground line-clamp-2">{q.question_text}</p>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-red-500 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        Sua: {answers[q.id]}
                      </span>
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Correta: {q.correct_answer}
                      </span>
                    </div>
                    {q.explanation && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium text-primary">Explicação:</span> {q.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" onClick={restart} className="gap-2 transition-all duration-200 hover:shadow-md hover:border-primary/30">
            <RotateCcw className="h-4 w-4" />
            Nova Sessão
          </Button>
          <Button onClick={async () => {
            setStudyQuestions([])
            setAnswers({})
            setCurrentIndex(0)
            setShowExplanation(false)
            // Keep filters, fetch fresh questions
            await startStudy()
          }} className="gap-2 transition-all duration-200 hover:shadow-md hover:bg-green-600">
            <Play className="h-4 w-4" />
            Repetir Mesmos Filtros
          </Button>
        </div>
      </div>
    )
  }

  return null
}
