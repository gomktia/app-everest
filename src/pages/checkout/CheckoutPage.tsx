import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { CreditCard, QrCode, Columns2, ShieldCheck, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { usePageTitle } from '@/hooks/usePageTitle'
import { supabase } from '@/lib/supabase/client'
import { validateCoupon, type Coupon } from '@/services/couponService'
import { createCheckoutSession } from '@/services/stripeService'
import { logger } from '@/lib/logger'

type PaymentMethod = 'card' | 'pix' | 'split_card'

interface StripeProduct {
  id: string
  name: string
  description: string | null
  price_cents: number
  landing_page_slug: string
  is_active: boolean
  stripe_product_classes?: { class_id: string; classes: { name: string } | null }[]
}

const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function CheckoutPage() {
  usePageTitle('Checkout')
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [product, setProduct] = useState<StripeProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card')
  const [installments, setInstallments] = useState(1)

  // Coupon
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)

  // Split card amounts
  const [splitAmount1, setSplitAmount1] = useState('')
  const [splitAmount2, setSplitAmount2] = useState('')

  // Affiliate
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null)

  // Fetch product
  useEffect(() => {
    if (!slug) return
    const fetchProduct = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('stripe_products')
        .select('*, stripe_product_classes(class_id, classes(name))')
        .eq('landing_page_slug', slug)
        .eq('is_active', true)
        .single()

      if (error || !data) {
        logger.error('Product fetch error:', error)
        toast({ title: 'Produto não encontrado', variant: 'destructive' })
        setLoading(false)
        return
      }
      setProduct(data)
      setLoading(false)
    }
    fetchProduct()
  }, [slug, toast])

  // Process URL params
  useEffect(() => {
    const couponParam = searchParams.get('coupon')
    if (couponParam) {
      setCouponCode(couponParam)
    }
    const refParam = searchParams.get('ref')
    if (refParam) {
      setAffiliateCode(refParam)
    }
  }, [searchParams])

  // Auto-apply coupon from URL
  useEffect(() => {
    const couponParam = searchParams.get('coupon')
    if (couponParam && product && !appliedCoupon) {
      handleApplyCoupon(couponParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product])

  const handleApplyCoupon = useCallback(
    async (code?: string) => {
      const codeToValidate = code || couponCode
      if (!codeToValidate.trim()) return
      setCouponLoading(true)
      const result = await validateCoupon(codeToValidate, product?.id)
      if (result.valid && result.coupon) {
        setAppliedCoupon(result.coupon)
        toast({ title: 'Cupom aplicado!' })
      } else {
        toast({ title: result.message || 'Cupom inválido', variant: 'destructive' })
      }
      setCouponLoading(false)
    },
    [couponCode, product, toast],
  )

  const discountCents = appliedCoupon
    ? appliedCoupon.discount_type === 'percent'
      ? Math.round((product?.price_cents || 0) * (appliedCoupon.discount_value / 100))
      : appliedCoupon.discount_value
    : 0

  const totalCents = Math.max(0, (product?.price_cents || 0) - discountCents)

  const handleSubmit = async () => {
    if (!slug) return
    setSubmitting(true)
    try {
      const params = {
        productSlug: slug,
        couponCode: appliedCoupon?.code,
        affiliateCode: affiliateCode || undefined,
        paymentMethod,
        installments: paymentMethod === 'card' ? installments : undefined,
        splitAmounts:
          paymentMethod === 'split_card'
            ? [
                Math.round(parseFloat(splitAmount1.replace(',', '.')) * 100) || 0,
                Math.round(parseFloat(splitAmount2.replace(',', '.')) * 100) || 0,
              ]
            : undefined,
      }
      const data = await createCheckoutSession(params)
      if (data.session_url) {
        window.location.href = data.session_url
      } else {
        toast({ title: 'Sessão criada. Redirecionando...' })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao processar pagamento'
      toast({ title: message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-gray-400" size={40} />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-10 space-y-4">
            <h1 className="text-xl font-bold text-gray-900">Produto não encontrado</h1>
            <p className="text-gray-500">O link pode estar incorreto ou o produto foi desativado.</p>
            <Button variant="outline" onClick={() => navigate('/login')}>
              Ir para o login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const paymentTabs: { key: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { key: 'card', label: 'Cartão', icon: <CreditCard size={16} /> },
    { key: 'pix', label: 'PIX', icon: <QrCode size={16} /> },
    { key: 'split_card', label: '2 Cartões', icon: <Columns2 size={16} /> },
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT — Order Summary */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold text-gray-900">Resumo do Pedido</h2>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{product.name}</h3>
              {product.description && (
                <p className="text-sm text-gray-500 mt-1">{product.description}</p>
              )}
              <Badge variant="secondary" className="mt-2">
                Acesso por 1 ano
              </Badge>
            </div>

            <div className="border-t pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatBRL(product.price_cents)}</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between text-green-600">
                  <span>
                    Cupom ({appliedCoupon.code})
                  </span>
                  <span>-{formatBRL(discountCents)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t">
                <span>Total</span>
                <span>{formatBRL(totalCents)}</span>
              </div>
            </div>

            {/* Coupon input */}
            <div className="flex gap-2">
              <Input
                placeholder="Código do cupom"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                disabled={!!appliedCoupon}
              />
              <Button
                variant="outline"
                onClick={() => handleApplyCoupon()}
                disabled={couponLoading || !!appliedCoupon}
              >
                {couponLoading ? <Loader2 className="animate-spin" size={16} /> : 'Aplicar'}
              </Button>
            </div>
            {appliedCoupon && (
              <button
                className="text-xs text-red-500 underline"
                onClick={() => {
                  setAppliedCoupon(null)
                  setCouponCode('')
                }}
              >
                Remover cupom
              </button>
            )}
          </CardContent>
        </Card>

        {/* RIGHT — Payment */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold text-gray-900">Pagamento</h2>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Payment method tabs */}
            <div className="flex gap-2">
              {paymentTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setPaymentMethod(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-md text-sm font-medium transition-colors ${
                    paymentMethod === tab.key
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-950/50 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {paymentMethod === 'card' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Ao clicar em Finalizar, você será redirecionado para a página segura do Stripe
                  para inserir os dados do cartão.
                </p>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Parcelas
                  </label>
                  <Select
                    value={String(installments)}
                    onValueChange={(v) => setInstallments(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}x de {formatBRL(Math.ceil(totalCents / n))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {paymentMethod === 'pix' && (
              <p className="text-sm text-gray-500">
                Ao clicar em Finalizar, você será redirecionado para gerar o QR Code PIX.
              </p>
            )}

            {paymentMethod === 'split_card' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">
                  Divida o valor entre dois cartões. A soma deve ser igual ao total.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">
                      Cartão 1 (R$)
                    </label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={splitAmount1}
                      onChange={(e) => setSplitAmount1(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">
                      Cartão 2 (R$)
                    </label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={splitAmount2}
                      onChange={(e) => setSplitAmount2(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Submit button */}
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-green-600 hover:bg-green-700 text-white text-base py-6"
            >
              {submitting ? (
                <Loader2 className="animate-spin mr-2" size={18} />
              ) : null}
              Finalizar Compra — {formatBRL(totalCents)}
            </Button>

            <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
              <ShieldCheck size={14} />
              Pagamento seguro via Stripe &middot; Seus dados estão protegidos
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
