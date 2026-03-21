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
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import {
  Users,
  UserPlus,
  UserMinus,
  Search,
  ArrowLeft,
  Mail,
  Calendar,
  GraduationCap,
} from 'lucide-react'
import { SectionLoader } from '@/components/SectionLoader'
import { useToast } from '@/hooks/use-toast'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'
import { supabase } from '@/lib/supabase/client'
import { getUsers } from '@/services/adminUserService'
import type { User } from '@/services/adminUserService'

interface ClassStudent {
  id: string
  user_id: string
  class_id: string
  enrollment_date: string  // ✅ FIX: campo correto do banco
  user?: {
    id: string
    email: string
    first_name: string
    last_name: string
  }
}

export default function AdminClassStudentsPage() {
  const { classId } = useParams<{ classId: string }>()
  const navigate = useNavigate()
  usePageTitle('Alunos da Turma')
  const { toast } = useToast()
  const { classIds: teacherClassIds, isTeacher, isAdmin, loading: teacherLoading } = useTeacherClasses()

  const [className, setClassName] = useState('')
  const [students, setStudents] = useState<ClassStudent[]>([])
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    if (teacherLoading) return
    // Teacher can only manage students in their own classes
    if (isTeacher && classId && !teacherClassIds.includes(classId)) {
      toast({ title: 'Acesso negado', description: 'Você não tem permissão para gerenciar esta turma.', variant: 'destructive' })
      navigate('/admin/classes')
      return
    }
    loadData()
  }, [classId, teacherLoading])

  const loadData = async () => {
    try {
      setLoading(true)

      // Carregar info da turma
      const { data: classData } = await supabase
        .from('classes')
        .select('name')
        .eq('id', classId)
        .single()

      if (classData) {
        setClassName(classData.name)
      }

      // Carregar alunos da turma
      const { data: studentsData, error: studentsError} = await supabase
        .from('student_classes')
        .select('id, user_id, class_id, enrollment_date')
        .eq('class_id', classId)

      if (studentsError) {
        logger.error('Error loading students:', studentsError)
        throw studentsError
      }

      logger.debug('📚 Students data from DB:', studentsData)

      // Carregar dados dos usuários separadamente
      if (studentsData && studentsData.length > 0) {
        const userIds = studentsData.map(s => s.user_id)
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, email, first_name, last_name')
          .in('id', userIds)

        if (usersError) {
          logger.error('Error loading users:', usersError)
          throw usersError
        }

        // Mapear os dados combinando student_classes com users
        const mappedStudents = studentsData.map((student: any) => {
          const user = usersData?.find(u => u.id === student.user_id)
          return {
            ...student,
            user: user || null
          }
        })

        logger.debug('✅ Mapped students:', mappedStudents)
        setStudents(mappedStudents)
      } else {
        setStudents([])
      }

      // Carregar usuários estudantes disponíveis para adicionar (paginado)
      const { data: allUsers } = await getUsers(0, 200, undefined, 'student')
      logger.debug('👥 All users:', allUsers.length)
      const enrolledIds = (studentsData || []).map((s: any) => s.user_id)
      logger.debug('📝 Enrolled IDs:', enrolledIds)
      const available = allUsers.filter(u => !enrolledIds.includes(u.id))
      logger.debug('✨ Available users:', available.length)
      setAvailableUsers(available)

    } catch (error) {
      logger.error('❌ Erro ao carregar dados:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddStudent = async () => {
    if (!selectedUserId) {
      toast({
        title: 'Erro',
        description: 'Selecione um aluno',
        variant: 'destructive'
      })
      return
    }
    if (isAdding) return
    setIsAdding(true)

    try {
      const { error } = await supabase
        .from('student_classes')
        .insert({
          user_id: selectedUserId,
          class_id: classId,
          enrollment_date: new Date().toISOString().split('T')[0]
        })

      if (error) throw error

      toast({
        title: 'Sucesso',
        description: 'Aluno adicionado à turma'
      })

      setIsAddDialogOpen(false)
      setSelectedUserId('')
      loadData()
    } catch (error) {
      logger.error('❌ Erro ao adicionar aluno:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar o aluno',
        variant: 'destructive'
      })
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveStudent = async (studentClassId: string) => {
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
      logger.error('❌ Erro ao remover aluno:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o aluno',
        variant: 'destructive'
      })
    }
  }

  const filteredStudents = students.filter(s =>
    s.user?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.user?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.user?.last_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return <SectionLoader />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{`Alunos - ${className}`}</h1>
        <p className="text-sm text-muted-foreground">Gerencie os alunos matriculados nesta turma</p>
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
                  onClick={() => navigate('/admin/classes')}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{className}</h2>
                  <p className="text-sm text-muted-foreground">
                    {students.length} aluno(s) matriculado(s)
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setIsAddDialogOpen(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Adicionar Aluno
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
                placeholder="Buscar alunos..."
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
                  <TableHead>Aluno</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="hidden md:table-cell">Matrícula</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <Users className="h-12 w-12 text-muted-foreground/50" />
                        <div>
                          <p className="font-medium text-muted-foreground">Nenhum aluno encontrado</p>
                          <p className="text-sm text-muted-foreground/60">
                            {searchTerm ? 'Tente outra busca' : 'Adicione alunos a esta turma'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="font-medium">
                          {student.user?.first_name} {student.user?.last_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          {student.user?.email}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {/* ✅ FIX: usar enrollment_date ao invés de enrolled_at */}
                          {student.enrollment_date ? new Date(student.enrollment_date).toLocaleDateString('pt-BR') : 'Data não disponível'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveStudent(student.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <UserMinus className="h-4 w-4 mr-2" />
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

        {/* Add Student Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Aluno</DialogTitle>
              <DialogDescription>
                Selecione um aluno para adicionar a esta turma
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <SearchableCombobox
                options={availableUsers.map(u => ({
                  value: u.id,
                  label: `${u.first_name} ${u.last_name}`.trim() || u.email,
                  sublabel: u.email,
                }))}
                value={selectedUserId}
                onValueChange={setSelectedUserId}
                placeholder="Selecione um aluno"
                searchPlaceholder="Buscar por nome ou email..."
                emptyMessage={availableUsers.length === 0
                  ? 'Todos os alunos já estão matriculados nesta turma'
                  : 'Nenhum aluno encontrado'
                }
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddStudent} disabled={!selectedUserId || isAdding}>
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
