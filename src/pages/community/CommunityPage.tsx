import { useState, useEffect, useMemo } from 'react'
import { Plus, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { SpacesSidebar } from '@/components/community/SpacesSidebar'
import { PostFeed } from '@/components/community/PostFeed'
import { PostEditor } from '@/components/community/PostEditor'
import { communityService, type CommunitySpace } from '@/services/communityService'
import { useAuth } from '@/hooks/use-auth'
import { useContentAccess } from '@/hooks/useContentAccess'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { TourButton } from '@/components/TourButton'
import type { DriveStep } from 'driver.js'

const COMMUNITY_TOUR_STEPS: DriveStep[] = [
  { element: '[data-tour="community-sidebar"]', popover: { title: 'Espaços da Comunidade', description: 'Filtre os posts por espaço: Geral, turmas específicas ou outros temas. No mobile, use o botão de menu.' } },
  { element: '[data-tour="community-feed"]', popover: { title: 'Feed de Posts', description: 'Veja as publicações dos colegas e professores. Curta e comente para interagir com a comunidade.' } },
  { element: '[data-tour="community-create"]', popover: { title: 'Criar Post', description: 'Clique no botão flutuante para criar uma nova publicação. Escolha o espaço e escreva seu conteúdo.' } },
]

export default function CommunityPage() {
  const { user, isStudent, effectiveUserId } = useAuth()
  const { isRestricted: isReadOnly } = useContentAccess('community_readonly')
  const { isRestricted: hasSpaceRestrictions, allowedIds: allowedSpaceIds } = useContentAccess('community_space')
  const [spaces, setSpaces] = useState<CommunitySpace[]>([])
  const [userClassIds, setUserClassIds] = useState<string[]>([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [feedKey, setFeedKey] = useState(0)

  const targetUserId = effectiveUserId || user?.id

  // Fetch user's class IDs for filtering class spaces
  useEffect(() => {
    if (!targetUserId || !isStudent) return
    const fetchClasses = async () => {
      const { data } = await supabase
        .from('student_classes')
        .select('class_id')
        .eq('user_id', targetUserId)
      setUserClassIds((data || []).map(e => e.class_id))
    }
    fetchClasses()
  }, [targetUserId, isStudent])

  useEffect(() => {
    const fetchSpaces = async () => {
      try {
        const data = await communityService.getSpaces()
        setSpaces(data)
      } catch (error) {
        logger.error('Failed to load spaces for editor', error)
      }
    }
    fetchSpaces()
  }, [])

  // Compute the allowed space IDs for the feed
  const feedAllowedSpaceIds = useMemo(() => {
    if (!isStudent) return undefined // admins/teachers see all

    // Build list of visible space IDs
    const visibleIds: string[] = []
    for (const space of spaces) {
      // Geral always visible
      if (space.slug === 'geral') { visibleIds.push(space.id); continue }
      // Class spaces: only for enrolled students
      if (space.space_type === 'course' && space.class_id) {
        if (userClassIds.includes(space.class_id)) visibleIds.push(space.id)
        continue
      }
      // Other general spaces: check restrictions
      if (hasSpaceRestrictions) {
        if (allowedSpaceIds.includes(space.id)) visibleIds.push(space.id)
      } else {
        visibleIds.push(space.id)
      }
    }
    return visibleIds.length > 0 ? visibleIds : undefined
  }, [isStudent, spaces, userClassIds, hasSpaceRestrictions, allowedSpaceIds])

  // Filter spaces available for the post editor (only visible ones)
  const editorSpaces = useMemo(() => {
    if (!isStudent) return spaces
    if (!feedAllowedSpaceIds) return spaces
    return spaces.filter(s => feedAllowedSpaceIds.includes(s.id))
  }, [isStudent, spaces, feedAllowedSpaceIds])

  const handlePostSuccess = () => {
    setEditorOpen(false)
    setFeedKey((k) => k + 1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Comunidade</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Interaja, compartilhe e tire suas duvidas
            </p>
          </div>
          <TourButton steps={COMMUNITY_TOUR_STEPS} />
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
        <div data-tour="community-sidebar" className="hidden lg:block">
          <SpacesSidebar />
        </div>

        {/* Feed */}
        <div data-tour="community-feed" className="flex-1 min-w-0">
          <PostFeed key={feedKey} allowedSpaceIds={feedAllowedSpaceIds} />
        </div>
      </div>

      {/* Floating create button */}
      {!(isStudent && isReadOnly) && (
        <Button
          data-tour="community-create"
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
          spaces={editorSpaces}
          onSuccess={handlePostSuccess}
          open={editorOpen}
          onOpenChange={setEditorOpen}
        />
      )}
    </div>
  )
}
