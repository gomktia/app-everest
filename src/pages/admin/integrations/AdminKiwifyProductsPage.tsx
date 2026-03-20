import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
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
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SectionLoader } from '@/components/SectionLoader'
import {
  ShoppingCart,
  PlusCircle,
  Edit,
  Trash2,
  Copy,
  Webhook,
  Search,
  LinkIcon,
  Package,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface KiwifyProduct {
  id: string
  kiwify_product_id: string
  class_id: string
  product_name: string
  is_active: boolean
  created_at: string
  classes?: { id: string; name: string } | null
}

interface ClassOption {
  id: string
  name: string
}

const WEBHOOK_URL =
  'https://hnhzindsfuqnaxosujay.supabase.co/functions/v1/kiwify-webhook'

// ─── Component ──────────────────────────────────────────────────────────────

export default function AdminKiwifyProductsPage() {
  usePageTitle('Produtos Kiwify')
  const { toast } = useToast()
  const [products, setProducts] = useState<KiwifyProduct[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<KiwifyProduct | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formKiwifyId, setFormKiwifyId] = useState('')
  const [formClassId, setFormClassId] = useState('')
  const [formActive, setFormActive] = useState(true)

  const loadProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('kiwify_products')
        .select('*, classes(id, name)')
        .order('created_at', { ascending: false })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      logger.error('Erro ao carregar produtos Kiwify:', error)
      toast({
        title: 'Erro',
        description: 'Nao foi possivel carregar os produtos',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const loadClasses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name')
        .eq('status', 'active')
        .order('name')

      if (error) throw error
      setClasses(data || [])
    } catch (error) {
      logger.error('Erro ao carregar turmas:', error)
    }
  }, [])

  useEffect(() => {
    loadProducts()
    loadClasses()
  }, [loadProducts, loadClasses])

  const resetForm = () => {
    setFormName('')
    setFormKiwifyId('')
    setFormClassId('')
    setFormActive(true)
    setEditingProduct(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEditDialog = (product: KiwifyProduct) => {
    setEditingProduct(product)
    setFormName(product.product_name)
    setFormKiwifyId(product.kiwify_product_id)
    setFormClassId(product.class_id)
    setFormActive(product.is_active)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim() || !formKiwifyId.trim() || !formClassId) {
      toast({
        title: 'Campos obrigatorios',
        description: 'Preencha todos os campos antes de salvar',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        product_name: formName.trim(),
        kiwify_product_id: formKiwifyId.trim(),
        class_id: formClassId,
        is_active: formActive,
      }

      if (editingProduct) {
        const { error } = await supabase
          .from('kiwify_products')
          .update(payload)
          .eq('id', editingProduct.id)

        if (error) throw error
        toast({ title: 'Produto atualizado com sucesso' })
      } else {
        const { error } = await supabase
          .from('kiwify_products')
          .insert(payload)

        if (error) throw error
        toast({ title: 'Produto criado com sucesso' })
      }

      setDialogOpen(false)
      resetForm()
      loadProducts()
    } catch (error: any) {
      logger.error('Erro ao salvar produto Kiwify:', error)
      const isDuplicate = error?.code === '23505'
      toast({
        title: 'Erro ao salvar',
        description: isDuplicate
          ? 'Ja existe um produto com esse ID Kiwify'
          : error?.message || 'Tente novamente',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (product: KiwifyProduct) => {
    if (
      !confirm(
        `Excluir o mapeamento "${product.product_name}"? Esta acao nao pode ser desfeita.`,
      )
    )
      return

    try {
      const { error } = await supabase
        .from('kiwify_products')
        .delete()
        .eq('id', product.id)

      if (error) throw error
      toast({ title: 'Produto removido com sucesso' })
      loadProducts()
    } catch (error) {
      logger.error('Erro ao excluir produto Kiwify:', error)
      toast({
        title: 'Erro ao excluir',
        description: 'Tente novamente',
        variant: 'destructive',
      })
    }
  }

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(WEBHOOK_URL)
    toast({ title: 'URL do webhook copiada!' })
  }

  const filteredProducts = products.filter(
    (p) =>
      p.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.kiwify_product_id.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (loading) return <SectionLoader />

  const activeCount = products.filter((p) => p.is_active).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Produtos Kiwify
        </h1>
        <p className="text-sm text-muted-foreground">
          Mapeie produtos da Kiwify para turmas da plataforma. Ao receber uma
          compra via webhook, o aluno e matriculado automaticamente.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted/50">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">
                  {products.length}
                </div>
                <div className="text-xs text-muted-foreground">
                  Total de Produtos
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted/50">
                <LinkIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">
                  {activeCount}
                </div>
                <div className="text-xs text-muted-foreground">Ativos</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted/50">
                <ShoppingCart className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">
                  {classes.length}
                </div>
                <div className="text-xs text-muted-foreground">
                  Turmas Disponiveis
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Webhook URL Info */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950/50">
              <Webhook className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Webhook URL (configurar na Kiwify)
              </h3>
              <p className="text-xs text-muted-foreground mb-2">
                Configure esta URL no painel da Kiwify em Configuracoes &gt;
                Webhooks. O evento de compra aprovada ira matricular o aluno
                automaticamente na turma vinculada.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted/50 rounded-md px-3 py-2 font-mono text-foreground/80 break-all">
                  {WEBHOOK_URL}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyWebhookUrl}
                  className="shrink-0 gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search + Add */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="relative flex-1 w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou ID do produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button className="w-full md:w-auto" onClick={openCreateDialog}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Novo Mapeamento
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-5">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="hidden md:table-cell">
                    ID Kiwify
                  </TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Criado em
                  </TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <ShoppingCart className="h-12 w-12 text-muted-foreground/50" />
                        <div>
                          <p className="font-medium text-muted-foreground">
                            Nenhum produto encontrado
                          </p>
                          <p className="text-sm text-muted-foreground/60">
                            {searchTerm
                              ? 'Tente outra busca'
                              : 'Adicione um mapeamento de produto para turma'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow
                      key={product.id}
                      className="group hover:bg-primary/5"
                    >
                      <TableCell>
                        <div className="font-medium group-hover:text-primary transition-colors">
                          {product.product_name}
                        </div>
                        <div className="text-xs text-muted-foreground md:hidden">
                          {product.kiwify_product_id}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <code className="text-xs bg-muted/50 rounded px-2 py-0.5 font-mono">
                          {product.kiwify_product_id}
                        </code>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {product.classes?.name || (
                            <span className="text-muted-foreground italic">
                              Turma removida
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {product.is_active ? (
                          <Badge className="bg-green-100 dark:bg-green-950/50 border-green-300 dark:border-green-800 text-green-600">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground"
                          >
                            Inativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {new Date(product.created_at).toLocaleDateString(
                          'pt-BR',
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(product)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProduct
                ? 'Editar Mapeamento'
                : 'Novo Mapeamento de Produto'}
            </DialogTitle>
            <DialogDescription>
              Vincule um produto da Kiwify a uma turma da plataforma.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="product-name">Nome do Produto</Label>
              <Input
                id="product-name"
                placeholder="Ex: Extensivo EAOF 2027"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kiwify-id">ID do Produto na Kiwify</Label>
              <Input
                id="kiwify-id"
                placeholder="Ex: prod_abc123xyz"
                value={formKiwifyId}
                onChange={(e) => setFormKiwifyId(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Encontre o ID do produto no painel da Kiwify, na pagina de
                detalhes do produto.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="class-select">Turma Vinculada</Label>
              <Select value={formClassId} onValueChange={setFormClassId}>
                <SelectTrigger id="class-select">
                  <SelectValue placeholder="Selecione uma turma..." />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="is-active" className="cursor-pointer">
                  Ativo
                </Label>
                <p className="text-xs text-muted-foreground">
                  Quando inativo, compras deste produto nao geram matricula
                </p>
              </div>
              <Switch
                id="is-active"
                checked={formActive}
                onCheckedChange={setFormActive}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editingProduct ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
