import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { SectionLoader } from '@/components/SectionLoader'
import {
  getUserById,
  updateUser,
  banUser,
  unbanUser,
  setUnlimitedAccess,
  getEnrollmentsByUser,
  addUserToClass,
  unenrollFromClass,
} from '@/services/adminUserService'
import {
  ArrowLeft,
  User,
  Shield,
  GraduationCap,
  Clock,
  Save,
  UserCheck,
  UserX,
  Settings,
  Lock,
  MessageSquare,
} from 'lucide-react'

interface CourseRow {
  id: string
  name: string
}

interface ClassRow {
  id: string
  name: string
  class_courses: { course_id: string }[]
}

interface EnrollmentRow {
  id: string
  class_id: string
  subscription_expires_at: string | null
  classes: {
    id: string
    name: string
    class_courses: {
      video_courses: { id: string; name: string }
    }[]
  }
}

interface EnrollmentState {
  classId: string
  expiresAt: string
}

export default function AdminUserProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Section 1 - User data
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Section 2 - Access controls
  const [isBanned, setIsBanned] = useState(false)
  const [isUnlimitedAccess, setIsUnlimitedAccess] = useState(false)
  const [role, setRole] = useState('student')

  // Section 3 - Enrollments
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [enrollmentState, setEnrollmentState] = useState<Record<string, EnrollmentState>>({})

  // Section 4 - History
  const [createdAt, setCreatedAt] = useState('')
  const [totalXp, setTotalXp] = useState(0)
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    try {
      // Fetch user
      const user = await getUserById(userId)
      if (!user) {
        toast({ title: 'Usuário não encontrado', variant: 'destructive' })
        navigate('/admin/management')
        return
      }

      const fullNameValue = `${user.first_name || ''} ${user.last_name || ''}`.trim()
      setFullName(fullNameValue)
      setEmail(user.email)
      setPhone((user as any).phone || '')
      setCpfCnpj((user as any).cpf_cnpj || '')
      setIsBanned((user as any).is_banned || false)
      setIsUnlimitedAccess((user as any).is_unlimited_access || false)
      setRole(user.role || 'student')
      setCreatedAt(user.created_at)
      setLastSeenAt((user as any).last_seen_at || null)

      // Fetch XP
      try {
        const { data: xpData } = await supabase.rpc('get_user_rank_position', { p_user_id: userId })
        if (xpData && xpData.length > 0) {
          setTotalXp(xpData[0].total_xp || 0)
        }
      } catch {
        // XP not critical
      }

      // Fetch all courses
      const { data: coursesData } = await supabase
        .from('video_courses')
        .select('id, name')
        .order('name')
      setCourses(coursesData || [])

      // Fetch all classes with their linked courses
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, name, class_courses(course_id)')
        .order('name')
      setClasses((classesData as any) || [])

      // Fetch user enrollments
      const enrollmentsData = await getEnrollmentsByUser(userId)
      setEnrollments(enrollmentsData as any)

      // Build enrollment state map: courseId -> { classId, expiresAt }
      const stateMap: Record<string, EnrollmentState> = {}
      for (const enrollment of enrollmentsData as any[]) {
        const classCourses = enrollment.classes?.class_courses || []
        for (const cc of classCourses) {
          const courseId = cc.video_courses?.id
          if (courseId) {
            stateMap[courseId] = {
              classId: enrollment.class_id,
              expiresAt: enrollment.subscription_expires_at || '',
            }
          }
        }
      }
      setEnrollmentState(stateMap)
    } catch (error) {
      logger.error('Erro ao carregar dados do usuário:', error)
      toast({ title: 'Erro ao carregar dados', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [userId, navigate, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const getClassesForCourse = (courseId: string): ClassRow[] => {
    return classes.filter(cls =>
      cls.class_courses?.some(cc => cc.course_id === courseId)
    )
  }

  const getEnrollmentStatus = (courseId: string): 'active' | 'expired' | 'none' => {
    const state = enrollmentState[courseId]
    if (!state || !state.classId) return 'none'
    if (state.expiresAt && new Date(state.expiresAt) < new Date()) return 'expired'
    return 'active'
  }

  const handleClassChange = (courseId: string, newClassId: string) => {
    setEnrollmentState(prev => ({
      ...prev,
      [courseId]: {
        classId: newClassId,
        expiresAt: prev[courseId]?.expiresAt || '',
      },
    }))
  }

  const handleExpiresAtChange = (courseId: string, date: string) => {
    setEnrollmentState(prev => ({
      ...prev,
      [courseId]: {
        ...prev[courseId],
        expiresAt: date,
      },
    }))
  }

  const handleClearEnrollment = (courseId: string) => {
    setEnrollmentState(prev => {
      const next = { ...prev }
      delete next[courseId]
      return next
    })
  }

  const handleSave = async () => {
    if (!userId) return

    setSaving(true)

    try {
      // 1. Update user profile
      const nameParts = fullName.trim().split(/\s+/)
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      await updateUser(userId, {
        first_name: firstName,
        last_name: lastName,
        role,
      } as any)

      // Update extra fields via direct query (may not be in typed schema)
      await (supabase as any)
        .from('users')
        .update({
          phone: phone || null,
          cpf_cnpj: cpfCnpj || null,
        })
        .eq('id', userId)

      // 2. Handle ban/unban
      if (isBanned) {
        await banUser(userId)
      } else {
        await unbanUser(userId)
      }

      // 3. Handle unlimited access
      await setUnlimitedAccess(userId, isUnlimitedAccess)

      // 4. Sync enrollments
      // Build map of current enrollments: classId -> enrollmentRow
      const currentEnrollmentsByClass = new Map<string, EnrollmentRow>()
      for (const enrollment of enrollments) {
        currentEnrollmentsByClass.set(enrollment.class_id, enrollment)
      }

      // Desired state: collect all classIds from enrollmentState
      const desiredClassIds = new Set<string>()
      const desiredByClass = new Map<string, string>() // classId -> expiresAt
      for (const [, state] of Object.entries(enrollmentState)) {
        if (state.classId) {
          desiredClassIds.add(state.classId)
          desiredByClass.set(state.classId, state.expiresAt)
        }
      }

      // Remove enrollments that are no longer desired
      for (const enrollment of enrollments) {
        if (!desiredClassIds.has(enrollment.class_id)) {
          await unenrollFromClass(userId, enrollment.class_id)
        }
      }

      // Add new enrollments or update expiration
      for (const [classId, expiresAt] of desiredByClass.entries()) {
        const existing = currentEnrollmentsByClass.get(classId)
        if (!existing) {
          // New enrollment
          await addUserToClass(userId, classId, expiresAt || undefined)
        } else if (existing.subscription_expires_at !== (expiresAt || null)) {
          // Update expiration date
          await supabase
            .from('student_classes')
            .update({ subscription_expires_at: expiresAt || null })
            .eq('id', existing.id)
        }
      }

      toast({ title: 'Membro atualizado com sucesso!' })
      navigate('/admin/management')
    } catch (error) {
      logger.error('Erro ao salvar dados do membro:', error)
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <SectionLoader />

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '--'
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Editar Membro</h1>
        <p className="text-sm text-muted-foreground">{email}</p>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Card */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/admin/management')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-muted/50">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Editar Membro</h2>
                  <p className="text-sm text-muted-foreground">{email}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 1 - Dados do Membro */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <User className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle>Dados do Membro</CardTitle>
                <CardDescription>Informações pessoais do usuário</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-sm font-semibold">Nome Completo *</label>
                <Input
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Nome completo do membro"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-semibold">Email</label>
                <Input
                  value={email}
                  disabled
                  readOnly
                  className="mt-1 bg-muted/50"
                />
              </div>

              <div>
                <label className="text-sm font-semibold">Telefone</label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="flex-1"
                  />
                  {phone && (
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="shrink-0 border-green-500/50 text-green-600 hover:bg-green-500/10"
                      onClick={() => {
                        const digits = phone.replace(/\D/g, '')
                        const number = digits.startsWith('55') ? digits : `55${digits}`
                        window.open(`https://wa.me/${number}`, '_blank')
                      }}
                      title="Chamar no WhatsApp"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-semibold">CPF/CNPJ</label>
                <Input
                  value={cpfCnpj}
                  onChange={e => setCpfCnpj(e.target.value)}
                  placeholder="000.000.000-00"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Alterar Senha</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Para redefinir a senha de um usuário, use o painel do Supabase Authentication.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 2 - Controles de Acesso */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Shield className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <CardTitle>Controles de Acesso</CardTitle>
                <CardDescription>Permissões e restrições do membro</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <UserX className="h-5 w-5 text-red-500" />
                  <span className="text-base font-semibold">Banido</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Impede o acesso do aluno na área de membros
                </p>
              </div>
              <Switch checked={isBanned} onCheckedChange={setIsBanned} />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-green-500" />
                  <span className="text-base font-semibold">Acesso Ilimitado</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Todos os conteúdos liberados (atuais e futuros)
                </p>
              </div>
              <Switch checked={isUnlimitedAccess} onCheckedChange={setIsUnlimitedAccess} />
            </div>

            <div>
              <label className="text-sm font-semibold">Função</label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione uma função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Estudante
                    </div>
                  </SelectItem>
                  <SelectItem value="teacher">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      Professor
                    </div>
                  </SelectItem>
                  <SelectItem value="administrator">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Administrador
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Section 3 - Controle de Matrículas */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <GraduationCap className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <CardTitle>Controle de Matrículas</CardTitle>
                <CardDescription>Gerencie as matrículas do membro nos cursos</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Curso</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Turma</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Expiração</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map(course => {
                    const availableClasses = getClassesForCourse(course.id)
                    const state = enrollmentState[course.id]
                    const status = getEnrollmentStatus(course.id)

                    return (
                      <tr key={course.id} className="border-b border-border/50">
                        <td className="py-3 px-2 font-medium">{course.name}</td>
                        <td className="py-3 px-2">
                          {availableClasses.length > 0 ? (
                            <Select
                              value={state?.classId || 'none'}
                              onValueChange={val => {
                                if (val === 'none') {
                                  handleClearEnrollment(course.id)
                                } else {
                                  handleClassChange(course.id, val)
                                }
                              }}
                            >
                              <SelectTrigger className="w-48 h-9">
                                <SelectValue placeholder="--" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">--</SelectItem>
                                {availableClasses.map(cls => (
                                  <SelectItem key={cls.id} value={cls.id}>
                                    {cls.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-muted-foreground">Nenhuma turma</span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          {state?.classId ? (
                            <Input
                              type="date"
                              value={state.expiresAt?.split('T')[0] || ''}
                              onChange={e => handleExpiresAtChange(course.id, e.target.value)}
                              className="w-40 h-9"
                            />
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          {status === 'active' && (
                            <Badge variant="default" className="bg-green-500/10 text-green-700 border-green-500/20">
                              Ativo
                            </Badge>
                          )}
                          {status === 'expired' && (
                            <Badge variant="default" className="bg-red-500/10 text-red-700 border-red-500/20">
                              Expirado
                            </Badge>
                          )}
                          {status === 'none' && (
                            <Badge variant="secondary" className="text-muted-foreground">
                              Não matriculado
                            </Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {courses.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground">
                        Nenhum curso encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Section 4 - Histórico */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Clock className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <CardTitle>Histórico</CardTitle>
                <CardDescription>Informações de atividade do membro</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 rounded-xl bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Data de Criação</p>
                <p className="text-sm font-semibold">{formatDate(createdAt)}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">XP Acumulado</p>
                <p className="text-sm font-semibold">{totalXp.toLocaleString('pt-BR')} XP</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Último Acesso</p>
                <p className="text-sm font-semibold">{formatDate(lastSeenAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2 pb-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/management')}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !fullName.trim()}
            className="flex-1"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </div>
    </div>
  )
}
