import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MoreHorizontal, PlusCircle, Upload, Search, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ImportQuestionsDialog } from '@/components/admin/questions/ImportQuestionsDialog'
import { getAllQuestions, deleteQuestion } from '@/services/adminQuizService'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'

export default function AdminQuestionsPage() {
  usePageTitle('Banco de Questões')
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterSubject, setFilterSubject] = useState('all')
  const [filterTopic, setFilterTopic] = useState('all')
  const [filterReview, setFilterReview] = useState(false)
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([])
  const [topics, setTopics] = useState<{ id: string; name: string; subject_id: string }[]>([])
  const { toast } = useToast()

  const loadQuestions = async () => {
    try {
      setLoading(true)
      const [data, { data: subjectsData }, { data: topicsData }] = await Promise.all([
        getAllQuestions(),
        supabase.from('subjects').select('id, name').order('name'),
        supabase.from('topics').select('id, name, subject_id').order('name'),
      ])
      setQuestions(data)
      setSubjects(subjectsData || [])
      setTopics(topicsData || [])
    } catch (error) {
      logger.error('Erro ao carregar questões:', error)
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar as questões.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQuestions()
  }, [])

  const handleImportComplete = () => {
    loadQuestions()
  }

  const handleDeleteQuestion = async (questionId: string, questionText: string) => {
    const truncatedText = questionText.length > 50 ? questionText.substring(0, 50) + '...' : questionText
    if (!confirm(`Tem certeza que deseja deletar a questão "${truncatedText}"? Esta ação não pode ser desfeita.`)) {
      return
    }

    try {
      await deleteQuestion(questionId)
      toast({
        title: 'Questão deletada',
        description: 'A questão foi deletada com sucesso.',
      })
      loadQuestions()
    } catch (error) {
      logger.error('Error deleting question:', error)
      toast({
        title: 'Erro ao deletar',
        description: 'Não foi possível deletar a questão. Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  const filtered = questions.filter(q => {
    if (filterReview && !q.needs_review) return false
    if (filterSubject !== 'all' && q.topics?.subjects?.id !== filterSubject) return false
    if (filterTopic !== 'all' && q.topics?.id !== filterTopic) return false
    if (search) {
      const term = normalize(search)
      const text = normalize(q.question_text || '')
      const topic = normalize(q.topics?.name || '')
      const subject = normalize(q.topics?.subjects?.name || '')
      if (!text.includes(term) && !topic.includes(term) && !subject.includes(term)) return false
    }
    return true
  })

  const reviewCount = questions.filter(q => q.needs_review).length
  const filteredTopics = filterSubject === 'all'
    ? topics
    : topics.filter(t => t.subject_id === filterSubject)

  return (
    <>
      <ImportQuestionsDialog
        isOpen={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImportComplete={handleImportComplete}
      />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Banco de Questões</CardTitle>
            <CardDescription>
              {loading ? 'Carregando...' : `${questions.length} questões no banco. ${filtered.length} exibidas.`}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Importar
            </Button>
            <Button asChild>
              <Link to="/admin/questions/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Nova Questão
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por enunciado, tópico ou matéria..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterSubject} onValueChange={(v) => { setFilterSubject(v); setFilterTopic('all') }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Matéria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Matérias</SelectItem>
                {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterTopic} onValueChange={setFilterTopic}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Tópico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tópicos</SelectItem>
                {filteredTopics.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {reviewCount > 0 && (
              <Button
                variant={filterReview ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
                onClick={() => setFilterReview(!filterReview)}
              >
                <AlertTriangle className="h-4 w-4" />
                Verificar ({reviewCount})
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Enunciado</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Matéria</TableHead>
                  <TableHead>Tópico</TableHead>
                  <TableHead>
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {search || filterSubject !== 'all' || filterTopic !== 'all' || filterReview
                        ? 'Nenhuma questão encontrada com esses filtros.'
                        : 'Nenhuma questão no banco.'}
                    </TableCell>
                  </TableRow>
                )}
                {filtered.slice(0, 200).map((q) => (
                  <TableRow key={q.id} className={q.needs_review ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                    <TableCell className="font-medium max-w-md truncate">
                      <div className="flex items-center gap-2">
                        {q.needs_review && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        )}
                        <span className="truncate">{q.question_text}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {q.question_type === 'multiple_choice' ? 'Múltipla' : q.question_type === 'true_false' ? 'C/E' : q.question_type || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{q.topics?.subjects?.name || 'N/A'}</TableCell>
                    <TableCell className="text-sm">{q.topics?.name || 'N/A'}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            aria-haspopup="true"
                            size="icon"
                            variant="ghost"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/admin/questions/${q.id}/edit`}>
                              Editar
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteQuestion(q.id, q.question_text)}
                          >
                            Deletar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length > 200 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground text-sm">
                      Mostrando 200 de {filtered.length} questões. Use os filtros para refinar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
