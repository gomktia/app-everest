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
import { MoreHorizontal, PlusCircle, Pencil, Trash2, BarChart2, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getAllSimulations, deleteSimulation, type AdminSimulation } from '@/services/adminSimulationService'
import { useToast } from '@/components/ui/use-toast'
import { SectionLoader } from '@/components/SectionLoader'
import { ImportQuestionsToQuizDialog } from '@/components/admin/ImportQuestionsToQuizDialog'

export default function AdminSimulationsPage() {
  usePageTitle('Simulados')
  const [simulations, setSimulations] = useState<AdminSimulation[]>([])
  const [loading, setLoading] = useState(true)
  const [importTarget, setImportTarget] = useState<{ id: string; title: string } | null>(null)
  const { toast } = useToast()

  const loadSimulations = async () => {
    try {
      setLoading(true)
      const data = await getAllSimulations()
      setSimulations(data)
    } catch (error) {
      logger.error('Erro ao carregar simulados:', error)
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar os simulados.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSimulations()
  }, [])

  const handleDelete = async (simulationId: string, simulationTitle: string) => {
    if (!confirm(`Tem certeza que deseja deletar o simulado "${simulationTitle}"? Esta ação não pode ser desfeita.`)) {
      return
    }

    try {
      await deleteSimulation(simulationId)
      toast({
        title: 'Simulado deletado',
        description: 'O simulado foi deletado com sucesso.',
      })
      loadSimulations()
    } catch (error) {
      logger.error('Error deleting simulation:', error)
      toast({
        title: 'Erro ao deletar',
        description: 'Não foi possível deletar o simulado. Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Não agendado'
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const getStatusBadge = (simulation: AdminSimulation) => {
    if (simulation.status === 'draft') return { label: 'Rascunho', variant: 'outline' as const }
    if (!simulation.scheduled_start) return { label: 'Publicado', variant: 'default' as const }

    const now = new Date()
    const start = new Date(simulation.scheduled_start)
    const end = simulation.scheduled_end ? new Date(simulation.scheduled_end) : null

    if (now < start) return { label: 'Agendado', variant: 'default' as const }
    if (end && now > end) return { label: 'Encerrado', variant: 'secondary' as const }
    return { label: 'Em Andamento', variant: 'default' as const }
  }

  if (loading) {
    return <SectionLoader />
  }

  return (
    <>
    {importTarget && (
      <ImportQuestionsToQuizDialog
        isOpen={!!importTarget}
        onOpenChange={(open) => { if (!open) setImportTarget(null) }}
        onImportComplete={loadSimulations}
        quizId={importTarget.id}
        quizTitle={importTarget.title}
        entityLabel="simulado"
      />
    )}
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Gerenciar Simulados</CardTitle>
          <CardDescription>
            Crie e gerencie os simulados da plataforma.
          </CardDescription>
        </div>
        <Button asChild>
          <Link to="/admin/simulations/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Novo Simulado
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {simulations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Nenhum simulado encontrado. Crie seu primeiro simulado!
                </TableCell>
              </TableRow>
            ) : (
              simulations.map((sim) => {
                const statusBadge = getStatusBadge(sim)
                return (
                  <TableRow key={sim.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-semibold">{sim.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {sim.questions_count || 0} questões • {sim.attempts_count || 0} tentativas
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(sim.scheduled_start)}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost" aria-label="Mais opcoes">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/admin/simulations/${sim.id}/edit`}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setImportTarget({ id: sim.id, title: sim.title })}
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Importar Questões
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={`/admin/simulations/${sim.id}/reports`}>
                              <BarChart2 className="mr-2 h-4 w-4" />
                              Ver Resultados
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(sim.id, sim.title)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Deletar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    </>
  )
}
