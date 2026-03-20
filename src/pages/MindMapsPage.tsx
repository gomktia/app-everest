import { useState, useEffect, useMemo } from 'react'
import { Network, Search, Sparkles, BookOpen } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SectionLoader } from '@/components/SectionLoader'
import { MindMapViewer } from '@/components/mind-maps/MindMapViewer'
import { mindMapService, type MindMap } from '@/services/mindMapService'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'
import { logger } from '@/lib/logger'

// ─── Subject colour palette ───────────────────────────────────────────────────

const SUBJECT_COLOURS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6',
  '#f43f5e', '#a855f7', '#06b6d4', '#84cc16',
]

const SUBJECT_TW_COLOURS = [
  'purple', 'purple', 'rose', 'orange',
  'amber', 'emerald', 'cyan', 'blue',
  'red', 'purple', 'cyan', 'emerald',
] as const

function getSubjectColour(subject: string, subjects: string[]): string {
  const idx = subjects.indexOf(subject)
  return SUBJECT_COLOURS[idx % SUBJECT_COLOURS.length]
}

function getSubjectTwColour(subject: string, subjects: string[]): string {
  const idx = subjects.indexOf(subject)
  return SUBJECT_TW_COLOURS[idx % SUBJECT_TW_COLOURS.length]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MindMapsPage() {
  usePageTitle('Mapas Mentais')

  const [mindMaps, setMindMaps] = useState<MindMap[]>([])
  const [subjects, setSubjects] = useState<string[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [openMap, setOpenMap] = useState<MindMap | null>(null)

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        const [maps, subs] = await Promise.all([
          mindMapService.getAll(),
          mindMapService.getSubjects(),
        ])
        setMindMaps(maps)
        setSubjects(subs)
      } catch (err) {
        logger.error('Error loading mind maps', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    let list = mindMaps
    if (selectedSubject) {
      list = list.filter(m => m.subject === selectedSubject)
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      list = list.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.subject.toLowerCase().includes(q) ||
        m.topic.toLowerCase().includes(q),
      )
    }
    return list
  }, [mindMaps, selectedSubject, searchText])

  if (isLoading) return <SectionLoader />

  return (
    <div className="container py-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Network className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mapas Mentais</h1>
            <p className="text-sm text-muted-foreground">
              Visualize conceitos de forma interativa
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          <span>{mindMaps.length} {mindMaps.length === 1 ? 'mapa' : 'mapas'} disponíveis</span>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar mapas mentais..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Subject chips */}
        {subjects.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedSubject === null ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs rounded-full"
              onClick={() => setSelectedSubject(null)}
            >
              Todos
            </Button>
            {subjects.map(sub => (
              <Button
                key={sub}
                variant={selectedSubject === sub ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'h-7 text-xs rounded-full transition-colors',
                  selectedSubject === sub && 'text-white',
                )}
                style={selectedSubject === sub ? { backgroundColor: getSubjectColour(sub, subjects), borderColor: getSubjectColour(sub, subjects) } : {}}
                onClick={() => setSelectedSubject(sub === selectedSubject ? null : sub)}
              >
                {sub}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-3">
          <Network className="h-12 w-12 opacity-30" />
          <p className="text-base font-medium">Nenhum mapa mental disponível ainda</p>
          {(selectedSubject || searchText) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSelectedSubject(null); setSearchText('') }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(map => {
            const colour = map.color ?? getSubjectColour(map.subject, subjects)
            const nodeCount = mindMapService.countNodes(map.data?.nodes ?? [])
            return (
              <Card
                key={map.id}
                className="cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg border-border/60"
                onClick={() => setOpenMap(map)}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Icon + subject row */}
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="p-2 rounded-lg shrink-0"
                      style={{ backgroundColor: `${colour}22` }}
                    >
                      <Network className="h-5 w-5" style={{ color: colour }} />
                    </div>
                    <Badge
                      variant="outline"
                      className="text-xs shrink-0"
                      style={{ borderColor: colour, color: colour }}
                    >
                      {map.subject}
                    </Badge>
                  </div>

                  {/* Title */}
                  <p className="font-semibold text-sm leading-snug line-clamp-2">{map.title}</p>

                  {/* Node count */}
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    {nodeCount} {nodeCount === 1 ? 'conceito' : 'conceitos'}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Viewer Dialog ── */}
      <Dialog open={!!openMap} onOpenChange={open => { if (!open) setOpenMap(null) }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Network className="h-5 w-5 text-primary" />
              {openMap?.title}
            </DialogTitle>
          </DialogHeader>
          {openMap && (
            <MindMapViewer
              title={openMap.title}
              subject={openMap.subject}
              color={getSubjectTwColour(openMap.subject, subjects)}
              nodes={openMap.data?.nodes ?? []}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
