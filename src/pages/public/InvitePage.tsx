import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { getInviteBySlug, registerForInvite, getRegistrationCount } from '@/services/inviteService'
import {
  UserPlus,
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Phone,
  User,
  CreditCard,
  Mountain,
  BookOpen,
  Trophy,
  Zap,
  ArrowLeft,
  CheckCircle2,
  Library,
  MessageSquare,
  FileText,
  PenTool,
  HelpCircle,
  ClipboardList,
} from 'lucide-react'

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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

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
      setError('As senhas não coincidem')
      return
    }
    if (form.password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres')
      return
    }
    if (!form.phone || form.phone.replace(/\D/g, '').length < 10) {
      setError('Informe um número de WhatsApp válido')
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
      toast({ title: 'Conta criada!', description: 'Faça login para acessar o conteúdo.' })
      navigate('/login')
    } catch (err: any) {
      if (err.message === 'EMAIL_EXISTS') {
        setError('Você já tem uma conta. Faça login para acessar.')
      } else if (err.message === 'Vagas esgotadas') {
        setError('Desculpe, as vagas foram esgotadas.')
      } else if (err.message === 'WEAK_PASSWORD') {
        setError('Senha muito fraca. Use uma senha mais complexa com letras, números e símbolos.')
      } else {
        setError('Erro ao criar conta. Tente novamente.')
      }
    } finally {
      setRegistering(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sidebar">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Invite not found
  if (!invite) {
    return (
      <div className="min-h-screen flex">
        <HeroPanel />
        <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-sidebar text-sidebar-foreground">
          <div className="w-full max-w-sm space-y-6 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <Mountain className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Convite não encontrado</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Este link de convite pode ter expirado ou não existe mais.
              </p>
            </div>
            <Button asChild className="w-full h-11 rounded-xl">
              <Link to="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Ir para o login
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const slotsAvailable = invite.max_slots ? invite.max_slots - registrationCount : null
  const isFull = slotsAvailable !== null && slotsAvailable <= 0

  return (
    <div className="min-h-screen flex">
      <InviteHeroPanel
        title={invite.title}
        description={invite.description}
        courseName={invite.video_courses?.name}
        motivationalMessage={invite.motivational_message}
        slotsAvailable={slotsAvailable}
        isFull={isFull}
      />

      {/* Right side — Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-sidebar text-sidebar-foreground relative overflow-y-auto">
        <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="w-full max-w-sm space-y-6 relative z-10">
          {/* Mobile logo + invite info (hidden on lg+) */}
          <div className="flex flex-col items-center gap-3 lg:hidden">
            <img src="/logo.png" alt="Everest" className="h-14 w-14 rounded-xl object-contain" />
            <h1 className="text-xl font-bold text-center">{invite.title}</h1>
            {invite.video_courses && (
              <p className="text-sm text-muted-foreground">Curso: {invite.video_courses.name}</p>
            )}
            {invite.max_slots && (
              <Badge variant={isFull ? 'destructive' : 'outline'}>
                {isFull ? 'Vagas esgotadas' : `${slotsAvailable} vagas restantes`}
              </Badge>
            )}
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Crie sua conta</h2>
            <p className="text-muted-foreground text-sm">
              Preencha seus dados para acessar o conteúdo.
            </p>
          </div>

          {isFull ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 space-y-4 text-center">
              <p className="text-sm font-medium text-destructive">As vagas foram esgotadas</p>
              <Button asChild variant="outline" className="w-full h-11 rounded-xl">
                <Link to="/login">Ir para o login</Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent p-6 shadow-sm">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    Nome completo
                  </Label>
                  <Input
                    required
                    placeholder="Seu nome completo"
                    className="h-11 rounded-xl border-border/60 focus:border-primary"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    Email
                  </Label>
                  <Input
                    type="email"
                    required
                    placeholder="seu@email.com"
                    autoComplete="email"
                    className="h-11 rounded-xl border-border/60 focus:border-primary"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      WhatsApp
                    </Label>
                    <Input
                      type="tel"
                      placeholder="(00) 00000-0000"
                      className="h-11 rounded-xl border-border/60 focus:border-primary"
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                      CPF <span className="text-muted-foreground font-normal">(opcional)</span>
                    </Label>
                    <Input
                      placeholder="000.000.000-00"
                      className="h-11 rounded-xl border-border/60 focus:border-primary"
                      value={form.cpf}
                      onChange={e => setForm({ ...form, cpf: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      Senha
                    </Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Min. 8 caracteres"
                        className="pr-10 h-11 rounded-xl border-border/60 focus:border-primary"
                        value={form.password}
                        onChange={e => setForm({ ...form, password: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      Confirmar
                    </Label>
                    <div className="relative">
                      <Input
                        type={showConfirm ? 'text' : 'password'}
                        required
                        placeholder="Repita a senha"
                        className="pr-10 h-11 rounded-xl border-border/60 focus:border-primary"
                        value={form.confirmPassword}
                        onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl font-semibold text-sm shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
                  disabled={registering}
                >
                  {registering ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Criar conta e acessar
                    </>
                  )}
                </Button>
              </form>
            </div>
          )}

          {/* Footer */}
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Faça login
              </Link>
            </p>
            <p className="text-xs text-muted-foreground">
              Ao criar sua conta, você concorda com nossos{' '}
              <a href="/termos" className="underline hover:text-foreground transition-colors">Termos de Uso</a>
              {' '}e{' '}
              <a href="/privacidade" className="underline hover:text-foreground transition-colors">Política de Privacidade</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Invite Hero Panel (left side) ──────────────────────────────────────────

interface InviteHeroPanelProps {
  title: string
  description?: string
  courseName?: string
  motivationalMessage?: string | null
  slotsAvailable: number | null
  isFull: boolean
}

const DEFAULT_MOTIVATIONAL = 'Sua dedicação é o que faz a diferença. Cada hora de estudo te aproxima da aprovação que vai transformar a sua vida.'

function InviteHeroPanel({ title, description, courseName, motivationalMessage, slotsAvailable, isFull }: InviteHeroPanelProps) {
  return (
    <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500">
      {/* Animated background shapes */}
      <div className="absolute inset-0">
        <div className="absolute top-[10%] left-[15%] w-64 h-64 rounded-full bg-white/[0.07] animate-[float_20s_ease-in-out_infinite]" />
        <div className="absolute bottom-[15%] right-[10%] w-80 h-80 rounded-full bg-white/[0.05] animate-[float_25s_ease-in-out_infinite_reverse]" />
        <div className="absolute top-[50%] left-[60%] w-40 h-40 rounded-full bg-white/[0.06] animate-[float_15s_ease-in-out_infinite]" />

        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 40px, white 40px, white 41px)',
          }}
        />

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

        {/* Center — Invite info */}
        <div className="space-y-8">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/10 text-sm font-medium">
              <UserPlus className="h-4 w-4" />
              Convite Especial
            </div>
            <h2 className="text-3xl xl:text-4xl 2xl:text-5xl font-extrabold leading-[1.1] tracking-tight">
              {title}
            </h2>
            {description && (
              <p className="text-white/80 text-lg leading-relaxed">
                {description}
              </p>
            )}
            {courseName && (
              <p className="text-white/80 text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 shrink-0" />
                Curso: {courseName}
              </p>
            )}
          </div>

          {/* Slogan */}
          <div className="space-y-2">
            <p className="text-3xl xl:text-4xl font-black italic text-white/95 tracking-tight">
              Rumo ao topo!
            </p>
          </div>

          {/* Motivational message */}
          <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 p-5 max-w-lg">
            <p className="text-white/90 text-base leading-relaxed">
              {motivationalMessage || DEFAULT_MOTIVATIONAL}
            </p>
          </div>

          {slotsAvailable !== null && !isFull && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 text-sm font-semibold">
              {slotsAvailable} {slotsAvailable === 1 ? 'vaga restante' : 'vagas restantes'}
            </div>
          )}
        </div>

        {/* Bottom — Feature pills */}
        <div className="flex flex-wrap gap-2.5">
          <FeaturePill icon={<BookOpen className="h-3.5 w-3.5" />} label="Videoaulas" />
          <FeaturePill icon={<Zap className="h-3.5 w-3.5" />} label="Flashcards" />
          <FeaturePill icon={<Mountain className="h-3.5 w-3.5" />} label="Simulados" />
          <FeaturePill icon={<Library className="h-3.5 w-3.5" />} label="Acervo Digital" />
          <FeaturePill icon={<HelpCircle className="h-3.5 w-3.5" />} label="Quizzes" />
          <FeaturePill icon={<ClipboardList className="h-3.5 w-3.5" />} label="Banco de Questões" />
          <FeaturePill icon={<FileText className="h-3.5 w-3.5" />} label="Provas" />
          <FeaturePill icon={<PenTool className="h-3.5 w-3.5" />} label="Redação" />
          <FeaturePill icon={<MessageSquare className="h-3.5 w-3.5" />} label="Comunidade" />
          <FeaturePill icon={<Trophy className="h-3.5 w-3.5" />} label="Ranking" />
        </div>
      </div>

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

// ─── Shared Hero Panel (for not-found state) ────────────────────────────────

function HeroPanel() {
  return (
    <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500">
      <div className="absolute inset-0">
        <div className="absolute top-[10%] left-[15%] w-64 h-64 rounded-full bg-white/[0.07] animate-[float_20s_ease-in-out_infinite]" />
        <div className="absolute bottom-[15%] right-[10%] w-80 h-80 rounded-full bg-white/[0.05] animate-[float_25s_ease-in-out_infinite_reverse]" />
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 40px, white 40px, white 41px)',
          }}
        />
        <svg className="absolute bottom-0 left-0 w-full text-black/[0.08]" viewBox="0 0 1200 300" preserveAspectRatio="none">
          <path d="M0,300 L0,200 L150,100 L300,180 L450,60 L600,140 L750,40 L900,120 L1050,80 L1200,160 L1200,300 Z" fill="currentColor" />
        </svg>
      </div>
      <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 text-white w-full">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Everest" className="h-12 w-12 rounded-xl object-contain brightness-0 invert" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Everest</h1>
            <p className="text-white/60 text-xs font-medium tracking-wider uppercase">Preparatórios</p>
          </div>
        </div>
        <div className="space-y-6 max-w-md">
          <h2 className="text-4xl xl:text-5xl font-extrabold leading-[1.1] tracking-tight">
            Conquiste o<br /><span className="text-white/90">topo da sua</span><br />preparação.
          </h2>
          <p className="text-white/70 text-lg leading-relaxed">
            Videoaulas, flashcards, simulados e muito mais em uma plataforma completa para sua aprovação.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <FeaturePill icon={<BookOpen className="h-3.5 w-3.5" />} label="Videoaulas" />
          <FeaturePill icon={<Zap className="h-3.5 w-3.5" />} label="Flashcards" />
          <FeaturePill icon={<Mountain className="h-3.5 w-3.5" />} label="Simulados" />
          <FeaturePill icon={<Trophy className="h-3.5 w-3.5" />} label="Ranking" />
        </div>
      </div>
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

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-sm font-medium text-white/90">
      {icon}
      {label}
    </div>
  )
}
