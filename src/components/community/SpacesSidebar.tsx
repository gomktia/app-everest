import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { MessageSquare, HelpCircle, BookOpen, Coffee, Hash, Loader2, GraduationCap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { communityService, type CommunitySpace } from '@/services/communityService'
import { useAuth } from '@/hooks/use-auth'
import { useContentAccess } from '@/hooks/useContentAccess'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

const ICON_MAP: Record<string, React.ElementType> = {
  MessageSquare,
  HelpCircle,
  BookOpen,
  Coffee,
  GraduationCap,
}

function getSpaceIcon(iconName: string): React.ElementType {
  return ICON_MAP[iconName] || Hash
}

export function SpacesSidebar() {
  const [spaces, setSpaces] = useState<CommunitySpace[]>([])
  const [loading, setLoading] = useState(true)
  const [userClassIds, setUserClassIds] = useState<string[]>([])
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isStudent, effectiveUserId } = useAuth()
  const { isRestricted, allowedIds, loading: accessLoading } = useContentAccess('community_space')

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
        logger.error('Failed to load spaces', error)
      } finally {
        setLoading(false)
      }
    }
    fetchSpaces()
  }, [])

  const currentSlug = location.pathname.match(/^\/comunidade\/([^/]+)/)?.[1]

  // Filter spaces based on role and class permissions
  const visibleSpaces = spaces.filter(space => {
    // Admins/teachers see everything
    if (!isStudent) return true

    // "Geral" is always visible
    if (space.slug === 'geral') return true

    // Class spaces: only visible to enrolled students
    if (space.space_type === 'course' && space.class_id) {
      return userClassIds.includes(space.class_id)
    }

    // Other general spaces: check content access restrictions
    if (isRestricted) {
      return allowedIds.includes(space.id)
    }

    // No restrictions = show all
    return true
  })

  const generalSpaces = visibleSpaces.filter(s => s.space_type !== 'course')
  const classSpaces = visibleSpaces.filter(s => s.space_type === 'course')

  const renderSpaceButton = (space: CommunitySpace) => {
    const Icon = getSpaceIcon(space.icon)
    const isActive = currentSlug === space.slug

    return (
      <button
        key={space.id}
        type="button"
        onClick={() => navigate(`/comunidade/${space.slug}`)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all duration-200',
          isActive
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: space.color }}
        />
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{space.name}</span>
      </button>
    )
  }

  return (
    <Card className="w-[220px] shrink-0 border-border shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-foreground">Espacos</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        {loading || accessLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => navigate('/comunidade')}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all duration-200',
                !currentSlug
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="truncate">Todos os Espacos</span>
            </button>

            {/* General spaces */}
            <div className="space-y-0.5">
              {generalSpaces.map(renderSpaceButton)}
            </div>

            {/* Class spaces */}
            {classSpaces.length > 0 && (
              <>
                <div className="pt-3 pb-1 px-3">
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                    Minhas Turmas
                  </p>
                </div>
                <div className="space-y-0.5">
                  {classSpaces.map(renderSpaceButton)}
                </div>
              </>
            )}
          </nav>
        )}
      </CardContent>
    </Card>
  )
}
