import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { logger } from '@/lib/logger'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Button } from '@/components/ui/button'
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
  ListVideo,
  BookOpen,
  Users,
  Play,
  Award,
  Copy,
  Loader2,
  Eye,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getAllCourses, deleteCourse, duplicateCourse, type AdminCourse } from '@/services/adminCourseService'
import { useAuth } from '@/contexts/auth-provider'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { SectionLoader } from '@/components/SectionLoader'

export default function AdminCoursesPage() {
  usePageTitle('Cursos')
  const [courses, setCourses] = useState<AdminCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [duplicating, setDuplicating] = useState<string | null>(null)
  const [totalStudents, setTotalStudents] = useState(0)
  const { toast } = useToast()
  const { profile } = useAuth()
  const { classIds, isTeacher, loading: teacherLoading } = useTeacherClasses()

  const loadCourses = async () => {
    try {
      setLoading(true)
      const [data, studentsResult] = await Promise.all([
        getAllCourses(),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student')
      ])

      if (isTeacher && classIds.length > 0) {
        // Fetch course IDs linked to the teacher's classes
        const { data: classCourses } = await supabase
          .from('class_courses')
          .select('course_id')
          .in('class_id', classIds)

        const allowedCourseIds = new Set(
          (classCourses || []).map((cc: any) => cc.course_id as string)
        )
        setCourses(data.filter(c => allowedCourseIds.has(c.id)))
      } else if (isTeacher && classIds.length === 0) {
        // Teacher with no classes sees no courses
        setCourses([])
      } else {
        // Admin sees everything
        setCourses(data)
      }

      setTotalStudents(studentsResult.count || 0)
    } catch (error) {
      logger.error('Erro ao carregar cursos:', error)
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar os cursos.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!teacherLoading) {
      loadCourses()
    }
  }, [teacherLoading, classIds])

  const handleDelete = async (courseId: string, courseName: string) => {
    if (!confirm(`Tem certeza que deseja deletar o curso "${courseName}"? Esta ação não pode ser desfeita.`)) {
      return
    }

    try {
      await deleteCourse(courseId)
      toast({
        title: 'Curso deletado',
        description: 'O curso foi deletado com sucesso.',
      })
      loadCourses()
    } catch (error) {
      logger.error('Error deleting course:', error)
      toast({
        title: 'Erro ao deletar',
        description: 'Não foi possível deletar o curso. Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const handleDuplicate = async (courseId: string, courseName: string) => {
    if (!profile) return
    setDuplicating(courseId)
    try {
      const newCourse = await duplicateCourse(courseId, profile.id)
      toast({
        title: 'Curso duplicado!',
        description: `"${courseName}" foi copiado como "${newCourse.name}".`,
      })
      loadCourses()
    } catch (error) {
      logger.error('Error duplicating course:', error)
      toast({
        title: 'Erro ao duplicar',
        description: 'Não foi possível duplicar o curso.',
        variant: 'destructive',
      })
    } finally {
      setDuplicating(null)
    }
  }

  const renderStatusBadge = (course: AdminCourse) => {
    const status = course.status || (course.is_active ? 'published' : 'draft')
    switch (status) {
      case 'published':
        return <Badge className="bg-green-100 dark:bg-green-950/50 text-green-500 font-semibold">Publicado</Badge>
      case 'draft':
        return <Badge variant="secondary" className="font-semibold">Rascunho</Badge>
      case 'coming_soon':
        return <Badge className="bg-orange-100 dark:bg-orange-950/50 text-orange-500 font-semibold">Em Breve</Badge>
      default:
        return <Badge variant="secondary" className="font-semibold">Rascunho</Badge>
    }
  }

  if (loading || teacherLoading) {
    return <SectionLoader />
  }

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Stats */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-muted/50">
                    <BookOpen className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      Gerenciar Cursos
                    </h2>
                    <p className="text-muted-foreground text-lg">
                      Adicione, edite ou remova cursos da plataforma
                    </p>
                  </div>
                </div>
                <Button
                  asChild
                  className="px-6 py-3 rounded-xl font-semibold"
                >
                  <Link to="/admin/courses/new">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Novo Curso
                  </Link>
                </Button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-xl bg-blue-100 dark:bg-blue-950/50 border border-blue-300 dark:border-blue-800">
                  <BookOpen className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-blue-600">{courses.length}</div>
                  <div className="text-sm text-muted-foreground">Total de Cursos</div>
                </div>
                <div className="text-center p-4 rounded-xl bg-green-100 dark:bg-green-950/50 border border-green-300 dark:border-green-800">
                  <Play className="h-6 w-6 text-green-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-600">
                    {courses.filter(c => c.is_active).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Publicados</div>
                </div>
                <div className="text-center p-4 rounded-xl bg-purple-100 dark:bg-purple-950/50 border border-purple-300 dark:border-purple-800">
                  <Users className="h-6 w-6 text-purple-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-purple-600">
                    {totalStudents.toLocaleString('pt-BR')}
                  </div>
                  <div className="text-sm text-muted-foreground">Estudantes</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Courses Table */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-foreground">Lista de Cursos</h2>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Titulo</TableHead>
                      <TableHead className="font-semibold">Modulos</TableHead>
                      <TableHead className="font-semibold">Aulas</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="text-right font-semibold">
                        <span className="sr-only">Acoes</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Nenhum curso encontrado. Crie seu primeiro curso!
                        </TableCell>
                      </TableRow>
                    ) : (
                      courses.map((course) => (
                        <TableRow
                          key={course.id}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              {course.thumbnail_url ? (
                                <img src={course.thumbnail_url} alt={`Capa do curso ${course.name}`} className="w-12 h-8 rounded object-cover" loading="lazy" />
                              ) : (
                                <div className="w-12 h-8 rounded bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                                  {course.acronym || course.name?.substring(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-foreground">{course.name}</p>
                                  {course.show_in_storefront && (
                                    <Eye className="h-3.5 w-3.5 text-muted-foreground" title="Visível na vitrine" />
                                  )}
                                </div>
                                {course.acronym && (
                                  <p className="text-xs text-muted-foreground">{course.acronym}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <ListVideo className="h-4 w-4 text-muted-foreground" />
                              {course.modules_count || 0}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Play className="h-4 w-4 text-muted-foreground" />
                              {course.lessons_count || 0}
                            </div>
                          </TableCell>
                          <TableCell>
                            {renderStatusBadge(course)}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  aria-haspopup="true"
                                  size="icon"
                                  variant="ghost"
                                  className="hover:bg-muted"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Toggle menu</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link to={`/admin/courses/${course.id}/edit`}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Editar Curso
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link to={`/admin/courses/${course.id}/classes`}>
                                    <Users className="mr-2 h-4 w-4" />
                                    Gerenciar Turmas
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDuplicate(course.id, course.name)}
                                  disabled={duplicating === course.id}
                                >
                                  {duplicating === course.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Copy className="mr-2 h-4 w-4" />
                                  )}
                                  Duplicar Curso
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDelete(course.id, course.name)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Deletar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
