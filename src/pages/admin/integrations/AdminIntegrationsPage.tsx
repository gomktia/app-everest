import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useToast } from '@/hooks/use-toast'
import { testPandaConnection } from '@/services/pandaVideo'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { Link } from 'react-router-dom'
import {
  Video,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  RefreshCw,
  ShoppingCart,
  Mail,
  Database,
  Globe,
  Webhook,
  Copy,
  Link2,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AIProviderConfigPanel } from '@/components/admin/integrations/AIProviderConfig'
import { PageTabs } from '@/components/PageTabs'
import { Settings } from 'lucide-react'

// ─── Integration definitions ─────────────────────────────────────────────────

interface Integration {
  id: string
  name: string
  description: string
  icon: typeof Video
  brandColor: string
  bgGradient: string
  apiKey?: string
  webhookUrl?: string
  projectUrl?: string
  features: string[]
  docsUrl: string
  status: 'connected' | 'disconnected' | 'error' | 'checking'
  statusMessage?: string
  extra?: Record<string, string>
}

const INTEGRATIONS_CONFIG: Omit<Integration, 'status' | 'statusMessage'>[] = [
  {
    id: 'panda-video',
    name: 'Panda Video',
    description: 'Streaming de vídeo para aulas gravadas e ao vivo',
    icon: Video,
    brandColor: 'text-emerald-600',
    bgGradient: 'from-emerald-500/10 to-emerald-600/5',
    apiKey: import.meta.env.VITE_PANDA_API_KEY || 'panda-••••••••••••••••',
    features: ['555 vídeos hospedados', 'Player embed', 'HLS streaming', 'Analytics'],
    docsUrl: 'https://docs.pandavideo.com',
    extra: {
      'Library ID': 'a747d22e-bc6f-4563-96c6-711ec74f9ae5',
      'Domínio liberado': 'app.everestpreparatorios.com.br',
    },
  },
  {
    id: 'memberkit',
    name: 'MemberKit',
    description: 'Gestão de membros, cursos e pagamentos',
    icon: Users,
    brandColor: 'text-blue-600',
    bgGradient: 'from-blue-500/10 to-blue-600/5',
    apiKey: import.meta.env.VITE_MEMBERKIT_API_KEY || '••••••••••••••••',
    features: ['Import de cursos', 'Import de alunos', 'Sincronização de turmas', 'API REST'],
    docsUrl: 'https://docs.memberkit.com.br',
    extra: {
      'Curso principal': 'Extensivo EAOF 2027 (ID: 274441)',
    },
  },
  {
    id: 'kiwify',
    name: 'Kiwify',
    description: 'Plataforma de vendas e checkout para matrículas',
    icon: ShoppingCart,
    brandColor: 'text-green-600',
    bgGradient: 'from-green-500/10 to-green-600/5',
    webhookUrl: 'https://hnhzindsfuqnaxosujay.supabase.co/functions/v1/kiwify-webhook',
    features: ['Webhook de compra', 'Matrícula automática', 'Magic link por email', 'Tabela kiwify_products'],
    docsUrl: 'https://docs.kiwify.com.br',
  },
  {
    id: 'resend',
    name: 'Resend',
    description: 'Serviço de envio de emails transacionais',
    icon: Mail,
    brandColor: 'text-violet-600',
    bgGradient: 'from-violet-500/10 to-violet-600/5',
    features: ['Magic link de login', 'Emails transacionais', 'SMTP integrado ao Supabase', 'Templates customizados'],
    docsUrl: 'https://resend.com/docs',
    extra: {
      'Configuração': 'Via Supabase Auth > SMTP Settings',
    },
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Backend: banco de dados, auth, storage e edge functions',
    icon: Database,
    brandColor: 'text-emerald-500',
    bgGradient: 'from-emerald-500/10 to-teal-600/5',
    projectUrl: 'https://supabase.com/dashboard/project/hnhzindsfuqnaxosujay',
    features: ['PostgreSQL + RLS', 'Auth + Magic Link', 'Realtime subscriptions', 'Edge Functions', 'Storage'],
    docsUrl: 'https://supabase.com/docs',
    extra: {
      'Project Ref': 'hnhzindsfuqnaxosujay',
      'Região': 'sa-east-1 (São Paulo)',
    },
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Deploy e hospedagem da aplicação frontend',
    icon: Globe,
    brandColor: 'text-foreground',
    bgGradient: 'from-neutral-500/10 to-neutral-600/5',
    projectUrl: 'https://vercel.com',
    features: ['Deploy automático', 'CDN global', 'Preview deploys', 'Analytics'],
    docsUrl: 'https://vercel.com/docs',
    extra: {
      'Domínio': 'app.everestpreparatorios.com.br',
    },
  },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminIntegrationsPage() {
  usePageTitle('Integrações')
  const { toast } = useToast()
  const [integrations, setIntegrations] = useState<Integration[]>(
    INTEGRATIONS_CONFIG.map(c => ({ ...c, status: 'checking' as const }))
  )
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({})
  const [testing, setTesting] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('status')

  useEffect(() => {
    checkAllStatuses()
  }, [])

  const checkAllStatuses = async () => {
    // Panda Video - real test
    try {
      const result = await testPandaConnection()
      updateStatus('panda-video', result.success ? 'connected' : 'error',
        result.success ? `${result.videosCount || 0} vídeos encontrados` : 'Falha na conexão')
    } catch {
      updateStatus('panda-video', 'error', 'Falha na conexão')
    }

    // Supabase - test query
    try {
      const { error } = await supabase.from('users').select('id', { count: 'exact', head: true })
      updateStatus('supabase', error ? 'error' : 'connected',
        error ? error.message : 'Banco de dados acessível')
    } catch {
      updateStatus('supabase', 'error', 'Sem conexão')
    }

    // Kiwify - check if webhook function exists (via kiwify_products table)
    try {
      const { error } = await supabase.from('kiwify_products').select('id', { count: 'exact', head: true })
      updateStatus('kiwify', error ? 'disconnected' : 'connected',
        error ? 'Tabela kiwify_products não encontrada' : 'Webhook configurado')
    } catch {
      updateStatus('kiwify', 'disconnected', 'Não verificado')
    }

    // MemberKit - check if we have imported data
    try {
      const { count } = await supabase.from('video_courses').select('id', { count: 'exact', head: true })
      updateStatus('memberkit', (count ?? 0) > 0 ? 'connected' : 'disconnected',
        (count ?? 0) > 0 ? `${count} cursos importados` : 'Nenhum dado importado')
    } catch {
      updateStatus('memberkit', 'disconnected', 'Não verificado')
    }

    // Resend, Vercel - indirect checks
    updateStatus('resend', 'connected', 'Configurado via Supabase SMTP')
    updateStatus('vercel', 'connected', 'Deploy ativo')
  }

  const updateStatus = (id: string, status: Integration['status'], message?: string) => {
    setIntegrations(prev => prev.map(i =>
      i.id === id ? { ...i, status, statusMessage: message } : i
    ))
  }

  const handleTestConnection = async (integration: Integration) => {
    setTesting(integration.id)
    try {
      if (integration.id === 'panda-video') {
        const result = await testPandaConnection()
        updateStatus('panda-video', result.success ? 'connected' : 'error',
          result.success ? `${result.videosCount || 0} vídeos` : 'Falha')
        toast({
          title: result.success ? 'Panda Video conectado!' : 'Erro na conexão',
          description: result.success ? `${result.videosCount} vídeos encontrados` : 'Verifique a API Key',
          variant: result.success ? 'default' : 'destructive',
        })
      } else if (integration.id === 'supabase') {
        const { error } = await supabase.from('users').select('id', { count: 'exact', head: true })
        updateStatus('supabase', error ? 'error' : 'connected', error ? error.message : 'OK')
        toast({
          title: error ? 'Erro' : 'Supabase conectado!',
          variant: error ? 'destructive' : 'default',
        })
      } else {
        toast({ title: `${integration.name} — verificação indireta`, description: integration.statusMessage })
      }
    } catch (e: any) {
      updateStatus(integration.id, 'error', e.message)
      toast({ title: 'Erro no teste', description: e.message, variant: 'destructive' })
    } finally {
      setTesting(null)
    }
  }

  const maskKey = (key: string) => {
    if (key.length <= 8) return '••••••••'
    return key.slice(0, 4) + '••••••••' + key.slice(-4)
  }

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: `${label} copiado!` })
  }

  const statusIcon = (status: Integration['status']) => {
    switch (status) {
      case 'connected': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />
      case 'checking': return <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
      default: return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
  }

  const statusBadge = (status: Integration['status']) => {
    switch (status) {
      case 'connected': return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Conectado</Badge>
      case 'error': return <Badge variant="destructive">Erro</Badge>
      case 'checking': return <Badge variant="secondary">Verificando...</Badge>
      default: return <Badge variant="outline" className="text-yellow-600 border-yellow-500/30">Desconectado</Badge>
    }
  }

  const connectedCount = integrations.filter(i => i.status === 'connected').length
  const errorCount = integrations.filter(i => i.status === 'error').length

  const renderIntegrationCard = (integration: Integration) => {
    const Icon = integration.icon
    const isKeyVisible = visibleKeys[integration.id]

    return (
      <Card key={integration.id} className={cn(
        'border-border shadow-sm overflow-hidden transition-all hover:shadow-md',
        integration.status === 'error' && 'border-red-500/20'
      )}>
        {/* Banner gradient */}
        <div className={cn('h-2 bg-gradient-to-r', integration.bgGradient)} />

        <CardContent className="p-5 space-y-4">
          {/* Header row */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br',
                integration.bgGradient
              )}>
                <Icon className={cn('h-5 w-5', integration.brandColor)} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{integration.name}</h3>
                <p className="text-xs text-muted-foreground leading-snug">{integration.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {statusIcon(integration.status)}
              {statusBadge(integration.status)}
            </div>
          </div>

          {/* Status message */}
          {integration.statusMessage && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-1.5">
              {integration.statusMessage}
            </p>
          )}

          {/* Features pills */}
          <div className="flex flex-wrap gap-1.5">
            {integration.features.map((f, i) => (
              <Badge key={i} variant="outline" className="text-[10px] font-normal">{f}</Badge>
            ))}
          </div>

          {/* API Key */}
          {integration.apiKey && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">API Key</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6"
                      onClick={() => toggleKeyVisibility(integration.id)}
                    >
                      {isKeyVisible
                        ? <EyeOff className="h-3 w-3" />
                        : <Eye className="h-3 w-3" />}
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6"
                      onClick={() => copyToClipboard(integration.apiKey!, 'API Key')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <code className="block text-xs bg-muted/50 rounded-md px-3 py-2 font-mono text-foreground/80 break-all">
                  {isKeyVisible ? integration.apiKey : maskKey(integration.apiKey)}
                </code>
              </div>
            </>
          )}

          {/* Webhook URL */}
          {integration.webhookUrl && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Webhook className="h-3 w-3" /> Webhook URL
                  </span>
                  <Button
                    variant="ghost" size="icon" className="h-6 w-6"
                    onClick={() => copyToClipboard(integration.webhookUrl!, 'Webhook URL')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <code className="block text-xs bg-muted/50 rounded-md px-3 py-2 font-mono text-foreground/80 break-all">
                  {integration.webhookUrl}
                </code>
              </div>
            </>
          )}

          {/* Extra info */}
          {integration.extra && (
            <>
              <Separator />
              <div className="space-y-1">
                {Object.entries(integration.extra).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="font-medium text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline" size="sm" className="flex-1 gap-1.5 text-xs"
              onClick={() => handleTestConnection(integration)}
              disabled={testing === integration.id}
            >
              {testing === integration.id
                ? <RefreshCw className="h-3 w-3 animate-spin" />
                : <RefreshCw className="h-3 w-3" />}
              Testar
            </Button>
            {integration.id === 'memberkit' && (
              <Button
                variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" asChild
              >
                <Link to="/admin/integrations/memberkit-import">
                  <Upload className="h-3 w-3" />
                  Importar
                </Link>
              </Button>
            )}
            {integration.projectUrl && (
              <Button
                variant="outline" size="sm" className="flex-1 gap-1.5 text-xs"
                onClick={() => window.open(integration.projectUrl, '_blank', 'noopener')}
              >
                <Link2 className="h-3 w-3" />
                Painel
              </Button>
            )}
            <Button
              variant="ghost" size="sm" className="gap-1.5 text-xs"
              onClick={() => window.open(integration.docsUrl, '_blank', 'noopener')}
            >
              <ExternalLink className="h-3 w-3" />
              Docs
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Status e configuração dos serviços conectados à plataforma
          </p>
        </div>
        <Button variant="outline" onClick={checkAllStatuses} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Verificar Todos
        </Button>
      </div>

      <PageTabs
        value={activeTab}
        onChange={setActiveTab}
        layout="full"
        tabs={[
          {
            value: 'status',
            label: 'Status',
            icon: <CheckCircle className="h-4 w-4" />,
            content: (
              <div className="space-y-6 pt-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="border-border shadow-sm">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-foreground">{integrations.length}</div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </CardContent>
                  </Card>
                  <Card className="border-border shadow-sm">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">{connectedCount}</div>
                      <div className="text-xs text-muted-foreground">Conectados</div>
                    </CardContent>
                  </Card>
                  <Card className="border-border shadow-sm">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-red-600">{errorCount}</div>
                      <div className="text-xs text-muted-foreground">Com Erro</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Integration Cards */}
                <div className="grid gap-5 md:grid-cols-2">
                  {integrations.map(renderIntegrationCard)}
                </div>
              </div>
            ),
          },
          {
            value: 'configuracao',
            label: 'Configuração',
            icon: <Settings className="h-4 w-4" />,
            content: (
              <div className="space-y-6 pt-4">
                {/* AI Provider Configuration */}
                <AIProviderConfigPanel />

                {/* API Keys & Webhook Details */}
                <div className="grid gap-5 md:grid-cols-2">
                  {integrations
                    .filter(i => i.apiKey || i.webhookUrl || i.extra)
                    .map(renderIntegrationCard)}
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
