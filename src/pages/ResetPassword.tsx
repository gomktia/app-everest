import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Mountain, Loader2, MailCheck } from 'lucide-react'
import { updateUserPassword, sendPasswordResetEmail } from '@/services/authService'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/components/ui/use-toast'
import { supabase } from '@/lib/supabase/client'

const resetPasswordSchema = z
  .object({
    password: z.string().min(12, 'A senha deve ter pelo menos 12 caracteres.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof resetPasswordSchema>

type PageState = 'loading' | 'form' | 'expired' | 'request-link' | 'link-sent'

export default function ResetPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [pageState, setPageState] = useState<PageState>('loading')
  const [requestEmail, setRequestEmail] = useState('')
  const [sentEmail, setSentEmail] = useState('')
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    // Hash-based params (older Supabase flows)
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const accessToken = hashParams.get('access_token')
    const type = hashParams.get('type')

    let resolved = false

    // Listen for PASSWORD_RECOVERY event (fired by Supabase after code exchange)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        resolved = true
        setPageState('form')
      }
    })

    const validateAndShowForm = async () => {
      if (accessToken && type === 'recovery') {
        // Hash-based recovery flow (legacy)
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: hashParams.get('refresh_token') || '',
        })
        setPageState(error ? 'expired' : 'form')
        return
      }

      if (code) {
        // PKCE recovery flow
        // detectSessionInUrl may have already started exchanging the code.
        // Try exchangeCodeForSession — if it fails (code already consumed or
        // opened in different browser without code_verifier), fall back to
        // checking for an existing valid session.
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          // Exchange succeeded — wait briefly for PASSWORD_RECOVERY event
          await new Promise((r) => setTimeout(r, 200))
          if (!resolved) setPageState('form')
          return
        }

        // Exchange failed — code may have been consumed by detectSessionInUrl,
        // or this is a different browser. Wait for the auto-exchange to complete
        // then check for a valid session.
        await new Promise((r) => setTimeout(r, 1500))
        if (resolved) return // PASSWORD_RECOVERY event already handled it

        const { error: userError } = await supabase.auth.getUser()
        if (!userError) {
          setPageState('form')
        } else {
          setPageState('expired')
        }
        return
      }

      // No code in URL — check for existing valid session
      const { error } = await supabase.auth.getUser()
      if (error) {
        setPageState('request-link')
      } else {
        setPageState('form')
      }
    }

    validateAndShowForm()

    return () => subscription.unsubscribe()
  }, [])

  const form = useForm<FormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true)

    // Double-check session is valid on server before updating
    const { error: userError } = await supabase.auth.getUser()
    if (userError) {
      toast({
        title: 'Sessão expirada',
        description: 'Sua sessão expirou. Solicite um novo link abaixo.',
        variant: 'destructive',
      })
      setPageState('request-link')
      setIsLoading(false)
      return
    }

    const { error } = await updateUserPassword(data.password)
    if (error) {
      const msg = error.message?.toLowerCase() || ''
      let description = error.message

      if (msg.includes('same password') || msg.includes('different') || msg.includes('same_password')) {
        description = 'A nova senha não pode ser igual à senha atual.'
      } else if (msg.includes('hibp') || msg.includes('pwned') || msg.includes('breach') || msg.includes('compromised')) {
        description = 'Esta senha foi encontrada em vazamentos de dados. Escolha uma senha diferente e mais segura.'
      } else if (msg.includes('least') || msg.includes('short') || msg.includes('too_short') || msg.includes('characters')) {
        description = 'A senha deve ter pelo menos 12 caracteres.'
      } else if (msg.includes('reauthentication') || msg.includes('reauthenticate')) {
        description = 'Sessão expirada. Solicite um novo link abaixo.'
        setPageState('request-link')
      } else if (msg.includes('session') || msg.includes('token') || msg.includes('jwt') || msg.includes('not authorized')) {
        description = 'Sessão expirada. Solicite um novo link abaixo.'
        setPageState('request-link')
      }

      toast({
        title: 'Erro ao redefinir senha',
        description,
        variant: 'destructive',
      })
    } else {
      // Sign out after successful password change to force fresh login
      await supabase.auth.signOut()
      toast({
        title: 'Senha redefinida com sucesso!',
        description: 'Faça login com sua nova senha.',
      })
      navigate('/login')
    }
    setIsLoading(false)
  }

  const handleRequestNewLink = async () => {
    if (!requestEmail.trim()) {
      toast({ title: 'Informe seu email', variant: 'destructive' })
      return
    }
    setIsLoading(true)
    const { error } = await sendPasswordResetEmail(requestEmail.trim())
    if (error) {
      toast({
        title: 'Erro ao enviar',
        description: 'Verifique o email e tente novamente.',
        variant: 'destructive',
      })
    } else {
      setSentEmail(requestEmail.trim())
      setPageState('link-sent')
    }
    setIsLoading(false)
  }

  // ── Loading state ──
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center items-center gap-2 mb-4">
              <Mountain className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">Everest</span>
            </div>
            <CardTitle>Verificando link...</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Link expired ──
  if (pageState === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center items-center gap-2 mb-4">
              <Mountain className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">Everest</span>
            </div>
            <CardTitle>Link Expirado</CardTitle>
            <CardDescription>
              Este link de redefinição expirou, já foi utilizado, ou foi aberto em um navegador diferente do que solicitou o link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              Solicite um novo link informando seu email:
            </p>
            <Input
              type="email"
              placeholder="seu@email.com"
              value={requestEmail}
              onChange={(e) => setRequestEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRequestNewLink()}
            />
            <Button className="w-full" onClick={handleRequestNewLink} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar novo link
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate('/login')}>
              Voltar ao Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Request new link (no code, no session) ──
  if (pageState === 'request-link') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center items-center gap-2 mb-4">
              <Mountain className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">Everest</span>
            </div>
            <CardTitle>Redefinir Senha</CardTitle>
            <CardDescription>
              Informe seu email para receber um link de redefinição.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="email"
              placeholder="seu@email.com"
              value={requestEmail}
              onChange={(e) => setRequestEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRequestNewLink()}
              autoFocus
            />
            <Button className="w-full" onClick={handleRequestNewLink} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar link de redefinição
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate('/login')}>
              Voltar ao Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Link sent confirmation ──
  if (pageState === 'link-sent') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center items-center gap-2 mb-4">
              <Mountain className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">Everest</span>
            </div>
            <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center mb-3">
              <MailCheck className="h-7 w-7 text-emerald-500" />
            </div>
            <CardTitle>Email Enviado!</CardTitle>
            <CardDescription>
              Enviamos um link de redefinição para{' '}
              <span className="font-semibold text-foreground">{sentEmail}</span>.
              Abra o link <strong>no mesmo navegador</strong> que você está usando agora.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                <strong>Importante:</strong> O link deve ser aberto no mesmo navegador (Chrome, Safari, etc.) onde você fez a solicitação. Se abrir em outro, o link não funcionará.
              </p>
            </div>
            <Button variant="ghost" className="w-full" onClick={() => navigate('/login')}>
              Voltar ao Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Password form (session is valid) ──
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center gap-2 mb-4">
            <Mountain className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">Everest</span>
          </div>
          <CardTitle>Redefinir Senha</CardTitle>
          <CardDescription>Crie uma nova senha para sua conta (mínimo 12 caracteres).</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova Senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Mínimo 12 caracteres" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Nova Senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Repita a senha" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Nova Senha
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
