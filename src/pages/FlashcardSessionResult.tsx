import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { CheckCircle, Share2, XCircle, BookOpen, Trophy, Target, TrendingUp, Star } from 'lucide-react'
import { ShareResultsDialog } from '@/components/flashcards/ShareResultsDialog'
import { getFlashcardSessionDetails } from '@/services/flashcardService'
import { SectionLoader } from '@/components/SectionLoader'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type FlashcardSession = {
  id: string
  cards_reviewed: number
  correct_answers: number
  incorrect_answers: number
  session_mode: string
  started_at: string
  ended_at: string
  topic_id: string
  user_id: string
  group_session_id: string
  topics: {
    id: string
    name: string
    description: string
    subjects: { id: string; name: string }
  }
  topicTitle: string
  subjectId: string
  topicId: string
  totalCards: number
  correct: number
  incorrect: number
  details?: Array<{
    id: string
    question: string
    answer: string
    userAnswer: 'correct' | 'incorrect'
  }>
}

export default function FlashcardSessionResultPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [session, setSession] = useState<FlashcardSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isShareOpen, setIsShareOpen] = useState(false)

  useEffect(() => {
    if (sessionId) {
      getFlashcardSessionDetails(sessionId)
        .then((data) => {
          if (!data) return
          setSession({
            ...data,
            topicTitle: data.topics.name,
            subjectId: data.topics.subjects.id,
            topicId: data.topic_id,
            totalCards: data.cards_reviewed,
            correct: data.correct_answers,
            incorrect: data.incorrect_answers,
          })
        })
        .catch((error) => logger.error('Error loading session details:', error))
        .finally(() => setIsLoading(false))
    }
  }, [sessionId])

  if (isLoading) return <SectionLoader />

  if (!session) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Sessão não encontrada</h1>
        <Button asChild variant="outline">
          <Link to="/flashcards">Voltar aos Flashcards</Link>
        </Button>
      </div>
    )
  }

  const percentage = session.totalCards > 0 ? Math.round((session.correct / session.totalCards) * 100) : 0

  const getPerformanceLevel = (pct: number) => {
    if (pct >= 90) return { level: 'Excepcional', color: 'text-purple-500', icon: Trophy }
    if (pct >= 80) return { level: 'Excelente', color: 'text-green-500', icon: Star }
    if (pct >= 70) return { level: 'Bom', color: 'text-blue-500', icon: Target }
    if (pct >= 60) return { level: 'Regular', color: 'text-yellow-500', icon: TrendingUp }
    return { level: 'Precisa Melhorar', color: 'text-red-500', icon: Target }
  }

  const performance = getPerformanceLevel(percentage)
  const PerformanceIcon = performance.icon

  return (
    <div className="space-y-6">
      <ShareResultsDialog
        isOpen={isShareOpen}
        onOpenChange={setIsShareOpen}
        topicTitle={session.topicTitle}
        correct={session.correct}
        total={session.totalCards}
      />

      {/* Header */}
      <div className="text-center space-y-4">
        <Badge variant="outline" className="text-sm">Sessão Finalizada</Badge>
        <h1 className="text-5xl font-bold text-foreground">{percentage}%</h1>
        <div className="flex items-center justify-center gap-2">
          <PerformanceIcon className={cn('h-5 w-5', performance.color)} />
          <span className={cn('text-lg font-semibold', performance.color)}>{performance.level}</span>
        </div>
        <p className="text-muted-foreground">{session.topicTitle}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border shadow-sm">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-600">{session.correct}</p>
            <p className="text-xs text-muted-foreground">Acertos</p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="p-4 text-center">
            <XCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-red-600">{session.incorrect}</p>
            <p className="text-xs text-muted-foreground">Erros</p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="p-4 text-center">
            <BookOpen className="h-6 w-6 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-blue-600">{session.totalCards}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Progresso da Sessão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Precisão</span>
              <span className={cn('font-semibold', performance.color)}>{percentage}%</span>
            </div>
            <Progress value={percentage} className="h-2.5" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 rounded-lg bg-green-100 border border-green-300">
              <p className="text-xl font-bold text-green-600">{((session.correct / session.totalCards) * 100).toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Taxa de Acerto</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-blue-100 border border-blue-300">
              <p className="text-xl font-bold text-blue-600">{session.totalCards - session.incorrect}</p>
              <p className="text-xs text-muted-foreground">Cards Dominados</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Review */}
      {session.details && (
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Revisão Detalhada</CardTitle>
                <CardDescription>Analise cada flashcard e veja onde pode melhorar</CardDescription>
              </div>
              <Badge variant="outline">{session.details.length} cards</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="space-y-2">
              {session.details.map((card, index) => (
                <AccordionItem
                  value={`item-${index}`}
                  key={card.id}
                  className="border rounded-lg px-4 data-[state=open]:bg-muted/50"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        card.userAnswer === 'correct' ? 'bg-green-100 text-green-500' : 'bg-red-100 text-red-500',
                      )}>
                        {card.userAnswer === 'correct' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{card.question}</p>
                        <Badge
                          variant="outline"
                          className={cn(
                            'mt-1 text-xs',
                            card.userAnswer === 'correct'
                              ? 'bg-green-100 text-green-600 border-green-300'
                              : 'bg-red-100 text-red-600 border-red-300',
                          )}
                        >
                          {card.userAnswer === 'correct' ? 'Acerto' : 'Erro'}
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-4">
                    <div className="grid gap-4 p-4 bg-muted/30 rounded-lg border border-border">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Pergunta</p>
                        <p className="text-sm">{card.question}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Resposta Correta</p>
                        <p className="text-sm font-medium">{card.answer}</p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button className="flex-1" onClick={() => setIsShareOpen(true)}>
          <Share2 className="mr-2 h-4 w-4" />
          Compartilhar Resultado
        </Button>
        <Button variant="outline" className="flex-1" asChild>
          <Link to="/progresso/historico-flashcards">
            <BookOpen className="mr-2 h-4 w-4" />
            Ver Histórico
          </Link>
        </Button>
      </div>

      {/* Next Steps */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-6 text-center space-y-4">
          <h3 className="text-base font-semibold text-foreground">Continue Aprendendo</h3>
          <p className="text-sm text-muted-foreground">
            {percentage >= 80
              ? 'Excelente trabalho! Que tal tentar um novo tópico?'
              : 'Continue praticando para dominar este tópico!'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/flashcards/${session.subjectId}/${session.topicId}/study?mode=difficult_review`}>
                Revisar Difíceis
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/flashcards/${session.subjectId}`}>Escolher Novo Tópico</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
