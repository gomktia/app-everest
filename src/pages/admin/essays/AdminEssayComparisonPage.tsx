import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import {
  getEssaysForComparison,
  getErrorCategories,
  type EssayForCorrection,
  type ErrorCategory,
} from '@/services/essayService'
import { SectionLoader } from '@/components/SectionLoader'
import { InteractiveEssayEditor } from '@/components/admin/essays/InteractiveEssayEditor'
import { CorrectionPanel } from '@/components/admin/essays/CorrectionPanel'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { cn } from '@/lib/utils'

export default function AdminEssayComparisonPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  usePageTitle('Comparar Redações')
  const [essays, setEssays] = useState<EssayForCorrection[]>([])
  const [errorCategories, setErrorCategories] = useState<ErrorCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const editor1Ref = useRef<HTMLDivElement>(null)
  const editor2Ref = useRef<HTMLDivElement>(null)
  const [isSyncEnabled, setIsSyncEnabled] = useState(true)
  const isSyncingScroll = useRef(false)

  useEffect(() => {
    const ids = searchParams.get('ids')?.split(',')
    if (ids && ids.length === 2) {
      Promise.all([getEssaysForComparison(ids), getErrorCategories()])
        .then(([essayData, categoryData]) => {
          setEssays(essayData)
          setErrorCategories(categoryData)
        })
        .finally(() => setIsLoading(false))
    } else {
      navigate('/admin/essays')
    }
  }, [searchParams, navigate])

  const handleScroll = (source: 'editor1' | 'editor2') => {
    if (!isSyncEnabled || isSyncingScroll.current) return
    isSyncingScroll.current = true
    const src = source === 'editor1' ? editor1Ref.current : editor2Ref.current
    const tgt = source === 'editor1' ? editor2Ref.current : editor1Ref.current
    if (src && tgt) tgt.scrollTop = src.scrollTop
    setTimeout(() => { isSyncingScroll.current = false }, 100)
  }

  if (isLoading) return <SectionLoader />

  if (essays.length < 2) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Erro ao carregar comparação</h1>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    )
  }

  const [essay1, essay2] = essays

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <h1 className="text-xl font-bold text-foreground">Comparar Redações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {essay1.essay_prompts?.title}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setIsSyncEnabled(!isSyncEnabled)}
          className="gap-2 transition-all duration-200 hover:shadow-md hover:border-primary/30"
        >
          <RefreshCw className={cn('h-4 w-4', isSyncEnabled && 'animate-spin')} />
          {isSyncEnabled ? 'Desativar Sync' : 'Ativar Sync'}
        </Button>
      </div>

      {/* Side by side */}
      <ResizablePanelGroup direction="horizontal" className="flex-grow">
        <ResizablePanel>
          <div className="h-full flex flex-col gap-2">
            <Badge variant="outline" className="w-fit">
              {essay1.users?.first_name} {essay1.users?.last_name}
              {essay1.final_grade != null && ` · ${essay1.final_grade}`}
            </Badge>
            <div
              ref={editor1Ref}
              onScroll={() => handleScroll('editor1')}
              className="overflow-y-auto flex-1"
            >
              <InteractiveEssayEditor
                text={essay1.submission_text}
                annotations={[]}
                onTextSelect={() => {}}
                onAnnotationClick={() => {}}
              />
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel>
          <div className="h-full flex flex-col gap-2">
            <Badge variant="outline" className="w-fit">
              {essay2.users?.first_name} {essay2.users?.last_name}
              {essay2.final_grade != null && ` · ${essay2.final_grade}`}
            </Badge>
            <div
              ref={editor2Ref}
              onScroll={() => handleScroll('editor2')}
              className="overflow-y-auto flex-1"
            >
              <InteractiveEssayEditor
                text={essay2.submission_text}
                annotations={[]}
                onTextSelect={() => {}}
                onAnnotationClick={() => {}}
              />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
