import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { SectionLoader } from '@/components/SectionLoader'
import {
  getAllEssayPrompts,
  deleteEssayPrompt,
  type AdminEssayPrompt,
} from '@/services/adminEssayService'

export default function AdminEssayPromptsPage() {
  usePageTitle('Temas de Redação')
  const { toast } = useToast()
  const [prompts, setPrompts] = useState<AdminEssayPrompt[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    fetchPrompts()
  }, [])

  const fetchPrompts = async () => {
    setIsLoading(true)
    try {
      const data = await getAllEssayPrompts()
      setPrompts(data)
    } catch {
      toast({ title: 'Erro ao carregar temas', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteEssayPrompt(deleteId)
      setPrompts(prev => prev.filter(p => p.id !== deleteId))
      toast({ title: 'Tema excluído com sucesso' })
    } catch {
      toast({ title: 'Erro ao excluir tema', variant: 'destructive' })
    } finally {
      setDeleteId(null)
    }
  }

  if (isLoading) return <SectionLoader />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon">
            <Link to="/admin/essays">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gerenciar Temas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Crie e edite os temas de redação disponíveis para os alunos
            </p>
          </div>
        </div>
        <Button asChild className="gap-2">
          <Link to="/admin/essays/new">
            <Plus className="h-4 w-4" />
            Novo Tema
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {prompts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum tema cadastrado. Clique em "Novo Tema" para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Redações</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prompts.map(prompt => (
                  <TableRow key={prompt.id}>
                    <TableCell className="font-medium max-w-[400px] truncate">
                      {prompt.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant={prompt.is_active ? 'default' : 'secondary'}>
                        {prompt.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {prompt.submissions_count ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="icon">
                          <Link to={`/admin/essays/${prompt.id}/edit`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(prompt.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Tema</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este tema? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
