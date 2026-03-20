import { ShieldCheck } from 'lucide-react'

export function OfficialBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-600 border border-blue-300">
      <ShieldCheck className="h-3 w-3" />
      Resposta Oficial
    </span>
  )
}
