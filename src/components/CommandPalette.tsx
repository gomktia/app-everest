import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  BookOpen,
  Brain,
  Search,
  ClipboardCheck,
  FileText,
  Archive,
  Mic,
  Calendar,
  Target,
  TrendingUp,
  Trophy,
  Award,
  MessageSquare,
  Bell,
  Settings,
  Megaphone,
} from 'lucide-react'

type CommandItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  keywords?: string[]
  group: string
}

const commands: CommandItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, group: 'Navegação', keywords: ['inicio', 'home'] },
  { label: 'Meus Cursos', href: '/courses', icon: BookOpen, group: 'Estudos', keywords: ['aulas', 'video', 'curso'] },
  { label: 'Flashcards', href: '/flashcards', icon: Brain, group: 'Estudos', keywords: ['cartoes', 'memorizar', 'revisar'] },
  { label: 'Banco de Questões', href: '/banco-de-questoes', icon: Search, group: 'Estudos', keywords: ['questoes', 'exercicios', 'prova'] },
  { label: 'Simulados', href: '/simulados', icon: ClipboardCheck, group: 'Avaliações', keywords: ['prova', 'teste', 'exame'] },
  { label: 'Redações', href: '/redacoes', icon: FileText, group: 'Avaliações', keywords: ['texto', 'escrever', 'dissertacao'] },
  { label: 'Acervo Digital', href: '/acervo', icon: Archive, group: 'Conteúdo', keywords: ['livros', 'materiais', 'pdf', 'apostila'] },
  { label: 'Evercast', href: '/evercast', icon: Mic, group: 'Conteúdo', keywords: ['podcast', 'audio', 'ouvir'] },
  { label: 'Calendário', href: '/calendario', icon: Calendar, group: 'Agenda', keywords: ['eventos', 'data', 'agenda'] },
  { label: 'Plano de Estudos', href: '/plano-de-estudos', icon: Target, group: 'Agenda', keywords: ['pomodoro', 'planejar', 'timer', 'cronometro'] },
  { label: 'Progresso', href: '/progresso', icon: TrendingUp, group: 'Desempenho', keywords: ['desempenho', 'estatisticas'] },
  { label: 'Ranking', href: '/ranking', icon: Trophy, group: 'Desempenho', keywords: ['posicao', 'classificacao', 'xp'] },
  { label: 'Conquistas', href: '/conquistas', icon: Award, group: 'Desempenho', keywords: ['badges', 'medalhas'] },
  { label: 'Comunidade', href: '/comunidade', icon: MessageSquare, group: 'Social', keywords: ['forum', 'discussao', 'chat', 'comunidade'] },
  { label: 'Moderação', href: '/comunidade/moderacao', icon: MessageSquare, group: 'Social', keywords: ['moderacao', 'denuncias', 'filtro'] },
  { label: 'Notificações', href: '/notificacoes', icon: Bell, group: 'Sistema', keywords: ['avisos', 'alertas'] },
  { label: 'Configurações', href: '/configuracoes', icon: Settings, group: 'Sistema', keywords: ['perfil', 'conta', 'tema'] },
  { label: 'Enviar Aviso', href: '/admin/broadcast', icon: Megaphone, group: 'Admin', keywords: ['aviso', 'notificacao', 'broadcast', 'mensagem', 'push'] },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Keyboard shortcut: Ctrl+K / ⌘K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return commands.filter(cmd => {
      const label = cmd.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const group = cmd.group.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const keywords = (cmd.keywords || []).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      return label.includes(q) || group.includes(q) || keywords.includes(q)
    })
  }, [query])

  // Group filtered results
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {}
    for (const item of filtered) {
      if (!groups[item.group]) groups[item.group] = []
      groups[item.group].push(item)
    }
    return groups
  }, [filtered])

  const flatFiltered = filtered

  const go = useCallback((item: CommandItem) => {
    setOpen(false)
    navigate(item.href)
  }, [navigate])

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, flatFiltered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && flatFiltered[selectedIndex]) {
      e.preventDefault()
      go(flatFiltered[selectedIndex])
    }
  }

  // Reset index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  let globalIndex = -1

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 gap-0 max-w-lg overflow-hidden !rounded-xl border-border/50 shadow-2xl [&>button]:hidden">
        {/* Search input */}
        <div className="flex items-center border-b px-3 sm:px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground/60 shrink-0 mr-3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar página..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 min-h-[44px]"
          />
          <kbd className="ml-2 text-xs text-muted-foreground/50 border rounded px-1.5 py-0.5 bg-muted/30 shrink-0 hidden sm:inline">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] sm:max-h-[320px] overflow-y-auto p-2">
          {flatFiltered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhum resultado para "{query}"
            </div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="mb-1">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
                  {group}
                </div>
                {items.map((item) => {
                  globalIndex++
                  const idx = globalIndex
                  const Icon = item.icon
                  const isSelected = idx === selectedIndex
                  return (
                    <button
                      key={item.href}
                      data-index={idx}
                      onClick={() => go(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-3 sm:py-2.5 rounded-lg text-sm transition-colors cursor-pointer min-h-[44px]",
                        isSelected
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      <Icon className={cn(
                        "h-4 w-4 shrink-0",
                        isSelected && "text-primary"
                      )} />
                      <span className="font-medium">{item.label}</span>
                      {isSelected && (
                        <span className="ml-auto text-[10px] text-muted-foreground/50">
                          Enter ↵
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 hidden sm:flex items-center gap-4 text-[10px] text-muted-foreground/40">
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span>esc fechar</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
