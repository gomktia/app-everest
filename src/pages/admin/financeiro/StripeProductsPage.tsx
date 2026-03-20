import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SectionLoader } from '@/components/SectionLoader'
import { ArrowLeft, Plus, Copy, Edit, Package, Check, X } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface StripeProduct {
  id: string
  stripe_product_id: string
  stripe_price_id: string
  product_name: string
  price_cents: number
  installments_max: number
  access_days: number
  is_bundle: boolean
  landing_page_slug: string | null
  is_active: boolean
  created_at: string
  stripe_product_classes?: { class_id: string; classes: { id: string; name: string } | null }[]
}

interface ClassOption {
  id: string
  name: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const generateSlug = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// ─── Component ──────────────────────────────────────────────────────────────

export default function StripeProductsPage() {
  usePageTitle('Produtos Stripe')
  const navigate = useNavigate()
  const { toast } = useToast()
  const [products, setProducts] = useState<StripeProduct[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<StripeProduct | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formStripeProductId, setFormStripeProductId] = useState('')
  const [formStripePriceId, setFormStripePriceId] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formInstallments, setFormInstallments] = useState('12')
  const [formAccessDays, setFormAccessDays] = useState('365')
  const [formIsBundle, setFormIsBundle] = useState(false)
  const [formSlug, setFormSlug] = useState('')
  const [formClassIds, setFormClassIds] = useState<string[]>([])

  const loadProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('stripe_products')
        .select('*, stripe_product_classes(class_id, classes(id, name))')
        .order('created_at', { ascending: false })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      logger.error('Erro ao carregar produtos Stripe:', error)
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
    setFormStripeProductId('')
    setFormStripePriceId('')
    setFormPrice('')
    setFormInstallments('12')
    setFormAccessDays('365')
    setFormIsBundle(false)
    setFormSlug('')
    setFormClassIds([])
    setEditingProduct(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEditDialog = (product: StripeProduct) => {
    setEditingProduct(product)
    setFormName(product.product_name)
    setFormStripeProductId(product.stripe_product_id)
    setFormStripePriceId(product.stripe_price_id)
    setFormPrice((product.price_cents / 100).toFixed(2).replace('.', ','))
    setFormInstallments(String(product.installments_max))
    setFormAccessDays(String(product.access_days))
    setFormIsBundle(product.is_bundle)
    setFormSlug(product.landing_page_slug || '')
    setFormClassIds(
      product.stripe_product_classes?.map((spc) => spc.class_id) || []
    )
    setDialogOpen(true)
  }

  const handleNameChange = (name: string) => {
    setFormName(name)
    if (!editingProduct) {
      setFormSlug(generateSlug(name))
    }
  }

  const parsePriceToCents = (value: string): number => {
    const cleaned = value.replace(/[^\d,\.]/g, '').replace(',', '.')
    return Math.round(parseFloat(cleaned) * 100) || 0
  }

  const handleSave = async () => {
    if (
      !formName.trim() ||
      !formStripeProductId.trim() ||
      !formStripePriceId.trim() ||
      !formPrice.trim() ||
      !formSlug.trim() ||
      formClassIds.length === 0
    ) {
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
        stripe_product_id: formStripeProductId.trim(),
        stripe_price_id: formStripePriceId.trim(),
        price_cents: parsePriceToCents(formPrice),
        installments_max: parseInt(formInstallments),
        access_days: parseInt(formAccessDays),
        is_bundle: formIsBundle,
        landing_page_slug: formSlug.trim(),
        is_active: true,
      }

      if (editingProduct) {
        const { error } = await supabase
          .from('stripe_products')
          .update(payload)
          .eq('id', editingProduct.id)
        if (error) throw error

        // Delete and re-insert class associations
        const { error: deleteError } = await supabase
          .from('stripe_product_classes')
          .delete()
          .eq('stripe_product_id', editingProduct.id)
        if (deleteError) throw deleteError

        const classRows = formClassIds.map((classId) => ({
          stripe_product_id: editingProduct.id,
          class_id: classId,
        }))
        const { error: insertError } = await supabase
          .from('stripe_product_classes')
          .insert(classRows)
        if (insertError) throw insertError

        toast({ title: 'Produto atualizado com sucesso' })
      } else {
        const { data, error } = await supabase
          .from('stripe_products')
          .insert(payload)
          .select('id')
          .single()
        if (error) throw error

        const classRows = formClassIds.map((classId) => ({
          stripe_product_id: data.id,
          class_id: classId,
        }))
        const { error: insertError } = await supabase
          .from('stripe_product_classes')
          .insert(classRows)
        if (insertError) throw insertError

        toast({ title: 'Produto criado com sucesso' })
      }

      setDialogOpen(false)
      resetForm()
      loadProducts()
    } catch (error: any) {
      logger.error('Erro ao salvar produto Stripe:', error)
      const isDuplicate = error?.code === '23505'
      toast({
        title: 'Erro ao salvar',
        description: isDuplicate
          ? 'Ja existe um produto com esse Stripe Price ID ou slug'
          : error?.message || 'Tente novamente',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (product: StripeProduct) => {
    try {
      const { error } = await supabase
        .from('stripe_products')
        .update({ is_active: !product.is_active })
        .eq('id', product.id)
      if (error) throw error
      toast({
        title: product.is_active ? 'Produto desativado' : 'Produto ativado',
      })
      loadProducts()
    } catch (error) {
      logger.error('Erro ao alterar status:', error)
      toast({
        title: 'Erro ao alterar status',
        description: 'Tente novamente',
        variant: 'destructive',
      })
    }
  }

  const copyCheckoutUrl = (slug: string) => {
    const url = `https://app.everestpreparatorios.com.br/checkout/${slug}`
    navigator.clipboard.writeText(url)
    toast({ title: 'URL de checkout copiada!' })
  }

  const toggleClassId = (classId: string) => {
    setFormClassIds((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId]
    )
  }

  const getClassNames = (product: StripeProduct) => {
    return (
      product.stripe_product_classes
        ?.map((spc) => spc.classes?.name)
        .filter(Boolean)
        .join(', ') || '-'
    )
  }

  if (loading) return <SectionLoader />

  const activeCount = products.filter((p) => p.is_active).length
  const bundleCount = products.filter((p) => p.is_bundle).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/financeiro')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Produtos Stripe
            </h1>
            <p className="text-sm text-muted-foreground">
              Gerencie produtos, precos e vincule turmas para venda via Stripe.
            </p>
          </div>
        </div>
        <Button onClick={openCreateDialog} className="w-full md:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Criar Produto
        </Button>
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
                  Total Produtos
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted/50">
                <Check className="h-5 w-5 text-blue-600" />
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
                <Package className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">
                  {bundleCount}
                </div>
                <div className="text-xs text-muted-foreground">Bundles</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-5">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Preco</TableHead>
                  <TableHead className="hidden lg:table-cell">Parcelas</TableHead>
                  <TableHead className="hidden lg:table-cell">Acesso</TableHead>
                  <TableHead className="hidden md:table-cell">Turma(s)</TableHead>
                  <TableHead className="hidden lg:table-cell">Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <Package className="h-12 w-12 text-muted-foreground/50" />
                        <div>
                          <p className="font-medium text-muted-foreground">
                            Nenhum produto cadastrado
                          </p>
                          <p className="text-sm text-muted-foreground/60">
                            Crie um produto para comecar a vender via Stripe
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow
                      key={product.id}
                      className="group hover:bg-primary/5"
                    >
                      <TableCell>
                        <div className="font-medium group-hover:text-primary transition-colors">
                          {product.product_name}
                        </div>
                        {product.is_bundle && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            Bundle
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {formatBRL(product.price_cents)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {product.installments_max}x
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {product.access_days} dias
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-[200px] truncate">
                        {getClassNames(product)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <code className="text-xs bg-muted/50 rounded px-2 py-0.5 font-mono">
                          {product.landing_page_slug || '-'}
                        </code>
                      </TableCell>
                      <TableCell>
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
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Editar"
                            onClick={() => openEditDialog(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {product.landing_page_slug && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Copiar URL de Checkout"
                              onClick={() =>
                                copyCheckoutUrl(product.landing_page_slug!)
                              }
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={
                              product.is_active ? 'Desativar' : 'Ativar'
                            }
                            onClick={() => handleToggleActive(product)}
                          >
                            {product.is_active ? (
                              <X className="h-4 w-4 text-destructive" />
                            ) : (
                              <Check className="h-4 w-4 text-green-600" />
                            )}
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Produto' : 'Criar Produto Stripe'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="product-name">Nome do Produto</Label>
              <Input
                id="product-name"
                placeholder="Ex: Extensivo EAOF 2027"
                value={formName}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stripe-product-id">Stripe Product ID</Label>
              <Input
                id="stripe-product-id"
                placeholder="prod_..."
                value={formStripeProductId}
                onChange={(e) => setFormStripeProductId(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Copie do Stripe Dashboard em Products.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stripe-price-id">Stripe Price ID</Label>
              <Input
                id="stripe-price-id"
                placeholder="price_..."
                value={formStripePriceId}
                onChange={(e) => setFormStripePriceId(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Preco (R$)</Label>
                <Input
                  id="price"
                  placeholder="997,00"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="installments">Parcelas Max</Label>
                <Select
                  value={formInstallments}
                  onValueChange={setFormInstallments}
                >
                  <SelectTrigger id="installments">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}x
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="access-days">Dias de Acesso</Label>
              <Input
                id="access-days"
                type="number"
                value={formAccessDays}
                onChange={(e) => setFormAccessDays(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is-bundle"
                checked={formIsBundle}
                onCheckedChange={(checked) => {
                  setFormIsBundle(checked === true)
                  if (checked !== true) {
                    setFormClassIds((prev) => prev.slice(0, 1))
                  }
                }}
              />
              <Label htmlFor="is-bundle" className="cursor-pointer">
                E um bundle (combo de turmas)
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug da Landing Page</Label>
              <Input
                id="slug"
                placeholder="extensivo-eaof-2027"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                URL: /checkout/{formSlug || '...'}
              </p>
            </div>

            <div className="space-y-2">
              <Label>
                {formIsBundle ? 'Turmas do Bundle' : 'Turma Vinculada'}
              </Label>
              {formIsBundle ? (
                <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                  {classes.map((c) => (
                    <div key={c.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`class-${c.id}`}
                        checked={formClassIds.includes(c.id)}
                        onCheckedChange={() => toggleClassId(c.id)}
                      />
                      <Label
                        htmlFor={`class-${c.id}`}
                        className="cursor-pointer text-sm font-normal"
                      >
                        {c.name}
                      </Label>
                    </div>
                  ))}
                  {classes.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma turma encontrada
                    </p>
                  )}
                </div>
              ) : (
                <Select
                  value={formClassIds[0] || ''}
                  onValueChange={(val) => setFormClassIds([val])}
                >
                  <SelectTrigger>
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
              )}
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
