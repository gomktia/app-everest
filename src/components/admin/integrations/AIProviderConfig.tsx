import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Bot,
  PlusCircle,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { aiCorrectionService } from '@/services/ai/aiCorrectionService'
import type { AIProviderConfig as AIProviderConfigType, AIProviderType } from '@/types/essay-correction'

const PROVIDER_OPTIONS: { value: AIProviderType; label: string; defaultModel: string; needsBaseUrl: boolean }[] = [
  { value: 'claude', label: 'Claude (Anthropic)', defaultModel: 'claude-sonnet-4-5-20250514', needsBaseUrl: false },
  { value: 'openai', label: 'OpenAI (GPT)', defaultModel: 'gpt-4o', needsBaseUrl: false },
  { value: 'gemini', label: 'Gemini (Google)', defaultModel: 'gemini-2.5-flash', needsBaseUrl: false },
  { value: 'antigravity', label: 'Antigravity AI', defaultModel: 'default', needsBaseUrl: true },
  { value: 'dify', label: 'Dify AI', defaultModel: '', needsBaseUrl: true },
]

const emptyConfig: Partial<AIProviderConfigType> = {
  provider: 'claude',
  display_name: '',
  api_key: '',
  model_name: '',
  base_url: '',
  is_active: false,
}

export function AIProviderConfigPanel() {
  const { toast } = useToast()
  const [providers, setProviders] = useState<AIProviderConfigType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editConfig, setEditConfig] = useState<Partial<AIProviderConfigType>>(emptyConfig)
  const [showApiKey, setShowApiKey] = useState(false)

  const fetchProviders = async () => {
    setLoading(true)
    const data = await aiCorrectionService.getAllProviders()
    setProviders(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchProviders()
  }, [])

  const handleOpenDialog = (provider?: AIProviderConfigType) => {
    if (provider) {
      setEditConfig({ ...provider, api_key: '' }) // Don't show existing key
    } else {
      setEditConfig({ ...emptyConfig })
    }
    setShowApiKey(false)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!editConfig.display_name || !editConfig.provider) {
      toast({ title: 'Preencha o nome e o provedor', variant: 'destructive' })
      return
    }

    // For new providers, API key is required
    if (!editConfig.id && !editConfig.api_key) {
      toast({ title: 'API Key é obrigatória para novos provedores', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      await aiCorrectionService.saveProvider(editConfig as any)
      toast({ title: editConfig.id ? 'Provedor atualizado!' : 'Provedor adicionado!' })
      setDialogOpen(false)
      fetchProviders()
    } catch {
      toast({ title: 'Erro ao salvar provedor', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await aiCorrectionService.deleteProvider(id)
      toast({ title: 'Provedor removido' })
      fetchProviders()
    } catch {
      toast({ title: 'Erro ao remover provedor', variant: 'destructive' })
    }
  }

  const handleToggleActive = async (provider: AIProviderConfigType) => {
    try {
      await aiCorrectionService.saveProvider({
        ...provider,
        is_active: !provider.is_active,
      })
      toast({ title: provider.is_active ? 'Provedor desativado' : 'Provedor ativado!' })
      fetchProviders()
    } catch {
      toast({ title: 'Erro ao alterar status', variant: 'destructive' })
    }
  }

  const selectedProviderOption = PROVIDER_OPTIONS.find(p => p.value === editConfig.provider)

  const maskKey = (key?: string) => {
    if (!key || key.length <= 8) return '••••••••••••'
    return key.slice(0, 6) + '••••••••' + key.slice(-4)
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-orange-500/10 to-orange-600/5">
              <Bot className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <CardTitle>Provedores de IA</CardTitle>
              <CardDescription>Configure os provedores para correção automática de redações</CardDescription>
            </div>
          </div>
          <Button size="sm" onClick={() => handleOpenDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" /> Novo Provedor
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : providers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhum provedor configurado</p>
              <p className="text-xs mt-1">Adicione um provedor de IA para habilitar a correção automática</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provedor</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-[60px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{provider.display_name}</span>
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          {provider.provider}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {provider.model_name || '—'}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted/50 rounded px-2 py-1">
                        {provider.api_key ? maskKey(provider.api_key) : '••••••••'}
                      </code>
                    </TableCell>
                    <TableCell className="text-center">
                      {provider.is_active ? (
                        <Badge className="bg-green-100 dark:bg-green-950/50 text-green-600 border-green-300 dark:border-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          <XCircle className="h-3 w-3 mr-1" />
                          Inativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleToggleActive(provider)}>
                            {provider.is_active ? (
                              <><XCircle className="mr-2 h-4 w-4" /> Desativar</>
                            ) : (
                              <><CheckCircle className="mr-2 h-4 w-4" /> Ativar</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenDialog(provider)}>
                            <Edit className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => provider.id && handleDelete(provider.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editConfig.id ? 'Editar' : 'Novo'} Provedor de IA
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Provedor</Label>
              <Select
                value={editConfig.provider}
                onValueChange={(value: AIProviderType) => {
                  const option = PROVIDER_OPTIONS.find(p => p.value === value)
                  setEditConfig(prev => ({
                    ...prev,
                    provider: value,
                    model_name: prev?.model_name || option?.defaultModel || '',
                    base_url: value === 'antigravity' ? 'https://api.antigravity.ai/v1' : prev?.base_url || '',
                    display_name: prev?.display_name || option?.label || '',
                  }))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o provedor" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nome de Exibição</Label>
              <Input
                value={editConfig.display_name ?? ''}
                onChange={(e) => setEditConfig(prev => ({ ...prev, display_name: e.target.value }))}
                placeholder="Ex: Claude Sonnet 4.5"
              />
            </div>

            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="relative">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={editConfig.api_key ?? ''}
                  onChange={(e) => setEditConfig(prev => ({ ...prev, api_key: e.target.value }))}
                  placeholder={editConfig.id ? 'Deixe vazio para manter a atual' : 'sk-...'}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                A chave é armazenada no banco e usada apenas pela Edge Function no servidor.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Modelo</Label>
              <Input
                value={editConfig.model_name ?? ''}
                onChange={(e) => setEditConfig(prev => ({ ...prev, model_name: e.target.value }))}
                placeholder={selectedProviderOption?.defaultModel || 'Nome do modelo'}
              />
            </div>

            {selectedProviderOption?.needsBaseUrl && (
              <div className="space-y-2">
                <Label>Base URL</Label>
                <Input
                  value={editConfig.base_url ?? ''}
                  onChange={(e) => setEditConfig(prev => ({ ...prev, base_url: e.target.value }))}
                  placeholder="https://api.example.com/v1"
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <Switch
                checked={editConfig.is_active ?? false}
                onCheckedChange={(checked) => setEditConfig(prev => ({ ...prev, is_active: checked }))}
              />
              <Label>Ativar como provedor principal</Label>
            </div>
            {editConfig.is_active && (
              <p className="text-xs text-amber-600">
                Ao ativar este provedor, os demais serão desativados automaticamente.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
