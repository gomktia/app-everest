import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Trophy,
  CheckCircle2,
  XCircle,
  Circle,
  Target,
  BarChart3,
  ChevronLeft,
  Loader2,
  FileCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'

interface Answer {
  question_id: string
  answer_value: string
  is_correct: boolean
  points_earned: number
}

interface Question {
  id: string
  question_number: string
  correct_answer: string
  points: number
}

interface AttemptResult {
  id: string
  score: number
  total_points: number
  percentage: number
  quiz: {
    title: string
    description?: string
    passing_score?: number
  }
}

export default function AnswerSheetResultPage() {
  const { sheetId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const attemptId = searchParams.get('attemptId')

  const [attempt, setAttempt] = useState<AttemptResult | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (attemptId) {
      loadResults()
    }
  }, [attemptId])

  const loadResults = async () => {
    try {
      setLoading(true)

      // Buscar tentativa
      const { data: attemptData, error: attemptError } = await supabase
        .from('quiz_attempts')
        .select(`
          *,
          quiz:quizzes (
            title,
            description,
            passing_score
          )
        `)
        .eq('id', attemptId)
        .single()

      if (attemptError) throw attemptError
      setAttempt(attemptData)

      // Buscar respostas
      const { data: answersData, error: answersError } = await supabase
        .from('quiz_answers')
        .select('*')
        .eq('attempt_id', attemptId)

      if (answersError) throw answersError
      setAnswers(answersData || [])

      // Buscar questões
      const { data: questionsData, error: questionsError } = await supabase
        .from('quiz_questions')
        .select('id, question_number, correct_answer, points')
        .eq('quiz_id', attemptData.quiz_id)
        .order('display_order', { ascending: true })

      if (questionsError) throw questionsError
      setQuestions(questionsData || [])

    } catch (error: any) {
      toast({
        title: 'Erro ao carregar resultado',
        description: error.message,
        variant: 'destructive'
      })
      navigate('/cartoes-resposta')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Carregando...</h1>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!attempt) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Erro</h1>
        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Resultado não encontrado
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const correctCount = answers.filter(a => a.is_correct).length
  const incorrectCount = answers.filter(a => !a.is_correct && a.answer_value).length
  const blankCount = questions.length - answers.length
  const isPassed = attempt.quiz.passing_score
    ? attempt.percentage >= attempt.quiz.passing_score
    : true

  const getPerformanceLevel = () => {
    if (attempt.percentage >= 90) return { label: 'Excelente', color: 'text-green-600' }
    if (attempt.percentage >= 70) return { label: 'Bom', color: 'text-blue-600' }
    if (attempt.percentage >= 50) return { label: 'Regular', color: 'text-yellow-600' }
    return { label: 'Precisa melhorar', color: 'text-red-600' }
  }

  const performance = getPerformanceLevel()

  return (
    <div className="space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header com Score */}
        <Card className="border-border shadow-sm">
          <CardContent className="pt-6 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className={cn(
                "p-6 rounded-full",
                isPassed
                  ? "bg-green-100 dark:bg-green-950/50"
                  : "bg-red-100 dark:bg-red-950/50"
              )}>
                {isPassed ? (
                  <Trophy className="h-16 w-16 text-green-500" />
                ) : (
                  <Target className="h-16 w-16 text-red-500" />
                )}
              </div>

              <div>
                <h1 className="text-4xl font-bold mb-2">{attempt.percentage.toFixed(1)}%</h1>
                <p className={cn("text-xl font-semibold", performance.color)}>
                  {performance.label}
                </p>
                <p className="text-muted-foreground mt-2">
                  {attempt.score.toFixed(1)} de {attempt.total_points} pontos
                </p>
              </div>

              {attempt.quiz.passing_score && (
                <Badge
                  variant={isPassed ? 'default' : 'destructive'}
                  className="text-sm py-1 px-3"
                >
                  {isPassed ? '✓ Aprovado' : '✗ Reprovado'} (nota mínima: {attempt.quiz.passing_score}%)
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-green-100 dark:bg-green-950/50">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{correctCount}</p>
                  <p className="text-sm text-muted-foreground">Corretas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-red-100 dark:bg-red-950/50">
                  <XCircle className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{incorrectCount}</p>
                  <p className="text-sm text-muted-foreground">Incorretas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <Circle className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{blankCount}</p>
                  <p className="text-sm text-muted-foreground">Em branco</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de Desempenho */}
        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-lg">Desempenho</h3>
                </div>
                <span className="text-sm text-muted-foreground">
                  {correctCount} de {questions.length} questões
                </span>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">Acertos</span>
                    <span className="font-medium">
                      {((correctCount / questions.length) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress
                    value={(correctCount / questions.length) * 100}
                    className="h-2"
                    indicatorClassName="bg-green-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-red-600">Erros</span>
                    <span className="font-medium">
                      {((incorrectCount / questions.length) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress
                    value={(incorrectCount / questions.length) * 100}
                    className="h-2"
                    indicatorClassName="bg-red-500"
                  />
                </div>

                {blankCount > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Em branco</span>
                      <span className="font-medium">
                        {((blankCount / questions.length) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress
                      value={(blankCount / questions.length) * 100}
                      className="h-2"
                      indicatorClassName="bg-muted"
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gabarito */}
        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <FileCheck className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-bold">Gabarito Oficial</h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {questions.map((question) => {
                  const answer = answers.find(a => a.question_id === question.id)
                  const isCorrect = answer?.is_correct

                  return (
                    <div
                      key={question.id}
                      className={cn(
                        "p-3 rounded-lg border-2 flex items-center justify-between",
                        isCorrect
                          ? "border-green-300 dark:border-green-800 bg-green-100 dark:bg-green-950/50"
                          : answer
                          ? "border-red-300 dark:border-red-800 bg-red-100 dark:bg-red-950/50"
                          : "border-muted/30 bg-muted/10"
                      )}
                    >
                      <div>
                        <span className="font-bold">{question.question_number}</span>
                        <div className="text-xs text-muted-foreground">
                          {answer?.answer_value || '-'}
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <Badge variant="outline" className="text-xs">
                          {question.correct_answer}
                        </Badge>
                        {isCorrect ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-1" />
                        ) : answer ? (
                          <XCircle className="h-4 w-4 text-red-500 mt-1" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground mt-1" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ações */}
        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => navigate('/cartoes-resposta')}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Voltar para Cartões Resposta
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
