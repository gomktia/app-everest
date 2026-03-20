import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Calendar, Radio, User, Users, Clock } from 'lucide-react'
import { getLiveEvent, type LiveEvent } from '@/services/liveEventService'
import { getPandaLiveViewers } from '@/services/pandaLiveService'
import { LivePlayerEmbed } from '@/components/LivePlayerEmbed'
import { SectionLoader } from '@/components/SectionLoader'
import { useToast } from '@/hooks/use-toast'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase/client'

export default function LivePlayerPage() {
  const { liveId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [live, setLive] = useState<LiveEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewerCount, setViewerCount] = useState<number | null>(null)
  const viewerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!liveId) return
    loadLive()

    const channel = supabase
      .channel(`live-event-${liveId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_events', filter: `id=eq.${liveId}` },
        (payload) => {
          setLive(prev => prev ? { ...prev, ...payload.new } as LiveEvent : null)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (viewerIntervalRef.current) clearInterval(viewerIntervalRef.current)
    }
  }, [liveId])

  // Poll viewer count when live is active
  useEffect(() => {
    if (live?.status !== 'live' || !live.panda_live_id) {
      setViewerCount(null)
      if (viewerIntervalRef.current) clearInterval(viewerIntervalRef.current)
      return
    }

    const fetchViewers = async () => {
      try {
        const data = await getPandaLiveViewers(live.panda_live_id!)
        setViewerCount(data.viewers)
      } catch { /* ignore */ }
    }

    fetchViewers()
    viewerIntervalRef.current = setInterval(fetchViewers, 15000) // Every 15s

    return () => {
      if (viewerIntervalRef.current) clearInterval(viewerIntervalRef.current)
    }
  }, [live?.status, live?.panda_live_id])

  const loadLive = async () => {
    const data = await getLiveEvent(liveId!)
    if (!data) {
      toast({ title: 'Erro', description: 'Aula ao vivo não encontrada', variant: 'destructive' })
      navigate('/lives')
      return
    }
    setLive(data)
    setLoading(false)
  }

  if (loading) return <SectionLoader />
  if (!live) return null

  const isLive = live.status === 'live'
  const isScheduled = live.status === 'scheduled'

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" asChild>
          <Link to="/lives"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-foreground truncate">{live.title}</h1>
            {isLive && (
              <Badge className="bg-red-500 text-white animate-pulse shrink-0" role="status">
                <Radio className="h-3 w-3 mr-1" />
                Ao Vivo
              </Badge>
            )}
            {isScheduled && (
              <Badge variant="outline" className="text-blue-500 border-blue-300 dark:border-blue-800 shrink-0">Agendada</Badge>
            )}
            {live.status === 'ended' && (
              <Badge variant="outline" className="shrink-0">Encerrada</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 sm:gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(live.scheduled_start), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
            {live.users && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {live.users.first_name} {live.users.last_name}
              </span>
            )}
            {isLive && viewerCount !== null && (
              <span className="flex items-center gap-1 text-red-500 font-medium">
                <Users className="h-3 w-3" />
                {viewerCount} assistindo
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Player or waiting state */}
      {isLive ? (
        <LivePlayerEmbed provider={live.provider} streamUrl={live.stream_url} title={live.title} />
      ) : isScheduled ? (
        <Card className="border-border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 space-y-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center">
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground">Aula ainda não começou</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Início previsto: {format(new Date(live.scheduled_start), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDistanceToNow(new Date(live.scheduled_start), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 space-y-4">
            <Radio className="h-12 w-12 text-muted-foreground/30" />
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground">Aula encerrada</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {live.recording_published
                  ? 'A gravação está disponível nos seus cursos.'
                  : 'A gravação será disponibilizada em breve.'}
              </p>
            </div>
            {live.recording_published && live.course_id && (
              <Button variant="outline" asChild>
                <Link to={`/courses/${live.course_id}`}>Ver Gravação no Curso</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Description */}
      {live.description && (
        <Card className="border-border shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-foreground mb-2">Descrição</h3>
            <p className="text-sm text-muted-foreground">{live.description}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
