import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  MailCheck,
  KeyRound,
  Mountain,
} from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Por favor, insira um email válido.'),
  password: z.string().optional(),
}).refine(
  (data) => !data.password || data.password.length >= 12,
  { message: 'A senha deve ter pelo menos 12 caracteres.', path: ['password'] }
)

type LoginValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { signIn, signInWithMagicLink } = useAuth()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [usePasswordMode, setUsePasswordMode] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [sentEmail, setSentEmail] = useState('')

  // Rate limiting: track failed attempts
  const MAX_ATTEMPTS = 5
  const LOCKOUT_SECONDS = 120
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null)
  const [lockoutRemaining, setLockoutRemaining] = useState(0)

  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil

  useEffect(() => {
    if (!lockoutUntil) return
    const tick = () => {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000)
      if (remaining <= 0) {
        setLockoutUntil(null)
        setLockoutRemaining(0)
        setFailedAttempts(0)
      } else {
        setLockoutRemaining(remaining)
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [lockoutUntil])

  const trackFailedAttempt = useCallback(() => {
    const next = failedAttempts + 1
    setFailedAttempts(next)
    if (next >= MAX_ATTEMPTS) {
      setLockoutUntil(Date.now() + LOCKOUT_SECONDS * 1000)
    }
  }, [failedAttempts])

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (data: LoginValues) => {
    if (isLockedOut) {
      toast({
        title: 'Conta temporariamente bloqueada',
        description: `Aguarde ${lockoutRemaining}s antes de tentar novamente.`,
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    if (usePasswordMode) {
      const { error } = await signIn(data.email, data.password || '')
      if (error) {
        trackFailedAttempt()
        const attemptsLeft = MAX_ATTEMPTS - (failedAttempts + 1)
        toast({
          title: 'Erro de Autenticação',
          description: attemptsLeft > 0
            ? `Email ou senha inválidos. ${attemptsLeft} tentativa${attemptsLeft !== 1 ? 's' : ''} restante${attemptsLeft !== 1 ? 's' : ''}.`
            : `Muitas tentativas incorretas. Conta bloqueada por ${LOCKOUT_SECONDS / 60} minutos.`,
          variant: 'destructive',
        })
      } else {
        setFailedAttempts(0)
      }
    } else {
      const { error } = await signInWithMagicLink(data.email)
      if (error) {
        toast({
          title: 'Erro ao enviar link',
          description: 'Não foi possível enviar o link de acesso. Verifique seu email e tente novamente.',
          variant: 'destructive',
        })
      } else {
        setSentEmail(data.email)
        setMagicLinkSent(true)
      }
    }
    setIsLoading(false)
  }

  // ── Magic link sent state ──
  if (magicLinkSent) {
    return (
      <div className="min-h-screen flex">
        <HeroPanel />
        <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-sidebar text-sidebar-foreground">
          <div className="w-full max-w-sm space-y-8">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                <MailCheck className="h-8 w-8 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Verifique seu Email</h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  Enviamos um link de acesso para{' '}
                  <span className="font-semibold text-foreground">{sentEmail}</span>
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent p-6 space-y-4">
              <div className="text-center text-sm text-muted-foreground space-y-1">
                <p>Clique no link enviado para acessar a plataforma.</p>
                <p className="text-xs">O link expira em 1 hora.</p>
              </div>

              <Button
                variant="outline"
                className="w-full h-11 rounded-xl"
                onClick={() => {
                  setMagicLinkSent(false)
                  setSentEmail('')
                }}
              >
                Tentar com outro email
              </Button>

              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => onSubmit({ email: sentEmail })}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Reenviar link
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Main login ──
  return (
    <div className="min-h-screen flex">
      <HeroPanel />

      {/* Right side — Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-sidebar text-sidebar-foreground relative">
        {/* Subtle top-right glow */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="w-full max-w-sm space-y-8 relative z-10">
          {/* Mobile logo (hidden on lg+) */}
          <div className="flex flex-col items-center gap-3 lg:hidden">
            <img src="/logo.png" alt="Everest" className="h-14 w-14 rounded-xl object-contain" />
            <h1 className="text-2xl font-bold">Everest</h1>
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Bem-vindo de volta</h2>
            <p className="text-muted-foreground text-sm">
              {usePasswordMode
                ? 'Entre com seu email e senha.'
                : 'Informe seu email para receber o link de acesso.'}
            </p>
          </div>

          {/* Form card */}
          <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent p-6 shadow-sm">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="email"
                            placeholder="seu@email.com"
                            autoComplete="email"
                            className="pl-10 h-12 rounded-xl border-border/60 focus:border-primary"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {usePasswordMode && (
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-sm font-semibold">Senha</FormLabel>
                          <a
                            href="/reset-password"
                            className="text-xs text-muted-foreground hover:text-primary transition-colors"
                            tabIndex={-1}
                          >
                            Esqueceu a senha?
                          </a>
                        </div>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="••••••••"
                              autoComplete="current-password"
                              className="pl-10 pr-10 h-12 rounded-xl border-border/60 focus:border-primary"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {isLockedOut && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-center">
                    <p className="text-sm font-medium text-destructive">
                      Conta temporariamente bloqueada
                    </p>
                    <p className="text-xs text-destructive/80 mt-1">
                      Tente novamente em {lockoutRemaining}s
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl font-semibold text-sm shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
                  disabled={isLoading || isLockedOut}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {usePasswordMode ? 'Entrando...' : 'Enviando...'}
                    </>
                  ) : usePasswordMode ? (
                    <>
                      Entrar
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Enviar Link de Acesso
                    </>
                  )}
                </Button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-sidebar-accent px-3 text-muted-foreground">ou</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-foreground"
                  onClick={() => setUsePasswordMode(!usePasswordMode)}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  {usePasswordMode ? 'Entrar com link mágico' : 'Entrar com senha'}
                </Button>
              </form>
            </Form>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Ao acessar, você concorda com nossos{' '}
            <a href="/termos" className="underline hover:text-foreground transition-colors">Termos de Uso</a>
            {' '}e{' '}
            <a href="/privacidade" className="underline hover:text-foreground transition-colors">Política de Privacidade</a>.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Hero Panel (left side, hidden on mobile) ────────────────────────────────

function HeroPanel() {
  return (
    <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500">
      {/* Animated background shapes */}
      <div className="absolute inset-0">
        {/* Large floating circles */}
        <div className="absolute top-[10%] left-[15%] w-64 h-64 rounded-full bg-white/[0.07] animate-[float_20s_ease-in-out_infinite]" />
        <div className="absolute bottom-[15%] right-[10%] w-80 h-80 rounded-full bg-white/[0.05] animate-[float_25s_ease-in-out_infinite_reverse]" />
        <div className="absolute top-[50%] left-[60%] w-40 h-40 rounded-full bg-white/[0.06] animate-[float_15s_ease-in-out_infinite]" />

        {/* Diagonal lines */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 40px, white 40px, white 41px)',
          }}
        />

        {/* Mountain silhouette at bottom */}
        <svg className="absolute bottom-0 left-0 w-full text-black/[0.08]" viewBox="0 0 1200 300" preserveAspectRatio="none">
          <path d="M0,300 L0,200 L150,100 L300,180 L450,60 L600,140 L750,40 L900,120 L1050,80 L1200,160 L1200,300 Z" fill="currentColor" />
        </svg>
        <svg className="absolute bottom-0 left-0 w-full text-black/[0.05]" viewBox="0 0 1200 200" preserveAspectRatio="none">
          <path d="M0,200 L0,150 L200,100 L400,130 L600,70 L800,110 L1000,80 L1200,120 L1200,200 Z" fill="currentColor" />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 text-white w-full">
        {/* Top — Logo */}
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Everest" className="h-12 w-12 rounded-xl object-contain brightness-0 invert" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Everest</h1>
            <p className="text-white/60 text-xs font-medium tracking-wider uppercase">Preparatórios</p>
          </div>
        </div>

        {/* Center — Hero text */}
        <div className="space-y-8">
          <div className="space-y-5">
            <h2 className="text-3xl xl:text-4xl 2xl:text-5xl font-extrabold leading-[1.1] tracking-tight">
              Conquiste o topo da sua aprovação.
            </h2>
            <p className="text-white/80 text-lg leading-relaxed">
              Videoaulas, flashcards, simulados e muito mais em uma plataforma completa para o seu sucesso.
            </p>
          </div>

          {/* Slogan */}
          <p className="text-3xl xl:text-4xl font-black italic text-white/95 tracking-tight">
            Rumo ao topo!
          </p>

          {/* Motivational message */}
          <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 p-5 max-w-lg">
            <p className="text-white/90 text-base leading-relaxed">
              Sua dedicação é o que faz a diferença. Cada hora de estudo te aproxima
              da aprovação que vai transformar a sua vida.
            </p>
          </div>
        </div>

        {/* Bottom spacer */}
        <div />
      </div>

      {/* CSS for float animation */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          33% { transform: translateY(-20px) rotate(2deg); }
          66% { transform: translateY(10px) rotate(-1deg); }
        }
      `}</style>
    </div>
  )
}
