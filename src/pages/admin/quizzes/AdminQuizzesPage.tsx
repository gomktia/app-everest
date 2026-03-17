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
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  MoreHorizontal,
  PlusCircle,
  Pencil,
  Trash2,
  ListChecks,
  BarChart2,
  Upload,
} from 'lucide-react'
import { getAdminQuizzes, deleteQuiz, type AdminQuiz } from '@/services/adminQuizService'
import { SectionLoader } from '@/components/SectionLoader'
import { useToast } from '@/components/ui/use-toast'
import { ImportQuestionsToQuizDialog } from '@/components/admin/ImportQuestionsToQuizDialog'

export default function AdminQuizzesPage() {
  usePageTitle('Quizzes')
  const [quizzes, setQuizzes] = useState<AdminQuiz[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [importTarget, setImportTarget] = useState<{ id: string; title: string } | null>(null)
  const { toast } = useToast()

  const loadQuizzes = () => {
    setIsLoading(true)
    getAdminQuizzes()
      .then(setQuizzes)
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadQuizzes()
  }, [])

  const handleDeleteQuiz = async (quizId: string, quizTitle: string) => {
    if (!confirm(`Tem certeza que deseja deletar o quiz "${quizTitle}"? Esta ação não pode ser desfeita.`)) {
      return
    }

    try {
      await deleteQuiz(quizId)
      toast({
        title: 'Quiz deletado',
        description: `O quiz "${quizTitle}" foi deletado com sucesso.`,
      })
      loadQuizzes()
    } catch (error) {
      logger.error('Error deleting quiz:', error)
      toast({
        title: 'Erro ao deletar',
        description: 'Não foi possível deletar o quiz. Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return <SectionLoader />
  }

  return (
    <>
    {importTarget && (
      <ImportQuestionsToQuizDialog
        isOpen={!!importTarget}
        onOpenChange={(open) => { if (!open) setImportTarget(null) }}
        onImportComplete={loadQuizzes}
        quizId={importTarget.id}
        quizTitle={importTarget.title}
        entityLabel="quiz"
      />
    )}
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Gerenciar Quizzes</CardTitle>
          <CardDescription>
            Crie, edite e analise os quizzes da plataforma.
          </CardDescription>
        </div>
        <Button asChild>
          <Link to="/admin/quizzes/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Novo Quiz
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Tópico</TableHead>
              <TableHead>Questões</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quizzes.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum quiz encontrado. Crie o primeiro quiz.
                </TableCell>
              </TableRow>
            )}
            {quizzes.map((quiz) => (
              <TableRow key={quiz.id}>
                <TableCell className="font-medium">{quiz.title}</TableCell>
                <TableCell>{quiz.topics?.name || 'N/A'}</TableCell>
                <TableCell>{quiz.quiz_questions[0]?.count || 0}</TableCell>
                <TableCell>
                  {quiz.duration_minutes
                    ? `${quiz.duration_minutes} min`
                    : 'N/A'}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={`/admin/quizzes/${quiz.id}/questions`}>
                          <ListChecks className="mr-2 h-4 w-4" />
                          Gerenciar Questões
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setImportTarget({ id: quiz.id, title: quiz.title })}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Importar Questões
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={`/admin/quizzes/${quiz.id}/edit`}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar Detalhes
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={`/admin/quizzes/${quiz.id}/reports`}>
                          <BarChart2 className="mr-2 h-4 w-4" />
                          Ver Relatórios
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDeleteQuiz(quiz.id, quiz.title)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Deletar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    </>
  )
}
