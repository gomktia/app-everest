import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Settings,
  Save,
  Globe,
  Mail,
  Bell,
  Shield,
  Palette,
  Database,
  Zap,
  Loader2,
} from 'lucide-react'
import { PageTabs } from '@/components/PageTabs'
import { useToast } from '@/components/ui/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getAllSettings, updateSettings, type SettingsKey } from '@/services/systemSettingsService'
import { logger } from '@/lib/logger'

// Default values used when DB has no data yet
const DEFAULTS: Record<SettingsKey, Record<string, any>> = {
  general: {
    platformName: 'Everest Preparatórios',
    platformUrl: 'https://app.everestpreparatorios.com.br',
    description: 'Plataforma de estudos para concursos militares',
    timezone: 'America/Sao_Paulo',
    maintenanceMode: false,
    allowSignups: true,
  },
  email: {
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
    useSsl: true,
  },
  notifications: {
    newMessage: true,
    essayCorrection: true,
    newCourse: true,
    studyReminder: true,
    achievement: false,
    rankingUpdate: false,
  },
  security: {
    sessionTimeout: 60,
    maxLoginAttempts: 5,
    twoFactorEnabled: true,
    strongPassword: true,
    auditLog: true,
  },
  appearance: {
    primaryColor: '#FF6B35',
    secondaryColor: '#004E89',
    darkMode: true,
    animations: true,
  },
}

export default function AdminSettingsPage() {
  usePageTitle('Configurações')
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<SettingsKey>('general')
  const [settings, setSettings] = useState<Record<string, Record<string, any>>>(DEFAULTS)
  const [savedSettings, setSavedSettings] = useState<Record<string, Record<string, any>>>(DEFAULTS)
  const isDirty = JSON.stringify(settings[activeTab]) !== JSON.stringify(savedSettings[activeTab])

  // Load settings from DB on mount
  useEffect(() => {
    async function load() {
      try {
        const data = await getAllSettings()
        const mergeSettings = (prev: Record<string, Record<string, any>>) => {
          const merged = { ...prev }
          for (const key of Object.keys(DEFAULTS) as SettingsKey[]) {
            if (data[key]) {
              merged[key] = { ...DEFAULTS[key], ...data[key] }
            }
          }
          return merged
        }
        setSettings(prev => mergeSettings(prev))
        setSavedSettings(prev => mergeSettings(prev))
      } catch (err) {
        logger.error('Failed to load settings:', err)
        toast({
          title: 'Erro ao carregar configurações',
          description: 'Usando valores padrão. Tente novamente.',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Helper to update a field in the current tab's settings
  const updateField = (tab: SettingsKey, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [tab]: { ...prev[tab], [field]: value },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings(activeTab, settings[activeTab])
      setSavedSettings(prev => ({ ...prev, [activeTab]: { ...settings[activeTab] } }))
      toast({
        title: 'Configurações salvas',
        description: `As configurações de "${getTabLabel(activeTab)}" foram atualizadas com sucesso.`,
      })
    } catch {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const g = settings.general
  const e = settings.email
  const n = settings.notifications
  const s = settings.security
  const a = settings.appearance

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações do Sistema</h1>
        <p className="text-muted-foreground">Gerencie as configurações globais da plataforma</p>
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-muted/50">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Painel de Configurações</h2>
              <p className="text-sm text-muted-foreground">
                Configure o comportamento e aparência do sistema
              </p>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>

        {/* Settings Tabs */}
        <PageTabs
          value={activeTab}
          onChange={(v) => {
            if (isDirty) {
              const confirmed = window.confirm('Você tem alterações não salvas. Deseja descartar e trocar de aba?')
              if (!confirmed) return
              // Revert unsaved changes for current tab
              setSettings(prev => ({ ...prev, [activeTab]: { ...savedSettings[activeTab] } }))
            }
            setActiveTab(v as SettingsKey)
          }}
          layout={5}
          tabs={[
            {
              value: 'general',
              label: 'Geral',
              content: (
                <Card className="border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <Globe className="h-5 w-5" />
                      Configurações Gerais
                    </CardTitle>
                    <CardDescription>
                      Configure as informações básicas da plataforma
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="platform-name">Nome da Plataforma</Label>
                        <Input
                          id="platform-name"
                          value={g.platformName}
                          onChange={(ev) => updateField('general', 'platformName', ev.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="platform-url">URL da Plataforma</Label>
                        <Input
                          id="platform-url"
                          value={g.platformUrl}
                          onChange={(ev) => updateField('general', 'platformUrl', ev.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="platform-description">Descrição</Label>
                      <Textarea
                        id="platform-description"
                        value={g.description}
                        onChange={(ev) => updateField('general', 'description', ev.target.value)}
                        className="min-h-[100px]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timezone">Fuso Horário</Label>
                      <Select
                        value={g.timezone}
                        onValueChange={(v) => updateField('general', 'timezone', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o fuso horário" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/Sao_Paulo">América/São Paulo (GMT-3)</SelectItem>
                          <SelectItem value="America/New_York">América/Nova York (GMT-5)</SelectItem>
                          <SelectItem value="Europe/London">Europa/Londres (GMT+0)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/50">
                      <div className="space-y-0.5">
                        <Label>Modo de Manutenção</Label>
                        <p className="text-sm text-muted-foreground">
                          Ativar para realizar manutenção no sistema
                        </p>
                      </div>
                      <Switch
                        checked={g.maintenanceMode}
                        onCheckedChange={(v) => updateField('general', 'maintenanceMode', v)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/50">
                      <div className="space-y-0.5">
                        <Label>Permitir Novos Cadastros</Label>
                        <p className="text-sm text-muted-foreground">
                          Usuários podem criar novas contas
                        </p>
                      </div>
                      <Switch
                        checked={g.allowSignups}
                        onCheckedChange={(v) => updateField('general', 'allowSignups', v)}
                      />
                    </div>
                  </CardContent>
                </Card>
              ),
            },
            {
              value: 'email',
              label: 'E-mail',
              content: (
                <Card className="border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <Mail className="h-5 w-5" />
                      Configurações de E-mail
                    </CardTitle>
                    <CardDescription>
                      Configure o servidor SMTP e templates de e-mail
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="smtp-host">Servidor SMTP</Label>
                        <Input
                          id="smtp-host"
                          placeholder="smtp.gmail.com"
                          value={e.smtpHost}
                          onChange={(ev) => updateField('email', 'smtpHost', ev.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtp-port">Porta SMTP</Label>
                        <Input
                          id="smtp-port"
                          placeholder="587"
                          type="number"
                          value={e.smtpPort}
                          onChange={(ev) => updateField('email', 'smtpPort', ev.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="smtp-user">Usuário SMTP</Label>
                        <Input
                          id="smtp-user"
                          placeholder="noreply@everest.com"
                          type="email"
                          value={e.smtpUser}
                          onChange={(ev) => updateField('email', 'smtpUser', ev.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtp-password">Senha SMTP</Label>
                        <Input
                          id="smtp-password"
                          placeholder="********"
                          type="password"
                          value={e.smtpPassword}
                          onChange={(ev) => updateField('email', 'smtpPassword', ev.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/50">
                      <div className="space-y-0.5">
                        <Label>Usar SSL/TLS</Label>
                        <p className="text-sm text-muted-foreground">
                          Conexão segura com o servidor SMTP
                        </p>
                      </div>
                      <Switch
                        checked={e.useSsl}
                        onCheckedChange={(v) => updateField('email', 'useSsl', v)}
                      />
                    </div>
                  </CardContent>
                </Card>
              ),
            },
            {
              value: 'notifications',
              label: 'Notificações',
              content: (
                <Card className="border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <Bell className="h-5 w-5" />
                      Configurações de Notificações
                    </CardTitle>
                    <CardDescription>
                      Gerencie quais notificações serão enviadas aos usuários
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {([
                      { key: 'newMessage', title: 'Nova Mensagem', description: 'Notificar sobre novas mensagens no fórum' },
                      { key: 'essayCorrection', title: 'Redação Corrigida', description: 'Notificar quando uma redação for corrigida' },
                      { key: 'newCourse', title: 'Novo Curso', description: 'Notificar sobre novos cursos disponíveis' },
                      { key: 'studyReminder', title: 'Lembrete de Estudo', description: 'Enviar lembretes diários de estudo' },
                      { key: 'achievement', title: 'Conquista Desbloqueada', description: 'Notificar sobre novas conquistas' },
                      { key: 'rankingUpdate', title: 'Ranking Atualizado', description: 'Notificar sobre mudanças no ranking' },
                    ] as const).map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/50"
                      >
                        <div className="space-y-0.5">
                          <Label>{item.title}</Label>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                        <Switch
                          checked={n[item.key]}
                          onCheckedChange={(v) => updateField('notifications', item.key, v)}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ),
            },
            {
              value: 'security',
              label: 'Segurança',
              content: (
                <Card className="border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <Shield className="h-5 w-5" />
                      Configurações de Segurança
                    </CardTitle>
                    <CardDescription>
                      Configure políticas de segurança e autenticação
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="session-timeout">Tempo de Sessão (minutos)</Label>
                      <Input
                        id="session-timeout"
                        type="number"
                        value={s.sessionTimeout}
                        onChange={(ev) => updateField('security', 'sessionTimeout', Number(ev.target.value))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="max-attempts">Máximo de Tentativas de Login</Label>
                      <Input
                        id="max-attempts"
                        type="number"
                        value={s.maxLoginAttempts}
                        onChange={(ev) => updateField('security', 'maxLoginAttempts', Number(ev.target.value))}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/50">
                      <div className="space-y-0.5">
                        <Label>Autenticação de Dois Fatores</Label>
                        <p className="text-sm text-muted-foreground">
                          Exigir 2FA para todos os administradores (em breve)
                        </p>
                      </div>
                      <Switch
                        checked={s.twoFactorEnabled}
                        onCheckedChange={(v) => updateField('security', 'twoFactorEnabled', v)}
                        disabled
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/50">
                      <div className="space-y-0.5">
                        <Label>Exigir Senha Forte</Label>
                        <p className="text-sm text-muted-foreground">
                          Senhas devem ter no mínimo 12 caracteres
                        </p>
                      </div>
                      <Switch
                        checked={s.strongPassword}
                        onCheckedChange={(v) => updateField('security', 'strongPassword', v)}
                        disabled
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/50">
                      <div className="space-y-0.5">
                        <Label>Log de Auditoria</Label>
                        <p className="text-sm text-muted-foreground">
                          Registrar todas as ações administrativas (em breve)
                        </p>
                      </div>
                      <Switch
                        checked={s.auditLog}
                        onCheckedChange={(v) => updateField('security', 'auditLog', v)}
                        disabled
                      />
                    </div>
                  </CardContent>
                </Card>
              ),
            },
            {
              value: 'appearance',
              label: 'Aparência',
              content: (
                <Card className="border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <Palette className="h-5 w-5" />
                      Configurações de Aparência
                    </CardTitle>
                    <CardDescription>
                      Personalize cores e temas da plataforma (em breve)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="primary-color">Cor Primária</Label>
                        <div className="flex gap-2">
                          <Input
                            id="primary-color"
                            type="color"
                            value={a.primaryColor}
                            onChange={(ev) => updateField('appearance', 'primaryColor', ev.target.value)}
                            className="w-16 h-10 p-1"
                          />
                          <Input
                            value={a.primaryColor}
                            onChange={(ev) => updateField('appearance', 'primaryColor', ev.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="secondary-color">Cor Secundária</Label>
                        <div className="flex gap-2">
                          <Input
                            id="secondary-color"
                            type="color"
                            value={a.secondaryColor}
                            onChange={(ev) => updateField('appearance', 'secondaryColor', ev.target.value)}
                            className="w-16 h-10 p-1"
                          />
                          <Input
                            value={a.secondaryColor}
                            onChange={(ev) => updateField('appearance', 'secondaryColor', ev.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/50">
                      <div className="space-y-0.5">
                        <Label>Modo Escuro por Padrão</Label>
                        <p className="text-sm text-muted-foreground">
                          Iniciar sistema em modo escuro
                        </p>
                      </div>
                      <Switch
                        checked={a.darkMode}
                        onCheckedChange={(v) => updateField('appearance', 'darkMode', v)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/50">
                      <div className="space-y-0.5">
                        <Label>Animações</Label>
                        <p className="text-sm text-muted-foreground">
                          Ativar animações e transições suaves
                        </p>
                      </div>
                      <Switch
                        checked={a.animations}
                        onCheckedChange={(v) => updateField('appearance', 'animations', v)}
                      />
                    </div>
                  </CardContent>
                </Card>
              ),
            },
          ]}
        />

        {/* System Info */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-green-100 dark:bg-green-950/50">
                  <Database className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Sistema Operacional</h3>
                  <p className="text-sm text-muted-foreground">
                    Versão 2.1.0 — Última atualização: {new Date().toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-950/50 border border-green-300 dark:border-green-800">
                <Zap className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-500">Online</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function getTabLabel(tab: SettingsKey): string {
  const labels: Record<SettingsKey, string> = {
    general: 'Geral',
    email: 'E-mail',
    notifications: 'Notificações',
    security: 'Segurança',
    appearance: 'Aparência',
  }
  return labels[tab]
}
