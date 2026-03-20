import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { X, ChevronLeft, ChevronRight, ClipboardCheck, Calendar, Clock, FileText, BarChart3, Target } from 'lucide-react'

interface SimulationsTutorialProps {
  onClose: () => void
}

const tutorialSteps = [
  {
    title: 'Bem-vindo aos Simulados! 🎯',
    description: 'Simulados são essenciais para sua preparação! Pratique em condições reais de prova e avalie seu desempenho.',
    icon: ClipboardCheck,
    tips: [
      'Simule condições reais de prova',
      'Teste seu conhecimento completo',
      'Identifique pontos de melhoria'
    ]
  },
  {
    title: 'Escolha seu Simulado 📋',
    description: 'Navegue pelos simulados disponíveis. Veja informações como número de questões, tempo limite e data de realização.',
    icon: FileText,
    tips: [
      'Verifique a quantidade de questões',
      'Confira o tempo disponível',
      'Planeje quando realizar'
    ]
  },
  {
    title: 'Prepare-se com Antecedência 📅',
    description: 'Separe um tempo sem interrupções. Tenha água, papel e caneta por perto. Crie um ambiente tranquilo de estudo.',
    icon: Calendar,
    tips: [
      'Escolha um local silencioso',
      'Desligue notificações do celular',
      'Reserve o tempo completo do simulado'
    ]
  },
  {
    title: 'Gestão do Tempo ⏱️',
    description: 'Acompanhe o cronômetro durante o simulado. Distribua seu tempo entre as questões sem se prender a nenhuma delas.',
    icon: Clock,
    tips: [
      'Calcule tempo médio por questão',
      'Marque questões difíceis para depois',
      'Reserve tempo para revisar'
    ]
  },
  {
    title: 'Estratégias de Resolução 🎓',
    description: 'Leia cada questão com atenção. Elimine alternativas absurdas. Revise suas respostas se sobrar tempo.',
    icon: Target,
    tips: [
      'Leia o enunciado duas vezes',
      'Elimine alternativas incorretas',
      'Confie em seu preparo'
    ]
  },
  {
    title: 'Análise dos Resultados 📊',
    description: 'Após finalizar, analise seu desempenho detalhado. Veja acertos por matéria, tempo gasto e comparação com outros alunos.',
    icon: BarChart3,
    tips: [
      'Revise todas as questões erradas',
      'Identifique suas matérias fracas',
      'Use os resultados para estudar melhor'
    ]
  }
]

export function SimulationsTutorial({ onClose }: SimulationsTutorialProps) {
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
