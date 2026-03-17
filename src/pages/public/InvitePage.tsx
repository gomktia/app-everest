import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { getInviteBySlug, registerForInvite, getRegistrationCount } from '@/services/inviteService'
import { UserPlus, Loader2 } from 'lucide-react'

export default function InvitePage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [invite, setInvite] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [registrationCount, setRegistrationCount] = useState(0)
  const [form, setForm] = useState({ name: '', email: '', phone: '', cpf: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    getInviteBySlug(slug)
      .then(data => {
        setInvite(data)
        return getRegistrationCount(data.id)
      })
      .then(count => setRegistrationCount(count))
      .catch(() => setInvite(null))
      .finally(() => setLoading(false))
  }, [slug])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('As senhas nao coincidem')
      return
    }
    if (form.password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres')
      return
    }
    if (!form.phone || form.phone.replace(/\D/g, '').length < 10) {
      setError('Informe um numero de WhatsApp valido')
      return
    }

    setRegistering(true)
    try {
      await registerForInvite(invite.id, {
        name: form.name,
        email: form.email,
        phone: form.phone,
        cpf_cnpj: form.cpf || undefined,
        password: form.password,
      })
      toast({ title: 'Conta criada!', description: 'Faca login para acessar o conteudo.' })
      navigate('/login')
    } catch (err: any) {
      if (err.message === 'EMAIL_EXISTS') {
        setError('Voce ja tem uma conta. Faca login para acessar.')
      } else if (err.message === 'Vagas esgotadas') {
        setError('Desculpe, as vagas foram esgotadas.')
      } else if (err.message === 'WEAK_PASSWORD') {
        setError('Senha muito fraca. Use uma senha mais complexa com letras, numeros e simbolos.')
      } else {
        setError('Erro ao criar conta. Tente novamente.')
      }
    } finally {
      setRegistering(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!invite) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="text-center">Convite nao encontrado ou expirado</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Este link de convite pode ter expirado ou nao existe mais.
            </p>
            <Button asChild>
              <Link to="/login">Ir para o login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const slotsAvailable = invite.max_slots ? invite.max_slots - registrationCount : null
  const isFull = slotsAvailable !== null && slotsAvailable <= 0

  return (
    <div className="min-h-screen bg-background">
      {invite.cover_image_url || invite.video_courses?.thumbnail_url ? (
        <div className="w-full h-64 relative">
          <img
            src={invite.cover_image_url || invite.video_courses?.thumbnail_url}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </div>
      ) : (
        <div className="w-full h-32 bg-primary/10" />
      )}

      <div className="max-w-xl mx-auto px-4 -mt-16 relative z-10 pb-12">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl">{invite.title}</CardTitle>
            {invite.video_courses && (
              <p className="text-sm text-muted-foreground">
                Curso: {invite.video_courses.name}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {invite.description && (
              <p className="text-muted-foreground">{invite.description}</p>
            )}
            {invite.max_slots && (
              <Badge variant={isFull ? 'destructive' : 'outline'}>
                {isFull
                  ? 'Vagas esgotadas'
                  : `${slotsAvailable} de ${invite.max_slots} vagas disponiveis`}
              </Badge>
            )}
          </CardContent>
        </Card>

        {!isFull && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Criar conta e acessar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CPF/CNPJ (opcional)</Label>
                  <Input
                    placeholder="000.000.000-00"
                    value={form.cpf}
                    onChange={e => setForm({ ...form, cpf: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input
                    type="password"
                    required
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirmar senha</Label>
                  <Input
                    type="password"
                    required
                    value={form.confirmPassword}
                    onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={registering}>
                  {registering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Criar conta e acessar
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground mt-8">
          Everest Cursos Preparatorios - Rumo ao topo!
        </p>
      </div>
    </div>
  )
}
