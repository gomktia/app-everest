import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from '@/components/ui/responsive-dialog'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { logger } from '@/lib/logger'
import {
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  Download,
  Upload,
  Trash2,
  Save,
  Camera,
  Loader2,
  Lock,
  Link as LinkIcon,
  Image as ImageIcon
} from 'lucide-react'
import { updateUserPassword } from '@/services/authService'

// MD5 implementation for Gravatar (SubtleCrypto doesn't support MD5)
function md5(input: string): string {
  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    a = (a + q + x + t) | 0
    return (((a << s) | (a >>> (32 - s))) + b) | 0
  }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & c) | (~b & d), a, b, x, s, t) }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & d) | (c & ~d), a, b, x, s, t) }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(b ^ c ^ d, a, b, x, s, t) }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(c ^ (b | ~d), a, b, x, s, t) }

  const bytes: number[] = []
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    if (c < 128) bytes.push(c)
    else if (c < 2048) { bytes.push(192 | (c >> 6)); bytes.push(128 | (c & 63)) }
    else { bytes.push(224 | (c >> 12)); bytes.push(128 | ((c >> 6) & 63)); bytes.push(128 | (c & 63)) }
  }
  const n = bytes.length
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) bytes.push(0)
  const bits = n * 8
  bytes.push(bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >> 24) & 0xff, 0, 0, 0, 0)

  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476
  for (let i = 0; i < bytes.length; i += 64) {
    const w: number[] = []
    for (let j = 0; j < 16; j++) w[j] = bytes[i + j * 4] | (bytes[i + j * 4 + 1] << 8) | (bytes[i + j * 4 + 2] << 16) | (bytes[i + j * 4 + 3] << 24)
    let aa = a, bb = b, cc = c, dd = d
    a=ff(a,b,c,d,w[0],7,-680876936);d=ff(d,a,b,c,w[1],12,-389564586);c=ff(c,d,a,b,w[2],17,606105819);b=ff(b,c,d,a,w[3],22,-1044525330)
    a=ff(a,b,c,d,w[4],7,-176418897);d=ff(d,a,b,c,w[5],12,1200080426);c=ff(c,d,a,b,w[6],17,-1473231341);b=ff(b,c,d,a,w[7],22,-45705983)
    a=ff(a,b,c,d,w[8],7,1770035416);d=ff(d,a,b,c,w[9],12,-1958414417);c=ff(c,d,a,b,w[10],17,-42063);b=ff(b,c,d,a,w[11],22,-1990404162)
    a=ff(a,b,c,d,w[12],7,1804603682);d=ff(d,a,b,c,w[13],12,-40341101);c=ff(c,d,a,b,w[14],17,-1502002290);b=ff(b,c,d,a,w[15],22,1236535329)
    a=gg(a,b,c,d,w[1],5,-165796510);d=gg(d,a,b,c,w[6],9,-1069501632);c=gg(c,d,a,b,w[11],14,643717713);b=gg(b,c,d,a,w[0],20,-373897302)
    a=gg(a,b,c,d,w[5],5,-701558691);d=gg(d,a,b,c,w[10],9,38016083);c=gg(c,d,a,b,w[15],14,-660478335);b=gg(b,c,d,a,w[4],20,-405537848)
    a=gg(a,b,c,d,w[9],5,568446438);d=gg(d,a,b,c,w[14],9,-1019803690);c=gg(c,d,a,b,w[3],14,-187363961);b=gg(b,c,d,a,w[8],20,1163531501)
    a=gg(a,b,c,d,w[13],5,-1444681467);d=gg(d,a,b,c,w[2],9,-51403784);c=gg(c,d,a,b,w[7],14,1735328473);b=gg(b,c,d,a,w[12],20,-1926607734)
    a=hh(a,b,c,d,w[5],4,-378558);d=hh(d,a,b,c,w[8],11,-2022574463);c=hh(c,d,a,b,w[11],16,1839030562);b=hh(b,c,d,a,w[14],23,-35309556)
    a=hh(a,b,c,d,w[1],4,-1530992060);d=hh(d,a,b,c,w[4],11,1272893353);c=hh(c,d,a,b,w[7],16,-155497632);b=hh(b,c,d,a,w[10],23,-1094730640)
    a=hh(a,b,c,d,w[13],4,681279174);d=hh(d,a,b,c,w[0],11,-358537222);c=hh(c,d,a,b,w[3],16,-722521979);b=hh(b,c,d,a,w[6],23,76029189)
    a=hh(a,b,c,d,w[9],4,-640364487);d=hh(d,a,b,c,w[12],11,-421815835);c=hh(c,d,a,b,w[15],16,530742520);b=hh(b,c,d,a,w[2],23,-995338651)
    a=ii(a,b,c,d,w[0],6,-198630844);d=ii(d,a,b,c,w[7],10,1126891415);c=ii(c,d,a,b,w[14],15,-1416354905);b=ii(b,c,d,a,w[5],21,-57434055)
    a=ii(a,b,c,d,w[12],6,1700485571);d=ii(d,a,b,c,w[3],10,-1894986606);c=ii(c,d,a,b,w[10],15,-1051523);b=ii(b,c,d,a,w[1],21,-2054922799)
    a=ii(a,b,c,d,w[8],6,1873313359);d=ii(d,a,b,c,w[15],10,-30611744);c=ii(c,d,a,b,w[6],15,-1560198380);b=ii(b,c,d,a,w[13],21,1309151649)
    a=ii(a,b,c,d,w[4],6,-145523070);d=ii(d,a,b,c,w[11],10,-1120210379);c=ii(c,d,a,b,w[2],15,718787259);b=ii(b,c,d,a,w[9],21,-343485551)
    a = (a + aa) | 0; b = (b + bb) | 0; c = (c + cc) | 0; d = (d + dd) | 0
  }
  const hex = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff].map(b => b.toString(16).padStart(2, '0')).join('')
  return hex(a) + hex(b) + hex(c) + hex(d)
}

const getGravatarUrl = (email: string, size: number = 200) => {
  const hash = md5(email.toLowerCase().trim())
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`
}

function SecurityPasswordForm() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const { toast } = useToast()

  const handleSetPassword = async () => {
    if (newPassword.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Senhas não coincidem',
        description: 'A confirmação de senha não corresponde.',
        variant: 'destructive',
      })
      return
    }

    setIsSavingPassword(true)
    const { error } = await updateUserPassword(newPassword)
    if (error) {
      toast({
        title: 'Erro ao definir senha',
        description: 'Não foi possível salvar a senha. Tente novamente.',
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Senha definida!',
        description: 'Agora você pode usar email + senha para entrar.',
      })
      setNewPassword('')
      setConfirmPassword('')
    }
    setIsSavingPassword(false)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Nova Senha</Label>
        <Input
          type="password"
          placeholder="Mínimo 6 caracteres"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Confirmar Senha</Label>
        <Input
          type="password"
          placeholder="Repita a senha"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
      <Button
        onClick={handleSetPassword}
        disabled={isSavingPassword || !newPassword || !confirmPassword}
      >
        {isSavingPassword ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Lock className="mr-2 h-4 w-4" />
        )}
        Definir Senha
      </Button>
    </div>
  )
}

export default function SettingsPage() {
  const { profile, refreshProfile } = useAuth()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [showAvatarDialog, setShowAvatarDialog] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const defaultNotifications = {
    email: true,
    push: true,
    achievements: true,
    courses: true,
    reminders: false,
    social: true
  }

  const defaultPrivacy = {
    profileVisibility: 'public',
    showProgress: true,
    showAchievements: true,
    allowMessages: true
  }

  const defaultAppearance = {
    theme: 'system',
    language: 'pt-BR',
    fontSize: 'medium',
    animations: true
  }

  function loadStoredPrefs<T>(key: string, defaults: T): T {
    try {
      const stored = localStorage.getItem(key)
      if (stored) return { ...defaults, ...JSON.parse(stored) }
    } catch {
      // Ignore invalid JSON
    }
    return defaults
  }

  const [settings, setSettings] = useState({
    profile: {
      firstName: profile?.first_name || '',
      lastName: profile?.last_name || '',
      email: profile?.email || '',
      bio: profile?.bio || '',
      avatar: profile?.avatar_url || `https://img.usecurling.com/ppl/medium?seed=${profile?.id || 'default'}`
    },
    notifications: loadStoredPrefs('everest_notification_prefs', defaultNotifications),
    privacy: loadStoredPrefs('everest_privacy_prefs', defaultPrivacy),
    appearance: loadStoredPrefs('everest_appearance_prefs', defaultAppearance)
  })

  // Atualizar settings quando o profile carregar
  useEffect(() => {
    if (profile) {
      setSettings(prev => ({
        ...prev,
        profile: {
          ...prev.profile,
          firstName: profile.first_name || '',
          lastName: profile.last_name || '',
          email: profile.email || '',
          bio: profile.bio || '',
          avatar: profile.avatar_url || `https://img.usecurling.com/ppl/medium?seed=${profile.id}`
        }
      }))
    }
  }, [profile])

  // Persist preferences to localStorage when they change
  useEffect(() => {
    localStorage.setItem('everest_notification_prefs', JSON.stringify(settings.notifications))
  }, [settings.notifications])

  useEffect(() => {
    localStorage.setItem('everest_privacy_prefs', JSON.stringify(settings.privacy))
  }, [settings.privacy])

  useEffect(() => {
    localStorage.setItem('everest_appearance_prefs', JSON.stringify(settings.appearance))
  }, [settings.appearance])

  const handleExportData = () => {
    if (!profile) return

    const exportData = {
      profile: {
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        bio: profile.bio,
        role: profile.role,
        avatar_url: profile.avatar_url,
        created_at: profile.created_at,
      },
      exported_at: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `everest-dados-${profile.first_name || 'usuario'}-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)

    toast({
      title: 'Dados exportados',
      description: 'O arquivo JSON foi baixado com seus dados de perfil.',
    })
  }

  const handleDeleteAccount = () => {
    const confirmed = window.confirm(
      'Tem certeza que deseja solicitar a exclusão da sua conta? Esta ação não pode ser desfeita.'
    )
    if (confirmed) {
      toast({
        title: 'Exclusão de conta',
        description: 'Entre em contato com o suporte para deletar sua conta.',
      })
    }
  }

  const handleSave = async () => {
    if (!profile?.id) {
      toast({
        title: 'Erro',
        description: 'Usuário não autenticado',
        variant: 'destructive'
      })
      return
    }

    // Validação de campos obrigatórios
    if (!settings.profile.firstName.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Por favor, preencha seu nome.',
        variant: 'destructive'
      })
      return
    }

    if (!settings.profile.lastName.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Por favor, preencha seu sobrenome.',
        variant: 'destructive'
      })
      return
    }

    setIsSaving(true)

    try {
      // Atualizar o perfil do usuário na tabela user_profiles
      const { error } = await supabase
        .from('users')
        .update({
          first_name: settings.profile.firstName.trim(),
          last_name: settings.profile.lastName.trim(),
          bio: settings.profile.bio?.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id)

      if (error) throw error

      // Atualizar o profile no contexto
      await refreshProfile()

      toast({
        title: 'Sucesso!',
        description: 'Suas configurações foram salvas com sucesso.',
      })

      logger.debug('Configurações salvas:', {
        firstName: settings.profile.firstName,
        lastName: settings.profile.lastName,
        bio: settings.profile.bio
      })
    } catch (error: any) {
      logger.error('Erro ao salvar configurações:', error)
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Não foi possível salvar suas configurações. Tente novamente.',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleAvatarClick = () => {
    setShowAvatarDialog(true)
  }

  const handleFileUploadClick = () => {
    setShowAvatarDialog(false)
    fileInputRef.current?.click()
  }

  const handleUseGravatar = async () => {
    if (!profile?.email || !profile?.id) return

    setIsUploadingAvatar(true)
    setShowAvatarDialog(false)

    try {
      const gravatarUrl = getGravatarUrl(profile.email)
      logger.debug('Usando Gravatar:', gravatarUrl)

      // Atualizar no banco de dados
      const { error: updateError } = await supabase
        .from('users')
        .update({
          avatar_url: gravatarUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id)

      if (updateError) throw updateError

      // Atualizar state local
      setSettings(prev => ({
        ...prev,
        profile: { ...prev.profile, avatar: gravatarUrl }
      }))

      // Atualizar profile no contexto
      await refreshProfile()

      toast({
        title: 'Sucesso!',
        description: 'Sua foto do Gravatar foi configurada.',
      })

      logger.debug('Gravatar configurado com sucesso')
    } catch (error: any) {
      logger.error('Erro ao configurar Gravatar:', error)
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível configurar o Gravatar.',
        variant: 'destructive'
      })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleUseUrlAvatar = async () => {
    if (!avatarUrl.trim()) {
      toast({
        title: 'URL inválida',
        description: 'Por favor, insira uma URL válida.',
        variant: 'destructive'
      })
      return
    }

    // Validar se é uma URL válida
    try {
      new URL(avatarUrl)
    } catch {
      toast({
        title: 'URL inválida',
        description: 'Por favor, insira uma URL válida começando com http:// ou https://',
        variant: 'destructive'
      })
      return
    }

    if (!profile?.id) return

    setIsUploadingAvatar(true)
    setShowAvatarDialog(false)

    try {
      logger.debug('Usando URL de avatar:', avatarUrl)

      // Atualizar no banco de dados
      const { error: updateError } = await supabase
        .from('users')
        .update({
          avatar_url: avatarUrl.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id)

      if (updateError) throw updateError

      // Atualizar state local
      setSettings(prev => ({
        ...prev,
        profile: { ...prev.profile, avatar: avatarUrl.trim() }
      }))

      // Atualizar profile no contexto
      await refreshProfile()

      toast({
        title: 'Sucesso!',
        description: 'Sua foto de perfil foi atualizada.',
      })

      setAvatarUrl('')
      logger.debug('Avatar URL configurada com sucesso')
    } catch (error: any) {
      logger.error('Erro ao configurar avatar URL:', error)
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível configurar a URL do avatar.',
        variant: 'destructive'
      })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Formato inválido',
        description: 'Por favor, selecione uma imagem (JPG, PNG, GIF ou WebP).',
        variant: 'destructive'
      })
      return
    }

    // Validar tamanho (máx 2MB para evitar problemas)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo permitido é 2MB. Use uma URL externa para imagens maiores.',
        variant: 'destructive'
      })
      return
    }

    if (!profile?.id) return

    setIsUploadingAvatar(true)

    try {
      let avatarUrl: string

      // Try Supabase Storage first
      const filePath = `avatars/${profile.id}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { contentType: file.type, upsert: true })

      if (uploadError) {
        // Fallback: convert to base64 if storage bucket doesn't exist
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
          reader.readAsDataURL(file)
        })
        avatarUrl = base64
      } else {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
        avatarUrl = urlData.publicUrl
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq('id', profile.id)

      if (updateError) throw updateError

      setSettings(prev => ({ ...prev, profile: { ...prev.profile, avatar: avatarUrl } }))
      await refreshProfile()
      toast({ title: 'Foto de perfil atualizada!' })
    } catch (error: any) {
      logger.error('Erro ao salvar avatar:', error)
      toast({ title: 'Erro ao salvar avatar', variant: 'destructive' })
    } finally {
      setIsUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Configurações</h1>

      <div className="space-y-8">
        {/* Profile Settings */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-4">
              <User className="h-6 w-6 text-primary" />
              Perfil
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Input file oculto */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handleAvatarChange}
              className="hidden"
            />

            <div className="flex items-center gap-6 mb-6">
              <div className="relative">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={settings.profile.avatar} alt="Avatar" />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                    {settings.profile.firstName?.[0]?.toUpperCase()}{settings.profile.lastName?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Button
                  size="sm"
                  className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                  onClick={handleAvatarClick}
                  disabled={isUploadingAvatar}
                  title="Alterar foto de perfil"
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div>
                <h3 className="font-semibold text-lg">{settings.profile.firstName} {settings.profile.lastName}</h3>
                <p className="text-muted-foreground">{settings.profile.email}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nome</Label>
                <Input
                  id="firstName"
                  value={settings.profile.firstName}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    profile: { ...prev.profile, firstName: e.target.value }
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Sobrenome</Label>
                <Input
                  id="lastName"
                  value={settings.profile.lastName}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    profile: { ...prev.profile, lastName: e.target.value }
                  }))}
                />
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={settings.profile.email}
                disabled
                className="bg-muted cursor-not-allowed"
                title="O email não pode ser alterado"
              />
              <p className="text-xs text-muted-foreground">
                O email não pode ser alterado. Entre em contato com o suporte se precisar mudar.
              </p>
            </div>

            <div className="space-y-2 mt-4">
              <Label htmlFor="bio">Bio (opcional)</Label>
              <Input
                id="bio"
                value={settings.profile.bio}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  profile: { ...prev.profile, bio: e.target.value }
                }))}
                placeholder="Conte um pouco sobre você..."
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                {settings.profile.bio?.length || 0}/200 caracteres
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-4">
              <Bell className="h-6 w-6 text-primary" />
              Notificações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-notifications">Notificações por email</Label>
                  <p className="text-sm text-muted-foreground">Receba notificações importantes por email</p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={settings.notifications.email}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, email: checked }
                  }))}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="push-notifications">Notificações push</Label>
                  <p className="text-sm text-muted-foreground">Receba notificações no navegador</p>
                </div>
                <Switch
                  id="push-notifications"
                  checked={settings.notifications.push}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, push: checked }
                  }))}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="achievements">Conquistas</Label>
                  <p className="text-sm text-muted-foreground">Seja notificado quando ganhar novas conquistas</p>
                </div>
                <Switch
                  id="achievements"
                  checked={settings.notifications.achievements}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, achievements: checked }
                  }))}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="courses">Novos cursos</Label>
                  <p className="text-sm text-muted-foreground">Seja notificado sobre novos cursos disponíveis</p>
                </div>
                <Switch
                  id="courses"
                  checked={settings.notifications.courses}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, courses: checked }
                  }))}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="reminders">Lembretes de estudo</Label>
                  <p className="text-sm text-muted-foreground">Receba lembretes para suas sessões de estudo</p>
                </div>
                <Switch
                  id="reminders"
                  checked={settings.notifications.reminders}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, reminders: checked }
                  }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-4">
              <Shield className="h-6 w-6 text-primary" />
              Privacidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="show-progress">Mostrar progresso</Label>
                  <p className="text-sm text-muted-foreground">Permitir que outros vejam seu progresso</p>
                </div>
                <Switch
                  id="show-progress"
                  checked={settings.privacy.showProgress}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    privacy: { ...prev.privacy, showProgress: checked }
                  }))}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="show-achievements">Mostrar conquistas</Label>
                  <p className="text-sm text-muted-foreground">Permitir que outros vejam suas conquistas</p>
                </div>
                <Switch
                  id="show-achievements"
                  checked={settings.privacy.showAchievements}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    privacy: { ...prev.privacy, showAchievements: checked }
                  }))}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="allow-messages">Permitir mensagens</Label>
                  <p className="text-sm text-muted-foreground">Permitir que outros usuários enviem mensagens</p>
                </div>
                <Switch
                  id="allow-messages"
                  checked={settings.privacy.allowMessages}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    privacy: { ...prev.privacy, allowMessages: checked }
                  }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-4">
              <Palette className="h-6 w-6 text-primary" />
              Aparência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="animations">Animações</Label>
                  <p className="text-sm text-muted-foreground">Habilitar animações e transições</p>
                </div>
                <Switch
                  id="animations"
                  checked={settings.appearance.animations}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    appearance: { ...prev.appearance, animations: checked }
                  }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PWA Settings */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-4">
              <Globe className="h-6 w-6 text-primary" />
              Aplicativo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="pwa-install">Instalar App</Label>
                  <p className="text-sm text-muted-foreground">Instale o Everest como aplicativo no seu dispositivo</p>
                </div>
                <Button
                  id="pwa-install"
                  variant="outline"
                  onClick={() => {
                    // Check if app is already installed
                    if (window.matchMedia('(display-mode: standalone)').matches) {
                      toast({ title: 'O Everest já está instalado no seu dispositivo!' })
                      return
                    }
                    toast({
                      title: 'Para instalar o Everest',
                      description: 'Use o menu do navegador > "Instalar aplicativo" ou "Adicionar à tela inicial".',
                    })
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Instalar
                </Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="pwa-status">Status do App</Label>
                  <p className="text-sm text-muted-foreground">
                    {window.matchMedia('(display-mode: standalone)').matches
                      ? 'App instalado e funcionando'
                      : 'App não instalado'}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  window.matchMedia('(display-mode: standalone)').matches
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                }`}>
                  {window.matchMedia('(display-mode: standalone)').matches ? 'Instalado' : 'Não Instalado'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-4">
              <Lock className="h-6 w-6 text-primary" />
              Segurança
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Defina uma senha para usar como alternativa ao link mágico de acesso.
                Se preferir, pode continuar entrando apenas com o link enviado por email.
              </p>
              <SecurityPasswordForm />
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-4">
              <Download className="h-6 w-6 text-primary" />
              Gerenciamento de Dados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button variant="outline" className="w-full justify-start" onClick={handleExportData}>
                <Download className="mr-2 h-4 w-4" />
                Exportar meus dados
              </Button>
              <Separator />
              <Button variant="destructive" className="w-full justify-start" onClick={handleDeleteAccount}>
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir conta
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {isUploadingAvatar ? 'Fazendo upload da foto...' : isSaving ? 'Salvando alterações...' : 'Lembre-se de salvar suas alterações'}
          </p>
          <Button
            onClick={handleSave}
            disabled={isSaving || isUploadingAvatar}
            size="lg"
            className="w-full sm:w-auto"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Configurações
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Avatar Upload Dialog */}
      <ResponsiveDialog open={showAvatarDialog} onOpenChange={setShowAvatarDialog}>
        <ResponsiveDialogContent className="sm:max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Alterar Foto de Perfil</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Escolha uma das opções abaixo para adicionar sua foto
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="space-y-3 mt-4">
            {/* Opção 1: Upload de arquivo */}
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={handleFileUploadClick}
            >
              <div className="flex items-start gap-3 text-left">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Fazer Upload</p>
                  <p className="text-sm text-muted-foreground">
                    Envie uma imagem do seu computador (máx 2MB)
                  </p>
                </div>
              </div>
            </Button>

            {/* Opção 2: URL Externa */}
            <div className="border rounded-lg p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <LinkIcon className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Usar URL Externa</p>
                  <p className="text-sm text-muted-foreground">
                    Cole o link de uma imagem da internet
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Input
                  placeholder="https://exemplo.com/foto.jpg"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                />
                <Button
                  onClick={handleUseUrlAvatar}
                  className="w-full"
                  disabled={!avatarUrl.trim()}
                >
                  Usar esta URL
                </Button>
              </div>
            </div>

            {/* Opção 3: Gravatar */}
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={handleUseGravatar}
            >
              <div className="flex items-start gap-3 text-left">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Usar Gravatar</p>
                  <p className="text-sm text-muted-foreground">
                    Use sua foto do Gravatar (baseado no seu email)
                  </p>
                </div>
              </div>
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  )
}
