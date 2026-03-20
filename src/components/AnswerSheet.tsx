import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  Circle,
  XCircle,
  FileCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

export interface AnswerSheetQuestion {
  id: string
  number: string | number
  answer?: string
  isCorrect?: boolean
  isAnswered?: boolean
}

interface AnswerSheetProps {
  questions: AnswerSheetQuestion[]
  currentQuestionIndex: number
  onQuestionSelect: (index: number) => void
  showResults?: boolean
  className?: string
}

export function AnswerSheet({
  questions,
  currentQuestionIndex,
  onQuestionSelect,
  showResults = false,
  className
}: AnswerSheetProps) {
  const [isOpen, setIsOpen] = useState(true)

  const answeredCount = questions.filter(q => q.isAnswered).length
  const correctCount = questions.filter(q => q.isCorrect === true).length
  const incorrectCount = questions.filter(q => q.isCorrect === false).length

  const getQuestionIcon = (question: AnswerSheetQuestion, index: number) => {
    if (index === currentQuestionIndex) {
      return <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
    }

    if (showResults) {
      if (question.isCorrect === true) {
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      }
      if (question.isCorrect === false) {
        return <XCircle className="h-4 w-4 text-red-500" />
      }
    }

    if (question.isAnswered) {
      return <CheckCircle2 className="h-4 w-4 text-blue-500" />
    }

    return <Circle className="h-4 w-4 text-muted-foreground" />
  }

  const getQuestionStatus = (question: AnswerSheetQuestion, index: number) => {
    if (index === currentQuestionIndex) {
      return 'border-primary bg-primary/10 text-primary font-bold'
    }

    if (showResults) {
      if (question.isCorrect === true) {
        return 'border-green-500/50 bg-green-100 text-green-600 hover:bg-green-500/20'
      }
      if (question.isCorrect === false) {
        return 'border-red-500/50 bg-red-100 text-red-600 hover:bg-red-500/20'
      }
    }

    if (question.isAnswered) {
      return 'border-blue-500/50 bg-blue-100 text-blue-600 hover:bg-blue-500/20'
    }

    return 'border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/50'
  }

  return (
    <Card className={cn("border-border shadow-sm", className)}><CardContent className="p-6">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
              <FileCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Cartão Resposta</h3>
              <p className="text-sm text-muted-foreground">
                {answeredCount}/{questions.length} respondidas
              </p>
            </div>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="mt-4">
          {/* Stats */}
          {showResults && (
            <div className="flex gap-4 mb-4 p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">{correctCount} certas</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium">{incorrectCount} erradas</span>
              </div>
              <div className="flex items-center gap-2">
                <Circle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {questions.length - answeredCount} em branco
                </span>
              </div>
            </div>
          )}

          {/* Grid de questões */}
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
            {questions.map((question, index) => (
              <button
                key={question.id}
                onClick={() => onQuestionSelect(index)}
                className={cn(
                  'relative aspect-square rounded-lg border-2 transition-all duration-200 flex flex-col items-center justify-center gap-1 p-1',
                  getQuestionStatus(question, index)
                )}
              >
                <span className="text-xs font-medium">{question.number}</span>
                {getQuestionIcon(question, index)}
                {question.answer && !showResults && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-background" />
                )}
              </button>
            ))}
          </div>

          {/* Legenda */}
          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Circle className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Não respondida</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-blue-500" />
                <span className="text-muted-foreground">Respondida</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">Atual</span>
              </div>
              {showResults && (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    <span className="text-muted-foreground">Correta</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-3 w-3 text-red-500" />
                    <span className="text-muted-foreground">Incorreta</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </CardContent></Card>
  )
}
