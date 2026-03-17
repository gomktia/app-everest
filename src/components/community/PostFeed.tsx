import { useState, useEffect, useCallback } from 'react'
import { Search, Loader2, MessageSquarePlus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { communityService, type CommunityPost } from '@/services/communityService'
import { logger } from '@/lib/logger'
import { PostCard } from './PostCard'

interface PostFeedProps {
  spaceId?: string
  allowedSpaceIds?: string[]
}

type SortOption = 'recent' | 'popular' | 'unanswered'
type TypeFilter = 'all' | 'text' | 'question' | 'poll'

export function PostFeed({ spaceId, allowedSpaceIds }: PostFeedProps) {
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortOption>('recent')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchPosts = useCallback(async (pageNum: number, append = false) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    try {
      const { posts: fetched, total: totalCount } = await communityService.getPosts({
        spaceId,
        allowedSpaceIds: !spaceId ? allowedSpaceIds : undefined,
        sort,
        type: typeFilter === 'all' ? undefined : typeFilter,
        search: debouncedSearch || undefined,
        page: pageNum,
        limit: 20,
      })

      if (append) {
        setPosts((prev) => [...prev, ...fetched])
      } else {
        setPosts(fetched)
      }
      setTotal(totalCount)
    } catch (error) {
      logger.error('Failed to fetch posts', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [spaceId, allowedSpaceIds, sort, typeFilter, debouncedSearch])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
    fetchPosts(1)
  }, [fetchPosts])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchPosts(nextPage, true)
  }

  const handleReactionChange = () => {
    fetchPosts(1)
  }

  const hasMore = posts.length < total

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Tabs value={sort} onValueChange={(v) => setSort(v as SortOption)} className="w-auto">
          <TabsList>
            <TabsTrigger value="recent">Recentes</TabsTrigger>
            <TabsTrigger value="popular">Populares</TabsTrigger>
            <TabsTrigger value="unanswered">Sem Resposta</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="text">Texto</SelectItem>
            <SelectItem value="question">Perguntas</SelectItem>
            <SelectItem value="poll">Enquetes</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar posts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Post list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <MessageSquarePlus className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">Nenhum post encontrado</h3>
          <p className="text-sm text-muted-foreground">
            Seja o primeiro a iniciar uma conversa!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onReactionChange={handleReactionChange} />
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Carregando...
                  </>
                ) : (
                  'Carregar mais'
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
