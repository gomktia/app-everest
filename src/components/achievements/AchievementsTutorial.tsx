import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from '@/components/ui/responsive-dialog'
import {
  Award,
  Trophy,
  Star,
  Target,
  Crown,
  Zap,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Check,
  Gift,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TutorialStep {
  title: string
  description: string
  icon: React.ReactNode
  tips: string[]
  color: string
}

const tutorialSteps: TutorialStep[] = [
  {
    title: 'Bem-vindo ao Sistema de Conquistas!',
    description: 'Ganhe conquistas especiais ao completar desafios e atividades na plataforma.',
    icon: <Award className="w-16 h-16" />,
    tips: [
      'Desbloqueie conquistas únicas estudando',
      'Ganhe XP (pontos de experiência) por cada conquista',
      'Suba no ranking e compare seu progresso',
      'Mostre suas conquistas para motivar outros alunos'
    ],
    color: 'blue'
  },
  {
    title: 'O que são Conquistas?',
    description: 'Conquistas são medalhas especiais que você ganha ao completar desafios específicos na plataforma.',
    icon: <Trophy className="w-16 h-16" />,
    tips: [
      '🎉 Primeiro Login - Sua primeira visita à plataforma',
      '📚 Estudante Dedicado - Complete várias atividades',
      '🏆 Top 10 - Entre no ranking dos melhores',
      '🏃 Maratonista - Estude vários dias seguidos',
      '💎 Especialista - Domine uma matéria específica',
      '👑 Mestre - Alcance níveis altos de XP'
    ],
    color: 'yellow'
  },
  {
    title: 'Como Ganhar XP?',
    description: 'XP (experiência) é a moeda do sistema de conquistas. Quanto mais XP, melhor sua posição!',
    icon: <Star className="w-16 h-16" />,
    tips: [
      '✅ Complete quizzes e testes',
      '📝 Pratique com flashcards',
      '🎯 Assista aulas completas',
      '📚 Estude usando o Planejador',
      '🔥 Mantenha uma sequência de estudos',
      '🏆 Desbloqueie conquistas valiosas'
    ],
    color: 'orange'
  },
  {
    title: 'Raridade das Conquistas',
    description: 'Conquistas têm diferentes níveis de raridade, que definem o quanto de XP você ganha.',
    icon: <Crown className="w-16 h-16" />,
    tips: [
      '⚪ Comum - 5 a 10 XP (fáceis de conseguir)',
      '🟢 Incomum - 10 a 25 XP (requer esforço)',
      '🔵 Raro - 25 a 50 XP (desafios moderados)',
      '🟣 Épico - 50 a 100 XP (muito difíceis)',
      '🌟 Lendário - 100+ XP (extremamente raras)'
    ],
    color: 'purple'
  },
  {
    title: 'Navegando nas Abas',
    description: 'Use as abas para visualizar diferentes tipos de conquistas.',
    icon: <Target className="w-16 h-16" />,
    tips: [
      '✅ Desbloqueadas - Conquistas que você já conseguiu',
      '🔒 Pendentes - Conquistas que você ainda precisa desbloquear',
      '🏆 Todas - Visualize todas as conquistas disponíveis',
      '📊 Veja seu progresso e estatísticas no topo',
      '🎯 Acompanhe quantas conquistas faltam'
    ],
    color: 'green'
  },
  {
    title: 'Dicas para Desbloquear Conquistas',
    description: 'Maximize suas conquistas com estas estratégias de estudo inteligente.',
    icon: <Zap className="w-16 h-16" />,
    tips: [
      '📅 Estude todos os dias para manter sequências',
      '🎯 Foque em completar atividades inteiras',
      '⚡ Use o cronômetro Pomodoro para sessões focadas',
      '📈 Acompanhe seu progresso no Dashboard',
      '🤝 Participe de discussões e ajude outros alunos',
      '🔥 Mantenha consistência nos estudos'
    ],
    color: 'red'
  }
]

interface AchievementsTutorialProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

export function AchievementsTutorial({ open, onOpenChange, onComplete }: AchievementsTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const step = tutorialSteps[currentStep]
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === tutorialSteps.length - 1

  const handleNext = () => {
    if (isLastStep) {
      onComplete()
      onOpenChange(false)
      setCurrentStep(0)
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleSkip = () => {
    onComplete()
    onOpenChange(false)
    setCurrentStep(0)
  }

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      blue: {
        bg: 'bg-blue-100 dark:bg-blue-950/50',
        text: 'text-blue-600',
        border: 'border-blue-300 dark:border-blue-800'
      },
      yellow: {
        bg: 'bg-yellow-100 dark:bg-yellow-950/50',
        text: 'text-yellow-600',
        border: 'border-yellow-300 dark:border-yellow-800'
      },
      orange: {
        bg: 'bg-orange-100 dark:bg-orange-950/50',
        text: 'text-orange-600',
        border: 'border-orange-300 dark:border-orange-800'
      },
      purple: {
        bg: 'bg-purple-100 dark:bg-purple-950/50',
        text: 'text-purple-600',
        border: 'border-purple-300 dark:border-purple-800'
      },
      green: {
        bg: 'bg-green-100 dark:bg-green-950/50',
        text: 'text-green-600',
        border: 'border-green-300 dark:border-green-800'
      },
      red: {
        bg: 'bg-red-100 dark:bg-red-950/50',
        text: 'text-red-600',
        border: 'border-red-300 dark:border-red-800'
      }
    }
    return colors[color] || colors.blue
  }

  const colorClasses = getColorClasses(step.color)

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline" className="text-xs">
              Passo {currentStep + 1} de {tutorialSteps.length}
            </Badge>
            {!isLastStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Pular Tutorial
              </Button>
            )}
          </div>
          <ResponsiveDialogTitle className="text-2xl">
            {step.title}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-base">
            {step.description}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-6 py-4">
          {/* Icon */}
          <div
            className={cn(
              'w-20 h-20 mx-auto rounded-2xl flex items-center justify-center border-2',
              colorClasses.bg,
              colorClasses.text,
              colorClasses.border
            )}
          >
            {step.icon}
          </div>

          {/* Tips List */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              {isFirstStep ? 'Principais Recursos:' : currentStep === 1 ? 'Exemplos de Conquistas:' : 'Informações Importantes:'}
            </h4>
            <div className="space-y-2">
              {step.tips.map((tip, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border',
                    colorClasses.bg,
                    colorClasses.border
                  )}
                >
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                      colorClasses.bg,
                      colorClasses.text
                    )}
                  >
                    {isFirstStep ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <span className="text-xs font-bold">{index + 1}</span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Progress Dots */}
          <div className="flex items-center justify-center gap-2 pt-4">
            {tutorialSteps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  index === currentStep
                    ? 'w-8 bg-primary'
                    : 'bg-muted hover:bg-muted-foreground/50'
                )}
                aria-label={`Ir para passo ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={isFirstStep}
            className="flex-1"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Anterior
          </Button>
          <Button
            onClick={handleNext}
            className={cn(
              'flex-1',
              isLastStep &&
                'bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70'
            )}
          >
            {isLastStep ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Começar a Desbloquear!
              </>
            ) : (
              <>
                Próximo
                <ChevronRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
