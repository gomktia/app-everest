import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { SectionLoader } from '@/components/SectionLoader'
import { supabase } from '@/lib/supabase/client'
import { ChevronLeft, Plus, Trash2, Users, BookOpen, CheckCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface CourseClass {
  id: string
  class_id: string
  class_name: string
  class_status: string
  student_count: number
  assigned_at: string
}

interface AvailableClass {
  id: string
  name: string
  status: string
  student_count: number
  is_assigned: boolean
}

export default function AdminCourseClassesPage() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  usePageTitle('Turmas do Curso')
  const { toast } = useToast()

  const [courseName, setCourseName] = useState('')
  const [assignedClasses, setAssignedClasses] = useState<CourseClass[]>([])
  const [availableClasses, setAvailableClasses] = useState<AvailableClass[]>([])
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const loadData = async () => {
    if (!courseId) return

    try {
      setLoading(true)

      // Get course name
      const { data: course, error: courseError } = await supabase
        .from('video_courses')
        .select('name')
        .eq('id', courseId)
        .single()

      if (courseError) throw courseError
      setCourseName(course.name)

      // Get assigned classes
      const { data: classCoursesData, error: classCoursesError } = await supabase
        .from('class_courses')
        .select(`
          id,
          class_id,
          assigned_at,
          classes (
            id,
            name,
            status
          )
        `)
        .eq('course_id', courseId)

      if (classCoursesError) throw classCoursesError

      // Get student counts for each class
      const classesWithCounts = await Promise.all(
        (classCoursesData || []).map(async (cc: any) => {
          const { count } = await supabase
            .from('student_classes')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', cc.class_id)

          return {
            id: cc.id,
            class_id: cc.class_id,
            class_name: cc.classes.name,
            class_status: cc.classes.status,
            student_count: count || 0,
            assigned_at: cc.assigned_at,
          }
        })
      )

      setAssignedClasses(classesWithCounts)

      // Get all available classes
      const { data: allClasses, error: allClassesError } = await supabase
        .from('classes')
        .select('id, name, status')
        .order('name')

      if (allClassesError) {
        logger.error('Error loading classes:', allClassesError)
        throw allClassesError
      }

      logger.debug('📚 All classes loaded:', allClasses)

      // Mark which classes are already assigned
      const assignedClassIds = new Set(classCoursesData?.map((cc: any) => cc.class_id) || [])

      const classesWithAssignment = await Promise.all(
        (allClasses || []).map(async (cls: any) => {
          const { count } = await supabase
            .from('student_classes')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', cls.id)

          return {
            id: cls.id,
            name: cls.name,
            status: cls.status,
            student_count: count || 0,
            is_assigned: assignedClassIds.has(cls.id),
          }
        })
      )

      logger.debug('✅ Available classes with assignment status:', classesWithAssignment)
      setAvailableClasses(classesWithAssignment)
    } catch (error) {
      logger.error('❌ Error loading data:', error)
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar os dados.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [courseId])

  const handleAssignClasses = async () => {
    if (!courseId || selectedClasses.length === 0) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const inserts = selectedClasses.map((classId) => ({
        course_id: courseId,
        class_id: classId,
        assigned_by_user_id: user.id,
      }))

      const { error } = await supabase
        .from('class_courses')
        .insert(inserts)

      if (error) throw error

      toast({
        title: 'Turmas atribuídas!',
        description: `${selectedClasses.length} turma(s) atribuída(s) com sucesso.`,
      })

      setSelectedClasses([])
      setDialogOpen(false)
      loadData()
    } catch (error) {
      logger.error('❌ Error assigning classes:', error)
      toast({
        title: 'Erro ao atribuir',
        description: 'Não foi possível atribuir as turmas.',
        variant: 'destructive',
      })
    }
  }

  const handleRemoveClass = async (classId: string, className: string) => {
    if (!confirm(`Remover acesso da turma "${className}" a este curso?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('class_courses')
        .delete()
        .eq('id', classId)

      if (error) throw error

      toast({
        title: 'Turma removida',
        description: 'O acesso da turma foi removido com sucesso.',
      })

      loadData()
    } catch (error) {
      logger.error('❌ Error removing class:', error)
      toast({
        title: 'Erro ao remover',
        description: 'Não foi possível remover o acesso da turma.',
        variant: 'destructive',
      })
    }
  }

  const toggleClassSelection = (classId: string) => {
    setSelectedClasses((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId]
    )
  }

  if (loading) {
    return <SectionLoader />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{`Turmas do Curso: ${courseName}`}</h1>
        <p className="text-sm text-muted-foreground">Gerencie quais turmas têm acesso a este curso</p>
      </div>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => navigate('/admin/courses')}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Voltar para Cursos
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Atribuir Turmas
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Atribuir Curso às Turmas</DialogTitle>
                <DialogDescription>
                  Selecione as turmas que terão acesso a este curso
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-[400px] overflow-y-auto">
                <div className="space-y-2">
                  {(() => {
                    const unassignedClasses = availableClasses.filter((cls) => !cls.is_assigned)
                    logger.debug('🎯 Unassigned classes to show:', unassignedClasses)
                    logger.debug('📊 Total available classes:', availableClasses.length)
                    logger.debug('📊 Unassigned classes:', unassignedClasses.length)
                    return unassignedClasses.map((cls) => (
                      <div
                        key={cls.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer",
                          selectedClasses.includes(cls.id)
                            ? "bg-primary/10 border-primary"
                            : "bg-card hover:bg-muted/50"
                        )}
                        onClick={() => toggleClassSelection(cls.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedClasses.includes(cls.id)}
                            onCheckedChange={() => toggleClassSelection(cls.id)}
                          />
                          <div>
                            <div className="font-medium">{cls.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {cls.student_count} aluno(s)
                            </div>
                          </div>
                        </div>
                        <Badge variant={cls.status === 'active' ? 'default' : 'outline'}>
                          {cls.status === 'active' ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </div>
                    ))
                  })()}

                  {availableClasses.filter((cls) => !cls.is_assigned).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Todas as turmas já têm acesso a este curso
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleAssignClasses}
                  disabled={selectedClasses.length === 0}
                >
                  Atribuir ({selectedClasses.length})
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-muted/50">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{assignedClasses.length}</div>
                  <div className="text-sm text-muted-foreground">Turmas com Acesso</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-muted/50">
                  <BookOpen className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {assignedClasses.reduce((sum, c) => sum + c.student_count, 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Alunos com Acesso</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-muted/50">
                  <CheckCircle className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {availableClasses.length - assignedClasses.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Turmas Disponíveis</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Assigned Classes Table */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Turmas com Acesso</h2>

            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Turma</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Alunos</TableHead>
                    <TableHead>Atribuído em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedClasses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhuma turma tem acesso a este curso ainda.
                        <br />
                        Clique em "Atribuir Turmas" para começar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    assignedClasses.map((cls) => (
                      <TableRow key={cls.id} className="hover:bg-muted/20">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {cls.class_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={cls.class_status === 'active' ? 'default' : 'outline'}>
                            {cls.class_status === 'active' ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell>{cls.student_count}</TableCell>
                        <TableCell>
                          {new Date(cls.assigned_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveClass(cls.id, cls.class_name)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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
