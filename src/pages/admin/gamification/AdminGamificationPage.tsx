import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { logger } from '@/lib/logger'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageTabs, type TabItem } from '@/components/PageTabs'
import { Textarea } from '@/components/ui/textarea'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Trophy,
  Award,
  Star,
  Zap,
  Target,
  TrendingUp,
  Users,
  BarChart3,
  PlusCircle,
  Edit,
  Trash2,
  Medal,
  Crown,
  Shield,
  Flame,
  Gift,
  FileText,
  ClipboardList
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import { SectionLoader } from '@/components/SectionLoader'
import { useToast } from '@/hooks/use-toast'
import { useTeacherClasses } from '@/hooks/useTeacherClasses'
import {
  getAchievements,
  createAchievement,
  updateAchievement,
  deleteAchievement,
  getRanking,
  getGamificationStats,
  type Achievement,
  type RankingEntry
} from '@/services/gamificationService'

export default function AdminGamificationPage() {
  usePageTitle('Gamificação')
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [simulationRanking, setSimulationRanking] = useState<{ user_id: string; first_name: string; last_name: string; total_attempts: number; best_percentage: number; avg_percentage: number }[]>([])
  const [essayRanking, setEssayRanking] = useState<{ user_id: string; first_name: string; last_name: string; total_essays: number; best_grade: number; avg_grade: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null)
  const [newAchievement, setNewAchievement] = useState({
    name: '',
    description: '',
    icon_url: '🏆',
    xp_reward: 100,
    category: 'general'
  })
  const [stats, setStats] = useState({
    totalAchievements: 0,
    totalUnlocked: 0,
    totalXP: 0,
    activeUsers: 0
  })
  const { toast } = useToast()
  const { studentIds, isTeacher, isAdmin, loading: teacherLoading } = useTeacherClasses()

  useEffect(() => {
    if (isTeacher && activeTab === 'overview') {
      setActiveTab('ranking')
    }
  }, [isTeacher])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [achievementsData, rankingData, statsData] = await Promise.allSettled([
        getAchievements(),
        getRanking(50),
        getGamificationStats()
      ])

      if (achievementsData.status === 'fulfilled') setAchievements(achievementsData.value)
      if (rankingData.status === 'fulfilled') setRanking(rankingData.value)
      if (statsData.status === 'fulfilled') setStats(statsData.value)

      // Load simulation ranking (from quiz_attempts where quiz type is 'simulation')
      try {
        const { data: simData } = await supabase
          .from('quiz_attempts')
          .select('user_id, percentage, quiz:quizzes!inner(type)')
          .eq('status', 'submitted')
          .eq('quizzes.type', 'simulation')
          .not('percentage', 'is', null)

        if (simData && simData.length > 0) {
          const simMap = new Map<string, { percentages: number[] }>()
          for (const row of simData) {
            const entry = simMap.get(row.user_id) || { percentages: [] }
            entry.percentages.push(row.percentage || 0)
            simMap.set(row.user_id, entry)
          }
          const userIds = [...simMap.keys()]
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, last_name')
            .in('id', userIds)
          const profileMap = new Map((profiles || []).map(p => [p.id, p]))
          const simRanking = userIds.map(uid => {
            const p = profileMap.get(uid)
            const entry = simMap.get(uid)!
            const best = Math.max(...entry.percentages)
            const avg = entry.percentages.reduce((a, b) => a + b, 0) / entry.percentages.length
            return {
              user_id: uid,
              first_name: p?.first_name || '',
              last_name: p?.last_name || '',
              total_attempts: entry.percentages.length,
              best_percentage: Math.round(best * 100) / 100,
              avg_percentage: Math.round(avg * 100) / 100,
            }
          }).sort((a, b) => b.best_percentage - a.best_percentage)
          setSimulationRanking(simRanking)
        }
      } catch (e) { logger.error('Erro ao carregar ranking simulados:', e) }

      // Load essay ranking (from essays with status=corrected)
      try {
        const { data: essayData } = await supabase
          .from('essays')
          .select('student_id, final_grade')
          .eq('status', 'corrected' as any)
          .not('final_grade', 'is', null)

        if (essayData && essayData.length > 0) {
          const essayMap = new Map<string, { grades: number[] }>()
          for (const row of essayData) {
            const entry = essayMap.get(row.student_id) || { grades: [] }
            entry.grades.push(row.final_grade || 0)
            essayMap.set(row.student_id, entry)
          }
          const userIds = [...essayMap.keys()]
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, last_name')
            .in('id', userIds)
          const profileMap = new Map((profiles || []).map(p => [p.id, p]))
          const essRanking = userIds.map(uid => {
            const p = profileMap.get(uid)
            const entry = essayMap.get(uid)!
            const best = Math.max(...entry.grades)
            const avg = entry.grades.reduce((a, b) => a + b, 0) / entry.grades.length
            return {
              user_id: uid,
              first_name: p?.first_name || '',
              last_name: p?.last_name || '',
              total_essays: entry.grades.length,
              best_grade: Math.round(best),
              avg_grade: Math.round(avg),
            }
          }).sort((a, b) => b.best_grade - a.best_grade)
          setEssayRanking(essRanking)
        }
      } catch (e) { logger.error('Erro ao carregar ranking redações:', e) }
    } catch (error) {
      logger.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEditAchievement = (achievement: Achievement) => {
    setEditingAchievement(achievement)
    setNewAchievement({
      name: achievement.name,
      description: achievement.description || '',
      icon_url: achievement.icon_url || '🏆',
      xp_reward: achievement.xp_reward,
      category: achievement.category || 'general'
    })
    setIsCreateDialogOpen(true)
  }

  const handleSaveAchievement = async () => {
    if (!newAchievement.name.trim()) {
      toast({ title: 'Erro', description: 'Digite o nome da conquista', variant: 'destructive' })
      return
    }

    setIsSaving(true)
    try {
      if (editingAchievement) {
        await updateAchievement(editingAchievement.id, newAchievement)
        toast({ title: 'Sucesso', description: 'Conquista atualizada com sucesso' })
      } else {
        await createAchievement(newAchievement)
        toast({ title: 'Sucesso', description: 'Conquista criada com sucesso' })
      }

      setIsCreateDialogOpen(false)
      setEditingAchievement(null)
      setNewAchievement({ name: '', description: '', icon_url: '🏆', xp_reward: 100, category: 'general' })
      loadData()
    } catch (error) {
      logger.error('Erro ao salvar conquista:', error)
      toast({ title: 'Erro', description: 'Não foi possível salvar a conquista', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteAchievement = async (achievement: Achievement) => {
    if (!confirm(`Tem certeza que deseja excluir "${achievement.name}"? Esta ação não pode ser desfeita.`)) {
      return
    }

    try {
      await deleteAchievement(achievement.id)
      toast({ title: 'Sucesso', description: 'Conquista excluída com sucesso' })
      loadData()
    } catch (error) {
      logger.error('Erro ao excluir conquista:', error)
      toast({ title: 'Erro', description: 'Não foi possível excluir a conquista', variant: 'destructive' })
    }
  }

  const getCategoryBadge = (category: string) => {
    const categories: Record<string, { label: string; className: string }> = {
      general: { label: 'Geral', className: 'bg-muted/50 border-border text-muted-foreground' },
      study: { label: 'Estudos', className: 'bg-blue-100 border-blue-300 text-blue-600' },
      quiz: { label: 'Quiz', className: 'bg-purple-100 border-purple-300 text-purple-600' },
      essay: { label: 'Redação', className: 'bg-green-100 border-green-300 text-green-600' },
      social: { label: 'Social', className: 'bg-orange-100 border-orange-300 text-orange-600' }
    }

    const cat = categories[category] || categories.general
    return <Badge className={cat.className}>{cat.label}</Badge>
  }

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-500" />
      case 2:
        return <Medal className="h-5 w-5 text-muted-foreground/70" />
      case 3:
        return <Medal className="h-5 w-5 text-amber-600" />
      default:
        return <span className="text-sm font-bold text-muted-foreground">#{position}</span>
    }
  }

  // Filter ranking for teachers (only their students)
  const studentIdSet = useMemo(() => new Set(studentIds), [studentIds])
  const filteredRanking = useMemo(() => {
    if (!isTeacher) return ranking
    return ranking
      .filter((entry) => studentIdSet.has(entry.user_id))
      .map((entry, idx) => ({ ...entry, position: idx + 1 }))
  }, [ranking, isTeacher, studentIdSet])

  // Compute stats scoped to the teacher's students
  const filteredStats = useMemo(() => {
    if (!isTeacher) return stats
    const totalXP = filteredRanking.reduce((sum, e) => sum + e.total_xp, 0)
    const totalUnlocked = filteredRanking.reduce((sum, e) => sum + e.achievements_count, 0)
    return {
      ...stats,
      totalUnlocked,
      totalXP,
      activeUsers: filteredRanking.length
    }
  }, [stats, filteredRanking, isTeacher])

  const filteredSimRanking = useMemo(() => {
    if (!isTeacher) return simulationRanking
    return simulationRanking.filter(e => studentIdSet.has(e.user_id))
  }, [simulationRanking, isTeacher, studentIdSet])

  const filteredEssayRanking = useMemo(() => {
    if (!isTeacher) return essayRanking
    return essayRanking.filter(e => studentIdSet.has(e.user_id))
  }, [essayRanking, isTeacher, studentIdSet])

  if (loading || teacherLoading) {
    return <SectionLoader />
  }

  const totalAchievements = filteredStats.totalAchievements
  const totalUnlocked = filteredStats.totalUnlocked
  const totalXP = filteredStats.totalXP

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isTeacher ? 'Gamificação — Minhas Turmas' : 'Gamificação'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isTeacher
            ? 'Ranking e conquistas dos alunos das suas turmas'
            : 'Gerencie conquistas, ranking, XP e sistema de recompensas'}
        </p>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card className="border-border shadow-sm">
            <CardContent className="p-3 md:p-6">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-yellow-100">
                  <Trophy className="h-5 w-5 md:h-6 md:w-6 text-yellow-600" />
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-bold text-foreground">{totalAchievements}</div>
                  <div className="text-xs md:text-sm text-muted-foreground">Conquistas</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-3 md:p-6">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-green-100">
                  <Award className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-bold text-foreground">{totalUnlocked}</div>
                  <div className="text-xs md:text-sm text-muted-foreground">Desbloqueadas</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-3 md:p-6">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-blue-100">
                  <Zap className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-bold text-foreground">{totalXP.toLocaleString()}</div>
                  <div className="text-xs md:text-sm text-muted-foreground">XP Total</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardContent className="p-3 md:p-6">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-purple-100">
                  <Users className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-bold text-foreground">{filteredRanking.length}</div>
                  <div className="text-xs md:text-sm text-muted-foreground">{isTeacher ? 'Meus Alunos' : 'Participantes'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <PageTabs
          value={activeTab}
          onChange={setActiveTab}
          layout={isTeacher ? 4 : 5}
          tabs={[
            ...(!isTeacher ? [{
              value: 'overview',
              label: 'Visão Geral',
              icon: <BarChart3 className="h-4 w-4" />,
              content: (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <Card className="border-border shadow-sm">
                    <CardContent className="p-5">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <Flame className="h-6 w-6 text-primary" />
                          <div>
                            <h3 className="text-xl font-bold text-foreground">Sistema de XP</h3>
                            <p className="text-sm text-muted-foreground">
                              Configure como os pontos são distribuídos
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center p-3 rounded-xl bg-muted/50 border border-border">
                            <span className="text-sm font-medium">Assistir aula completa</span>
                            <Badge>+10 XP</Badge>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-xl bg-muted/50 border border-border">
                            <span className="text-sm font-medium">Comentar na aula</span>
                            <Badge>+5 XP</Badge>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-xl bg-muted/50 border border-border">
                            <span className="text-sm font-medium">Avaliar aula</span>
                            <Badge>+3 XP</Badge>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-xl bg-muted/50 border border-border">
                            <span className="text-sm font-medium">Postar na comunidade</span>
                            <Badge>+5 XP</Badge>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-xl bg-muted/50 border border-border">
                            <span className="text-sm font-medium">Responder na comunidade</span>
                            <Badge>+3 XP</Badge>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-xl bg-muted/50 border border-border">
                            <span className="text-sm font-medium">Curtir post/comentário</span>
                            <Badge>+1 XP</Badge>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-xl bg-muted/50 border border-border">
                            <span className="text-sm font-medium">Melhor resposta</span>
                            <Badge>+15 XP</Badge>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-xl bg-muted/50 border border-border">
                            <span className="text-sm font-medium">Login diário</span>
                            <Badge>+5 XP</Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border shadow-sm">
                    <CardContent className="p-5">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <TrendingUp className="h-6 w-6 text-primary" />
                          <div>
                            <h3 className="text-xl font-bold text-foreground">Níveis</h3>
                            <p className="text-sm text-muted-foreground">
                              Sistema de progressão por níveis
                            </p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 rounded-xl bg-muted/50 border border-border">
                            <span className="text-sm font-medium">🥉 Nv 1 Iniciante</span>
                            <Badge>0–1.000 XP</Badge>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-xl bg-muted/50 border border-border">
                            <span className="text-sm font-medium">🥈 Nv 2 Estudante</span>
                            <Badge>1.001–2.500 XP</Badge>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-xl bg-muted/50 border border-border">
                            <span className="text-sm font-medium">🥇 Nv 3 Aprendiz</span>
                            <Badge>2.501–5.000 XP</Badge>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-xl bg-muted/50 border border-border">
                            <span className="text-sm font-medium">💎 Nv 4 Especialista</span>
                            <Badge>5.001–10.000 XP</Badge>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-xl bg-muted/50 border border-border">
                            <span className="text-sm font-medium">👑 Nv 5 Mestre</span>
                            <Badge>10.001–20.000 XP</Badge>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-xl bg-muted/50 border border-border">
                            <span className="text-sm font-medium">🌟 Nv 6 Lenda</span>
                            <Badge>20.001+ XP</Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ),
            } satisfies TabItem] : []),
            {
              value: 'achievements',
              label: 'Conquistas',
              icon: <Trophy className="h-4 w-4" />,
              content: (
                <Card className="border-border shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-semibold text-foreground">Conquistas Disponíveis</h3>
                      {!isTeacher && <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
                        setIsCreateDialogOpen(open)
                        if (!open) {
                          setEditingAchievement(null)
                          setNewAchievement({ name: '', description: '', icon_url: '🏆', xp_reward: 100, category: 'general' })
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button>
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Nova Conquista
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{editingAchievement ? 'Editar Conquista' : 'Criar Nova Conquista'}</DialogTitle>
                            <DialogDescription>
                              {editingAchievement ? 'Edite os dados da conquista' : 'Adicione uma nova conquista ao sistema de gamificação'}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="name">Nome da Conquista</Label>
                              <Input
                                id="name"
                                placeholder="Ex: Primeira Vitória"
                                value={newAchievement.name}
                                onChange={(e) => setNewAchievement({ ...newAchievement, name: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="description">Descrição</Label>
                              <Textarea
                                id="description"
                                placeholder="Como desbloquear esta conquista..."
                                value={newAchievement.description}
                                onChange={(e) => setNewAchievement({ ...newAchievement, description: e.target.value })}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="icon">Ícone (Emoji)</Label>
                              <Input
                                id="icon"
                                placeholder="🏆"
                                value={newAchievement.icon_url}
                                onChange={(e) => setNewAchievement({ ...newAchievement, icon_url: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="points">Pontos XP</Label>
                              <Input
                                id="points"
                                type="number"
                                value={newAchievement.xp_reward}
                                onChange={(e) => setNewAchievement({ ...newAchievement, xp_reward: parseInt(e.target.value) || 100 })}
                              />
                            </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isSaving}>
                              Cancelar
                            </Button>
                            <Button onClick={handleSaveAchievement} disabled={isSaving}>
                              {isSaving ? 'Salvando...' : editingAchievement ? 'Salvar' : 'Criar Conquista'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>}
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Conquista</TableHead>
                            <TableHead className="hidden md:table-cell">Categoria</TableHead>
                            <TableHead>XP</TableHead>
                            <TableHead className="hidden sm:table-cell">Desbloqueios</TableHead>
                            {!isTeacher && <TableHead className="text-right">Ações</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {achievements.map((achievement) => (
                            <TableRow key={achievement.id} className="group hover:bg-muted/50">
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="text-3xl">{achievement.icon_url}</div>
                                  <div>
                                    <div className="font-medium group-hover:text-primary transition-colors">
                                      {achievement.name}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {achievement.description}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {getCategoryBadge(achievement.category)}
                              </TableCell>
                              <TableCell>
                                <Badge className="bg-primary/10 border-primary/20 text-primary text-xs">
                                  +{achievement.xp_reward}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{achievement.unlocked_count || 0}</span>
                                </div>
                              </TableCell>
                              {!isTeacher && (
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditAchievement(achievement)}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteAchievement(achievement)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ),
            },
            {
              value: 'ranking',
              label: 'Ranking',
              icon: <Medal className="h-4 w-4" />,
              content: (
                <Card className="border-border shadow-sm">
                  <CardContent className="p-5">
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {isTeacher ? `Ranking dos Meus Alunos (${filteredRanking.length})` : 'Top 50 Estudantes'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {isTeacher
                          ? 'Ranking dos alunos matriculados nas suas turmas'
                          : 'Ranking global baseado em XP acumulado'}
                      </p>
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead className="w-12 md:w-16">Pos</TableHead>
                            <TableHead>Estudante</TableHead>
                            <TableHead className="hidden sm:table-cell">Nível</TableHead>
                            <TableHead>XP</TableHead>
                            <TableHead className="hidden md:table-cell">Conquistas</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRanking.map((entry) => (
                            <TableRow
                              key={entry.user_id}
                              className={cn(
                                'group hover:bg-muted/50',
                                entry.position <= 3 && 'bg-muted/50'
                              )}
                            >
                              <TableCell>
                                <div className="flex items-center justify-center">
                                  {getRankIcon(entry.position)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="font-medium group-hover:text-primary transition-colors text-sm md:text-base">
                                  <span className="hidden sm:inline">{entry.first_name} {entry.last_name}</span>
                                  <span className="sm:hidden">{entry.first_name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <Badge className="bg-primary/10 border-primary/20 text-primary text-xs">
                                  Nv. {entry.level}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 md:gap-2">
                                  <Zap className="h-3 w-3 md:h-4 md:w-4 text-yellow-500" />
                                  <span className="font-bold text-sm md:text-base">{entry.total_xp.toLocaleString()}</span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <div className="flex items-center gap-2">
                                  <Trophy className="h-4 w-4 text-muted-foreground" />
                                  <span>{entry.achievements_count}</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ),
            },
            {
              value: 'simulations',
              label: 'Ranking Simulados',
              icon: <ClipboardList className="h-4 w-4" />,
              content: (
                <Card className="border-border shadow-sm">
                  <CardContent className="p-5">
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {isTeacher ? `Ranking Simulados - Meus Alunos (${filteredSimRanking.length})` : `Top Estudantes em Simulados (${filteredSimRanking.length})`}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Ranking baseado na melhor nota percentual em simulados
                      </p>
                    </div>
                    {filteredSimRanking.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>Nenhum simulado finalizado ainda</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12 md:w-16">Pos</TableHead>
                              <TableHead>Estudante</TableHead>
                              <TableHead>Melhor Nota</TableHead>
                              <TableHead className="hidden sm:table-cell">Média</TableHead>
                              <TableHead className="hidden md:table-cell">Simulados</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredSimRanking.map((entry, idx) => (
                              <TableRow
                                key={entry.user_id}
                                className={cn(
                                  'group hover:bg-muted/50',
                                  idx < 3 && 'bg-muted/50'
                                )}
                              >
                                <TableCell>
                                  <div className="flex items-center justify-center">
                                    {getRankIcon(idx + 1)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium group-hover:text-primary transition-colors text-sm md:text-base">
                                    <span className="hidden sm:inline">{entry.first_name} {entry.last_name}</span>
                                    <span className="sm:hidden">{entry.first_name}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-blue-100 border-blue-300 text-blue-700 text-xs">
                                    {entry.best_percentage.toFixed(1)}%
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                  <span className="text-sm text-muted-foreground">{entry.avg_percentage.toFixed(1)}%</span>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  <span className="font-medium">{entry.total_attempts}</span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ),
            },
            {
              value: 'essays',
              label: 'Ranking Redações',
              icon: <FileText className="h-4 w-4" />,
              content: (
                <Card className="border-border shadow-sm">
                  <CardContent className="p-5">
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {isTeacher ? `Ranking Redações - Meus Alunos (${filteredEssayRanking.length})` : `Top Estudantes em Redações (${filteredEssayRanking.length})`}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Ranking baseado na melhor nota de redação corrigida
                      </p>
                    </div>
                    {filteredEssayRanking.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>Nenhuma redação corrigida ainda</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12 md:w-16">Pos</TableHead>
                              <TableHead>Estudante</TableHead>
                              <TableHead>Melhor Nota</TableHead>
                              <TableHead className="hidden sm:table-cell">Média</TableHead>
                              <TableHead className="hidden md:table-cell">Redações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredEssayRanking.map((entry, idx) => (
                              <TableRow
                                key={entry.user_id}
                                className={cn(
                                  'group hover:bg-muted/50',
                                  idx < 3 && 'bg-muted/50'
                                )}
                              >
                                <TableCell>
                                  <div className="flex items-center justify-center">
                                    {getRankIcon(idx + 1)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium group-hover:text-primary transition-colors text-sm md:text-base">
                                    <span className="hidden sm:inline">{entry.first_name} {entry.last_name}</span>
                                    <span className="sm:hidden">{entry.first_name}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-emerald-100 border-emerald-300 text-emerald-700 text-xs">
                                    {entry.best_grade}
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                  <span className="text-sm text-muted-foreground">{entry.avg_grade}</span>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  <span className="font-medium">{entry.total_essays}</span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}
