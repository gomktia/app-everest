import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { logger } from '@/lib/logger'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PlusCircle, BookOpen, TrendingUp, Layers, MoreVertical, Edit, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import { getSubjects } from '@/services/subjectService'
import type { SubjectWithTopicCount } from '@/services/subjectService'

export default function AdminFlashcardsPage() {
  usePageTitle('Flashcards')
  const [subjects, setSubjects] = useState<SubjectWithTopicCount[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const loadSubjects = async () => {
    try {
      const data = await getSubjects()
      setSubjects(data)
    } catch (error) {
      logger.error('Erro ao carregar matérias:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSubjects()
  }, [])

  const handleDeleteSubject = async (subjectId: string, subjectName: string) => {
    if (!confirm(`Deseja realmente deletar a matéria "${subjectName}"? Todos os tópicos e flashcards serão removidos.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', subjectId)

      if (error) throw error

      toast({
        title: 'Sucesso',
        description: 'Matéria deletada com sucesso',
      })

      loadSubjects()
    } catch (error) {
      logger.error('Erro ao deletar matéria:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível deletar a matéria',
        variant: 'destructive',
      })
    }
  }

  const totalTopics = subjects.reduce((acc, subject) => acc + subject.topics.length, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Flashcards</h1>
        <p className="text-muted-foreground mt-1">Gerencie as matérias e tópicos de flashcards do sistema</p>
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Actions */}
        <div className="flex items-center justify-end">
          <Button
            size="lg"
            className="gap-2"
            asChild
          >
            <Link to="/admin/flashcards/new">
              <PlusCircle className="h-5 w-5" />
              Nova Matéria
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-border shadow-sm">
            <CardContent className="p-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-2xl bg-blue-100">
                    <BookOpen className="h-6 w-6 text-blue-500" />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Matérias</p>
                  <h3 className="text-3xl font-bold mt-1 text-foreground">{subjects.length}</h3>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-2xl bg-green-100">
                    <Layers className="h-6 w-6 text-green-500" />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Tópicos</p>
                  <h3 className="text-3xl font-bold mt-1 text-foreground">{totalTopics}</h3>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-2xl bg-purple-100">
                    <TrendingUp className="h-6 w-6 text-purple-500" />
                  </div>
                  <Badge variant="secondary" className="text-xs">Ativo</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <h3 className="text-3xl font-bold mt-1 text-green-500">Online</h3>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Subjects Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : subjects.length === 0 ? (
          <Card className="border-border shadow-sm">
            <CardContent className="p-5">
              <div className="flex flex-col items-center justify-center py-12">
                <div className="p-4 rounded-2xl bg-muted/50 mb-4">
                  <BookOpen className="h-12 w-12 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma matéria encontrada</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Comece criando sua primeira matéria de flashcards
                </p>
                <Button asChild className="gap-2">
                  <Link to="/admin/flashcards/new">
                    <PlusCircle className="h-4 w-4" />
                    Criar Primeira Matéria
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject) => (
              <Card key={subject.id} className="border-border shadow-sm group transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <CardContent className="p-5">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Link to={`/admin/flashcards/${subject.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-3 rounded-2xl bg-muted/50">
                          <BookOpen className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {subject.name}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {subject.description || 'Sem descrição'}
                          </p>
                        </div>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/admin/flashcards/${subject.id}/edit`}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar Matéria
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteSubject(subject.id, subject.name)
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Deletar Matéria
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Layers className="h-4 w-4" />
                          <span>{subject.topics.length} tópicos</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Ativo
                        </Badge>
                      </div>

                      <div className="h-1 w-full rounded-full bg-muted">
                        <div
                          className="h-1 rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${Math.min((subject.topics.length / 10) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
