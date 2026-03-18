import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  GraduationCap,
  Plus,
  Trash2,
  Search,
  ArrowLeft,
  Calendar,
  Users,
  BookOpen,
} from 'lucide-react'
import { SectionLoader } from '@/components/SectionLoader'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import { getUserById } from '@/services/adminUserService'
import type { User } from '@/services/adminUserService'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'

interface StudentClass {
  id: string
  class_id: string
  user_id: string
  enrollment_date: string
  class?: {
    id: string
    name: string
    description: string
    status: string
    start_date: string
    end_date: string
  }
}

interface AvailableClass {
  id: string
  name: string
  description: string
  status: string
  start_date: string
  end_date: string
}

export default function AdminStudentClassesPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  usePageTitle('Turmas do Aluno')
  const { toast } = useToast()
  const { isTeacher, classIds: teacherClassIds, studentIds, loading: teacherLoading } = useTeacherClasses()

  const [user, setUser] = useState<User | null>(null)
  const [studentClasses, setStudentClasses] = useState<StudentClass[]>([])
  const [availableClasses, setAvailableClasses] = useState<AvailableClass[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState('')

  useEffect(() => {
    loadData()
  }, [userId])

  const loadData = async () => {
    try {
      setLoading(true)

      // Carregar dados do usuário
      const userData = await getUserById(userId!)
      if (userData) {
        setUser(userData)
      }

      // Carregar turmas do aluno
      const { data: classesData, error: classesError } = await supabase
        .from('student_classes')
        .select(`
          id,
          user_id,
          class_id,
          enrollment_date,
          classes (
            id,
            name,
            description,
            status,
            start_date,
            end_date
          )
        `)
        .eq('user_id', userId)

      if (classesError) {
        logger.error('Error loading student classes:', classesError)
        throw classesError
      }

      // Map the data to ensure 'class' field is properly set
      const mappedClasses = (classesData || []).map((item: any) => ({
        ...item,
        class: item.classes || item.class // Support both 'classes' and 'class' field names
      }))

      setStudentClasses(mappedClasses)

      // Carregar turmas disponíveis para adicionar
      const { data: allClasses, error: allClassesError } = await supabase
        .from('classes')
        .select('id, name, description, status, start_date, end_date')
        .eq('status', 'active')

      if (allClassesError) throw allClassesError

      const enrolledClassIds = (classesData || []).map((sc: any) => sc.class_id)
      let available = (allClasses || []).filter(
        (c: any) => !enrolledClassIds.includes(c.id)
      )
      // Teacher scope: only show classes owned by the teacher
      if (isTeacher && teacherClassIds.length > 0) {
        available = available.filter((c: any) => teacherClassIds.includes(c.id))
      }
      setAvailableClasses(available)

    } catch (error) {
      logger.error('Erro ao carregar dados:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddClass = async () => {
    if (!selectedClassId) {
      toast({
        title: 'Erro',
        description: 'Selecione uma turma',
        variant: 'destructive'
      })
      return
    }

    // Teacher scope: block adding to classes not owned by the teacher
    if (isTeacher && !teacherClassIds.includes(selectedClassId)) {
      toast({
        title: 'Acesso negado',
        description: 'Você só pode adicionar alunos às suas próprias turmas',
        variant: 'destructive'
      })
      return
    }

    try {
      const { error } = await supabase
        .from('student_classes')
        .insert({
          user_id: userId,
          class_id: selectedClassId,
          enrollment_date: new Date().toISOString().split('T')[0]
        })

      if (error) throw error

      toast({
        title: 'Sucesso',
        description: 'Aluno adicionado à turma'
      })

      setIsAddDialogOpen(false)
      setSelectedClassId('')
      loadData()
    } catch (error) {
      logger.error('Erro ao adicionar turma:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar o aluno à turma',
        variant: 'destructive'
      })
    }
  }

  const handleRemoveClass = async (studentClassId: string, classId?: string) => {
    // Teacher scope: block removing from classes not owned by the teacher
    if (isTeacher && classId && !teacherClassIds.includes(classId)) {
      toast({
        title: 'Acesso negado',
        description: 'Você só pode remover alunos das suas próprias turmas',
        variant: 'destructive'
      })
      return
    }

    if (!confirm('Deseja realmente remover este aluno da turma?')) return

    try {
      const { error } = await supabase
        .from('student_classes')
        .delete()
        .eq('id', studentClassId)

      if (error) throw error

      toast({
        title: 'Sucesso',
        description: 'Aluno removido da turma'
      })

      loadData()
    } catch (error) {
      logger.error('Erro ao remover turma:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o aluno da turma',
        variant: 'destructive'
      })
    }
  }

  const filteredClasses = studentClasses.filter(sc =>
    sc.class?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sc.class?.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading || teacherLoading) {
    return <SectionLoader />
  }

  // Teacher scope: can only manage students in their own classes
  if (isTeacher && userId && !studentIds.includes(userId)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <h2 className="text-xl font-semibold text-foreground">Acesso negado</h2>
        <p className="text-muted-foreground">Você não tem permissão para gerenciar as turmas deste aluno.</p>
        <Button variant="outline" onClick={() => navigate('/admin/management')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Turmas - {user?.first_name} {user?.last_name}</h1>
        <p className="text-muted-foreground">Gerencie as turmas do aluno</p>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/admin/management')}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-bold text-foreground">
                      {user?.first_name} {user?.last_name}
                    </h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {user?.email}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {studentClasses.length} turma(s) matriculada(s)
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setIsAddDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Turma
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar turmas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
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
                    <TableHead>Descrição</TableHead>
                    <TableHead className="hidden md:table-cell">Status</TableHead>
                    <TableHead className="hidden md:table-cell">Matrícula</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClasses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12">
                        <div className="flex flex-col items-center gap-3">
                          <BookOpen className="h-12 w-12 text-muted-foreground/50" />
                          <div>
                            <p className="font-medium text-muted-foreground">Nenhuma turma encontrada</p>
                            <p className="text-sm text-muted-foreground/70">
                              {searchTerm ? 'Tente outra busca' : 'Adicione o aluno a uma turma'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClasses.map((studentClass) => (
                      <TableRow key={studentClass.id}>
                        <TableCell>
                          <div className="font-medium text-foreground">
                            {studentClass.class?.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground max-w-md truncate">
                            {studentClass.class?.description}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge
                            variant={
                              studentClass.class?.status === 'active'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {studentClass.class?.status === 'active' ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {new Date(studentClass.enrollment_date).toLocaleDateString('pt-BR')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveClass(studentClass.id, studentClass.class_id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remover
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Add Class Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Turma</DialogTitle>
              <DialogDescription>
                Selecione uma turma para matricular o aluno
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma turma" />
                </SelectTrigger>
                <SelectContent>
                  {availableClasses.map((classItem) => (
                    <SelectItem key={classItem.id} value={classItem.id}>
                      {classItem.name} - {classItem.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableClasses.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma turma disponível para matrícula
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddClass} disabled={!selectedClassId}>
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
