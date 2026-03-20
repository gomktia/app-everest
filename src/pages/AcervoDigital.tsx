import { useEffect, useState, useMemo, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  FileText,
  Archive,
  BookOpen,
  Search,
  Download,
  Eye,
  ChevronRight,
  X,
  ClipboardList,
  Calendar,
  FolderOpen,
  ArrowLeft,
  LayoutGrid,
  List,
  Loader2,
  Shield,
  Lock,
} from 'lucide-react'
import { SectionLoader } from '@/components/SectionLoader'
import { cn } from '@/lib/utils'
import { acervoService, type AcervoItem, type ProvaGroup } from '@/services/acervoService'
import { logger } from '@/lib/logger'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useContentAccess } from '@/hooks/useContentAccess'
import { cachedFetch } from '@/lib/offlineCache'
import { OfflineBanner } from '@/components/OfflineBanner'
import { TourButton } from '@/components/TourButton'
import type { DriveStep } from 'driver.js'

const CONCURSO_COLORS: Record<string, { bg: string; text: string; badge: string; border: string; btn: string; hoverBorder: string }> = {
  livros: { bg: 'bg-emerald-100', text: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-500', border: 'border-emerald-300', btn: 'bg-emerald-600 hover:bg-green-600', hoverBorder: 'hover:border-emerald-500/40' },
  apostilas: { bg: 'bg-amber-100', text: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-500', border: 'border-amber-300', btn: 'bg-amber-600 hover:bg-green-600', hoverBorder: 'hover:border-amber-500/40' },
  exercicios: { bg: 'bg-violet-100', text: 'text-violet-600 dark:text-violet-400', badge: 'bg-violet-500', border: 'border-violet-300', btn: 'bg-violet-600 hover:bg-green-600', hoverBorder: 'hover:border-violet-500/40' },
  regulamentos: { bg: 'bg-red-100', text: 'text-red-600 dark:text-red-400', badge: 'bg-red-500', border: 'border-red-300', btn: 'bg-red-600 hover:bg-green-600', hoverBorder: 'hover:border-red-500/40' },
  mapas_mentais: { bg: 'bg-teal-100', text: 'text-teal-600 dark:text-teal-400', badge: 'bg-teal-500', border: 'border-teal-300', btn: 'bg-teal-600 hover:bg-green-600', hoverBorder: 'hover:border-teal-500/40' },
  EAOF: { bg: 'bg-blue-100', text: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-500', border: 'border-blue-300', btn: 'bg-blue-600 hover:bg-green-600', hoverBorder: 'hover:border-blue-500/40' },
  EAOP: { bg: 'bg-emerald-100', text: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-500', border: 'border-emerald-300', btn: 'bg-emerald-600 hover:bg-green-600', hoverBorder: 'hover:border-emerald-500/40' },
  CAMAR: { bg: 'bg-purple-100', text: 'text-purple-600 dark:text-purple-400', badge: 'bg-purple-500', border: 'border-purple-300', btn: 'bg-purple-600 hover:bg-green-600', hoverBorder: 'hover:border-purple-500/40' },
  CADAR: { bg: 'bg-orange-100', text: 'text-orange-600 dark:text-orange-400', badge: 'bg-orange-500', border: 'border-orange-300', btn: 'bg-orange-600 hover:bg-green-600', hoverBorder: 'hover:border-orange-500/40' },
  CAFAR: { bg: 'bg-rose-100', text: 'text-rose-600 dark:text-rose-400', badge: 'bg-rose-500', border: 'border-rose-300', btn: 'bg-rose-600 hover:bg-green-600', hoverBorder: 'hover:border-rose-500/40' },
  CFOE: { bg: 'bg-cyan-100', text: 'text-cyan-600 dark:text-cyan-400', badge: 'bg-cyan-500', border: 'border-cyan-300', btn: 'bg-cyan-600 hover:bg-green-600', hoverBorder: 'hover:border-cyan-500/40' },
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '—'
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`
}

// Category that was selected to browse files
interface SelectedCategory {
  type: 'livros' | 'provas' | 'apostilas' | 'exercicios' | 'regulamentos' | 'mapas_mentais'
  label: string
  concurso?: string
  items: AcervoItem[]
  group?: ProvaGroup
}

const ACERVO_TOUR_STEPS: DriveStep[] = [
  {
    element: '[data-tour="acervo-categories"]',
    popover: {
      title: 'Categorias',
      description: 'Navegue pelas categorias: Livros, Provas, Apostilas, Exercicios e mais. Clique em "Ver arquivos" para abrir.',
    },
  },
  {
    element: '[data-tour="acervo-search"]',
    popover: {
      title: 'Busca',
      description: 'Pesquise materiais pelo nome para encontrar rapidamente o que precisa.',
    },
  },
  {
    element: '[data-tour="acervo-stats"]',
    popover: {
      title: 'Estatisticas',
      description: 'Veja o total de materiais disponiveis, livros e provas no acervo.',
    },
  },
]

export default function AcervoDigitalPage() {
  const { isStudent } = useAuth()
  const { isRestricted: catRestricted, isAllowed: isCatAllowed, loading: catLoading } = useContentAccess('acervo_category')
  const { isRestricted: concRestricted, isAllowed: isConcAllowed, loading: concLoading } = useContentAccess('acervo_concurso')
  const [livros, setLivros] = useState<AcervoItem[]>([])
  const [provas, setProvas] = useState<AcervoItem[]>([])
  const [apostilas, setApostilas] = useState<AcervoItem[]>([])
  const [exercicios, setExercicios] = useState<AcervoItem[]>([])
  const [regulamentos, setRegulamentos] = useState<AcervoItem[]>([])
  const [mapasMentais, setMapasMentais] = useState<AcervoItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewingFile, setViewingFile] = useState<AcervoItem | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<SelectedCategory | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [viewerBlobUrl, setViewerBlobUrl] = useState<string | null>(null)
  const [viewerLoading, setViewerLoading] = useState(false)
  const { toast } = useToast()

  const handleDownloadWithWatermark = useCallback(async (item: AcervoItem) => {
    if (item.file_type !== 'pdf') {
      // Non-PDF: download direto
      window.open(acervoService.getPublicUrl(item.file_path), '_blank')
      return
    }
    setDownloadingId(item.id)
    try {
      await acervoService.downloadWithWatermark(item.file_path, `${item.title}.pdf`)
    } catch {
      toast({ title: 'Erro ao baixar', description: 'Tente novamente.', variant: 'destructive' })
    } finally {
      setDownloadingId(null)
    }
  }, [toast])

  const handleViewWithWatermark = useCallback(async (item: AcervoItem) => {
    if (item.file_type !== 'pdf') {
      window.open(acervoService.getPublicUrl(item.file_path), '_blank')
      return
    }
    setViewingFile(item)
    setViewerLoading(true)
    setViewerBlobUrl(null)
    try {
      const blobUrl = await acervoService.viewWithWatermark(item.file_path)
      setViewerBlobUrl(blobUrl)
    } catch {
      toast({ title: 'Erro ao carregar PDF', description: 'Tente novamente.', variant: 'destructive' })
      setViewingFile(null)
    } finally {
      setViewerLoading(false)
    }
  }, [toast])

  const handleCloseViewer = useCallback(() => {
    setViewingFile(null)
    if (viewerBlobUrl) {
      URL.revokeObjectURL(viewerBlobUrl)
      setViewerBlobUrl(null)
    }
  }, [viewerBlobUrl])

  const [fromCache, setFromCache] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true)
        const result = await cachedFetch('acervo-digital', () =>
          Promise.all([
            acervoService.getLivros(),
            acervoService.getProvas(),
            acervoService.getByCategory('apostila'),
            acervoService.getByCategory('exercicio'),
            acervoService.getByCategory('regulamento'),
            acervoService.getByCategory('mapa_mental'),
          ])
        )
        const [l, p, a, e, r, m] = result.data
        setLivros(l)
        setProvas(p)
        setApostilas(a)
        setExercicios(e)
        setRegulamentos(r)
        setMapasMentais(m)
        setFromCache(result.fromCache)
      } catch (err) {
        logger.error('Error loading acervo:', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const provaGroups = useMemo(() => acervoService.groupProvasByConcurso(provas), [provas])

  const filteredLivros = useMemo(() => {
    if (!search) return livros
    const q = search.toLowerCase()
    return livros.filter(l => l.title.toLowerCase().includes(q))
  }, [livros, search])

  const filteredProvaGroups = useMemo((): ProvaGroup[] => {
    if (!search) return provaGroups
    const q = search.toLowerCase()
    return provaGroups
      .map(group => ({
        ...group,
        subcategories: group.subcategories
          .map(sub => ({
            ...sub,
            years: sub.years
              .map(y => ({
                ...y,
                items: y.items.filter(i =>
                  i.title.toLowerCase().includes(q) ||
                  group.concurso.toLowerCase().includes(q)
                )
              }))
              .filter(y => y.items.length > 0)
          }))
          .filter(s => s.years.length > 0)
      }))
      .filter(g => g.subcategories.length > 0)
  }, [provaGroups, search])

  const totalItems = livros.length + provas.length + apostilas.length + exercicios.length + regulamentos.length + mapasMentais.length

  function getFileUrl(item: AcervoItem): string {
    return acervoService.getPublicUrl(item.file_path)
  }

  function getAllItemsFromGroup(group: ProvaGroup): AcervoItem[] {
    return group.subcategories.flatMap(sub => sub.years.flatMap(y => y.items))
  }

  if (isLoading || catLoading || concLoading) {
    return <SectionLoader />
  }

  // If a category is selected, show the file browser view
  if (selectedCategory) {
    const colors = CONCURSO_COLORS[selectedCategory.concurso || 'livros'] || CONCURSO_COLORS.livros
    const group = selectedCategory.group

    return (
      <div className="space-y-6">
        {/* Back + Header */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground mb-3 -ml-2"
            onClick={() => setSelectedCategory(null)}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Acervo
          </Button>
          <div className="flex items-center gap-3">
            <div className={cn('p-2.5 rounded-lg', colors.bg)}>
              {selectedCategory.type === 'livros' ? (
                <BookOpen className={cn('h-5 w-5', colors.text)} />
              ) : (
                <ClipboardList className={cn('h-5 w-5', colors.text)} />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{selectedCategory.label}</h1>
              <p className="text-sm text-muted-foreground">
                {selectedCategory.items.length} {selectedCategory.items.length === 1 ? 'arquivo' : 'arquivos'}
                {group && ` · ${group.yearRange}`}
              </p>
            </div>
          </div>
        </div>

        {/* Search + View Toggle */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nesta categoria..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
            <Button
              size="sm"
              variant="ghost"
              className={cn('h-8 px-2.5', viewMode === 'grid' && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground')}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={cn('h-8 px-2.5', viewMode === 'list' && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground')}
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Files content */}
        {(() => {
          // Get filtered items for flat views
          const flatItems = selectedCategory.type === 'livros'
            ? (search ? selectedCategory.items.filter(i => i.title.toLowerCase().includes(search.toLowerCase())) : selectedCategory.items)
            : (search ? selectedCategory.items.filter(i => i.title.toLowerCase().includes(search.toLowerCase())) : selectedCategory.items)

          // GRID VIEW
          if (viewMode === 'grid') {
            return (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {flatItems.map((item) => (
                  <div
                    key={item.id}
                    className={cn('group relative flex flex-col rounded-xl border bg-card p-4 transition-all duration-200 shadow-sm hover:shadow-lg', colors.border, colors.hoverBorder)}
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <div className={cn('p-2 rounded-lg shrink-0', colors.bg)}>
                        <FileText className={cn('h-4 w-4', colors.text)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-sm text-foreground leading-tight line-clamp-2">
                          {item.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatFileSize(item.file_size)} &middot; {item.file_type.toUpperCase()}
                          {item.year && ` · ${item.year}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        className={cn('flex-1 h-8 text-xs gap-1.5 text-white hover:bg-green-600 hover:shadow-md', colors.btn.split(' ')[0])}
                        onClick={() => handleViewWithWatermark(item)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ler
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 hover:bg-green-600 hover:text-white hover:border-green-600"
                        onClick={() => handleDownloadWithWatermark(item)}
                        disabled={downloadingId === item.id}
                      >
                        {downloadingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          }

          // LIST VIEW
          if (selectedCategory.type === 'provas' && group) {
            // Provas: grouped by subcategory/year
            return (
              <div className="space-y-6">
                {group.subcategories.map((sub, subIdx) => {
                  const filteredYears = search
                    ? sub.years.map(y => ({
                        ...y,
                        items: y.items.filter(i => i.title.toLowerCase().includes(search.toLowerCase()))
                      })).filter(y => y.items.length > 0)
                    : sub.years

                  if (filteredYears.length === 0) return null

                  return (
                    <div key={subIdx}>
                      {sub.name && (
                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border/60">
                          <FolderOpen className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-semibold text-muted-foreground">{sub.name}</span>
                        </div>
                      )}
                      <div className="space-y-4">
                        {filteredYears.map(yearGroup => (
                          <div key={yearGroup.year}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold', colors.bg, colors.text)}>
                                <Calendar className="h-3 w-3" />
                                {yearGroup.year}
                              </span>
                              <div className="flex-1 h-px bg-border/40" />
                              <span className="text-xs text-muted-foreground">{yearGroup.items.length} {yearGroup.items.length === 1 ? 'arquivo' : 'arquivos'}</span>
                            </div>
                            <div className="rounded-lg border border-border overflow-hidden bg-card">
                              {yearGroup.items.map((item, itemIdx) => (
                                <div
                                  key={item.id}
                                  className={cn(
                                    'flex items-center justify-between gap-3 p-2.5 border-l-2 border-l-transparent hover:border-l-primary hover:bg-muted/40 dark:hover:bg-white/[0.06] transition-all duration-200 group/item',
                                    itemIdx % 2 === 0 ? 'bg-card' : 'bg-muted/80 dark:bg-white/[0.04]'
                                  )}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className={cn('p-1.5 rounded-md shrink-0', colors.bg)}>
                                      <FileText className={cn('h-3.5 w-3.5', colors.text)} />
                                    </div>
                                    <div className="min-w-0">
                                      <span className="text-sm font-medium text-foreground truncate block">{item.title}</span>
                                      <span className="text-[11px] text-muted-foreground">
                                        {formatFileSize(item.file_size)} &middot; {item.file_type.toUpperCase()}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex gap-1.5 shrink-0">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-3 text-xs gap-1.5 opacity-70 group-hover/item:opacity-100 hover:bg-green-600 hover:text-white hover:border-green-600 transition-all"
                                      onClick={() => handleViewWithWatermark(item)}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      Ler
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-2 opacity-70 group-hover/item:opacity-100 hover:bg-green-600 hover:text-white hover:border-green-600 transition-all"
                                      onClick={() => handleDownloadWithWatermark(item)}
                                      disabled={downloadingId === item.id}
                                    >
                                      {downloadingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          }

          // Livros list view (flat)
          return (
            <div className="rounded-lg border border-border overflow-hidden bg-card">
              {flatItems.map((item, itemIdx) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center justify-between gap-3 p-2.5 border-l-2 border-l-transparent hover:border-l-primary hover:bg-muted/40 dark:hover:bg-white/[0.06] transition-all duration-200 group/item',
                    itemIdx % 2 === 0 ? 'bg-card' : 'bg-muted/80 dark:bg-white/[0.04]'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn('p-1.5 rounded-md shrink-0', colors.bg)}>
                      <FileText className={cn('h-3.5 w-3.5', colors.text)} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-foreground truncate block">{item.title}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatFileSize(item.file_size)} &middot; {item.file_type.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs gap-1.5 opacity-70 group-hover/item:opacity-100 hover:bg-green-600 hover:text-white hover:border-green-600 transition-all"
                      onClick={() => handleViewWithWatermark(item)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ler
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 opacity-70 group-hover/item:opacity-100 hover:bg-green-600 hover:text-white hover:border-green-600 transition-all"
                      asChild
                    >
                      <a href={getFileUrl(item)} download target="_blank" rel="noopener noreferrer">
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        })()}

        {/* PDF Viewer Dialog */}
        <Dialog open={!!viewingFile} onOpenChange={open => !open && handleCloseViewer()}>
          <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] max-h-[92vh] p-0 gap-0 overflow-hidden">
            {viewingFile && (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-sm truncate">{viewingFile.title}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      <Shield className="h-2.5 w-2.5" />
                      Protegido
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => handleDownloadWithWatermark(viewingFile)}
                      disabled={downloadingId === viewingFile.id}
                    >
                      {downloadingId === viewingFile.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      Baixar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={handleCloseViewer}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {viewerLoading ? (
                  <div className="flex-1 flex items-center justify-center" style={{ height: 'calc(92vh - 52px)' }}>
                    <div className="text-center space-y-3">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                      <p className="text-sm text-muted-foreground">Aplicando proteção ao documento...</p>
                    </div>
                  </div>
                ) : viewerBlobUrl ? (
                  <iframe
                    src={viewerBlobUrl}
                    className="w-full flex-1"
                    style={{ height: 'calc(92vh - 52px)' }}
                    title={viewingFile.title}
                  />
                ) : null}
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Main view: category cards grid
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Acervo Digital</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Livros, apostilas e provas anteriores para seu estudo
          </p>
        </div>
        <TourButton steps={ACERVO_TOUR_STEPS} />
      </div>

      <OfflineBanner fromCache={fromCache} />

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4" data-tour="acervo-stats">
        <Card className="border-border shadow-sm">
          <CardContent className="p-4">
            <div className="p-2 rounded-lg w-fit mb-3 bg-blue-100">
              <Archive className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-foreground">{totalItems}</div>
            <div className="text-xs text-muted-foreground mt-1">Total de Materiais</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="p-4">
            <div className="p-2 rounded-lg w-fit mb-3 bg-emerald-100">
              <BookOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-foreground">{livros.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Livros</div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="p-4">
            <div className="p-2 rounded-lg w-fit mb-3 bg-purple-100">
              <ClipboardList className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-foreground">{provas.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Provas</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative" data-tour="acervo-search">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar material por nome..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Category Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-tour="acervo-categories">
        {/* Livros Card */}
        {filteredLivros.length > 0 && (() => {
          const colors = CONCURSO_COLORS.livros
          const previewItems = filteredLivros.slice(0, 4)
          const catLocked = isStudent && catRestricted && !isCatAllowed('livros')
          return (
            <div
              className={cn(
                'group relative flex flex-col rounded-xl border bg-card p-5 transition-all duration-200 shadow-sm',
                colors.border, colors.hoverBorder, 'hover:shadow-lg',
                catLocked && 'opacity-50'
              )}
            >
              {/* Category badge */}
              <div className={cn('absolute -top-3 left-4 inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold text-white', colors.badge)}>
                Livros
              </div>

              {/* Title */}
              <div className="flex items-center gap-2.5 mt-1">
                <div className={cn('p-2 rounded-lg', colors.bg)}>
                  <BookOpen className={cn('h-5 w-5', colors.text)} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground leading-snug">Livros para Consulta</h3>
                  <p className="text-xs text-muted-foreground">{filteredLivros.length} arquivos</p>
                </div>
              </div>

              {/* Preview list */}
              <ul className="mt-4 flex-1 space-y-1.5">
                {previewItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 min-w-0">
                    <FileText className={cn('h-3.5 w-3.5 flex-shrink-0', colors.text)} />
                    <span className="truncate text-xs text-foreground">{item.title}</span>
                  </li>
                ))}
                {filteredLivros.length > 4 && (
                  <li className="text-xs text-muted-foreground pl-5.5">
                    +{filteredLivros.length - 4} {filteredLivros.length - 4 === 1 ? 'livro' : 'livros'}
                  </li>
                )}
              </ul>

              {/* Action button */}
              <button
                onClick={() => {
                  if (catLocked) {
                    toast({ title: 'Conteúdo bloqueado', description: 'Adquira o acesso completo para desbloquear este conteúdo' })
                    return
                  }
                  setSearch('')
                  setSelectedCategory({
                    type: 'livros',
                    label: 'Livros para Consulta',
                    items: livros,
                  })
                }}
                className={cn(
                  'mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 text-white hover:shadow-md',
                  catLocked ? 'bg-muted-foreground cursor-not-allowed' : colors.btn
                )}
              >
                {catLocked ? <Lock className="h-4 w-4" /> : null}
                {catLocked ? 'Bloqueado' : 'Ver arquivos'}
                {!catLocked && <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          )
        })()}

        {/* Extra Category Cards (Apostilas, Exercícios, Regulamentos) */}
        {[
          { key: 'apostilas' as const, items: apostilas, label: 'Apostilas', icon: BookOpen },
          { key: 'exercicios' as const, items: exercicios, label: 'Exercícios', icon: ClipboardList },
          { key: 'regulamentos' as const, items: regulamentos, label: 'Regulamentos', icon: FileText },
          { key: 'mapas_mentais' as const, items: mapasMentais, label: 'Mapas Mentais', icon: FileText },
        ].filter(cat => cat.items.length > 0).map(cat => {
          const colors = CONCURSO_COLORS[cat.key]
          const previewItems = cat.items.slice(0, 4)
          const Icon = cat.icon
          const catLocked = isStudent && catRestricted && !isCatAllowed(cat.key)
          return (
            <div
              key={cat.key}
              className={cn(
                'group relative flex flex-col rounded-xl border bg-card p-5 transition-all duration-200 shadow-sm',
                colors.border, colors.hoverBorder, 'hover:shadow-lg',
                catLocked && 'opacity-50'
              )}
            >
              <div className={cn('absolute -top-3 left-4 inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold text-white', colors.badge)}>
                {cat.label}
              </div>
              <div className="flex items-center gap-2.5 mt-1">
                <div className={cn('p-2 rounded-lg', colors.bg)}>
                  <Icon className={cn('h-5 w-5', colors.text)} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground leading-snug">{cat.label}</h3>
                  <p className="text-xs text-muted-foreground">{cat.items.length} arquivos</p>
                </div>
              </div>
              <ul className="mt-4 flex-1 space-y-1.5">
                {previewItems.map(item => (
                  <li key={item.id} className="flex items-center gap-2 min-w-0">
                    <FileText className={cn('h-3.5 w-3.5 flex-shrink-0', colors.text)} />
                    <span className="truncate text-xs text-foreground">{item.title}</span>
                  </li>
                ))}
                {cat.items.length > 4 && (
                  <li className="text-xs text-muted-foreground pl-5.5">
                    +{cat.items.length - 4} arquivos
                  </li>
                )}
              </ul>
              <button
                onClick={() => {
                  if (catLocked) {
                    toast({ title: 'Conteúdo bloqueado', description: 'Adquira o acesso completo para desbloquear este conteúdo' })
                    return
                  }
                  setSearch('')
                  setSelectedCategory({
                    type: cat.key,
                    label: cat.label,
                    concurso: cat.key,
                    items: cat.items,
                  })
                }}
                className={cn(
                  'mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 text-white hover:shadow-md',
                  catLocked ? 'bg-muted-foreground cursor-not-allowed' : colors.btn
                )}
              >
                {catLocked ? <Lock className="h-4 w-4" /> : null}
                {catLocked ? 'Bloqueado' : 'Ver arquivos'}
                {!catLocked && <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          )
        })}

        {/* Prova Group Cards */}
        {filteredProvaGroups.map((group) => {
          const colors = CONCURSO_COLORS[group.concurso] || CONCURSO_COLORS.livros
          const allItems = getAllItemsFromGroup(group)
          const previewItems = allItems.slice(0, 4)
          const years = [...new Set(allItems.map(i => i.year))].sort((a, b) => (b || 0) - (a || 0))
          const concLocked = isStudent && concRestricted && !isConcAllowed(group.concurso)

          return (
            <div
              key={group.concurso}
              className={cn(
                'group relative flex flex-col rounded-xl border bg-card p-5 transition-all duration-200 shadow-sm',
                colors.border, colors.hoverBorder, 'hover:shadow-lg',
                concLocked && 'opacity-50'
              )}
            >
              {/* Category badge */}
              <div className={cn('absolute -top-3 left-4 inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold text-white', colors.badge)}>
                {group.concurso}
              </div>

              {/* Title */}
              <div className="flex items-center gap-2.5 mt-1">
                <div className={cn('p-2 rounded-lg', colors.bg)}>
                  <ClipboardList className={cn('h-5 w-5', colors.text)} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground leading-snug">Provas {group.concurso}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{group.totalFiles} arquivos</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{group.yearRange}</span>
                  </div>
                </div>
              </div>

              {/* Preview list */}
              <ul className="mt-4 flex-1 space-y-1.5">
                {previewItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 min-w-0">
                    <FileText className={cn('h-3.5 w-3.5 flex-shrink-0', colors.text)} />
                    <span className="truncate text-xs text-foreground">{item.title}</span>
                  </li>
                ))}
                {allItems.length > 4 && (
                  <li className="text-xs text-muted-foreground pl-5.5">
                    +{allItems.length - 4} {allItems.length - 4 === 1 ? 'arquivo' : 'arquivos'}
                  </li>
                )}
              </ul>

              {/* Year pills */}
              <div className="mt-3 flex flex-wrap gap-1">
                {years.slice(0, 6).map(year => (
                  <span key={year} className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', colors.bg, colors.text)}>
                    {year}
                  </span>
                ))}
                {years.length > 6 && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground">
                    +{years.length - 6}
                  </span>
                )}
              </div>

              {/* Action button */}
              <button
                onClick={() => {
                  if (concLocked) {
                    toast({ title: 'Conteúdo bloqueado', description: 'Adquira o acesso completo para desbloquear este conteúdo' })
                    return
                  }
                  setSearch('')
                  setSelectedCategory({
                    type: 'provas',
                    label: `Provas ${group.concurso}`,
                    concurso: group.concurso,
                    items: allItems,
                    group,
                  })
                }}
                className={cn(
                  'mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 text-white hover:shadow-md',
                  concLocked ? 'bg-muted-foreground cursor-not-allowed' : colors.btn
                )}
              >
                {concLocked ? <Lock className="h-4 w-4" /> : null}
                {concLocked ? 'Bloqueado' : 'Ver arquivos'}
                {!concLocked && <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          )
        })}
      </div>

      {/* Empty state when search filters everything */}
      {filteredLivros.length === 0 && filteredProvaGroups.length === 0 && (
        <Card className="border-border shadow-sm">
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">
              {search ? 'Nenhum material encontrado para essa busca.' : 'Nenhum material disponível.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
