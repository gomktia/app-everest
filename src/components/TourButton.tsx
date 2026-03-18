import { useCallback } from 'react'
import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import { HelpCircle } from 'lucide-react'

interface TourButtonProps {
  steps: DriveStep[]
  className?: string
}

export function TourButton({ steps, className }: TourButtonProps) {
  const startTour = useCallback(() => {
    // Filter out steps whose target elements don't exist on the page
    const availableSteps = steps.filter(step => {
      if (!step.element) return true
      return document.querySelector(step.element as string) !== null
    })
    if (availableSteps.length === 0) return

    const d = driver({
      showProgress: true,
      animate: true,
      overlayColor: 'rgba(0, 0, 0, 0.75)',
      stagePadding: 8,
      stageRadius: 12,
      nextBtnText: 'Próximo',
      prevBtnText: 'Anterior',
      doneBtnText: 'Entendi!',
      progressText: '{{current}} de {{total}}',
      steps: availableSteps,
    })
    d.drive()
  }, [steps])

  return (
    <button
      onClick={startTour}
      className={className ?? "p-2.5 rounded-lg text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-all"}
      title="Tutorial da página"
    >
      <HelpCircle className="h-5 w-5" />
    </button>
  )
}
