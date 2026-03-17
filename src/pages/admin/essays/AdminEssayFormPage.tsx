import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Save } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { SectionLoader } from '@/components/SectionLoader'
import {
  getEssayPromptById,
  createEssayPrompt,
  updateEssayPrompt,
} from '@/services/adminEssayService'
import {
  getCriteriaTemplates,
  type CriteriaTemplate,
} from '@/services/essaySettingsService'

interface FormData {
  title: string
  description: string
  is_active: boolean
  criteria_template_id: string
  suggested_repertoire: string
  start_date: string
  end_date: string
}

export default function AdminEssayFormPage() {
  const { promptId } = useParams()
  const navigate = useNavigate()
  usePageTitle('Editor de Tema')
  const { toast } = useToast()
  const { user } = useAuth()
  const isEditing = !!promptId

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState<CriteriaTemplate[]>([])
  const [form, setForm] = useState<FormData>({
    title: '',
    description: '',
    is_active: true,
    criteria_template_id: '',
    suggested_repertoire: '',
    start_date: '',
    end_date: '',
  })

  useEffect(() => {
    loadData()
  }, [promptId])

  const loadData = async () => {
    try {
      setLoading(true)
      const templatesData = await getCriteriaTemplates()
      setTemplates(templatesData)

      if (isEditing) {
        const prompt = await getEssayPromptById(promptId!)
        if (!prompt) {
          toast({ title: 'Tema não encontrado', variant: 'destructive' })
          navigate('/admin/essays/prompts')
          return
        }
        setForm({
          title: prompt.title || '',
          description: prompt.description || '',
          is_active: prompt.is_active ?? true,
          criteria_template_id: prompt.criteria_template_id || '',
          suggested_repertoire: (prompt as any).suggested_repertoire || '',
          start_date: prompt.start_date ? prompt.start_date.split('T')[0] : '',
          end_date: prompt.end_date ? prompt.end_date.split('T')[0] : '',
        })
      }
    } catch (error: any) {
      toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const updateForm = (field: keyof FormData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Preencha o título do tema', variant: 'destructive' })
      return
    }

    // Get evaluation criteria from selected template
    let evaluationCriteria = {}
    if (form.criteria_template_id) {
      const template = templates.find((t) => t.id === form.criteria_template_id)
      if (template) {
        evaluationCriteria = template.criteria || {}
      }
    }

    try {
      setSaving(true)
      const payload: any = {
        title: form.title,
        description: form.description || null,
        is_active: form.is_active,
        criteria_template_id: form.criteria_template_id || null,
        evaluation_criteria: evaluationCriteria,
        suggested_repertoire: form.suggested_repertoire || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      }

      if (isEditing) {
        await updateEssayPrompt(promptId!, payload)
      } else {
        payload.created_by_user_id = user?.id || ''
        await createEssayPrompt(payload)
      }

      toast({ title: `Tema ${isEditing ? 'atualizado' : 'criado'} com sucesso!` })
      navigate('/admin/essays/prompts')
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <SectionLoader />

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/admin/essays/prompts"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <h1 className="text-2xl font-bold text-foreground">
            {isEditing ? 'Editar Tema' : 'Novo Tema de Redação'}
          </h1>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>

      {/* Form */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle>Dados do Tema</CardTitle>
          <CardDescription>Configure o tema e os critérios de avaliação</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Tema *</Label>
            <Input
              value={form.title}
              onChange={(e) => updateForm('title', e.target.value)}
              placeholder="Ex: A Persistência da Violência Contra a Mulher"
            />
          </div>

          <div>
            <Label>Descrição / Texto de Apoio</Label>
            <Textarea
              value={form.description}
              onChange={(e) => updateForm('description', e.target.value)}
              rows={6}
              placeholder="Forneça o texto motivador e as instruções para a redação..."
            />
          </div>

          <div>
            <Label>Repertório Sugerido</Label>
            <Textarea
              value={form.suggested_repertoire}
              onChange={(e) => updateForm('suggested_repertoire', e.target.value)}
              rows={3}
              placeholder="Sugestões de repertório sociocultural para o tema..."
            />
          </div>

          <div>
            <Label>Critérios de Avaliação</Label>
            <Select
              value={form.criteria_template_id || '_none'}
              onValueChange={(v) => updateForm('criteria_template_id', v === '_none' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Nenhum (padrão ENEM)</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data Início (opcional)</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => updateForm('start_date', e.target.value)}
              />
            </div>
            <div>
              <Label>Data Fim (opcional)</Label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => updateForm('end_date', e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label className="cursor-pointer">Tema ativo (visível para alunos)</Label>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => updateForm('is_active', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bottom save */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => navigate('/admin/essays/prompts')}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar Tema'}
        </Button>
      </div>
    </div>
  )
}
