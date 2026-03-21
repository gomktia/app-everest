import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { logger } from '@/lib/logger'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  GraduationCap,
  Users,
  PlusCircle,
  Search,
  Edit,
  Trash2,
  Lock,
  TrendingUp,
  BookOpen,
  Calendar,
  UserCheck,
  Shield
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionLoader } from '@/components/SectionLoader'
import { useToast } from '@/hooks/use-toast'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'
import {
  getClasses,
  createClass,
  deleteClass,
  getClassStudents,
  type Class
} from '@/services/classService'
import { supabase } from '@/lib/supabase/client'

interface LinkedCourse {
  id: string
  name: string
  thumbnail_url: string | null
}

export default function AdminClassesPage() {
  usePageTitle('Turmas')
  const [classes, setClasses] = useState<Class[]>([])
  const [classCourseMap, setClassCourseMap] = useState<Record<string, LinkedCourse>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const { toast } = useToast()
  const { classIds, isTeacher, isAdmin, loading: teacherLoading } = useTeacherClasses()

  useEffect(() => {
    if (!teacherLoading) {
      loadClasses()
    }
  }, [teacherLoading])

  const loadClassCourses = async (classList: Class[]) => {
    try {
      const classIdList = classList.map(c => c.id)
      const { data, error } = await supabase
        .from('class_courses')
        .select('class_id, video_courses(id, name, thumbnail_url)')
        .in('class_id', classIdList)

      if (error || !data) return

      const map: Record<string, LinkedCourse> = {}
      for (const row of data) {
        // Keep the first linked course per class
        if (!map[row.class_id] && row.video_courses) {
          map[row.class_id] = {
            id: row.video_courses.id,
            name: row.video_courses.name,
            thumbnail_url: row.video_courses.thumbnail_url,
          }
        }
      }
      setClassCourseMap(map)
    } catch (e) {
      logger.error('Erro ao carregar cursos das turmas:', e)
    }
  }

  const loadClasses = async () => {
    try {
      const data = await getClasses()
      // Teachers only see their own classes
      const filtered = isTeacher
        ? data.filter(c => classIds.includes(c.id))
        : data
      setClasses(filtered)
      // Load linked course thumbnails
      if (filtered.length > 0) {
        loadClassCourses(filtered)
      }
    } catch (error) {
      logger.error('Erro ao carregar turmas:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as turmas',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }


  const handleDeleteClass = async (classItem: Class) => {
    try {
      const students = await getClassStudents(classItem.id)
      if (students.length > 0) {
        toast({
          title: 'Não é possível excluir',
          description: `A turma "${classItem.name}" possui ${students.length} aluno(s) matriculado(s). Remova os alunos antes de excluir.`,
          variant: 'destructive',
        })
        return
      }

      if (!confirm(`Excluir a turma "${classItem.name}"? Esta ação não pode ser desfeita.`)) return

      await deleteClass(classItem.id)
      toast({ title: 'Turma excluída com sucesso' })
      loadClasses()
    } catch (error) {
      logger.error('Erro ao excluir turma:', error)
      toast({ title: 'Erro ao excluir turma', variant: 'destructive' })
    }
  }

  const filteredClasses = classes.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-green-100 dark:bg-green-950/50 border-green-300 dark:border-green-800 text-green-600">
            Ativa
          </Badge>
        )
      case 'inactive':
        return (
          <Badge className="bg-orange-100 dark:bg-orange-950/50 border-orange-300 dark:border-orange-800 text-orange-600">
            Inativa
          </Badge>
        )
      case 'archived':
        return (
          <Badge className="bg-muted/50 border-border text-muted-foreground">
            Arquivada
          </Badge>
        )
      default:
        return null
    }
  }

  if (loading || teacherLoading) {
    return <SectionLoader />
  }

  const totalStudents = classes.reduce((sum, c) => sum + (c.student_count || 0), 0)
  const activeClasses = classes.filter(c => c.status === 'active').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Gestão de Turmas</h1>
        <p className="text-sm text-muted-foreground">Gerencie turmas, matricule alunos e configure permissões de acesso</p>
      </div>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card className="border-border shadow-sm">
            <CardContent className="p-3 md:p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3">
                <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-muted/50">
                  <GraduationCap className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-bold text-foreground">{classes.length}</div>
                  <div className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">Total de Turmas</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-3 md:p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3">
                <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-muted/50">
                  <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-bold text-foreground">{activeClasses}</div>
                  <div className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">Turmas Ativas</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-3 md:p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3">
                <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-muted/50">
                  <Users className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-bold text-foreground">{totalStudents}</div>
                  <div className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">Alunos Matriculados</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-3 md:p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3">
                <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-muted/50">
                  <BookOpen className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-bold text-foreground">{Math.round(totalStudents / (classes.length || 1))}</div>
                  <div className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">Média por Turma</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="relative flex-1 w-full md:max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar turmas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {isAdmin && (
                <Button className="w-full md:w-auto" asChild>
                  <Link to="/admin/classes/new">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Nova Turma
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Turma</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead>Alunos</TableHead>
                  <TableHead className="hidden lg:table-cell">Criada em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClasses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <GraduationCap className="h-12 w-12 text-muted-foreground/50" />
                        <div>
                          <p className="font-medium text-muted-foreground">Nenhuma turma encontrada</p>
                          <p className="text-sm text-muted-foreground/60">
                            {searchTerm ? 'Tente outra busca' : 'Comece criando uma nova turma'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClasses.map((classItem) => {
                    const linkedCourse = classCourseMap[classItem.id]
                    return (
                    <TableRow key={classItem.id} className="group hover:bg-primary/5">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {linkedCourse?.thumbnail_url ? (
                            <img
                              src={linkedCourse.thumbnail_url}
                              alt={`Capa do curso ${linkedCourse.name}`}
                              className="w-16 h-10 rounded object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-16 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                              <BookOpen className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium group-hover:text-primary transition-colors">
                              {classItem.name}
                            </div>
                            {linkedCourse && (
                              <p className="text-xs text-muted-foreground">{linkedCourse.name}</p>
                            )}
                            {classItem.description && !linkedCourse && (
                              <div className="text-sm text-muted-foreground">
                                {classItem.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {getStatusBadge(classItem.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{classItem.student_count || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {new Date(classItem.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 group/btn"
                            asChild
                          >
                            <Link to={`/admin/classes/${classItem.id}/students`}>
                              <UserCheck className="h-4 w-4 group-hover/btn:text-primary transition-colors" />
                            </Link>
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 group/btn"
                              asChild
                            >
                              <Link to={`/admin/permissions?classId=${classItem.id}`}>
                                <Lock className="h-4 w-4 group-hover/btn:text-primary transition-colors" />
                              </Link>
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 group/btn"
                              asChild
                            >
                              <Link to={`/admin/classes/${classItem.id}/edit`}>
                                <Edit className="h-4 w-4 group-hover/btn:text-primary transition-colors" />
                              </Link>
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteClass(classItem)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <Link to="/admin/management" className="block">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-muted/50">
                    <Users className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-semibold mb-1 text-foreground">Gerenciar Alunos</h3>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Adicionar e remover alunos das turmas
                    </p>
                  </div>
                </div>
              </Link>
            </CardContent>
          </Card>

          {isAdmin && (
            <Card className="border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <Link to="/admin/permissions" className="block">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-muted/50">
                      <Lock className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-sm md:text-base font-semibold mb-1 text-foreground">Permissões</h3>
                      <p className="text-xs md:text-sm text-muted-foreground">
                        Configurar acesso aos recursos
                      </p>
                    </div>
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}

          <Card className="border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <Link to="/admin/reports" className="block">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-muted/50">
                    <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-semibold mb-1 text-foreground">Relatórios</h3>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Ver desempenho das turmas
                    </p>
                  </div>
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

