import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { logger } from '@/lib/logger'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableCombobox } from '@/components/ui/searchable-combobox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { MoreHorizontal, PlusCircle, Search, Edit, Trash2, UserX, UserCheck, RefreshCw, GraduationCap, Users as UsersIcon, Loader2, Circle, AlertTriangle, CheckCircle2, Eye, KeyRound, BookOpen } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getUsers, updateUser, type User, getUsersWithClasses, type UserWithClasses } from '@/services/adminUserService'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { supabase } from '@/lib/supabase/client'

interface UserManagementProps {
  /** When true, the viewer is a teacher — hide admin actions and filter to their students */
  isTeacher?: boolean
  /** Student IDs belonging to this teacher's classes (only used when isTeacher) */
  teacherStudentIds?: string[]
  /** Callback when user data changes (add/remove) so parent can refresh stats */
  onDataChange?: () => void
}

export const UserManagement = ({ isTeacher = false, teacherStudentIds = [], onDataChange }: UserManagementProps) => {
  const [users, setUsers] = useState<UserWithClasses[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserWithClasses[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [classFilter, setClassFilter] = useState<string>('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<UserWithClasses | null>(null)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editRole, setEditRole] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingUser, setDeletingUser] = useState<UserWithClasses | null>(null)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserFirstName, setNewUserFirstName] = useState('')
  const [newUserLastName, setNewUserLastName] = useState('')
  const [newUserClassId, setNewUserClassId] = useState('')
  const [availableClasses, setAvailableClasses] = useState<{ id: string; name: string }[]>([])
  const { toast } = useToast()

  useEffect(() => {
    loadUsers()
    loadClasses()
  }, [isTeacher, teacherStudentIds.length])

  useEffect(() => {
    filterUsers()
  }, [users, searchTerm, roleFilter, statusFilter, classFilter])

  const loadUsers = async () => {
    setIsLoading(true)
    try {
      const result = await getUsersWithClasses(0, 200)
      let data = result.data
      // For teachers, only show their students
      if (isTeacher && teacherStudentIds.length > 0) {
        const studentSet = new Set(teacherStudentIds)
        data = data.filter(u => studentSet.has(u.id))
      } else if (isTeacher) {
        // Teacher with no students
        data = []
      }
      setUsers(data)
      setFilteredUsers(data)
    } catch (error) {
      logger.error('❌ Erro ao carregar usuários:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os usuários.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadClasses = async () => {
    try {
      const { data } = await supabase
        .from('classes')
        .select('id, name')
        .order('name')
      if (data) setAvailableClasses(data)
    } catch (error) {
      logger.error('Erro ao carregar turmas:', error)
    }
  }

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserFirstName || !newUserLastName) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha email, nome e sobrenome.',
        variant: 'destructive',
      })
      return
    }

    setIsCreating(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: newUserEmail,
          first_name: newUserFirstName,
          last_name: newUserLastName,
          class_id: newUserClassId || null,
        },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      toast({
        title: 'Aluno criado!',
        description: 'Um email de boas-vindas será enviado com o link de acesso.',
      })

      setShowCreateDialog(false)
      setNewUserEmail('')
      setNewUserFirstName('')
      setNewUserLastName('')
      setNewUserClassId('')
      loadUsers()
    } catch (error: any) {
      toast({
        title: 'Erro ao criar aluno',
        description: error.message || 'Não foi possível criar o aluno.',
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
    }
  }

  const filterUsers = () => {
    let filtered = [...users]

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(user =>
        `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by role
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter)
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(user =>
        statusFilter === 'active' ? user.is_active : !user.is_active
      )
    }

    // Filter by class (Degustação)
    if (classFilter === 'tasting') {
      filtered = filtered.filter(user => user.isInTastingClass)
    } else if (classFilter === 'not_tasting') {
      filtered = filtered.filter(user => !user.isInTastingClass && user.role === 'student')
    } else if (classFilter === 'no_class') {
      filtered = filtered.filter(user =>
        user.role === 'student' && (!user.classes || user.classes.length === 0)
      )
    }

    setFilteredUsers(filtered)
  }

  const handleToggleStatus = async (user: User) => {
    const action = user.is_active ? 'desativar' : 'ativar'
    const name = `${user.first_name} ${user.last_name}`.trim() || user.email
    try {
      await updateUser(user.id, { is_active: !user.is_active })
      toast({
        title: user.is_active ? 'Usuário desativado' : 'Usuário ativado',
        description: `${name} foi ${user.is_active ? 'desativado' : 'ativado'} com sucesso.`,
      })
      loadUsers()
    } catch (error) {
      logger.error(`Erro ao ${action} usuário:`, error)
      toast({
        title: `Erro ao ${action}`,
        description: `Não foi possível ${action} ${name}. Tente novamente.`,
        variant: 'destructive'
      })
    }
  }

  const openEditDialog = (user: UserWithClasses) => {
    setEditingUser(user)
    setEditFirstName(user.first_name || '')
    setEditLastName(user.last_name || '')
    setEditRole(user.role)
    setShowEditDialog(true)
  }

  const handleEditUser = async () => {
    if (!editingUser) return
    const name = `${editFirstName} ${editLastName}`.trim() || editingUser.email
    setIsSaving(true)
    try {
      const updates: Record<string, any> = {
        first_name: editFirstName,
        last_name: editLastName,
      }
      // Teachers cannot change roles
      if (!isTeacher) {
        updates.role = editRole as 'student' | 'teacher' | 'administrator'
      }
      await updateUser(editingUser.id, updates)
      toast({
        title: 'Alterações salvas',
        description: `Os dados de ${name} foram atualizados.`,
      })
      setShowEditDialog(false)
      setEditingUser(null)
      loadUsers()
    } catch (error) {
      logger.error('Erro ao editar usuário:', error)
      toast({
        title: 'Erro ao salvar',
        description: `Não foi possível salvar as alterações de ${name}. Tente novamente.`,
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const openDeleteDialog = (user: UserWithClasses) => {
    setDeletingUser(user)
    setShowDeleteDialog(true)
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return
    const name = `${deletingUser.first_name} ${deletingUser.last_name}`.trim() || deletingUser.email
    setIsDeleting(true)
    try {
      const { error } = await supabase.rpc('admin_delete_user', { p_user_id: deletingUser.id })
      if (error) {
        // RPC may not exist yet in production (migration not deployed)
        if (error.message?.includes('Could not find') || error.code === '404' || error.message?.includes('does not exist')) {
          throw new Error('Função de exclusão ainda não está disponível. Aguarde a atualização do sistema.')
        }
        throw error
      }
      toast({
        title: 'Usuário removido',
        description: `${name} foi removido permanentemente da plataforma.`,
      })
      setShowDeleteDialog(false)
      setDeletingUser(null)
      loadUsers()
    } catch (error: any) {
      logger.error('Erro ao deletar usuário:', error)
      const msg = error?.message?.includes('administradores')
        ? error.message
        : error?.message?.includes('própria')
          ? error.message
          : `Não foi possível remover ${name}. Tente novamente.`
      toast({
        title: 'Erro ao remover',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'administrator':
        return 'destructive'
      case 'teacher':
        return 'default'
      case 'student':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'administrator':
        return 'Administrador'
      case 'teacher':
        return 'Professor'
      case 'student':
        return 'Aluno'
      default:
        return role
    }
  }

  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false
    const diff = Date.now() - new Date(lastSeen).getTime()
    return diff < 5 * 60 * 1000 // online if seen in last 5 minutes
  }

  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return 'Nunca acessou'
    const date = new Date(lastSeen)
    const now = Date.now()
    const diffMs = now - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMin < 1) return 'Agora'
    if (diffMin < 60) return `${diffMin}min atrás`
    if (diffHours < 24) return `${diffHours}h atrás`
    if (diffDays < 7) return `${diffDays}d atrás`
    return date.toLocaleDateString('pt-BR')
  }

  const onlineCount = users.filter(u => isOnline(u.last_seen_at)).length

  const tastingCount = users.filter(u => u.isInTastingClass).length
  const regularCount = users.filter(u => !u.isInTastingClass && u.role === 'student' && u.classes && u.classes.length > 0).length
  const noClassCount = users.filter(u => u.role === 'student' && (!u.classes || u.classes.length === 0)).length

  return (
    <>
      {/* Online Now Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/50">
          <CardHeader className="pb-3">
            <CardDescription className="text-emerald-700 dark:text-emerald-400">Online Agora</CardDescription>
            <CardTitle className="text-3xl text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
              <Circle className="h-3 w-3 fill-emerald-500 text-emerald-500 animate-pulse" />
              {onlineCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Usuários ativos nos últimos 5 min
            </p>
          </CardContent>
        </Card>
        {tastingCount > 0 && (
          <>
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/50">
            <CardHeader className="pb-3">
              <CardDescription className="text-amber-700 dark:text-amber-400">Em Degustação</CardDescription>
              <CardTitle className="text-3xl text-amber-900 dark:text-amber-300">
                {tastingCount}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Alunos com acesso de teste
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-950/50"
                onClick={() => setClassFilter('tasting')}
              >
                Ver alunos em Degustação
              </Button>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/50">
            <CardHeader className="pb-3">
              <CardDescription className="text-green-700 dark:text-green-400">Alunos Ativos</CardDescription>
              <CardTitle className="text-3xl text-green-900 dark:text-green-300">
                {regularCount}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-green-600 dark:text-green-400">
                Em turmas regulares
              </p>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/50">
            <CardHeader className="pb-3">
              <CardDescription className="text-red-700 dark:text-red-400">Necessita Atenção</CardDescription>
              <CardTitle className="text-3xl text-red-900 dark:text-red-300">
                {noClassCount}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-red-600 dark:text-red-400">
                Alunos sem nenhuma turma
              </p>
            </CardContent>
          </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {isTeacher ? 'Meus Alunos' : 'Usuários'} ({filteredUsers.length} de {users.length})
              </CardTitle>
              <CardDescription>
                {isTeacher
                  ? 'Alunos matriculados nas suas turmas.'
                  : 'Gerencie todos os usuários da plataforma.'}
              </CardDescription>
            </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={loadUsers}
              disabled={isLoading}
              title="Atualizar lista"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            {!isTeacher && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Adicionar Usuário
              </Button>
            )}
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {!isTeacher && (
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por função" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as funções</SelectItem>
                <SelectItem value="student">Alunos</SelectItem>
                <SelectItem value="teacher">Professores</SelectItem>
                <SelectItem value="administrator">Administradores</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
          {!isTeacher && (
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por turma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as turmas</SelectItem>
                <SelectItem value="tasting">Na Degustação</SelectItem>
                <SelectItem value="not_tasting">Em turma regular</SelectItem>
                <SelectItem value="no_class">Sem turma</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Turmas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead>Último Acesso</TableHead>
              <TableHead>
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded-md ml-auto" /></TableCell>
                  </TableRow>
                ))
              : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum usuário encontrado com os filtros aplicados.
                    </TableCell>
                  </TableRow>
                )
              : filteredUsers.map((user) => {
                  const userOnline = isOnline(user.last_seen_at)
                  return (
                  <TableRow key={user.id} className="group hover:bg-primary/5">
                    <TableCell className="font-medium group-hover:text-primary transition-colors">
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger>
                            <Circle className={`h-2.5 w-2.5 flex-shrink-0 ${
                              userOnline
                                ? 'fill-emerald-500 text-emerald-500'
                                : 'fill-gray-300 text-gray-300 dark:fill-gray-600 dark:text-gray-600'
                            }`} />
                          </TooltipTrigger>
                          <TooltipContent>
                            {userOnline ? 'Online agora' : formatLastSeen(user.last_seen_at)}
                          </TooltipContent>
                        </Tooltip>
                        {user.first_name} {user.last_name}
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role) as any}>
                        {getRoleLabel(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.role === 'student' && (
                          <>
                            {user.isInTastingClass ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-700">
                                Degustação
                              </Badge>
                            ) : user.classes && user.classes.length > 0 ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 dark:bg-green-950/50 dark:text-green-400 dark:border-green-700">
                                {user.classes.length} turma(s)
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 dark:bg-red-950/50 dark:text-red-400 dark:border-red-700">
                                Sem turma
                              </Badge>
                            )}
                          </>
                        )}
                        {user.role !== 'student' && (
                          <>
                            {user.classes && user.classes.length > 0 ? (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-700">
                                {user.classes.length} turma(s)
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.is_active ? 'default' : 'destructive'}
                      >
                        {user.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger className="cursor-default">
                          <span className={userOnline ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
                            {formatLastSeen(user.last_seen_at)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {user.last_seen_at
                            ? new Date(user.last_seen_at).toLocaleString('pt-BR')
                            : 'Nunca acessou a plataforma'}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            aria-haspopup="true"
                            size="icon"
                            variant="ghost"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuItem asChild>
                            <Link to={`/admin/users/${user.id}/profile`}>
                              <Eye className="mr-2 h-4 w-4" /> Ver Perfil Completo
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(user)}>
                            <Edit className="mr-2 h-4 w-4" /> Editar Rápido
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {!isTeacher && user.role === 'student' && (
                            <DropdownMenuItem asChild>
                              <Link to={`/admin/users/${user.id}/classes`}>
                                <GraduationCap className="mr-2 h-4 w-4" /> Gerenciar Turmas
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={async () => {
                              try {
                                await supabase.auth.resetPasswordForEmail(user.email, {
                                  redirectTo: `${window.location.origin}/reset-password`,
                                })
                                toast({ title: 'Email enviado', description: `Link de redefinição enviado para ${user.email}` })
                              } catch {
                                toast({ title: 'Erro', description: 'Não foi possível enviar o email', variant: 'destructive' })
                              }
                            }}
                          >
                            <KeyRound className="mr-2 h-4 w-4" /> Resetar Senha
                          </DropdownMenuItem>
                          {!isTeacher && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
                                {user.is_active ? (
                                  <>
                                    <UserX className="mr-2 h-4 w-4" /> Desativar
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="mr-2 h-4 w-4" /> Ativar
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => openDeleteDialog(user)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Remover Usuário
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  )
                })}
          </TableBody>
        </Table>
        </TooltipProvider>
      </CardContent>
    </Card>
    {/* Create User Dialog */}
    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Aluno</DialogTitle>
          <DialogDescription>
            O aluno receberá um email de boas-vindas com link de acesso à plataforma.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input
              type="email"
              placeholder="aluno@email.com"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                placeholder="Nome"
                value={newUserFirstName}
                onChange={(e) => setNewUserFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Sobrenome *</Label>
              <Input
                placeholder="Sobrenome"
                value={newUserLastName}
                onChange={(e) => setNewUserLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Turma (opcional)</Label>
            <SearchableCombobox
              options={availableClasses.map(cls => ({ value: cls.id, label: cls.name }))}
              value={newUserClassId}
              onValueChange={setNewUserClassId}
              placeholder="Selecione uma turma"
              searchPlaceholder="Buscar turma..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreateUser} disabled={isCreating}>
            {isCreating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="mr-2 h-4 w-4" />
            )}
            Criar Aluno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {/* Edit User Dialog */}
    <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>
            Altere os dados do usuário {editingUser?.email}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Sobrenome</Label>
              <Input
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
              />
            </div>
          </div>
          {!isTeacher && (
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Aluno</SelectItem>
                  <SelectItem value="teacher">Professor</SelectItem>
                  <SelectItem value="administrator">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleEditUser} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <Dialog open={showDeleteDialog} onOpenChange={(open) => { if (!isDeleting) setShowDeleteDialog(open) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Remover Usuário
          </DialogTitle>
          <DialogDescription>
            Esta ação é permanente e não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        {deletingUser && (
          <div className="py-4 space-y-3">
            <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/5">
              <p className="text-sm font-medium">
                {deletingUser.first_name} {deletingUser.last_name}
              </p>
              <p className="text-xs text-muted-foreground">{deletingUser.email}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Todos os dados deste usuário serão removidos, incluindo progresso em cursos,
              flashcards, tentativas de simulados, posts no fórum e matrículas em turmas.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDeleteUser} disabled={isDeleting}>
            {isDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            {isDeleting ? 'Removendo...' : 'Sim, Remover Permanentemente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
