import { useState, useEffect } from 'react'
import { PageTabs } from '@/components/PageTabs'
import { logger } from '@/lib/logger'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Card, CardContent } from '@/components/ui/card'
import { UserManagement } from '@/components/admin/management/UserManagement'
import { ClassManagement } from '@/components/admin/management/ClassManagement'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Users,
  GraduationCap,
  Settings,
  Shield,
  UserCheck,
  BookOpen
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'

export default function AdminManagementPage() {
  usePageTitle('Gestão de Usuários')
  const { isTeacher, isAdmin, studentIds, loading: teacherLoading } = useTeacherClasses()
  const [activeTab, setActiveTab] = useState('users')

  const [statsKey, setStatsKey] = useState(0)
  const [stats, setStats] = useState({
    totalUsers: 0,
    students: 0,
    teachers: 0,
    administrators: 0,
    totalCourses: 0,
    loading: true
  })

  useEffect(() => {
    if (!teacherLoading) {
      loadStats()
    }
  }, [teacherLoading, statsKey, isTeacher, isAdmin])

  const loadStats = async () => {
    try {
      if (isTeacher && !isAdmin) {
        // Teachers only see their student count
        setStats({
          totalUsers: studentIds.length,
          students: studentIds.length,
          teachers: 0,
          administrators: 0,
          totalCourses: 0,
          loading: false,
        })
        return
      }

      // Count by role using head queries (no data transfer)
      try {
        const [totalR, studentsR, teachersR, adminsR, coursesR] = await Promise.all([
          supabase.from('users').select('id', { count: 'exact', head: true }),
          supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'student'),
          supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
          supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'administrator'),
          supabase.from('video_courses').select('id', { count: 'exact', head: true }),
        ])

        setStats({
          totalUsers: totalR.count || 0,
          students: studentsR.count || 0,
          teachers: teachersR.count || 0,
          administrators: adminsR.count || 0,
          totalCourses: coursesR.count || 0,
          loading: false
        })
      } catch {
        logger.warn('Could not load user counts (RLS or permission issue)')
        setStats(prev => ({ ...prev, loading: false }))
        return
      }
    } catch (error) {
      logger.warn('Erro ao carregar estatisticas:', error)
      setStats(prev => ({ ...prev, loading: false }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        {/* Header Stats */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
            <div className="space-y-4 md:space-y-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-muted/50">
                    <Settings className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                      {isTeacher ? 'Meus Alunos' : 'Painel Administrativo'}
                    </h1>
                    <p className="text-muted-foreground text-sm md:text-lg">
                      {isTeacher ? 'Alunos matriculados nas suas turmas' : 'Gerencie usuarios e turmas'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full bg-muted/50 border border-border">
                  <Shield className="h-3 w-3 md:h-4 md:w-4 text-primary" />
                  <span className="text-xs md:text-sm font-medium text-foreground">
                    {isTeacher ? 'Professor' : 'Admin'}
                  </span>
                </div>
              </div>

              {/* Stats Grid */}
              {isTeacher ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div className="text-center p-3 md:p-4 rounded-xl bg-green-100 dark:bg-green-950/50 border border-green-300 dark:border-green-800">
                    <GraduationCap className="h-5 w-5 md:h-6 md:w-6 text-green-500 mx-auto mb-2" />
                    {stats.loading ? (
                      <Skeleton className="h-6 md:h-8 w-12 md:w-16 mx-auto" />
                    ) : (
                      <div className="text-xl md:text-2xl font-bold text-green-600">{stats.students}</div>
                    )}
                    <div className="text-xs md:text-sm text-muted-foreground">Alunos</div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <div className="text-center p-3 md:p-4 rounded-xl bg-blue-100 dark:bg-blue-950/50 border border-blue-300 dark:border-blue-800">
                    <Users className="h-5 w-5 md:h-6 md:w-6 text-blue-500 mx-auto mb-2" />
                    {stats.loading ? (
                      <Skeleton className="h-6 md:h-8 w-12 md:w-16 mx-auto" />
                    ) : (
                      <div className="text-xl md:text-2xl font-bold text-blue-600">{stats.totalUsers}</div>
                    )}
                    <div className="text-xs md:text-sm text-muted-foreground">Usuarios</div>
                  </div>
                  <div className="text-center p-3 md:p-4 rounded-xl bg-green-100 dark:bg-green-950/50 border border-green-300 dark:border-green-800">
                    <GraduationCap className="h-5 w-5 md:h-6 md:w-6 text-green-500 mx-auto mb-2" />
                    {stats.loading ? (
                      <Skeleton className="h-6 md:h-8 w-12 md:w-16 mx-auto" />
                    ) : (
                      <div className="text-xl md:text-2xl font-bold text-green-600">{stats.students}</div>
                    )}
                    <div className="text-xs md:text-sm text-muted-foreground">Alunos</div>
                  </div>
                  <div className="text-center p-3 md:p-4 rounded-xl bg-purple-100 dark:bg-purple-950/50 border border-purple-300 dark:border-purple-800">
                    <UserCheck className="h-5 w-5 md:h-6 md:w-6 text-purple-500 mx-auto mb-2" />
                    {stats.loading ? (
                      <Skeleton className="h-6 md:h-8 w-12 md:w-16 mx-auto" />
                    ) : (
                      <div className="text-xl md:text-2xl font-bold text-purple-600">{stats.teachers}</div>
                    )}
                    <div className="text-xs md:text-sm text-muted-foreground">Professores</div>
                  </div>
                  <div className="text-center p-3 md:p-4 rounded-xl bg-orange-100 dark:bg-orange-950/50 border border-orange-300 dark:border-orange-800">
                    <BookOpen className="h-5 w-5 md:h-6 md:w-6 text-orange-500 mx-auto mb-2" />
                    {stats.loading ? (
                      <Skeleton className="h-6 md:h-8 w-12 md:w-16 mx-auto" />
                    ) : (
                      <div className="text-xl md:text-2xl font-bold text-orange-600">{stats.totalCourses}</div>
                    )}
                    <div className="text-xs md:text-sm text-muted-foreground">Cursos</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Management Tabs */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
            {isTeacher ? (
              /* Teachers see only the student list, no tabs */
              <div>
                <div className="mb-4 md:mb-6">
                  <h2 className="text-xl md:text-2xl font-bold text-foreground">Meus Alunos</h2>
                  <p className="text-muted-foreground text-sm md:text-base">
                    Alunos matriculados nas suas turmas
                  </p>
                </div>
                <UserManagement isTeacher={true} teacherStudentIds={studentIds} onDataChange={() => setStatsKey(k => k + 1)} />
              </div>
            ) : (
              <div className="w-full">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4 md:mb-6">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-foreground">Gerenciamento</h2>
                    <p className="text-muted-foreground text-sm md:text-base">
                      Administre usuarios e turmas
                    </p>
                  </div>
                </div>
                <PageTabs
                  value={activeTab}
                  onChange={setActiveTab}
                  tabs={[
                    {
                      value: 'users',
                      label: 'Usuarios',
                      icon: <Users className="h-4 w-4" />,
                      content: <UserManagement onDataChange={() => setStatsKey(k => k + 1)} />,
                    },
                    {
                      value: 'classes',
                      label: 'Turmas',
                      icon: <GraduationCap className="h-4 w-4" />,
                      content: <ClassManagement onDataChange={() => setStatsKey(k => k + 1)} />,
                    },
                  ]}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
