import { Check } from 'lucide-react'

export function BestAnswerBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-950/50 text-green-600 border border-green-300 dark:border-green-800">
      <Check className="h-3 w-3" />
      Melhor Resposta
    </span>
  )
}
