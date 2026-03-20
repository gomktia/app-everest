import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  CheckCircle,
  XCircle,
  Trophy,
  Target,
  Brain,
  Star,
  Clock,
  Award,
  ChevronRight,
  ArrowRight,
  RotateCcw,
  Share2,
  Lightbulb,
  Sparkles,
  Loader2
} from 'lucide-react'
import { aiAssistantService } from '@/services/ai/aiAssistantService'
import { supabase } from '@/lib/supabase/client'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'
import { ShareQuizResultsDialog } from './ShareQuizResultsDialog'

interface Question {
  id: number | string
  question: string
  correctAnswer: string
  options: string[]
  explanation?: string
}

interface Topic {
  title: string
  questions: Question[]
}

interface QuizResultProps {
  answers: Record<string | number, string>
  topic: Topic
  retakeLink: string
  backLink: string
  backLinkText?: string
  durationSeconds?: number
}

export const QuizResult = ({
  answers,
  topic,
  retakeLink,
  backLink,
  backLinkText = 'Voltar',
  durationSeconds,
}: QuizResultProps) => {
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [aiExplanations, setAiExplanations] = useState<Record<string | number, string>>({})
  const [loadingExplanation, setLoadingExplanation] = useState<Record<string | number, boolean>>({})

  const handleExplainWithAI = async (q: Question) => {
    setLoadingExplanation(prev => ({ ...prev, [q.id]: true }))
    try {
      const result = await aiAssistantService.explainQuestion({
        question_text: q.question,
        options: q.options,
        correct_answer: q.correctAnswer,
        question_type: 'multiple_choice',
      })
      setAiExplanations(prev => ({ ...prev, [q.id]: result.explanation }))
      // Persist to database if the question has a numeric/string id
      await supabase
        .from('quiz_questions')
        .update({ explanation: result.explanation })
        .eq('id', q.id)
    } catch {
      // silently fail — user can retry
    } finally {
      setLoadingExplanation(prev => ({ ...prev, [q.id]: false }))
    }
  }

  const { questions } = topic
  const score = questions.reduce((acc, question) => {
    return answers[question.id] === question.correctAnswer ? acc + 1 : acc
  }, 0)
  const percentage =
    questions.length > 0 ? Math.round((score / questions.length) * 100) : 0

  const getPerformanceLevel = (percentage: number) => {
    if (percentage >= 90) return { level: 'Excelente', color: 'green', icon: Trophy }
    if (percentage >= 70) return { level: 'Bom', color: 'blue', icon: Star }
    if (percentage >= 50) return { level: 'Regular', color: 'yellow', icon: Target }
    return { level: 'Precisa melhorar', color: 'red', icon: Brain }
  }

  const getMotivationalMessage = (percentage: number) => {
    if (percentage >= 90) return '🌟 Incrível! Você dominou este conteúdo!'
    if (percentage >= 80) return '🚀 Parabéns! Você está arrasando!'
    if (percentage >= 70) return '💪 Bom trabalho! Continue assim!'
    if (percentage >= 60) return '📚 Você está no caminho certo!'
    return '🎓 Continue estudando! Você vai conseguir!'
  }

  const performance = getPerformanceLevel(percentage)
  const motivationalMessage = getMotivationalMessage(percentage)
  const PerformanceIcon = performance.icon

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Resultado do Quiz</h1>
        <p className="text-sm text-muted-foreground mt-1">{topic.title} - {percentage}% de acerto</p>
      </div>

      <ShareQuizResultsDialog
        isOpen={isShareOpen}
        onOpenChange={setIsShareOpen}
        topicTitle={topic.title}
        correct={score}
        total={questions.length}
        percentage={percentage}
      />

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Results Header */}
        <Card className="border-border shadow-sm text-center"><CardContent className="p-6">
          <div className="space-y-8">
            <div className="flex items-center justify-center gap-4">
              <div className="p-3 rounded-2xl bg-primary/10">
                <PerformanceIcon className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  Quiz Concluído!
                </h2>
                <p className="text-muted-foreground text-lg">{topic.title}</p>
              </div>
            </div>
            
            {/* Motivational Message */}
            <div className="px-6 py-4 rounded-xl bg-primary/5 border border-primary/10">
              <p className="text-lg font-semibold text-foreground">
                {motivationalMessage}
              </p>
            </div>

            {/* Score Display */}
            <div className="space-y-6">
              <div className="relative">
                <div className="text-7xl font-bold text-primary">
                  {percentage}%
                </div>
                <div className="text-2xl font-semibold text-muted-foreground">
                  {score} de {questions.length} questões corretas
                </div>
              </div>

              {/* Performance Badge */}
              <div className={cn(
                "inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 font-semibold",
                performance.color === 'green' && "bg-green-100 dark:bg-green-950/50 border-green-300 dark:border-green-800 text-green-600",
                performance.color === 'blue' && "bg-blue-100 dark:bg-blue-950/50 border-blue-300 dark:border-blue-800 text-blue-600",
                performance.color === 'yellow' && "bg-yellow-100 dark:bg-yellow-950/50 border-yellow-300 dark:border-yellow-800 text-yellow-600",
                performance.color === 'red' && "bg-red-100 dark:bg-red-950/50 border-red-300 dark:border-red-800 text-red-600"
              )}>
                <PerformanceIcon className="h-5 w-5" />
                {performance.level}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center p-6 rounded-xl bg-green-100 dark:bg-green-950/50 border border-green-300 dark:border-green-800">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-3" />
                <div className="text-3xl font-bold text-green-600">{score}</div>
                <div className="text-sm text-muted-foreground">Corretas</div>
              </div>
              <div className="text-center p-6 rounded-xl bg-red-100 dark:bg-red-950/50 border border-red-300 dark:border-red-800">
                <XCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
                <div className="text-3xl font-bold text-red-600">{questions.length - score}</div>
                <div className="text-sm text-muted-foreground">Incorretas</div>
              </div>
              <div className="text-center p-6 rounded-xl bg-blue-100 dark:bg-blue-950/50 border border-blue-300 dark:border-blue-800">
                <Clock className="h-8 w-8 text-blue-500 mx-auto mb-3" />
                <div className="text-3xl font-bold text-blue-600">
                  {durationSeconds ? `${Math.floor(durationSeconds / 60)}min` : '—'}
                </div>
                <div className="text-sm text-muted-foreground">Tempo total</div>
              </div>
            </div>
          </div>
        </CardContent></Card>

        {/* Question Review */}
        <Card className="border-border shadow-sm"><CardContent className="p-6">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Award className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Revisão das Questões</h2>
            </div>

            <Accordion type="single" collapsible className="space-y-4">
              {questions.map((q, index) => {
                const userAnswer = answers[q.id]
                const isCorrect = userAnswer === q.correctAnswer
                return (
                  <AccordionItem 
                    value={`item-${index}`} 
                    key={q.id}
                    className="border border-border/50 rounded-xl overflow-hidden bg-gradient-to-r from-card/50 to-card/30"
                  >
                    <AccordionTrigger className="px-6 py-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-4 w-full">
                        <div className={cn(
                          "p-2 rounded-lg",
                          isCorrect 
                            ? "bg-green-100 dark:bg-green-950/50 text-green-600" 
                            : "bg-red-100 dark:bg-red-950/50 text-red-600"
                        )}>
                          {isCorrect ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            <XCircle className="h-5 w-5" />
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <span className="font-semibold">Questão {index + 1}</span>
                          <div className="text-sm text-muted-foreground mt-1">
                            {isCorrect ? 'Resposta correta' : 'Resposta incorreta'}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-4">
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-gradient-to-r from-muted/20 to-muted/10 border border-border/50">
                          <p className="font-semibold text-lg">{q.question}</p>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-muted/30 to-muted/20">
                            <span className="text-sm font-medium text-muted-foreground">Sua resposta:</span>
                            <span className={cn(
                              "font-semibold",
                              isCorrect ? "text-green-600" : "text-red-600"
                            )}>
                              {userAnswer}
                            </span>
                          </div>
                          
                          {!isCorrect && (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-green-500/10 to-green-600/5 border border-green-300 dark:border-green-800">
                              <span className="text-sm font-medium text-muted-foreground">Resposta correta:</span>
                              <span className="font-semibold text-green-600">
                                {q.correctAnswer}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Explanation block */}
                        {(() => {
                          const explanation = q.explanation || aiExplanations[q.id]
                          if (explanation) {
                            return (
                              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-300 dark:border-blue-800">
                                <div className="flex items-center gap-2 mb-2">
                                  <Lightbulb className="h-4 w-4 text-blue-500" />
                                  <span className="text-sm font-semibold text-blue-600">Explicação</span>
                                </div>
                                <p className="text-sm text-foreground leading-relaxed">{explanation}</p>
                              </div>
                            )
                          }
                          if (!isCorrect) {
                            return (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 text-blue-600 border-blue-300 dark:border-blue-800 hover:bg-blue-500/10"
                                onClick={() => handleExplainWithAI(q)}
                                disabled={loadingExplanation[q.id]}
                              >
                                {loadingExplanation[q.id] ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Sparkles className="h-4 w-4" />
                                )}
                                {loadingExplanation[q.id] ? 'Gerando explicação...' : 'Explicar com IA'}
                              </Button>
                            )
                          }
                          return null
                        })()}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </div>
        </CardContent></Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Button
            onClick={() => setIsShareOpen(true)}
            size="lg"
            className="font-semibold"
          >
            <Share2 className="mr-2 h-5 w-5" />
            Compartilhar Resultado
          </Button>
          
          <Button 
            asChild 
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white font-semibold"
          >
            <Link to={retakeLink}>
              <RotateCcw className="mr-2 h-5 w-5" />
              Refazer Quiz
            </Link>
          </Button>
          
          <Button 
            variant="outline" 
            size="lg"
            asChild
            className="font-semibold"
          >
            <Link to={backLink}>
              <ArrowRight className="mr-2 h-4 w-4" />
              {backLinkText}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
