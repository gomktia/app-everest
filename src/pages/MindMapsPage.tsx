import { useState, useEffect, useMemo } from 'react'
import { Network, Search, BookOpen, Layers, Target } from 'lucide-react'
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
import { TourButton } from '@/components/TourButton'
import type { DriveStep } from 'driver.js'

// ─── Tour Steps ──────────────────────────────────────────────────────────────

const MIND_MAPS_TOUR_STEPS: DriveStep[] = [
  { element: '[data-tour="mm-stats"]', popover: { title: 'Estatísticas', description: 'Veja quantas matérias, mapas e conceitos estão disponíveis.' } },
  { element: '[data-tour="mm-filters"]', popover: { title: 'Filtros', description: 'Filtre por matéria ou busque pelo nome do mapa mental.' } },
  { element: '[data-tour="mm-card"]', popover: { title: 'Card de Mapa Mental', description: 'Clique para abrir o mapa mental interativo. Você pode expandir e colapsar os tópicos.' } },
]

// ─── Subject colour palette ──────────────────────────────────────────────────

const SUBJECT_TW_COLOURS = [
  'blue', 'purple', 'rose', 'orange',
  'amber', 'emerald', 'cyan', 'red',
] as const

function getSubjectTwColour(subject: string, subjects: string[]): string {
  const idx = subjects.indexOf(subject)
  return SUBJECT_TW_COLOURS[idx % SUBJECT_TW_COLOURS.length]
}

// ─── Page ────────────────────────────────────────────────────────────────────

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

  const totalConcepts = useMemo(
    () => mindMaps.reduce((sum, m) => sum + mindMapService.countNodes(m.data?.nodes ?? []), 0),
    [mindMaps],
  )

  if (isLoading) return <SectionLoader />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mapas Mentais</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visualize conceitos de forma interativa e acelere sua revisão
          </p>
        </div>
        <TourButton steps={MIND_MAPS_TOUR_STEPS} />
      </div>

      {/* Stats */}
      <div data-tour="mm-stats" className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-blue-500/30">
          <CardContent className="p-2.5 sm:p-4 text-center">
            <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 mx-auto mb-1" />
            <div className="text-lg sm:text-xl font-bold text-foreground">{subjects.length}</div>
            <div className="text-[11px] sm:text-xs text-muted-foreground">Matérias</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-purple-500/30">
          <CardContent className="p-2.5 sm:p-4 text-center">
            <Layers className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 mx-auto mb-1" />
            <div className="text-lg sm:text-xl font-bold text-foreground">{mindMaps.length}</div>
            <div className="text-[11px] sm:text-xs text-muted-foreground">Mapas</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm transition-all duration-200 hover:shadow-md hover:border-green-500/30">
          <CardContent className="p-2.5 sm:p-4 text-center">
            <Target className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mx-auto mb-1" />
            <div className="text-lg sm:text-xl font-bold text-foreground">{totalConcepts}</div>
            <div className="text-[11px] sm:text-xs text-muted-foreground">Conceitos</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div data-tour="mm-filters" className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar mapas mentais..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="pl-9"
            />
          </div>
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
                className="h-7 text-xs rounded-full"
                onClick={() => setSelectedSubject(sub === selectedSubject ? null : sub)}
              >
                {sub}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card className="border-border shadow-sm">
          <CardContent className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Network className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Nenhum mapa mental encontrado</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {selectedSubject || searchText
                ? 'Tente limpar os filtros para ver todos os mapas disponíveis.'
                : 'Os mapas mentais serão adicionados em breve.'}
            </p>
            {(selectedSubject || searchText) && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => { setSelectedSubject(null); setSearchText('') }}
              >
                Limpar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((map, idx) => {
            const twColor = getSubjectTwColour(map.subject, subjects)
            const nodeCount = mindMapService.countNodes(map.data?.nodes ?? [])
            return (
              <Card
                key={map.id}
                data-tour={idx === 0 ? 'mm-card' : undefined}
                className={cn(
                  'cursor-pointer border-border shadow-sm transition-all duration-200',
                  'hover:shadow-md hover:border-primary/30',
                )}
                onClick={() => setOpenMap(map)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="p-2.5 rounded-xl bg-primary/10">
                      <Network className="h-5 w-5 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {map.subject}
                    </Badge>
                  </div>

                  <h3 className="font-semibold text-foreground leading-snug line-clamp-2 mb-2">
                    {map.title}
                  </h3>

                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <BookOpen className="h-3 w-3" />
                    <span>{nodeCount} {nodeCount === 1 ? 'conceito' : 'conceitos'}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Viewer Dialog */}
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
