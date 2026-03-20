import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Send,
  Loader2,
  Download,
  Trash2,
  Lightbulb,
  PenLine,
  Upload,
  CheckCircle2,
  FileUp,
  X,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { submitEssay } from '@/services/essayService'
import { compressFile } from '@/lib/fileCompression'
import { cn } from '@/lib/utils'

const DRAFT_KEY = 'everest_essay_draft'

interface EssayDraft {
  theme: string
  text: string
  updatedAt: string
}

function loadDraft(): EssayDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveDraft(theme: string, text: string) {
  localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({ theme, text, updatedAt: new Date().toISOString() })
  )
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
}

export default function EssaySubmissionPage() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const { user } = useAuth()

  const draft = loadDraft()

  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [theme, setTheme] = useState(draft?.theme || '')
  const [text, setText] = useState(draft?.text || '')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [isDragging, setIsDragging] = useState(false)
  const saveTimerRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
  const charCount = text.length
  const lineCount = text ? text.split('\n').length : 0

  // Auto-save with debounce
  const debouncedSave = useCallback(
    (newTheme: string, newText: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (!newTheme && !newText) return

      setSaveStatus('saving')
      saveTimerRef.current = window.setTimeout(() => {
        saveDraft(newTheme, newText)
        setSaveStatus('saved')
      }, 800)
    },
    []
  )

  const handleThemeChange = (value: string) => {
    setTheme(value)
    debouncedSave(value, text)
  }

  const handleTextChange = (value: string) => {
    setText(value)
    debouncedSave(theme, value)
  }

  const handleClearDraft = () => {
    setTheme('')
    setText('')
    setFile(null)
    clearDraft()
    setSaveStatus('idle')
    toast({ title: 'Rascunho apagado' })
  }

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (draft?.text || draft?.theme) {
      setSaveStatus('saved')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!user) {
      toast({ title: 'Erro', description: 'Você precisa estar logado.', variant: 'destructive' })
      return
    }

    if (!text && !file) {
      toast({ title: 'Atenção', description: 'Digite o texto da redação ou envie um arquivo.', variant: 'destructive' })
      return
    }

    try {
      setLoading(true)
      const compressedFile = file ? await compressFile(file) : undefined
      await submitEssay(user.id, theme, text, compressedFile)
      clearDraft()
      toast({ title: 'Redação enviada com sucesso!', description: 'Você será notificado quando a correção estiver pronta.' })
      navigate('/redacoes')
    } catch {
      toast({ title: 'Erro ao enviar redação', description: 'Verifique sua conexão e tente novamente.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const processFile = (selectedFile: File) => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain']
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(pdf|jpg|jpeg|png|doc|docx|txt)$/i)) {
      toast({ title: 'Formato inválido', description: 'Envie uma foto (JPG, PNG), PDF ou DOCX.', variant: 'destructive' })
      return
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'O arquivo deve ter no máximo 5MB.', variant: 'destructive' })
      return
    }
    setFile(selectedFile)
    toast({ title: 'Arquivo selecionado', description: selectedFile.name })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0])
  }

  const handleRemoveFile = () => {
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    toast({ title: 'Arquivo removido' })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-8">
      {/* Header */}
      <div>
        <Link
          to="/redacoes"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar às Redações
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Nova Redação</h1>
      </div>

      {/* Instructions */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Lightbulb className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-foreground">Como funciona?</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                {[
                  'Digite seu rascunho — salva automaticamente',
                  'Baixe a folha modelo e passe a limpo',
                  'Tire uma foto da folha manuscrita',
                  'Envie tudo para correção do professor',
                ].map((step, i) => (
                  <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="flex items-center justify-center h-4 w-4 rounded-full bg-primary text-white text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                    {step}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Theme + Text Card */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-5 space-y-5">
            {/* Theme */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <PenLine className="h-4 w-4 text-primary" />
                <Label htmlFor="theme" className="font-semibold">Tema da Redação *</Label>
              </div>
              <Input
                id="theme"
                name="theme"
                value={theme}
                onChange={(e) => handleThemeChange(e.target.value)}
                placeholder="Ex: Inteligência Artificial e o Futuro do Trabalho"
                required
              />
            </div>

            {/* Text area */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="essay-text" className="font-semibold">Seu Rascunho</Label>
                <div className="flex items-center gap-2">
                  {saveStatus === 'saving' && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground animate-pulse">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Salvando...
                    </span>
                  )}
                  {saveStatus === 'saved' && (
                    <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Salvo
                    </span>
                  )}
                  {(text || theme) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearDraft}
                      className="h-6 px-1.5 text-xs text-muted-foreground hover:text-destructive gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      Limpar
                    </Button>
                  )}
                </div>
              </div>
              <Textarea
                id="essay-text"
                name="essay-text"
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="Comece a escrever sua redação aqui...&#10;&#10;Suas ideias são salvas automaticamente. Você pode sair e voltar quando quiser — seu rascunho estará aqui."
                rows={14}
                className="resize-y leading-relaxed"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{wordCount} palavras · {charCount} caracteres · {lineCount} {lineCount === 1 ? 'linha' : 'linhas'}</span>
                {wordCount >= 200 && (
                  <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Bom tamanho
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Download + Upload Card */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-5 space-y-4">
            {/* Download template */}
            <div className="flex items-center justify-between rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3.5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Download className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Folha de Redação Modelo</p>
                  <p className="text-xs text-muted-foreground">Imprima e passe a limpo à mão</p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="gap-1.5 shrink-0">
                <a href="/folha-redacao.pdf" download="Folha_Redacao_Everest.pdf">
                  <Download className="h-3.5 w-3.5" />
                  Baixar
                </a>
              </Button>
            </div>

            {/* Upload area */}
            <div className="space-y-1.5">
              <Label className="font-semibold">Foto ou Arquivo da Redação</Label>

              {!file ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-8 px-4 cursor-pointer transition-all',
                    isDragging
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/40 hover:bg-muted/30'
                  )}
                >
                  <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                    <FileUp className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {isDragging ? 'Solte o arquivo aqui' : 'Arraste um arquivo ou clique para selecionar'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG, PDF ou DOCX — máximo 5MB
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/50 p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center shrink-0">
                      <Upload className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveFile}
                    className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground max-w-[55%]">
            O professor receberá o texto digitado e o arquivo anexado.
          </p>
          <Button
            type="submit"
            disabled={loading}
            size="lg"
            className="gap-2 bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar para Correção
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
