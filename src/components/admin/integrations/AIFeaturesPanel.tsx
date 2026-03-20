import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Sparkles,
  Brain,
  MessageSquare,
  BookOpen,
  Target,
  Power,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { aiSettingsService } from '@/services/ai/aiSettingsService'
import type { AIFeatureSettings, AIUsageStats } from '@/services/ai/aiSettingsService'

interface FeatureDefinition {
  key: keyof Pick<AIFeatureSettings, 'audit' | 'quiz_gen' | 'lesson_chat' | 'study_plan'>
  icon: React.ReactNode
  label: string
  description: string
}

const FEATURES: FeatureDefinition[] = [
  {
    key: 'audit',
    icon: <Target className="h-4 w-4 text-blue-600" />,
    label: 'Auditar Questões',
    description: 'Revisar ortografia, gabarito e gerar explicações',
  },
  {
    key: 'quiz_gen',
    icon: <BookOpen className="h-4 w-4 text-green-600" />,
    label: 'Gerar Quiz da Aula',
    description: 'Criar questões a partir do PDF/PPT',
  },
  {
    key: 'lesson_chat',
    icon: <MessageSquare className="h-4 w-4 text-amber-600" />,
    label: 'Tirar Dúvida da Aula',
    description: 'Chat do aluno limitado ao conteúdo da aula',
  },
  {
    key: 'study_plan',
    icon: <Brain className="h-4 w-4 text-purple-600" />,
    label: 'Plano de Estudos IA',
    description: 'Diagnóstico e cronograma personalizado',
  },
]

export function AIFeaturesPanel() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<AIFeatureSettings | null>(null)
  const [usage, setUsage] = useState<AIUsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [s, u] = await Promise.all([
        aiSettingsService.getSettings(),
        aiSettingsService.getUsageStats(30),
      ])
      setSettings(s)
      setUsage(u)
      setLoading(false)
    }
    load()
  }, [])

  const handleToggle = async (
    key: keyof Pick<AIFeatureSettings, 'master' | 'audit' | 'quiz_gen' | 'lesson_chat' | 'study_plan'>,
    value: boolean
  ) => {
    if (!settings) return

    const prev = { ...settings }
    const next = { ...settings, [key]: value }
    setSettings(next)
    setSaving(key)

    try {
      await aiSettingsService.updateSettings({ [key]: value })
      toast({
        title: value
          ? `Feature "${key}" ativada`
          : `Feature "${key}" desativada`,
      })
    } catch {
      setSettings(prev)
      toast({
        title: 'Erro ao salvar configuração',
        variant: 'destructive',
      })
    } finally {
      setSaving(null)
    }
  }

  const featureCalls = (key: string) => usage?.by_feature?.[key]?.calls ?? 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-purple-500/10 to-purple-600/5">
            <Sparkles className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <CardTitle>Features de IA</CardTitle>
            <CardDescription>Controle as funcionalidades de IA do sistema</CardDescription>
          </div>
        </div>

        {usage && (
          <div className="flex items-center gap-3 text-right">
            <div>
              <div className="text-sm font-semibold text-foreground">
                {usage.total_calls.toLocaleString('pt-BR')} chamadas
              </div>
              <div className="text-xs text-muted-foreground">
                R$ {usage.total_cost.toFixed(2)} este mês
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : settings ? (
          <div className="space-y-4">
            {/* Master toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-foreground/5">
                  <Power className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <Label className="text-sm font-semibold cursor-pointer">
                    Ativar todas as features IA
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Desligar este toggle desabilita todas as features de uma vez
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.master}
                disabled={saving === 'master'}
                onCheckedChange={(val) => handleToggle('master', val)}
              />
            </div>

            {/* Separator */}
            <div className="border-t border-border" />

            {/* Individual feature toggles */}
            <div className="space-y-2">
              {FEATURES.map((feature) => {
                const calls = featureCalls(feature.key)
                return (
                  <div
                    key={feature.key}
                    className="flex items-center justify-between rounded-lg px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted/50">
                        {feature.icon}
                      </div>
                      <div>
                        <Label className="text-sm font-medium cursor-pointer">
                          {feature.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className="text-[10px] tabular-nums min-w-[54px] justify-center"
                      >
                        {calls.toLocaleString('pt-BR')} calls
                      </Badge>
                      <Switch
                        checked={settings[feature.key]}
                        disabled={!settings.master || saving === feature.key}
                        onCheckedChange={(val) => handleToggle(feature.key, val)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Erro ao carregar configurações
          </div>
        )}
      </CardContent>
    </Card>
  )
}
