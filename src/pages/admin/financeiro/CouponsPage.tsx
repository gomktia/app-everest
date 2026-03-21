import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useToast } from '@/hooks/use-toast'
import { logger } from '@/lib/logger'
import { supabase } from '@/lib/supabase/client'
import {
  getCoupons,
  adminCreateCoupon,
  adminUpdateCoupon,
  adminDeactivateCoupon,
  type Coupon,
} from '@/services/couponService'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SectionLoader } from '@/components/SectionLoader'
import { ArrowLeft, Plus, Copy, Edit, Tag, Hash, AlertTriangle } from 'lucide-react'

const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface StripeProduct {
  id: string
  product_name: string
  landing_page_slug: string
}

function getCouponStatus(coupon: Coupon): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (!coupon.is_active) return { label: 'Inativo', variant: 'secondary' }
  if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) return { label: 'Expirado', variant: 'outline' }
  if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) return { label: 'Esgotado', variant: 'outline' }
  return { label: 'Ativo', variant: 'default' }
}

export default function CouponsPage() {
  usePageTitle('Cupons')
  const navigate = useNavigate()
  const { toast } = useToast()

  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [products, setProducts] = useState<StripeProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)

  // Form state
  const [formCode, setFormCode] = useState('')
  const [formType, setFormType] = useState<'percent' | 'fixed'>('percent')
  const [formValue, setFormValue] = useState('')
  const [formMaxUses, setFormMaxUses] = useState('')
  const [formValidUntil, setFormValidUntil] = useState('')
  const [formProducts, setFormProducts] = useState<string[]>([])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [couponsData, productsRes] = await Promise.all([
        getCoupons(),
        supabase.from('stripe_products').select('id, product_name, landing_page_slug').order('product_name'),
      ])
      setCoupons(couponsData as Coupon[])
      setProducts(productsRes.data || [])
    } catch (err) {
      logger.error('Error loading coupons:', err)
      toast({ title: 'Erro ao carregar cupons', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  const resetForm = () => {
    setFormCode('')
    setFormType('percent')
    setFormValue('')
    setFormMaxUses('')
    setFormValidUntil('')
    setFormProducts([])
    setEditingCoupon(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEditDialog = (coupon: Coupon) => {
    setEditingCoupon(coupon)
    setFormCode(coupon.code)
    setFormType(coupon.discount_type)
    // Convert centavos back to reais for display when editing fixed discounts
    setFormValue(coupon.discount_type === 'fixed'
      ? String(coupon.discount_value / 100)
      : String(coupon.discount_value))
    setFormMaxUses(coupon.max_uses ? String(coupon.max_uses) : '')
    setFormValidUntil(coupon.valid_until ? coupon.valid_until.split('T')[0] : '')
    setFormProducts(coupon.applicable_products || [])
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formCode.trim() || !formValue) {
      toast({ title: 'Preencha o código e o valor do desconto', variant: 'destructive' })
      return
    }
    try {
      setSaving(true)
      // Convert reais to centavos for fixed discounts
      const discountValue = formType === 'fixed'
        ? Math.round(Number(formValue) * 100)
        : Number(formValue)

      if (editingCoupon) {
        await adminUpdateCoupon({
          coupon_id: editingCoupon.id,
          discount_type: formType,
          discount_value: discountValue,
          max_uses: formMaxUses ? Number(formMaxUses) : undefined,
          valid_until: formValidUntil || undefined,
          applicable_products: formProducts.length > 0 ? formProducts : undefined,
        })
      } else {
        await adminCreateCoupon({
          code: formCode.toUpperCase().replace(/\s/g, ''),
          discount_type: formType,
          discount_value: discountValue,
          max_uses: formMaxUses ? Number(formMaxUses) : undefined,
          valid_until: formValidUntil || undefined,
          applicable_products: formProducts.length > 0 ? formProducts : undefined,
        })
      }
      toast({ title: editingCoupon ? 'Cupom atualizado' : 'Cupom criado com sucesso' })
      setDialogOpen(false)
      resetForm()
      await loadData()
    } catch (err) {
      logger.error('Error saving coupon:', err)
      toast({ title: 'Erro ao salvar cupom', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (coupon: Coupon) => {
    try {
      await adminDeactivateCoupon(coupon.id)
      toast({ title: `Cupom ${coupon.code} desativado` })
      await loadData()
    } catch (err) {
      logger.error('Error deactivating coupon:', err)
      toast({ title: 'Erro ao desativar cupom', variant: 'destructive' })
    }
  }

  const handleCopyLink = (code: string) => {
    const url = `https://app.everestpreparatorios.com.br/checkout?coupon=${code}`
    navigator.clipboard.writeText(url)
    toast({ title: 'Link copiado!' })
  }

  const toggleProduct = (productId: string) => {
    setFormProducts(prev =>
      prev.includes(productId) ? prev.filter(p => p !== productId) : [...prev, productId]
    )
  }

  // Stats
  const activeCoupons = coupons.filter(c => c.is_active && (!c.valid_until || new Date(c.valid_until) >= new Date())).length
  const totalUses = coupons.reduce((sum, c) => sum + c.current_uses, 0)
  const expiredCoupons = coupons.filter(c => c.valid_until && new Date(c.valid_until) < new Date()).length

  if (loading) return <SectionLoader />

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/financeiro')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Cupons</h1>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" /> Criar Cupom
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-green-100 dark:bg-green-950/50 p-3">
              <Tag className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cupons Ativos</p>
              <p className="text-2xl font-bold">{activeCoupons}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-blue-100 dark:bg-blue-950/50 p-3">
              <Hash className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Usos</p>
              <p className="text-2xl font-bold">{totalUses}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-yellow-100 dark:bg-yellow-950/50 p-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cupons Expirados</p>
              <p className="text-2xl font-bold">{expiredCoupons}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Codigo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum cupom cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                coupons.map(coupon => {
                  const status = getCouponStatus(coupon)
                  return (
                    <TableRow key={coupon.id}>
                      <TableCell className="font-mono font-semibold">{coupon.code}</TableCell>
                      <TableCell>{coupon.discount_type === 'percent' ? '%' : 'R$'}</TableCell>
                      <TableCell>
                        {coupon.discount_type === 'percent'
                          ? `${coupon.discount_value}%`
                          : formatBRL(coupon.discount_value)}
                      </TableCell>
                      <TableCell>
                        {coupon.max_uses
                          ? `${coupon.current_uses}/${coupon.max_uses}`
                          : `${coupon.current_uses} (Ilimitado)`}
                      </TableCell>
                      <TableCell>
                        {coupon.valid_until
                          ? new Date(coupon.valid_until).toLocaleDateString('pt-BR')
                          : 'Sem validade'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(coupon)}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {coupon.is_active && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeactivate(coupon)}
                              title="Desativar"
                            >
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyLink(coupon.code)}
                            title="Copiar link"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm() } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCoupon ? 'Editar Cupom' : 'Criar Cupom'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="coupon-code">Codigo do Cupom</Label>
              <Input
                id="coupon-code"
                placeholder="EX: DESCONTO20"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                disabled={!!editingCoupon}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Desconto</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="discount-type"
                    checked={formType === 'percent'}
                    onChange={() => setFormType('percent')}
                    className="accent-primary"
                  />
                  <span className="text-sm">Porcentagem (%)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="discount-type"
                    checked={formType === 'fixed'}
                    onChange={() => setFormType('fixed')}
                    className="accent-primary"
                  />
                  <span className="text-sm">Valor fixo (R$)</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="coupon-value">
                Valor do Desconto {formType === 'percent' ? '(%)' : '(R$)'}
              </Label>
              <Input
                id="coupon-value"
                type="number"
                min={formType === 'percent' ? 1 : 0.01}
                max={formType === 'percent' ? 100 : undefined}
                step={formType === 'fixed' ? '0.01' : '1'}
                placeholder={formType === 'percent' ? '20' : '50.00'}
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="coupon-max-uses">Usos Maximos (vazio = ilimitado)</Label>
              <Input
                id="coupon-max-uses"
                type="number"
                min={1}
                placeholder="Ilimitado"
                value={formMaxUses}
                onChange={(e) => setFormMaxUses(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="coupon-valid-until">Valido ate (opcional)</Label>
              <Input
                id="coupon-valid-until"
                type="date"
                value={formValidUntil}
                onChange={(e) => setFormValidUntil(e.target.value)}
              />
            </div>

            {products.length > 0 && (
              <div className="space-y-2">
                <Label>Produtos Aplicaveis (vazio = todos)</Label>
                <div className="max-h-32 overflow-y-auto rounded border p-2 space-y-1">
                  {products.map(product => (
                    <label key={product.id} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={formProducts.includes(product.id)}
                        onChange={() => toggleProduct(product.id)}
                        className="accent-primary"
                      />
                      {product.product_name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editingCoupon ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
