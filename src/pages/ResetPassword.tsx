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
import { Mountain, Loader2 } from 'lucide-react'
import { updateUserPassword } from '@/services/authService'
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

export default function ResetPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [exchangeError, setExchangeError] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    // Also check for hash-based params (older Supabase flows)
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const accessToken = hashParams.get('access_token')
    const type = hashParams.get('type')

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })

    if (accessToken && type === 'recovery') {
      // Hash-based recovery flow (older Supabase config)
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: hashParams.get('refresh_token') || '',
      }).then(({ error }) => {
        if (error) {
          setExchangeError(true)
        } else {
          setSessionReady(true)
        }
      })
    } else if (code) {
      // PKCE recovery flow
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          // code_verifier missing (different browser) or code already used
          // Still allow if user has a valid session already
          supabase.auth.getSession().then(({ data }) => {
            if (data.session) {
              setSessionReady(true)
            } else {
              setExchangeError(true)
            }
          })
        } else {
          setSessionReady(true)
        }
      })
    } else {
      // No code/token — check for existing session
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          setSessionReady(true)
        }
      })
    }

    return () => subscription.unsubscribe()
  }, [])

  const form = useForm<FormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true)

    // Verify we still have a valid session before attempting update
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      toast({
        title: 'Sessão expirada',
        description: 'Solicite um novo link de redefinição na tela de login.',
        variant: 'destructive',
      })
      setIsLoading(false)
      return
    }

    const { error } = await updateUserPassword(data.password)
    if (error) {
      // Map common Supabase auth errors to PT-BR
      let description = error.message
      if (error.message?.includes('same password')) {
        description = 'A nova senha não pode ser igual à senha atual.'
      } else if (error.message?.includes('least')) {
        description = 'A senha não atende aos requisitos mínimos do servidor.'
      } else if (error.message?.includes('session') || error.message?.includes('token')) {
        description = 'Sessão expirada. Solicite um novo link de redefinição.'
      }

      toast({
        title: 'Erro ao redefinir senha',
        description,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Senha redefinida com sucesso!',
        description: 'Você já pode fazer login com sua nova senha.',
      })
      navigate('/login')
    }
    setIsLoading(false)
  }

  if (exchangeError) {
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
              Este link de redefinição de senha expirou ou já foi utilizado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={() => navigate('/login')}>
              Voltar ao Login
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Solicite um novo link de redefinição na tela de login.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!sessionReady) {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center gap-2 mb-4">
            <Mountain className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">Everest</span>
          </div>
          <CardTitle>Redefinir Senha</CardTitle>
          <CardDescription>Crie uma nova senha para sua conta.</CardDescription>
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
                      <Input type="password" {...field} />
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
                      <Input type="password" {...field} />
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
