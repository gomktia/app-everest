import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  FileCheck,
  Send,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Circle,
  Clock,
  BookText,
  Target,
  ArrowLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'

interface Question {
  id: string
  question_number: string
  points: number
  correct_answer: string
}

interface AnswerSheet {
  id: string
  title: string
  description?: string
  scheduled_start?: string
  scheduled_end?: string
  total_points: number
  passing_score?: number
  questions: Question[]
}

const ANSWER_OPTIONS = ['A', 'B', 'C', 'D', 'E']

export default function AnswerSheetFillPage() {
  const { sheetId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [answerSheet, setAnswerSheet] = useState<AnswerSheet | null>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (sheetId) {
      loadAnswerSheet()
    }
  }, [sheetId])

  const loadAnswerSheet = async () => {
    try {
      setLoading(true)

      // Buscar quiz
      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', sheetId)
        .eq('type', 'answer_sheet')
        .single()

      if (quizError) throw quizError

      // Verificar se já submeteu
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const { data: existingAttempt } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_id', sheetId)
        .eq('user_id', user.id)
        .eq('status', 'submitted')
        .maybeSingle()

      if (existingAttempt) {
        toast({
          title: 'Cartão já enviado',
          description: 'Você já enviou este cartão resposta',
        })
        navigate(`/cartao-resposta/${sheetId}/resultado?attemptId=${existingAttempt.id}`)
        return
      }

      // Buscar questões
      const { data: questions, error: questionsError } = await supabase
        .from('quiz_questions')
        .select('id, question_number, points, correct_answer')
        .eq('quiz_id', sheetId)
        .order('display_order', { ascending: true })

      if (questionsError) throw questionsError

      setAnswerSheet({
        ...quiz,
        questions: questions || []
      })

      // Criar tentativa
      const { data: attempt, error: attemptError } = await supabase
        .from('quiz_attempts')
        .insert({
          quiz_id: sheetId,
          user_id: user.id,
          status: 'in_progress'
        })
        .select()
        .single()

      if (attemptError) throw attemptError
      setAttemptId(attempt.id)

    } catch (error: any) {
      toast({
        title: 'Erro ao carregar cartão resposta',
        description: error.message,
        variant: 'destructive'
      })
      navigate('/cartoes-resposta')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  const handleSubmit = async () => {
    if (!attemptId || !answerSheet) return

    try {
      setSubmitting(true)

      // Salvar todas as respostas
      const answersToSave = answerSheet.questions.map(q => {
        const userAnswer = answers[q.id]
        const isCorrect = userAnswer === q.correct_answer
        const pointsEarned = isCorrect ? q.points : 0

        return {
          attempt_id: attemptId,
          question_id: q.id,
          answer_value: userAnswer || '',
          is_correct: isCorrect,
          points_earned: pointsEarned
        }
      })

      const { error: answersError } = await supabase
        .from('quiz_answers')
        .upsert(answersToSave, { onConflict: 'attempt_id,question_id' })

      if (answersError) throw answersError

      // Validar e calcular resultado
      const { data: result, error: validateError } = await supabase
        .rpc('validate_answer_sheet', { p_attempt_id: attemptId })

      if (validateError) throw validateError

      toast({
        title: 'Cartão enviado com sucesso!',
        description: `Você acertou ${result.correct_count} de ${answerSheet.questions.length} questões`,
      })

      navigate(`/cartao-resposta/${sheetId}/resultado?attemptId=${attemptId}`)
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar cartão',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
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

  if (!answerSheet) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Erro</h1>
        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Cartão resposta não encontrado
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const answeredCount = Object.keys(answers).filter(k => answers[k]).length
  const progress = (answeredCount / answerSheet.questions.length) * 100

  return (
    <div className="space-y-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back button */}
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {/* Header */}
        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-primary/10">
                    <FileCheck className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold">{answerSheet.title}</h1>
                    <p className="text-muted-foreground">
                      {answerSheet.description || 'Prova Presencial'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20">
                  <Target className="h-5 w-5 text-primary" />
                  <span className="font-semibold">{answerSheet.total_points} pontos</span>
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium">
                    {answeredCount}/{answerSheet.questions.length} respondidas ({progress.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full bg-muted/50 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <BookText className="h-5 w-5 text-blue-500 mt-1" />
              <div>
                <h3 className="font-bold mb-2">Instruções</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Selecione a alternativa correta para cada questão</li>
                  <li>• Você pode pular questões e voltar depois</li>
                  <li>• Confira suas respostas antes de enviar</li>
                  <li>• Após enviar, você verá o resultado imediatamente</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Answer Grid */}
        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileCheck className="h-6 w-6 text-primary" />
                Cartão Resposta
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {answerSheet.questions.map((question) => (
                  <div
                    key={question.id}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all",
                      answers[question.id]
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/50 bg-card/50"
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-lg">
                        {question.question_number}
                      </span>
                      {answers[question.id] ? (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex gap-2">
                      {ANSWER_OPTIONS.map((option) => (
                        <button
                          key={option}
                          onClick={() => handleAnswerChange(question.id, option)}
                          className={cn(
                            "flex-1 py-2 rounded-lg font-semibold transition-all",
                            answers[question.id] === option
                              ? "bg-primary text-primary-foreground shadow-lg scale-105"
                              : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-3 rounded-xl",
                  answeredCount === answerSheet.questions.length
                    ? "bg-green-100 dark:bg-green-950/50"
                    : "bg-orange-100 dark:bg-orange-950/50"
                )}>
                  {answeredCount === answerSheet.questions.length ? (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 text-orange-500" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold">
                    {answeredCount === answerSheet.questions.length
                      ? 'Todas as questões respondidas!'
                      : `Faltam ${answerSheet.questions.length - answeredCount} questões`}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {answeredCount === answerSheet.questions.length
                      ? 'Você pode enviar seu cartão resposta'
                      : 'Certifique-se de responder todas antes de enviar'}
                  </p>
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={submitting}
                    className="font-semibold px-8"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-5 w-5" />
                        Enviar Cartão
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      Confirmar Envio
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Você respondeu {answeredCount} de {answerSheet.questions.length} questões.
                      {answeredCount < answerSheet.questions.length && (
                        <>
                          <br /><br />
                          <strong className="text-orange-500">
                            Atenção: {answerSheet.questions.length - answeredCount} questões ficarão em branco.
                          </strong>
                        </>
                      )}
                      <br /><br />
                      Após enviar, você verá seu resultado imediatamente. Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSubmit}>
                      Confirmar e Enviar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
