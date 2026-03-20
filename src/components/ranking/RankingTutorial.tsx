import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { X, ChevronLeft, ChevronRight, Trophy, TrendingUp, Star, Award, Zap, Target } from 'lucide-react'

interface RankingTutorialProps {
  onClose: () => void
}

const tutorialSteps = [
  {
    title: 'Bem-vindo ao Ranking! 🏆',
    description: 'Acompanhe seu progresso e compare-se com outros estudantes. O ranking motiva você a estudar mais e melhor!',
    icon: Trophy,
    tips: [
      'Compete de forma saudável',
      'Use o ranking como motivação',
      'Celebre suas conquistas'
    ]
  },
  {
    title: 'Sistema de XP ⚡',
    description: 'Ganhe pontos de experiência (XP) completando atividades: quizzes, flashcards, simulados e muito mais!',
    icon: Zap,
    tips: [
      'Cada atividade dá uma quantidade de XP',
      'Quanto melhor seu desempenho, mais XP',
      'XP acumula para subir de nível'
    ]
  },
  {
    title: 'Níveis e Títulos 🌟',
    description: 'Conforme você ganha XP, sobe de nível e desbloqueia novos títulos: Iniciante, Estudante, Aprendiz, Especialista, Mestre e Lenda!',
    icon: Star,
    tips: [
      'Cada nível tem requisitos de XP',
      'Níveis mais altos desbloqueiam benefícios',
      'Mostre seu progresso no perfil'
    ]
  },
  {
    title: 'Rankings por Categoria 📊',
    description: 'Veja sua posição no ranking geral e também em categorias específicas: flashcards, quizzes e simulados.',
    icon: TrendingUp,
    tips: [
      'Ranking Global: posição geral',
      'Rankings por Atividade: compare-se em cada área',
      'Atualizações em tempo real'
    ]
  },
  {
    title: 'Conquistas e Badges 🏅',
    description: 'Desbloqueie conquistas especiais completando desafios. Cada conquista te dá XP extra e um badge único!',
    icon: Award,
    tips: [
      'Primeiro Login: 10 XP',
      'Top 10: 50 XP',
      'Maratonista: 30 XP (7 dias seguidos)',
      'E muito mais!'
    ]
  },
  {
    title: 'Dica Final 💡',
    description: 'Estude com consistência e qualidade. O ranking premia dedicação e resultados. Boa sorte!',
    icon: Target,
    tips: [
      'Foque na aprendizagem, não só no XP',
      'Estude todos os dias para manter o ritmo',
      'Celebre cada conquista, por menor que seja'
    ]
  }
]

export function RankingTutorial({ onClose }: RankingTutorialProps) {
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="border-border shadow-sm max-w-2xl w-full">
        <div className="relative p-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10">
                <Icon className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">{step.title}</h2>
                <p className="text-sm text-muted-foreground">Passo {currentStep + 1} de {tutorialSteps.length}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full" aria-label="Fechar tutorial">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <Progress value={progress} className="mb-6 h-2" />

          <div className="space-y-6 mb-8">
            <p className="text-lg text-foreground leading-relaxed">{step.description}</p>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Dicas importantes:</h3>
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

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 0} className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>

            <div className="flex gap-1.5">
              {tutorialSteps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 w-2 rounded-full transition-all duration-300 ${
                    index === currentStep ? 'bg-primary w-6' : index < currentStep ? 'bg-primary/50' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>

            <Button onClick={handleNext} className="gap-2 bg-gradient-to-r from-primary to-primary/80">
              {currentStep === tutorialSteps.length - 1 ? 'Finalizar' : 'Próximo'}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {currentStep < tutorialSteps.length - 1 && (
            <div className="text-center mt-4">
              <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
                Pular tutorial
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
