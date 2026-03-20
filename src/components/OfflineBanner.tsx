import { WifiOff } from 'lucide-react'

interface OfflineBannerProps {
  fromCache: boolean
  cachedAt?: number | null
}

/**
 * Banner sutil exibido quando dados vêm do cache offline.
 */
export function OfflineBanner({ fromCache, cachedAt }: OfflineBannerProps) {
  if (!fromCache) return null

  const timeAgo = cachedAt
    ? formatTimeAgo(cachedAt)
    : ''

  return (
    <div className="flex items-center gap-2 rounded-lg bg-amber-100 border border-amber-300 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>
        Modo offline — exibindo dados do último acesso{timeAgo ? ` (${timeAgo})` : ''}
      </span>
    </div>
  )
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes}min atrás`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h atrás`
  const days = Math.floor(hours / 24)
  return `${days}d atrás`
}
