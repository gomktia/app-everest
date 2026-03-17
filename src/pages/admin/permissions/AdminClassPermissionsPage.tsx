import { useState, useEffect } from 'react'
import { logger } from '@/lib/logger'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  GraduationCap,
  Lock,
  Brain,
  Target,
  Mic,
  FileText,
  Trophy,
  BookOpen,
  Calendar,
  Save,
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Users,
  Plus,
  Search,
  ClipboardCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  FEATURE_KEYS,
  type FeatureKey,
  getClassFeaturePermissions,
  updateClassFeaturePermissions,
} from '@/services/classPermissionsService'
import { supabase } from '@/lib/supabase/client'

/**
 * Pagina de Gerenciamento de Permissoes por Turma
 *
 * Permite que administradores configurem quais recursos
 * cada turma pode acessar na plataforma.
 */

interface Class {
  id: string
  name: string
  description: string | null
  teacher_id: string
  start_date: string
  end_date: string | null
  class_type: 'standard' | 'trial'
}

interface FeatureOption {
  key: FeatureKey
  label: string
  description: string
  icon: React.ElementType
  category: 'core' | 'content' | 'gamification'
}

// Recursos CONTROLAVEIS por turma
// NOTA: Recursos sempre visiveis: Dashboard, Notificacoes, Conquistas, Progresso, Configuracoes, Minhas Anotacoes
const FEATURE_OPTIONS: FeatureOption[] = [
  {
    key: FEATURE_KEYS.VIDEO_LESSONS,
    label: 'Videoaulas',
    description: 'Cursos em video',
    icon: BookOpen,
    category: 'core'
  },
  {
    key: FEATURE_KEYS.FLASHCARDS,
    label: 'Flashcards',
    description: 'Sistema de revisao espacada com flashcards',
    icon: Brain,
    category: 'content'
  },
  {
    key: FEATURE_KEYS.QUIZ,
    label: 'Quizzes',
    description: 'Quizzes por materia e topico',
    icon: Target,
    category: 'content'
  },
  {
    key: FEATURE_KEYS.QUESTION_BANK,
    label: 'Banco de Questoes',
    description: 'Treino livre com questoes aleatorias',
    icon: Search,
    category: 'content'
  },
  {
    key: FEATURE_KEYS.SIMULATIONS,
    label: 'Simulados',
    description: 'Simulados completos com tempo e nota',
    icon: ClipboardCheck,
    category: 'content'
  },
  {
    key: FEATURE_KEYS.EVERCAST,
    label: 'Evercast',
    description: 'Aulas em audio (podcast)',
    icon: Mic,
    category: 'content'
  },
  {
    key: FEATURE_KEYS.ESSAYS,
    label: 'Redacoes',
    description: 'Sistema de redacoes e correcoes',
    icon: FileText,
    category: 'content'
  },
  {
    key: FEATURE_KEYS.ACERVO,
    label: 'Acervo Digital',
    description: 'Biblioteca de PDFs, provas e materiais',
    icon: BookOpen,
    category: 'content'
  },
  {
    key: FEATURE_KEYS.LIVE_EVENTS,
    label: 'Ao Vivo',
    description: 'Aulas e eventos ao vivo',
    icon: Mic,
    category: 'content'
  },
  {
    key: FEATURE_KEYS.CALENDAR,
    label: 'Calendario',
    description: 'Calendario de aulas e eventos',
    icon: Calendar,
    category: 'gamification'
  },
  {
    key: FEATURE_KEYS.STUDY_PLANNER,
    label: 'Plano de Estudos',
    description: 'Planejamento e pomodoro',
    icon: Target,
    category: 'gamification'
  },
  {
    key: FEATURE_KEYS.RANKING,
    label: 'Ranking',
    description: 'Ranking de pontuacao entre alunos',
    icon: Trophy,
    category: 'gamification'
  },
  {
    key: FEATURE_KEYS.COMMUNITY,
    label: 'Comunidade',
    description: 'Feed de posts e interacao entre alunos (degustacao: somente leitura)',
    icon: Users,
    category: 'gamification'
  },
]

export default function AdminClassPermissionsPage() {
  const { toast } = useToast()
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [selectedPermissions, setSelectedPermissions] = useState<FeatureKey[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Buscar turmas
  useEffect(() => {
    loadClasses()
  }, [])

  // Buscar permissoes quando seleciona uma turma
  useEffect(() => {
    if (selectedClassId) {
      loadPermissions(selectedClassId)
    }
  }, [selectedClassId])

  const loadClasses = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('name')

      if (error) throw error

      setClasses(data || [])
    } catch (error) {
      logger.error('Erro ao carregar turmas:', error)
      toast({
        title: 'Erro',
        description: 'Nao foi possivel carregar as turmas.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadPermissions = async (classId: string) => {
    try {
      setLoading(true)
      const permissions = await getClassFeaturePermissions(classId)
      const featureKeys = permissions.map(p => p.feature_key as FeatureKey)
      setSelectedPermissions(featureKeys)
    } catch (error) {
      logger.error('Erro ao carregar permissoes:', error)
      toast({
        title: 'Erro',
        description: 'Nao foi possivel carregar as permissoes.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTogglePermission = (featureKey: FeatureKey) => {
    setSelectedPermissions(prev => {
      if (prev.includes(featureKey)) {
        return prev.filter(k => k !== featureKey)
      } else {
        return [...prev, featureKey]
      }
    })
  }

  const handleSelectAll = () => {
    const allKeys = FEATURE_OPTIONS.map(f => f.key)
    setSelectedPermissions(allKeys)
  }

  const handleDeselectAll = () => {
    setSelectedPermissions([])
  }

  const handleSave = async () => {
    if (!selectedClassId) {
      toast({
        title: 'Atencao',
        description: 'Selecione uma turma primeiro.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(true)
      const result = await updateClassFeaturePermissions(
        selectedClassId,
        selectedPermissions
      )

      if (result.success) {
        toast({
          title: 'Sucesso!',
          description: 'Permissoes atualizadas com sucesso.',
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      logger.error('Erro ao salvar permissoes:', error)
      toast({
        title: 'Erro',
        description: 'Nao foi possivel salvar as permissoes.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const selectedClass = classes.find(c => c.id === selectedClassId)

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'core':
        return 'Essenciais'
      case 'content':
        return 'Conteudo'
      case 'gamification':
        return 'Gamificacao'
      default:
        return 'Outros'
    }
  }

  const groupedFeatures = FEATURE_OPTIONS.reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = []
    }
    acc[feature.category].push(feature)
    return acc
  }, {} as Record<string, FeatureOption[]>)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Permissoes por Turma</h1>
        <p className="text-muted-foreground">Configure quais recursos cada turma pode acessar na plataforma</p>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <Lock className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Gerenciamento de Permissoes</h1>
                  <p className="text-muted-foreground">
                    Controle granular de acesso por turma
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="bg-blue-500/10 border-blue-500/20 text-blue-600">
                <Users className="h-3 w-3 mr-1" />
                {classes.length} Turmas
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Selecao de Turma */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <GraduationCap className="h-5 w-5 text-primary" />
                <Label className="text-lg font-semibold text-foreground">Selecione uma Turma</Label>
              </div>

              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha uma turma..." />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{cls.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {cls.class_type === 'trial' ? 'Trial' : 'Padrao'}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedClass && (
                <div className="p-4 rounded-xl bg-muted/50 border border-border">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground mb-1">{selectedClass.name}</h4>
                      {selectedClass.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {selectedClass.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Inicio: {new Date(selectedClass.start_date).toLocaleDateString('pt-BR')}</span>
                        {selectedClass.end_date && (
                          <span>Fim: {new Date(selectedClass.end_date).toLocaleDateString('pt-BR')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recursos Disponiveis */}
        {selectedClassId && (
          <Card className="border-border shadow-sm">
            <CardContent className="p-5">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-primary" />
                    <div>
                      <Label className="text-lg font-semibold text-foreground">Recursos Controlaveis</Label>
                      <p className="text-sm text-muted-foreground">
                        Configure quais recursos adicionais esta turma pode acessar
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleSelectAll}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Todos
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Nenhum
                    </Button>
                  </div>
                </div>

                {/* Info Box - Recursos Padrao */}
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-green-600 mb-2">Recursos Padrao (Sempre Visiveis)</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Todos os alunos tem acesso automatico aos seguintes recursos, independente da turma:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="bg-green-500/10 border-green-500/20 text-green-700">
                          Dashboard
                        </Badge>
                        <Badge variant="outline" className="bg-green-500/10 border-green-500/20 text-green-700">
                          Calendario
                        </Badge>
                        <Badge variant="outline" className="bg-green-500/10 border-green-500/20 text-green-700">
                          Ranking
                        </Badge>
                        <Badge variant="outline" className="bg-green-500/10 border-green-500/20 text-green-700">
                          Forum
                        </Badge>
                        <Badge variant="outline" className="bg-green-500/10 border-green-500/20 text-green-700">
                          Conquistas
                        </Badge>
                        <Badge variant="outline" className="bg-green-500/10 border-green-500/20 text-green-700">
                          Progresso
                        </Badge>
                        <Badge variant="outline" className="bg-green-500/10 border-green-500/20 text-green-700">
                          Notificacoes
                        </Badge>
                        <Badge variant="outline" className="bg-green-500/10 border-green-500/20 text-green-700">
                          Configuracoes
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {Object.entries(groupedFeatures).map(([category, features]) => (
                  <div key={category} className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-border">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        {getCategoryLabel(category)}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {features.filter(f => selectedPermissions.includes(f.key)).length}/{features.length}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {features.map(feature => {
                        const isSelected = selectedPermissions.includes(feature.key)
                        return (
                          <div
                            key={feature.key}
                            className={cn(
                              'p-4 rounded-xl border transition-all cursor-pointer',
                              isSelected
                                ? 'bg-primary/5 border-primary/50'
                                : 'bg-muted/50 border-border hover:border-primary/30'
                            )}
                            onClick={() => handleTogglePermission(feature.key)}
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleTogglePermission(feature.key)}
                                className="mt-1"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <feature.icon className="h-4 w-4 text-primary" />
                                  <span className="font-semibold text-foreground">{feature.label}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {feature.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* Info Box */}
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="flex-1 text-sm">
                      <h4 className="font-semibold text-blue-600 mb-1">Importante</h4>
                      <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Alunos so verao os recursos marcados acima no menu e dashboard</li>
                        <li>Professores e Administradores sempre tem acesso total</li>
                        <li>As alteracoes sao aplicadas imediatamente apos salvar</li>
                        <li>Alunos precisam fazer logout/login para ver as mudancas</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Acoes */}
                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={() => loadPermissions(selectedClassId)}
                    disabled={loading || saving}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Resetar
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={loading || saving}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Salvando...' : 'Salvar Permissoes'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!selectedClassId && !loading && (
          <Card className="border-border shadow-sm text-center py-12">
            <CardContent className="p-5">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                  <GraduationCap className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Selecione uma Turma</h3>
                <p className="text-muted-foreground">
                  Escolha uma turma acima para configurar as permissoes de acesso aos recursos da plataforma.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
