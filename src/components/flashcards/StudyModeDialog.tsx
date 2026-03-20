import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BookOpen,
  BrainCircuit,
  ChevronLeft,
  Clock,
  Target,
  Star,
  Trophy,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface StudyModeDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  subjectId: string
  topicId: string
}

const studyModes = [
  {
    name: 'Sessão Completa',
    description: 'Estude os cards do tópico no seu ritmo.',
    icon: BookOpen,
    mode: 'full',
    color: 'blue',
    time: '15-30 min',
    difficulty: 'Médio',
  },
  {
    name: 'Revisão de Difíceis',
    description: 'Foque nos cards que você marcou como difíceis.',
    icon: BrainCircuit,
    mode: 'difficult_review',
    color: 'red',
    time: '10-20 min',
    difficulty: 'Difícil',
  },
]

const cardCounts = [
  { count: 10, label: '10 Cards', time: '5-10 min', icon: Target },
  { count: 20, label: '20 Cards', time: '10-20 min', icon: Star },
  { count: 30, label: '30 Cards', time: '15-30 min', icon: Trophy },
]

export const StudyModeDialog = ({
  isOpen,
  onOpenChange,
  subjectId,
  topicId,
}: StudyModeDialogProps) => {
  const navigate = useNavigate()
  const [step, setStep] = useState<'mode' | 'count'>('mode')
  const [selectedMode, setSelectedMode] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setStep('mode')
      setSelectedMode(null)
    }
  }, [isOpen])

  const handleModeSelect = (mode: string) => {
    if (mode === 'difficult_review') {
      onOpenChange(false)
      navigate(
        `/flashcards/${subjectId}/${topicId}/study?mode=difficult_review`,
      )
    } else {
      setSelectedMode(mode)
      setStep('count')
    }
  }

  const handleCountSelect = (count: number | 'all') => {
    onOpenChange(false)
    navigate(
      `/flashcards/${subjectId}/${topicId}/study?mode=${selectedMode}&count=${count}`,
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          {step === 'mode' ? (
            <>
              <DialogTitle className="text-xl font-bold">
                🎯 Escolha seu Modo de Estudo
              </DialogTitle>
              <DialogDescription className="text-sm">
                Selecione a melhor forma de estudar este tópico.
              </DialogDescription>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setStep('mode')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div>
                <DialogTitle className="text-xl font-bold">
                  📊 Quantidade de Cards
                </DialogTitle>
                <DialogDescription className="text-sm">
                  Quantos cards você quer revisar?
                </DialogDescription>
              </div>
            </div>
          )}
        </DialogHeader>
        
        {step === 'mode' ? (
          <div className="grid gap-3 py-2">
            {studyModes.map((mode) => (
              <Card
                key={mode.mode}
                className={cn(
                  "cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg border-2 hover:border-primary"
                )}
                onClick={() => handleModeSelect(mode.mode)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2.5 rounded-lg",
                      mode.color === 'blue' && "bg-blue-100 dark:bg-blue-900/50",
                      mode.color === 'red' && "bg-red-100 dark:bg-red-900/50"
                    )}>
                      <mode.icon className={cn(
                        "h-5 w-5",
                        mode.color === 'blue' && "text-blue-600 dark:text-blue-400",
                        mode.color === 'red' && "text-red-600 dark:text-red-400"
                      )} />
                    </div>

                    <div className="flex-grow">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-base font-bold">
                          {mode.name}
                        </h3>
                        <Badge className={cn(
                          "text-xs",
                          mode.difficulty === 'Médio' && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
                          mode.difficulty === 'Difícil' && "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                        )}>
                          {mode.difficulty}
                        </Badge>
                      </div>

                      <p className="text-sm text-muted-foreground mb-2">
                        {mode.description}
                      </p>

                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{mode.time}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 py-2">
            {cardCounts.map((option) => (
              <Card
                key={option.count}
                className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg border-2 hover:border-primary"
                onClick={() => handleCountSelect(option.count)}
              >
                <CardContent className="p-4 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                      <option.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>

                    <div>
                      <h3 className="text-sm font-bold">
                        {option.label}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {option.time}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card
              className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg border-2 hover:border-green-500 col-span-3"
              onClick={() => handleCountSelect('all')}
            >
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
                    <BookOpen className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>

                  <div className="text-left">
                    <h3 className="text-sm font-bold">
                      Todos os Cards
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Estude todo o conteúdo do tópico
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
