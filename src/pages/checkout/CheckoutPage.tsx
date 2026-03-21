import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { createCheckoutSession } from '@/services/stripeService'
import { logger } from '@/lib/logger'

export default function CheckoutPage() {
  usePageTitle('Checkout')
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [error, setError] = useState<string | null>(null)
  const [productName, setProductName] = useState<string>('')

  useEffect(() => {
    if (!slug || !user) return

    async function redirectToStripe() {
      try {
        // Fetch product name for the loading screen
        const { data: product } = await supabase
          .from('stripe_products')
          .select('product_name')
          .eq('landing_page_slug', slug!)
          .eq('is_active', true)
          .single()

        if (!product) {
          setError('Produto não encontrado ou inativo.')
          return
        }

        setProductName(product.product_name)

        // Create Stripe Checkout session and redirect immediately
        const couponCode = searchParams.get('coupon') || undefined
        const affiliateCode = searchParams.get('ref') || undefined

        const data = await createCheckoutSession({
          productSlug: slug!,
          couponCode,
          affiliateCode,
          paymentMethod: 'card',
          installments: 12,
        })

        if (data.session_url) {
          window.location.href = data.session_url
        } else {
          setError('Não foi possível criar a sessão de pagamento.')
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao processar pagamento'
        logger.error('Checkout redirect error:', err)
        setError(message)
      }
    }

    redirectToStripe()
  }, [slug, user, searchParams])

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-10 space-y-4">
            <AlertCircle className="mx-auto text-orange-500" size={48} />
            <h1 className="text-xl font-bold text-gray-900">Faça login para continuar</h1>
            <p className="text-gray-500">Você precisa estar logado para realizar a compra.</p>
            <Button onClick={() => navigate(`/login?redirect=/checkout/${slug}`)}>
              Fazer login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-10 space-y-4">
            <AlertCircle className="mx-auto text-red-500" size={48} />
            <h1 className="text-xl font-bold text-gray-900">Erro no checkout</h1>
            <p className="text-gray-500">{error}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate('/courses')}>
                Voltar aos cursos
              </Button>
              <Button onClick={() => window.location.reload()}>
                Tentar novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Loading — redirecting to Stripe
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-10 pb-10 space-y-6">
          <Loader2 className="mx-auto animate-spin text-green-600" size={48} />
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-gray-900">Preparando seu pagamento...</h1>
            {productName && (
              <p className="text-sm font-medium text-green-700">{productName}</p>
            )}
            <p className="text-sm text-gray-500">
              Você será redirecionado para a página segura do Stripe.
            </p>
          </div>
          <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
            <ShieldCheck size={14} />
            Pagamento seguro via Stripe
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
