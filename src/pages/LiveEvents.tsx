import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Radio, Calendar, Video, Youtube, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUpcomingLives, type LiveEvent, type LiveEventProvider } from '@/services/liveEventService'
import { SectionLoader } from '@/components/SectionLoader'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase/client'

const providerConfig: Record<LiveEventProvider, { label: string; icon: typeof Radio; color: string }> = {
  panda: { label: 'Panda Video', icon: Video, color: 'text-blue-500' },
  youtube: { label: 'YouTube', icon: Youtube, color: 'text-red-500' },
  meet: { label: 'Google Meet', icon: ExternalLink, color: 'text-green-500' },
}

const statusConfig: Record<string, { label: string; className: string }> = {
  live: { label: 'Ao Vivo', className: 'bg-red-500 text-white animate-pulse' },
  scheduled: { label: 'Agendada', className: 'bg-blue-100 text-blue-500 border-blue-300' },
  ended: { label: 'Encerrada', className: 'bg-muted text-muted-foreground' },
}

export default function LiveEventsPage() {
  const [lives, setLives] = useState<LiveEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLives()

    const channel = supabase
      .channel('live-events-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_events' },
        () => loadLives()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const loadLives = async () => {
    const data = await getUpcomingLives()
    setLives(data)
    setLoading(false)
  }

  if (loading) return <SectionLoader />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Aulas ao Vivo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhe as aulas ao vivo e agendadas
        </p>
      </div>

      {lives.length === 0 ? (
        <Card className="border-border shadow-sm">
          <CardContent className="text-center py-12">
            <Radio className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma aula ao vivo agendada no momento.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lives.map((live) => {
            const provider = providerConfig[live.provider]
            const status = statusConfig[live.status] || statusConfig.scheduled
            const ProviderIcon = provider.icon

            return (
              <Card key={live.id} className={cn(
                'border-border shadow-sm transition-all hover:shadow-md',
                live.status === 'live' && 'border-red-300 ring-1 ring-red-500/20'
              )}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <Badge className={status.className}>{status.label}</Badge>
                    <ProviderIcon className={cn('h-4 w-4', provider.color)} />
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground">{live.title}</h3>
                    {live.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{live.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(new Date(live.scheduled_start), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                  </div>

                  {live.classes?.name && (
                    <p className="text-xs text-muted-foreground">
                      Turma: <span className="font-medium text-foreground">{live.classes.name}</span>
                    </p>
                  )}

                  <Button
                    className="w-full gap-2 min-h-[44px]"
                    variant={live.status === 'live' ? 'destructive' : 'outline'}
                    asChild
                  >
                    <Link to={`/lives/${live.id}`}>
                      {live.status === 'live' ? (
                        <>
                          <Radio className="h-4 w-4" />
                          Assistir Agora
                        </>
                      ) : (
                        'Ver Detalhes'
                      )}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
