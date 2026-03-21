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
    password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
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

    if (code) {
      // Exchange the code from the email link for a valid session
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          setExchangeError(true)
        } else {
          setSessionReady(true)
        }
      })
    } else {
      // Fallback: listen for PASSWORD_RECOVERY event (legacy flow)
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setSessionReady(true)
        }
      })
      // Check if already has session
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setSessionReady(true)
      })
      return () => subscription.unsubscribe()
    }
  }, [])

  const form = useForm<FormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true)
    const { error } = await updateUserPassword(data.password)
    if (error) {
      toast({
        title: 'Erro ao redefinir senha',
        description: 'O link pode ter expirado. Por favor, tente novamente.',
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
