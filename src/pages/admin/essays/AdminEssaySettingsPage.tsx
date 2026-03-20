import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, PlusCircle, MoreHorizontal, Edit, Trash2, Star, Loader2, FileText } from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { ciaarCorrectionService } from '@/services/ciaarCorrectionService'
import type { CorrectionTemplate } from '@/types/essay-correction'

export default function AdminEssaySettingsPage() {
  usePageTitle('Configurações de Redação')
  const { toast } = useToast()
  const [templates, setTemplates] = useState<CorrectionTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [viewTemplate, setViewTemplate] = useState<CorrectionTemplate | null>(null)
  const [editTemplate, setEditTemplate] = useState<Partial<CorrectionTemplate>>({
    name: '',
    description: '',
    expression_debit_value: 0.200,
    max_grade: 10.000,
    is_default: false,
    structure_criteria: {},
    content_criteria: {},
  })

  const fetchTemplates = async () => {
    setLoading(true)
    const data = await ciaarCorrectionService.getAllTemplates()
    setTemplates(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const handleOpenDialog = (template?: CorrectionTemplate) => {
    if (template) {
      setEditTemplate({ ...template })
    } else {
      setEditTemplate({
        name: '',
        description: '',
        expression_debit_value: 0.200,
        max_grade: 10.000,
        is_default: false,
        structure_criteria: {},
        content_criteria: {},
      })
    }
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!editTemplate.name) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      await ciaarCorrectionService.saveTemplate(editTemplate as CorrectionTemplate & { name: string })
      toast({ title: editTemplate.id ? 'Template atualizado!' : 'Template criado!' })
      setDialogOpen(false)
      fetchTemplates()
    } catch {
      toast({ title: 'Erro ao salvar template', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await ciaarCorrectionService.deleteTemplate(id)
      toast({ title: 'Template removido' })
      fetchTemplates()
    } catch {
      toast({ title: 'Erro ao remover template', variant: 'destructive' })
    }
  }

  const handleViewDetails = (template: CorrectionTemplate) => {
    setViewTemplate(template)
    setViewDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/admin/essays"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Configurações de Correção CIAAR</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os modelos de correção com sistema de débitos (Expressão, Estrutura e Conteúdo)
        </p>
      </div>

      {/* Templates Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500/10 to-blue-600/5">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Templates de Correção</CardTitle>
              <CardDescription>
                Modelos de avaliação com critérios de expressão, estrutura e conteúdo
              </CardDescription>
            </div>
          </div>
          <Button size="sm" onClick={() => handleOpenDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" /> Novo Template
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhum template de correção</p>
              <p className="text-xs mt-1">Crie um modelo de avaliação para começar a corrigir redações</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Nota Máxima</TableHead>
                  <TableHead>Débito/Erro</TableHead>
                  <TableHead className="text-center">Padrão</TableHead>
                  <TableHead className="w-[60px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <button
                        className="text-left hover:underline"
                        onClick={() => handleViewDetails(template)}
                      >
                        <span className="font-medium">{template.name}</span>
                        {template.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                            {template.description}
                          </p>
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{template.max_grade}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-red-600">
                        -{template.expression_debit_value}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {template.is_default && (
                        <Star className="h-4 w-4 text-amber-500 mx-auto fill-amber-500" />
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
                          <DropdownMenuItem onClick={() => handleViewDetails(template)}>
                            <FileText className="mr-2 h-4 w-4" /> Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenDialog(template)}>
                            <Edit className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => template.id && handleDelete(template.id)}
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

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editTemplate.id ? 'Editar' : 'Novo'} Template de Correção
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={editTemplate.name ?? ''}
                onChange={(e) => setEditTemplate(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: CIAAR 2025"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={editTemplate.description ?? ''}
                onChange={(e) => setEditTemplate(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição do modelo de correção..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nota Máxima</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={editTemplate.max_grade ?? 10}
                  onChange={(e) => setEditTemplate(prev => ({ ...prev, max_grade: parseFloat(e.target.value) || 10 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Débito por Erro de Expressão</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={editTemplate.expression_debit_value ?? 0.2}
                  onChange={(e) => setEditTemplate(prev => ({ ...prev, expression_debit_value: parseFloat(e.target.value) || 0.2 }))}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Critérios de Estrutura (JSON)</Label>
              <Textarea
                value={typeof editTemplate.structure_criteria === 'object' ? JSON.stringify(editTemplate.structure_criteria, null, 2) : '{}'}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value)
                    setEditTemplate(prev => ({ ...prev, structure_criteria: parsed }))
                  } catch {
                    // Allow typing incomplete JSON
                  }
                }}
                rows={6}
                className="font-mono text-xs"
                placeholder='{"introduction": {...}, "development": {...}, "conclusion": {...}}'
              />
              <p className="text-[11px] text-muted-foreground">
                Define os parágrafos esperados, períodos e conectivos para cada seção
              </p>
            </div>

            <div className="space-y-2">
              <Label>Critérios de Conteúdo (JSON)</Label>
              <Textarea
                value={typeof editTemplate.content_criteria === 'object' ? JSON.stringify(editTemplate.content_criteria, null, 2) : '{}'}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value)
                    setEditTemplate(prev => ({ ...prev, content_criteria: parsed }))
                  } catch {
                    // Allow typing incomplete JSON
                  }
                }}
                rows={6}
                className="font-mono text-xs"
                placeholder='{"pertinence": {...}, "argumentation": {...}, "informativity": {...}}'
              />
              <p className="text-[11px] text-muted-foreground">
                Define os critérios de pertinência, argumentação e informatividade com níveis de débito
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={editTemplate.is_default ?? false}
                onCheckedChange={(checked) => setEditTemplate(prev => ({ ...prev, is_default: checked }))}
              />
              <Label>Definir como template padrão</Label>
            </div>
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

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewTemplate?.name}
              {viewTemplate?.is_default && (
                <Badge className="bg-amber-100 text-amber-600 border-amber-300">
                  <Star className="h-3 w-3 mr-1 fill-amber-500" /> Padrão
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {viewTemplate && (
            <div className="space-y-4 py-2">
              {viewTemplate.description && (
                <p className="text-sm text-muted-foreground">{viewTemplate.description}</p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Nota Máxima</p>
                  <p className="text-2xl font-bold">{viewTemplate.max_grade}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Débito por Erro</p>
                  <p className="text-2xl font-bold text-red-600">-{viewTemplate.expression_debit_value}</p>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold text-sm mb-2">Critérios de Estrutura</h4>
                <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto font-mono">
                  {JSON.stringify(viewTemplate.structure_criteria, null, 2)}
                </pre>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2">Critérios de Conteúdo</h4>
                <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto font-mono">
                  {JSON.stringify(viewTemplate.content_criteria, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
