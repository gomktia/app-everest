import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/usePageTitle'
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
import { MoreHorizontal, PlusCircle, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { audioLessonService, AudioLesson } from '@/services/audioLessonService'
import { useToast } from '@/components/ui/use-toast'
import { logger } from '@/lib/logger'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function AdminEvercastPage() {
  usePageTitle('Evercast')
  const [lessons, setLessons] = useState<AudioLesson[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { toast } = useToast()

  const loadLessons = async () => {
    try {
      setIsLoading(true)
      const data = await audioLessonService.getAudioLessons()
      setLessons(data)
    } catch (error) {
      logger.error(error)
      toast({ title: 'Erro ao carregar áudio-aulas', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadLessons()
  }, [])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await audioLessonService.deleteAudioLesson(deleteId)
      toast({ title: 'Áudio-aula removida com sucesso' })
      loadLessons()
    } catch (error) {
      toast({ title: 'Erro ao remover', variant: 'destructive' })
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Gerenciar Evercast</CardTitle>
            <CardDescription>
              Adicione, edite ou remova áudio-aulas.
            </CardDescription>
          </div>
          <Button asChild>
            <Link to="/admin/evercast/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Nova Áudio-aula
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : lessons.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              Nenhuma áudio-aula encontrada. Comece criando uma nova!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Série</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lessons.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>{item.series}</TableCell>
                    <TableCell>{item.duration_minutes} min</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/admin/evercast/${item.id}/edit`}>
                              Editar
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(item.id)}>
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

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente a áudio-aula.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
