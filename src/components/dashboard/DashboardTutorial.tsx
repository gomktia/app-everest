import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { X, ChevronLeft, ChevronRight, LayoutDashboard, Trophy, BookOpen, Target, TrendingUp, Calendar } from 'lucide-react'

interface DashboardTutorialProps {
  onClose: () => void
}

const tutorialSteps = [
  {
    title: 'Bem-vindo ao Dashboard! 🎯',
    description: 'Esta é sua central de comando. Aqui você visualiza tudo o que está acontecendo nos seus estudos em um só lugar.',
    icon: LayoutDashboard,
    tips: [
      'Acompanhe seu progresso em tempo real',
      'Veja suas próximas atividades',
      'Monitore suas estatísticas de estudo'
    ]
  },
  {
    title: 'Suas Estatísticas 📊',
    description: 'No topo do dashboard você encontra cards com suas principais métricas: XP total, posição no ranking, sequência de estudos e progresso.',
    icon: TrendingUp,
    tips: [
      'XP: Ganhe pontos completando atividades',
      'Ranking: Sua posição entre todos os estudantes',
      'Sequência: Dias consecutivos estudando'
    ]
  },
  {
    title: 'Atividades Recentes 📚',
    description: 'Acompanhe o que você fez recentemente: flashcards estudados, quizzes completados, aulas assistidas.',
    icon: BookOpen,
    tips: [
      'Veja seu histórico de estudos',
      'Identifique padrões de aprendizado',
      'Retome de onde parou'
    ]
  },
  {
    title: 'Próximas Atividades 📅',
    description: 'Nunca perca prazos! Veja simulados agendados, aulas ao vivo e tarefas pendentes.',
    icon: Calendar,
    tips: [
      'Organize seu tempo de estudo',
      'Prepare-se para simulados',
      'Não perca aulas importantes'
    ]
  },
  {
    title: 'Conquistas Recentes 🏆',
    description: 'Celebre suas vitórias! Veja as medalhas e conquistas que você desbloqueou.',
    icon: Trophy,
    tips: [
      'Cada conquista vale XP extra',
      'Compartilhe seus marcos',
      'Motive-se a continuar'
    ]
  },
  {
    title: 'Dica Final 💡',
    description: 'Use o dashboard como ponto de partida todos os dias. Ele foi feito para te manter focado e motivado!',
    icon: Target,
    tips: [
      'Acesse diariamente pela manhã',
      'Defina metas baseadas nas estatísticas',
      'Comemore cada pequena vitória'
    ]
  }
]

export function DashboardTutorial({ onClose }: DashboardTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const step = tutorialSteps[currentStep]
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100
  const Icon = step.icon

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onClose()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = () => {
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="border-border shadow-sm max-w-2xl w-full">
        <div className="relative p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10">
                <Icon className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">{step.title}</h2>
                <p className="text-sm text-muted-foreground">
                  Passo {currentStep + 1} de {tutorialSteps.length}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSkip}
              className="rounded-full hover:bg-destructive/10 hover:text-destructive"
              aria-label="Fechar tutorial"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Progress */}
          <Progress value={progress} className="mb-6 h-2" />

          {/* Content */}
          <div className="space-y-6 mb-8">
            <p className="text-lg text-foreground leading-relaxed">
              {step.description}
            </p>

            {/* Tips */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Dicas importantes:
              </h3>
              <ul className="space-y-2">
                {step.tips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>

            <div className="flex gap-1.5">
              {tutorialSteps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 w-2 rounded-full transition-all duration-300 ${
                    index === currentStep
                      ? 'bg-primary w-6'
                      : index < currentStep
                      ? 'bg-primary/50'
                      : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>

            <Button
              onClick={handleNext}
              className="gap-2 bg-gradient-to-r from-primary to-primary/80"
            >
              {currentStep === tutorialSteps.length - 1 ? 'Finalizar' : 'Próximo'}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Skip button */}
          {currentStep < tutorialSteps.length - 1 && (
            <div className="text-center mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-muted-foreground hover:text-foreground"
              >
                Pular tutorial
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
