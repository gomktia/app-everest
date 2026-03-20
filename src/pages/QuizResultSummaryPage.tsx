import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { QuizResult } from '@/components/quizzes/QuizResult'
import { SectionLoader } from '@/components/SectionLoader'
import { useToast } from '@/hooks/use-toast'
import { quizService, type Quiz } from '@/services/quizService'
import { logger } from '@/lib/logger'

interface LocationState {
  attemptId?: string
  answers?: Record<string, string>
  quiz?: Quiz
  correctCount?: number
  totalQuestions?: number
  percentage?: number
  durationSeconds?: number
}

export default function QuizResultSummaryPage() {
  const { quizId } = useParams<{ quizId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('returnTo')
  const { toast } = useToast()

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)

  const state = location.state as LocationState

  useEffect(() => {
    const loadResults = async () => {
      try {
        setIsLoading(true)

        // Se recebeu dados via state, usar eles
        if (state?.quiz && state?.answers) {
          setQuiz(state.quiz)
          setAnswers(state.answers)
          setIsLoading(false)
          return
        }

        // Caso contrário, buscar do banco
        if (!quizId) {
          toast({
            title: 'Quiz não encontrado',
            description: 'ID do quiz não foi fornecido.',
            variant: 'destructive',
          })
          navigate('/quizzes')
          return
        }

        const quizData = await quizService.getQuizById(quizId)

        if (!quizData) {
          toast({
            title: 'Resultados não encontrados',
            description: 'Não foi possível carregar os resultados deste quiz.',
            variant: 'destructive',
          })
          navigate('/quizzes')
          return
        }

        setQuiz(quizData)
        setAnswers({}) // Sem respostas históricas por enquanto
      } catch (error) {
        logger.error('Erro ao carregar resultados:', error)
        toast({
          title: 'Erro ao carregar resultados',
          description: 'Ocorreu um erro ao buscar os resultados.',
          variant: 'destructive',
        })
        navigate('/quizzes')
      } finally {
        setIsLoading(false)
      }
    }

    loadResults()
  }, [quizId, state, navigate, toast])

  if (isLoading) {
    return <SectionLoader />
  }

  if (!quiz) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Resultados não encontrados</h2>
        <p className="text-muted-foreground mb-6">
          Não foi possível carregar os resultados deste quiz.
        </p>
      </div>
    )
  }

  // Transformar quiz para o formato esperado pelo QuizResult
  const topic = {
    title: quiz.title,
    questions: quiz.questions.map(q => ({
      id: q.id,
      question: q.question_text,
      correctAnswer: q.correct_answer,
      options: q.options,
      explanation: q.explanation,
    }))
  }

  return (
    <QuizResult
      answers={answers}
      topic={topic}
      retakeLink={`/quiz/${quizId}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
      backLink={returnTo || "/quizzes"}
      backLinkText={returnTo ? "Voltar para a Aula" : "Voltar aos Quizzes"}
      durationSeconds={state?.durationSeconds}
    />
  )
}
