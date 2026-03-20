import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getActiveLives, type LiveEvent } from '@/services/liveEventService'
import { supabase } from '@/lib/supabase/client'

export function LiveBanner() {
  const [activeLives, setActiveLives] = useState<LiveEvent[]>([])

  useEffect(() => {
    getActiveLives().then(setActiveLives)

    const channel = supabase
      .channel('live-events-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_events' },
        () => {
          getActiveLives().then(setActiveLives)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (activeLives.length === 0) return null

  const live = activeLives[0]

  return (
    <div className="relative overflow-hidden rounded-lg border border-red-300 bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex items-center justify-center shrink-0" aria-hidden="true">
            <Radio className="h-5 w-5 text-red-500" />
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground" role="status" aria-live="polite">
              Ao Vivo{activeLives.length > 1 ? ` (${activeLives.length})` : ''}
            </p>
            <p className="text-xs text-muted-foreground truncate">{live.title}</p>
          </div>
        </div>
        <Button size="sm" variant="destructive" className="shrink-0" asChild>
          <Link to={`/lives/${live.id}`}>Assistir</Link>
        </Button>
      </div>
    </div>
  )
}
