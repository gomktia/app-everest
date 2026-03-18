import { useCallback } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { HelpCircle } from 'lucide-react'

const TOUR_STEPS = [
  {
    element: '[data-tour="video-player"]',
    popover: {
      title: 'Player de Vídeo',
      description: 'Aqui você assiste suas aulas. Use os controles do player para pausar, ajustar volume e velocidade.',
    },
  },
  {
    element: '[data-tour="theater-mode"]',
    popover: {
      title: 'Apagar Luz',
      description: 'Escurece toda a tela ao redor do vídeo para você focar sem distrações. Pressione ESC para sair.',
    },
  },
  {
    element: '[data-tour="auto-play"]',
    popover: {
      title: 'Auto-Play',
      description: 'Quando ativado, a próxima aula começa automaticamente 5 segundos após o vídeo terminar.',
    },
  },
  {
    element: '[data-tour="complete-lesson"]',
    popover: {
      title: 'Concluir Aula (+10 XP)',
      description: 'Marque a aula como concluída e ganhe 10 pontos de experiência! Seu progresso é salvo automaticamente.',
    },
  },
  {
    element: '[data-tour="attachments-btn"]',
    popover: {
      title: 'Arquivos da Aula',
      description: 'Abra PDFs e apresentações ao lado do vídeo em tela dividida, ou baixe para estudar depois.',
    },
  },
  {
    element: '[data-tour="notebook-btn"]',
    popover: {
      title: 'Caderno Digital',
      description: 'Faça anotações de texto ou desenhe com mesa digitalizadora. Tudo é salvo automaticamente e fica disponível em "Minhas Anotações".',
    },
  },
  {
    element: '[data-tour="comments-btn"]',
    popover: {
      title: 'Comentários (+5 XP)',
      description: 'Tire dúvidas e interaja com outros alunos. Cada comentário rende 5 XP!',
    },
  },
  {
    element: '[data-tour="rating"]',
    popover: {
      title: 'Avalie a Aula (+3 XP)',
      description: 'Dê sua nota para a aula e ganhe 3 XP. Sua avaliação ajuda o professor a melhorar o conteúdo.',
    },
  },
  {
    element: '[data-tour="sidebar-toggle"]',
    popover: {
      title: 'Sidebar de Módulos',
      description: 'Veja todas as aulas do módulo, busque por título e acompanhe seu progresso. Pode ser colapsada para mais espaço.',
    },
  },
  {
    element: '[data-tour="lesson-nav"]',
    popover: {
      title: 'Navegação entre Aulas',
      description: 'Use os botões para ir para a aula anterior ou próxima rapidamente.',
    },
  },
]

export function LessonTourButton() {
  const startTour = useCallback(() => {
    const d = driver({
      showProgress: true,
      animate: true,
      overlayColor: 'rgba(0, 0, 0, 0.75)',
      stagePadding: 8,
      stageRadius: 12,
      popoverClass: 'lesson-tour-popover',
      nextBtnText: 'Próximo',
      prevBtnText: 'Anterior',
      doneBtnText: 'Entendi!',
      progressText: '{{current}} de {{total}}',
      steps: TOUR_STEPS,
    })
    d.drive()
  }, [])

  return (
    <button
      onClick={startTour}
      className="p-2.5 rounded-lg text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-all"
      title="Tutorial da página"
    >
      <HelpCircle className="h-5 w-5" />
    </button>
  )
}
