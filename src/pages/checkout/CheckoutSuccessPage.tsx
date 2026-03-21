import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle, BookOpen, Play, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { usePageTitle } from '@/hooks/usePageTitle'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

interface OrderInfo {
  productName: string
  totalCents: number
  paymentMethod: string
  installments: number | null
  status: string
}

function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100)
}

function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const colors = ['#22c55e', '#16a34a', '#4ade80', '#fbbf24', '#f59e0b', '#3b82f6', '#8b5cf6']
    const particles: Array<{
      x: number; y: number; w: number; h: number;
      color: string; vx: number; vy: number; rot: number; vr: number;
      opacity: number
    }> = []

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * -1,
        w: Math.random() * 8 + 4,
        h: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 3 + 2,
        rot: Math.random() * 360,
        vr: (Math.random() - 0.5) * 8,
        opacity: 1,
      })
    }

    let animationId: number
    let frame = 0

    function animate() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      frame++

      let alive = false
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.05
        p.rot += p.vr

        if (frame > 60) {
          p.opacity -= 0.008
        }

        if (p.opacity <= 0) continue
        alive = true

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rot * Math.PI) / 180)
        ctx.globalAlpha = Math.max(0, p.opacity)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }

      if (alive) {
        animationId = requestAnimationFrame(animate)
      }
    }

    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
    />
  )
}

export default function CheckoutSuccessPage() {
  usePageTitle('Compra Realizada')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('order')

  const [order, setOrder] = useState<OrderInfo | null>(null)
  const [loading, setLoading] = useState(!!orderId)

  useEffect(() => {
    if (!orderId) return

    async function fetchOrder() {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select(`
            total_cents,
            payment_method,
            installments,
            status,
            order_items (
              stripe_products:stripe_product_id (
                product_name
              )
            )
          `)
          .eq('id', orderId!)
          .single()

        if (error || !data) {
          logger.warn('Could not fetch order:', error)
          return
        }

        const items = data.order_items as any[]
        const productName = items?.[0]?.stripe_products?.product_name || 'Seu curso'

        setOrder({
          productName,
          totalCents: data.total_cents,
          paymentMethod: data.payment_method,
          installments: data.installments,
          status: data.status,
        })
      } catch (err) {
        logger.warn('Error fetching order:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchOrder()
  }, [orderId])

  const paymentLabel =
    order?.paymentMethod === 'pix'
      ? 'PIX'
      : order?.installments && order.installments > 1
        ? `${order.installments}x no cartão`
        : 'Cartão de crédito'

  return (
    <>
      <ConfettiCanvas />

      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white p-4">
        <Card className="w-full max-w-lg text-center shadow-lg border-green-200">
          <CardContent className="pt-10 pb-10 space-y-8">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center animate-[bounce_1s_ease-in-out]">
                  <CheckCircle className="text-green-600" size={48} strokeWidth={2.5} />
                </div>
                <Sparkles className="absolute -top-2 -right-2 text-yellow-500 animate-pulse" size={20} />
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900">
                Parabéns! Compra realizada!
              </h1>
              {loading ? (
                <div className="h-5 w-48 bg-gray-200 rounded animate-pulse mx-auto" />
              ) : order ? (
                <p className="text-lg font-semibold text-green-700">
                  {order.productName}
                </p>
              ) : null}
            </div>

            {/* Order details */}
            {order && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm text-left">
                <div className="flex justify-between">
                  <span className="text-gray-500">Valor</span>
                  <span className="font-medium">{formatBRL(order.totalCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Pagamento</span>
                  <span className="font-medium">{paymentLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className="inline-flex items-center gap-1 font-medium text-green-600">
                    <CheckCircle size={14} /> Confirmado
                  </span>
                </div>
              </div>
            )}

            {/* Next steps */}
            <div className="text-left space-y-3">
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Próximos passos
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-3 text-sm text-gray-600">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-green-700 text-xs font-bold">1</span>
                  </div>
                  <span>Você receberá um email de confirmação com os detalhes do acesso</span>
                </div>
                <div className="flex items-start gap-3 text-sm text-gray-600">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-green-700 text-xs font-bold">2</span>
                  </div>
                  <span>Acesse a plataforma e comece a assistir as aulas agora mesmo</span>
                </div>
                <div className="flex items-start gap-3 text-sm text-gray-600">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-green-700 text-xs font-bold">3</span>
                  </div>
                  <span>Use o plano de estudos para organizar sua rotina e manter o foco</span>
                </div>
              </div>
            </div>

            {/* CTA buttons */}
            <div className="space-y-3 pt-2">
              <Button
                onClick={() => navigate('/courses')}
                className="bg-green-600 hover:bg-green-700 text-white w-full h-12 text-base gap-2"
              >
                <Play size={18} />
                Começar a estudar agora
                <ArrowRight size={18} />
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/plano-de-estudos')}
                className="w-full gap-2"
              >
                <BookOpen size={18} />
                Montar meu plano de estudos
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
