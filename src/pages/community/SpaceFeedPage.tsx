import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Menu, Hash, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { SpacesSidebar } from '@/components/community/SpacesSidebar'
import { PostFeed } from '@/components/community/PostFeed'
import { PostEditor } from '@/components/community/PostEditor'
import { SectionLoader } from '@/components/SectionLoader'
import { communityService, type CommunitySpace } from '@/services/communityService'
import DOMPurify from 'dompurify'
import { useAuth } from '@/hooks/use-auth'
import { useContentAccess } from '@/hooks/useContentAccess'
import { logger } from '@/lib/logger'

export default function SpaceFeedPage() {
  const { isStudent } = useAuth()
  const { isRestricted: isReadOnly } = useContentAccess('community_readonly')
  const { isRestricted: hasSpaceRestrictions, isAllowed: isSpaceAllowed } = useContentAccess('community_space')
  const { spaceSlug } = useParams<{ spaceSlug: string }>()
  const navigate = useNavigate()
  const [space, setSpace] = useState<CommunitySpace | null>(null)
  const [spaces, setSpaces] = useState<CommunitySpace[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [feedKey, setFeedKey] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      if (!spaceSlug) return
      setLoading(true)
      setNotFound(false)

      try {
        const [spaceData, allSpaces] = await Promise.all([
          communityService.getSpaceBySlug(spaceSlug),
          communityService.getSpaces(),
        ])

        if (!spaceData) {
          setNotFound(true)
          return
        }

        // Check if student has access to this space
        if (isStudent && spaceData.slug !== 'geral' && spaceData.space_type !== 'course' && hasSpaceRestrictions && !isSpaceAllowed(spaceData.id)) {
          setNotFound(true)
          return
        }

        setSpace(spaceData)
        setSpaces(allSpaces)
      } catch (error) {
        logger.error('Failed to load space', error)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [spaceSlug, isStudent, hasSpaceRestrictions, isSpaceAllowed])

  const handlePostSuccess = () => {
    setEditorOpen(false)
    setFeedKey((k) => k + 1)
  }

  if (loading) return <SectionLoader />

  if (notFound || !space) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Espaco nao encontrado</h1>
          <p className="text-sm text-muted-foreground mt-1">
            O espaco que voce procura nao existe ou foi removido.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/comunidade')} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span
            className="h-3 w-3 rounded-full shrink-0"
            style={{ backgroundColor: space.color }}
          />
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Hash className="h-5 w-5 text-muted-foreground" />
              {space.name}
            </h1>
            {space.description && (
              <p className="text-sm text-muted-foreground mt-1">{DOMPurify.sanitize(space.description, { ALLOWED_TAGS: [] })}</p>
            )}
          </div>
        </div>

        {/* Mobile sidebar trigger */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="lg:hidden" aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[260px] p-4">
            <div className="mt-4" onClick={() => setSidebarOpen(false)}>
              <SpacesSidebar />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <SpacesSidebar />
        </div>

        {/* Feed filtered by space */}
        <div className="flex-1 min-w-0">
          <PostFeed key={feedKey} spaceId={space.id} />
        </div>
      </div>

      {/* Read-only notice */}
      {isStudent && isReadOnly && (
        <div className="text-xs text-muted-foreground text-center py-2">
          Modo leitura - acesso completo requer assinatura
        </div>
      )}

      {/* Floating create button */}
      {!(isStudent && isReadOnly) && (
        <Button
          size="lg"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40"
          onClick={() => setEditorOpen(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      {/* Post editor dialog */}
      {!(isStudent && isReadOnly) && (
        <PostEditor
          spaces={spaces}
          defaultSpaceId={space.id}
          onSuccess={handlePostSuccess}
          open={editorOpen}
          onOpenChange={setEditorOpen}
        />
      )}
    </div>
  )
}
