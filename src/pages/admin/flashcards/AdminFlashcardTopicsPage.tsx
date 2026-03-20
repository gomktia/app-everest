import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { logger } from '@/lib/logger'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MoreHorizontal,
  PlusCircle,
  ArrowLeft,
  BookOpen,
  Layers,
  FileText,
  TrendingUp,
  Trash2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import { getSubjectById } from '@/services/flashcardService'
import { getTopicsBySubjectId } from '@/services/flashcardService'
import type { Subject, TopicWithCardCount } from '@/services/flashcardService'

export default function AdminFlashcardTopicsPage() {
  const { subjectId } = useParams<{ subjectId: string }>()
  const navigate = useNavigate()
  usePageTitle('Tópicos de Flashcard')
  const { toast } = useToast()
  const [subject, setSubject] = useState<Subject | null>(null)
  const [topics, setTopics] = useState<TopicWithCardCount[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    if (!subjectId) return

    try {
      const [subjectData, topicsData] = await Promise.all([
        getSubjectById(subjectId),
        getTopicsBySubjectId(subjectId)
      ])

      setSubject(subjectData)
      setTopics(topicsData)
    } catch (error) {
      logger.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [subjectId])

  const handleDeleteTopic = async (topicId: string, topicName: string) => {
    if (!confirm(`Deseja realmente deletar o tópico "${topicName}"? Todos os flashcards serão removidos.`)) {
      return
    }

    try {
      logger.debug('🗑️ Deletando tópico:', { topicId, topicName })

      // ✅ FIX: Usar 'topics' ao invés de 'flashcard_topics'
      const { error } = await supabase
        .from('topics')
        .delete()
        .eq('id', topicId)

      if (error) throw error

      logger.success('✅ Tópico deletado com sucesso')
      toast({
        title: 'Sucesso',
        description: 'Tópico deletado com sucesso',
      })

      loadData()
    } catch (error) {
      logger.error('❌ Erro ao deletar tópico:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível deletar o tópico',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/admin/flashcards')}
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Carregando...</h1>
            <p className="text-muted-foreground">Buscando tópicos...</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (!subject) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/admin/flashcards')}
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Erro</h1>
            <p className="text-muted-foreground">Matéria não encontrada</p>
          </div>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Matéria não encontrada</h3>
            <p className="text-muted-foreground text-center mb-4">
              A matéria que você está procurando não existe ou foi removida
            </p>
            <Button onClick={() => navigate('/admin/flashcards')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Flashcards
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalCards = topics.reduce((acc, topic) => acc + topic.flashcardCount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/admin/flashcards')}
            className="shadow-sm"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{subject.name}</h1>
            <p className="text-muted-foreground">
              Gerencie os tópicos e flashcards desta matéria
            </p>
          </div>
        </div>
        <Button size="lg" className="shadow-sm" asChild>
          <Link to={`/admin/flashcards/${subjectId}/topics/new`}>
            <PlusCircle className="mr-2 h-5 w-5" />
            Novo Tópico
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Tópicos</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{topics.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Cards</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCards}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Badge variant="secondary" className="text-xs">Ativo</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Online</div>
          </CardContent>
        </Card>
      </div>

      {/* Topics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {topics.map((topic) => (
          <Card key={topic.id} className="group relative overflow-hidden bg-gradient-to-br from-card to-card/50 dark:from-card dark:to-muted/20 shadow-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-white shadow-sm">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors truncate">
                      {topic.name}
                    </CardTitle>
                    <CardDescription className="text-sm truncate">
                      {topic.description || 'Sem descrição'}
                    </CardDescription>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to={`/admin/flashcards/${subjectId}/${topic.id}`}>
                        <FileText className="mr-2 h-4 w-4" />
                        Gerenciar Cards
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={`/admin/flashcards/${subjectId}/topics/${topic.id}/edit`}>
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Editar Tópico
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDeleteTopic(topic.id, topic.name)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Deletar Tópico
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <FileText className="h-4 w-4" />
                    <span>{topic.flashcardCount} cards</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {topic.flashcardCount > 0 ? 'Ativo' : 'Vazio'}
                </Badge>
              </div>
              <div className="mt-4 h-1 w-full rounded-full bg-muted">
                <div
                  className="h-1 rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
                  style={{ width: `${Math.min((topic.flashcardCount / 20) * 100, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {topics.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Layers className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum tópico encontrado</h3>
            <p className="text-muted-foreground text-center mb-4">
              Comece criando seu primeiro tópico para esta matéria
            </p>
            <Button asChild>
              <Link to={`/admin/flashcards/${subjectId}/topics/new`}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Criar Primeiro Tópico
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}