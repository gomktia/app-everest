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
import { MoreHorizontal, PlusCircle, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ImportQuestionsDialog } from '@/components/admin/questions/ImportQuestionsDialog'
import { getAllQuestions, deleteQuestion } from '@/services/adminQuizService'
import { useToast } from '@/components/ui/use-toast'

export default function AdminQuestionsPage() {
  usePageTitle('Banco de Questões')
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const loadQuestions = async () => {
    try {
      setLoading(true)
      const data = await getAllQuestions()
      setQuestions(data)
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
              Gerencie todas as questões da plataforma.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Importar Questões
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
                {questions.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium max-w-md truncate">
                      {q.question_text}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {q.question_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{q.topics?.subjects?.name || 'N/A'}</TableCell>
                    <TableCell>{q.topics?.name || 'N/A'}</TableCell>
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
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
