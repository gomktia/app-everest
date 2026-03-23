import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getPandaVideos, getPandaFolders, type PandaVideo, type PandaFolder } from '@/services/pandaVideo'
import { getYouTubeVideos, extractYouTubeVideoId, type YouTubeVideo } from '@/services/youtubeService'
import { Search, CheckCircle, FolderOpen, Youtube, Tv, Link2 } from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

// Unified video type that both Panda and YouTube return
export interface VideoSelection {
  id: string
  title: string
  thumbnail: string
  duration: number
  source: 'panda_video' | 'youtube'
}

interface PandaVideoPickerModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onVideoSelect: (video: PandaVideo) => void
}

export const PandaVideoPickerModal = ({
  isOpen,
  onOpenChange,
  onVideoSelect,
}: PandaVideoPickerModalProps) => {
  const { toast } = useToast()
  const [tab, setTab] = useState<string>('panda')

  // Panda state
  const [pandaVideos, setPandaVideos] = useState<PandaVideo[]>([])
  const [folders, setFolders] = useState<PandaFolder[]>([])
  const [pandaLoading, setPandaLoading] = useState(true)
  const [pandaSearch, setPandaSearch] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<string>('all')
  const debouncedPandaSearch = useDebounce(pandaSearch, 300)

  // YouTube state
  const [ytVideos, setYtVideos] = useState<YouTubeVideo[]>([])
  const [ytLoading, setYtLoading] = useState(false)
  const [ytSearch, setYtSearch] = useState('')
  const [ytUrl, setYtUrl] = useState('')
  const [ytLoaded, setYtLoaded] = useState(false)
  const debouncedYtSearch = useDebounce(ytSearch, 400)

  // Load Panda folders once
  useEffect(() => {
    if (isOpen && folders.length === 0) {
      getPandaFolders()
        .then(setFolders)
        .catch(() => setFolders([]))
    }
  }, [isOpen, folders.length])

  // Load Panda videos
  useEffect(() => {
    if (isOpen && tab === 'panda') {
      setPandaLoading(true)
      const params: Parameters<typeof getPandaVideos>[0] = {}
      if (debouncedPandaSearch) params.search = debouncedPandaSearch
      if (selectedFolder && selectedFolder !== 'all') params.folder_id = selectedFolder

      getPandaVideos(Object.keys(params).length > 0 ? params : undefined)
        .then((data) => {
          setPandaVideos(data.videos || [])
          setPandaLoading(false)
        })
        .catch(() => {
          setPandaVideos([])
          setPandaLoading(false)
        })
    }
  }, [isOpen, tab, debouncedPandaSearch, selectedFolder])

  // Load YouTube videos
  useEffect(() => {
    if (isOpen && tab === 'youtube' && !ytLoaded) {
      setYtLoading(true)
      getYouTubeVideos()
        .then((data) => {
          setYtVideos(data.videos)
          setYtLoaded(true)
        })
        .finally(() => setYtLoading(false))
    }
  }, [isOpen, tab, ytLoaded])

  // YouTube search
  useEffect(() => {
    if (isOpen && tab === 'youtube' && debouncedYtSearch !== undefined && ytLoaded) {
      setYtLoading(true)
      getYouTubeVideos({ search: debouncedYtSearch || undefined })
        .then((data) => setYtVideos(data.videos))
        .finally(() => setYtLoading(false))
    }
  }, [debouncedYtSearch])

  const handleSelectPanda = (video: PandaVideo) => {
    onVideoSelect(video)
    onOpenChange(false)
  }

  const handleSelectYouTube = (video: YouTubeVideo) => {
    // Create a PandaVideo-compatible object with YouTube source
    const ytAsPanda: any = {
      id: video.id,
      title: video.title,
      thumbnail: video.thumbnail,
      duration: video.duration,
      _source: 'youtube',
    }
    onVideoSelect(ytAsPanda)
    onOpenChange(false)
  }

  const handleYouTubeUrl = () => {
    const videoId = extractYouTubeVideoId(ytUrl.trim())
    if (!videoId) {
      toast({ title: 'URL inválida', description: 'Cole uma URL válida do YouTube.', variant: 'destructive' })
      return
    }
    const ytAsPanda: any = {
      id: videoId,
      title: `YouTube - ${videoId}`,
      thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      duration: 0,
      _source: 'youtube',
    }
    onVideoSelect(ytAsPanda)
    onOpenChange(false)
  }

  const formatDuration = (seconds: number) => {
    if (!seconds) return '—'
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const VideoGrid = ({ videos, loading, onSelect, emptyMessage }: {
    videos: Array<{ id: string; title: string; thumbnail: string; duration: number }>
    loading: boolean
    onSelect: (video: any) => void
    emptyMessage?: string
  }) => (
    <ScrollArea className="h-[45vh] border rounded-md">
      <div className="p-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))
          : videos.length === 0
            ? (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FolderOpen className="h-10 w-10 mb-2 opacity-50" />
                  <p className="text-sm">{emptyMessage || 'Nenhum vídeo encontrado'}</p>
                </div>
              )
            : videos.map((video) => (
                <div
                  key={video.id}
                  className="group relative cursor-pointer rounded-lg overflow-hidden border"
                  onClick={() => onSelect(video)}
                >
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-24 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                    <CheckCircle className="h-10 w-10 text-white/0 group-hover:text-white/80 transition-colors" />
                  </div>
                  <div className="p-2">
                    <p className="text-sm font-medium truncate">
                      {video.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDuration(video.duration)}
                    </p>
                  </div>
                </div>
              ))}
      </div>
    </ScrollArea>
  )

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Selecionar Vídeo</DialogTitle>
          <DialogDescription>
            Escolha um vídeo do Panda Video ou do YouTube.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="panda" className="gap-2">
              <Tv className="h-4 w-4" />
              Panda Video
            </TabsTrigger>
            <TabsTrigger value="youtube" className="gap-2">
              <Youtube className="h-4 w-4" />
              YouTube
            </TabsTrigger>
          </TabsList>

          <TabsContent value="panda" className="space-y-3 mt-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título..."
                  className="pl-8"
                  value={pandaSearch}
                  onChange={(e) => setPandaSearch(e.target.value)}
                />
              </div>
              <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                <SelectTrigger className="w-[220px]">
                  <FolderOpen className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="Todas as pastas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as pastas</SelectItem>
                  {folders
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <VideoGrid
              videos={pandaVideos}
              loading={pandaLoading}
              onSelect={handleSelectPanda}
              emptyMessage={pandaSearch || selectedFolder !== 'all' ? 'Tente alterar os filtros' : 'Nenhum vídeo encontrado'}
            />

            {!pandaLoading && pandaVideos.length > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {pandaVideos.length} vídeo{pandaVideos.length !== 1 ? 's' : ''}
              </p>
            )}
          </TabsContent>

          <TabsContent value="youtube" className="space-y-3 mt-3">
            {/* URL paste */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cole a URL do YouTube aqui..."
                  className="pl-8"
                  value={ytUrl}
                  onChange={(e) => setYtUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleYouTubeUrl()}
                />
              </div>
              <Button onClick={handleYouTubeUrl} disabled={!ytUrl.trim()}>
                Usar URL
              </Button>
            </div>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 border-t" />
              <span className="text-xs text-muted-foreground">ou selecione do canal</span>
              <div className="flex-1 border-t" />
            </div>

            {/* Channel search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar no canal..."
                className="pl-8"
                value={ytSearch}
                onChange={(e) => setYtSearch(e.target.value)}
              />
            </div>

            <VideoGrid
              videos={ytVideos}
              loading={ytLoading}
              onSelect={handleSelectYouTube}
            />

            {!ytLoading && ytVideos.length > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {ytVideos.length} vídeo{ytVideos.length !== 1 ? 's' : ''}
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
