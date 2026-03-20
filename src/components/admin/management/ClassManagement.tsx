import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, PlusCircle, Search, RefreshCw, Edit, Users, Shield, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getClasses, type Class } from '@/services/classService'
import { supabase } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { logger } from '@/lib/logger'

export const ClassManagement = () => {
  const [classes, setClasses] = useState<Class[]>([])
  const [filteredClasses, setFilteredClasses] = useState<Class[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    loadClasses()
  }, [])

  useEffect(() => {
    filterClasses()
  }, [classes, searchTerm])

  const loadClasses = async () => {
    setIsLoading(true)
    try {
      const data = await getClasses()
      setClasses(data)
      setFilteredClasses(data)
    } catch (error) {
      logger.error('Erro ao carregar turmas:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as turmas.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const filterClasses = () => {
    let filtered = [...classes]

    if (searchTerm) {
      filtered = filtered.filter(cls =>
        cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cls.description || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredClasses(filtered)
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Turmas ({filteredClasses.length} de {classes.length})</CardTitle>
            <CardDescription>
              Gerencie as turmas e suas permissões de acesso.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={loadClasses}
              disabled={isLoading}
              title="Atualizar lista"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar turma..." 
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button asChild>
              <Link to="/admin/classes/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Adicionar Turma
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Alunos</TableHead>
              <TableHead>
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-8" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-8 w-8 rounded-md ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              : filteredClasses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma turma encontrada com os filtros aplicados.
                    </TableCell>
                  </TableRow>
                )
              : filteredClasses.map((cls) => (
                  <TableRow key={cls.id}>
                    <TableCell className="font-medium">{cls.name}</TableCell>
                    <TableCell className="max-w-md truncate">{cls.description}</TableCell>
                    <TableCell>
                      <Badge
                        variant={cls.class_type === 'trial' ? 'secondary' : 'outline'}
                      >
                        {cls.class_type === 'trial' ? 'Degustação' : 'Padrão'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={cls.status === 'active' ? 'default' : 'destructive'}
                      >
                        {cls.status === 'active' ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {cls.student_count || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost" aria-label="Mais opcoes">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuItem asChild>
                            <Link to={`/admin/classes/${cls.id}/edit`}>
                              <Edit className="mr-2 h-4 w-4" /> Editar
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={`/admin/classes/${cls.id}/students`}>
                              <Users className="mr-2 h-4 w-4" /> Gerenciar Alunos
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={`/admin/permissions`}>
                              <Shield className="mr-2 h-4 w-4" /> Gerenciar Permissões
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={async () => {
                              if (!confirm(`Deseja remover a turma "${cls.name}"?`)) return
                              try {
                                const { error } = await supabase.from('classes').delete().eq('id', cls.id)
                                if (error) throw error
                                toast({ title: 'Turma removida com sucesso' })
                                loadClasses()
                              } catch (error) {
                                logger.error('Erro ao remover turma:', error)
                                toast({ title: 'Erro', description: 'Não foi possível remover a turma.', variant: 'destructive' })
                              }
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Remover
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
  )
}
