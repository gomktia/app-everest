import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useFeaturePermissions } from '@/hooks/use-feature-permissions'
import { FEATURE_KEYS } from '@/services/classPermissionsService'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Users,
  FileText,
  ClipboardCheck,
  Settings,
  LogOut,
  Archive,
  Brain,
  Target,
  Mic,
  MessageSquare,
  BarChart3,
  GraduationCap,
  Award,
  TrendingUp,
  Trophy,
  Lock,
  Search,
  Bell,
  ChevronRight,
  Shield,
  Plug,
  HelpCircle,
  Radio,
  Megaphone,
  StickyNote,
  Mail,
  ShieldAlert,
  DollarSign,
  ShoppingCart,
  Package,
  Tag,
} from 'lucide-react'

// ─── Menu structure types ─────────────────────────────────────────────────────

type MenuItem = {
  label: string
  href: string
  icon: any
  featureKey?: string | null
  adminOnly?: boolean
}

type MenuGroup = {
  group: string
  icon?: any           // icon for collapsible trigger
  collapsible?: boolean
  items: MenuItem[]
}

// ─── Student menu ─────────────────────────────────────────────────────────────

const studentMenuGroups: MenuGroup[] = [
  {
    group: '',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Notificações', href: '/notificacoes', icon: Bell },
    ],
  },
  {
    group: 'Estudos',
    icon: BookOpen,
    collapsible: true,
    items: [
      { label: 'Meus Cursos', href: '/courses', icon: BookOpen, featureKey: FEATURE_KEYS.VIDEO_LESSONS },
      { label: 'Flashcards', href: '/flashcards', icon: Brain, featureKey: FEATURE_KEYS.FLASHCARDS },
      { label: 'Banco de Questões', href: '/banco-de-questoes', icon: Search, featureKey: FEATURE_KEYS.QUESTION_BANK },
      { label: 'Quizzes', href: '/quizzes', icon: Target, featureKey: FEATURE_KEYS.QUIZ },
      { label: 'Ao Vivo', href: '/lives', icon: Radio, featureKey: FEATURE_KEYS.LIVE_EVENTS },
    ],
  },
  {
    group: 'Avaliações',
    icon: ClipboardCheck,
    collapsible: true,
    items: [
      { label: 'Simulados', href: '/simulados', icon: ClipboardCheck, featureKey: FEATURE_KEYS.SIMULATIONS },
      { label: 'Redações', href: '/redacoes', icon: FileText, featureKey: FEATURE_KEYS.ESSAYS },
    ],
  },
  {
    group: 'Conteúdo',
    icon: Archive,
    collapsible: true,
    items: [
      { label: 'Acervo Digital', href: '/acervo', icon: Archive, featureKey: FEATURE_KEYS.ACERVO },
      { label: 'Minhas Anotações', href: '/anotacoes', icon: StickyNote },
      { label: 'Evercast', href: '/evercast', icon: Mic, featureKey: FEATURE_KEYS.EVERCAST },
    ],
  },
  {
    group: 'Agenda',
    icon: Calendar,
    collapsible: true,
    items: [
      { label: 'Calendário', href: '/calendario', icon: Calendar, featureKey: FEATURE_KEYS.CALENDAR },
      { label: 'Plano de Estudos', href: '/plano-de-estudos', icon: Target, featureKey: FEATURE_KEYS.STUDY_PLANNER },
    ],
  },
  {
    group: 'Desempenho',
    icon: TrendingUp,
    collapsible: true,
    items: [
      { label: 'Progresso', href: '/progresso', icon: TrendingUp },
      { label: 'Ranking', href: '/ranking', icon: Trophy, featureKey: FEATURE_KEYS.RANKING },
      { label: 'Conquistas', href: '/conquistas', icon: Award },
    ],
  },
  {
    group: 'Social',
    icon: MessageSquare,
    collapsible: true,
    items: [
      { label: 'Comunidade', href: '/comunidade', icon: MessageSquare, featureKey: FEATURE_KEYS.COMMUNITY },
    ],
  },
]

const studentFooterItems: MenuItem[] = [
  { label: 'Configurações', href: '/configuracoes', icon: Settings },
]

// ─── Admin menu ───────────────────────────────────────────────────────────────

const adminMenuGroups: MenuGroup[] = [
  {
    group: '',
    items: [
      { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    ],
  },
  {
    group: 'Pessoas',
    icon: Users,
    collapsible: true,
    items: [
      { label: 'Usuários', href: '/admin/management', icon: Users },
      { label: 'Turmas', href: '/admin/classes', icon: GraduationCap },
      { label: 'Convites', href: '/admin/invites', icon: Mail, adminOnly: true },
      { label: 'Enviar Aviso', href: '/admin/broadcast', icon: Megaphone, adminOnly: true },
      { label: 'Permissões', href: '/admin/permissions', icon: Lock, adminOnly: true },
    ],
  },
  {
    group: 'Conteúdo',
    icon: BookOpen,
    collapsible: true,
    items: [
      { label: 'Cursos', href: '/admin/courses', icon: BookOpen, adminOnly: true },
      { label: 'Flashcards', href: '/admin/flashcards', icon: Brain, adminOnly: true },
      { label: 'Quizzes', href: '/admin/quizzes', icon: Target, adminOnly: true },
      { label: 'Questões', href: '/admin/questions', icon: HelpCircle, adminOnly: true },
      { label: 'Redações', href: '/admin/essays', icon: FileText },
      { label: 'Simulados', href: '/admin/simulations', icon: ClipboardCheck, adminOnly: true },
      { label: 'Lives', href: '/admin/lives', icon: Radio, adminOnly: true },
      { label: 'Acervo Digital', href: '/admin/acervo', icon: Archive, adminOnly: true },
    ],
  },
  {
    group: 'Comunidade',
    icon: MessageSquare,
    collapsible: true,
    items: [
      { label: 'Feed', href: '/comunidade', icon: MessageSquare },
      { label: 'Moderação', href: '/comunidade/moderacao', icon: ShieldAlert },
    ],
  },
  {
    group: 'Agenda',
    icon: Calendar,
    collapsible: true,
    items: [
      { label: 'Calendário', href: '/admin/calendar', icon: Calendar },
    ],
  },
  {
    group: 'Análise',
    icon: BarChart3,
    collapsible: true,
    items: [
      { label: 'Relatórios', href: '/admin/reports', icon: BarChart3 },
      { label: 'Analytics de Vídeos', href: '/admin/reports/videos', icon: TrendingUp },
      { label: 'Gamificação', href: '/admin/gamification', icon: Trophy },
    ],
  },
  {
    group: 'Financeiro',
    icon: DollarSign,
    collapsible: true,
    items: [
      { label: 'Dashboard', href: '/admin/financeiro', icon: BarChart3, adminOnly: true },
      { label: 'Vendas', href: '/admin/financeiro/vendas', icon: ShoppingCart, adminOnly: true },
      { label: 'Produtos', href: '/admin/financeiro/produtos', icon: Package, adminOnly: true },
      { label: 'Cupons', href: '/admin/financeiro/cupons', icon: Tag, adminOnly: true },
      { label: 'Afiliados', href: '/admin/financeiro/afiliados', icon: Users, adminOnly: true },
      { label: 'Relatórios', href: '/admin/financeiro/relatorios', icon: FileText, adminOnly: true },
    ],
  },
  {
    group: 'Sistema',
    icon: Shield,
    collapsible: true,
    items: [
      { label: 'Integrações', href: '/admin/integrations', icon: Plug, adminOnly: true },
      { label: 'Configurações', href: '/admin/settings', icon: Settings, adminOnly: true },
    ],
  },
]

// ─── Dark navy sidebar CSS variables ──────────────────────────────────────────

const darkNavySidebarStyle = {
  '--sidebar-background': '234 25% 18%',
  '--sidebar-foreground': '0 0% 95%',
  '--sidebar-accent': '234 25% 24%',
  '--sidebar-accent-foreground': '0 0% 100%',
  '--sidebar-border': '234 20% 26%',
  '--sidebar-primary': '25 95% 53%',
  '--sidebar-primary-foreground': '0 0% 100%',
  '--sidebar-ring': '25 95% 53%',
} as React.CSSProperties

// ─── Component ────────────────────────────────────────────────────────────────

export function UnifiedSidebar() {
  const { profile, signOut, viewingAsStudent } = useAuth()
  const { hasFeature, loading: permissionsLoading } = useFeaturePermissions()
  const location = useLocation()
  const navigate = useNavigate()
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  if (!profile) return null

  const effectiveRole = viewingAsStudent && profile.role !== 'student' ? 'student' : profile.role
  const isAdministrator = effectiveRole === 'administrator'
  const isTeacher = effectiveRole === 'teacher'
  const isAdmin = isAdministrator || isTeacher
  const isStudent = effectiveRole === 'student'

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  // Permission filter for student items
  const filterItems = (items: MenuItem[]) =>
    items.filter(item => {
      if (item.adminOnly && !isAdministrator) return false
      if (!item.featureKey) return true
      if (isStudent && permissionsLoading) return false
      if (isStudent) return hasFeature(item.featureKey)
      return true
    })

  const isActiveHref = (href: string) => {
    if (isAdmin) {
      return href === '/admin'
        ? location.pathname === href
        : location.pathname.startsWith(href)
    }
    return location.pathname === href
  }

  // Check if any item in a group is active (to auto-open the group)
  const isGroupActive = (items: MenuItem[]) =>
    items.some(item => isActiveHref(item.href))

  const menuGroups = isAdmin ? adminMenuGroups : studentMenuGroups
  const visibleGroups = menuGroups
    .map(g => ({ ...g, items: filterItems(g.items) }))
    .filter(g => g.items.length > 0)

  const footerItems = isAdmin ? [] : filterItems(studentFooterItems)

  // ─── Render a collapsible group ─────────────────────────────────────────────

  const renderCollapsibleGroup = (group: MenuGroup, groupIndex: number) => {
    const GroupIcon = group.icon
    const active = isGroupActive(group.items)

    return (
      <SidebarGroup key={groupIndex} className="py-0.5">
        <Collapsible defaultOpen={active} className="group/collapsible">
          <SidebarMenu>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  tooltip={group.group}
                  className="w-full justify-start gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 text-white/80 hover:!text-white"
                >
                  {GroupIcon && <GroupIcon className="h-[18px] w-[18px] shrink-0" />}
                  <span className="flex-1">{group.group}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/40 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {group.items.map((item) => {
                    const isActive = isActiveHref(item.href)
                    return (
                      <SidebarMenuSubItem key={item.href}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={isActive}
                          className="text-sm h-8 text-white/70 hover:!text-white data-[active=true]:!text-white data-[active=true]:!bg-sidebar-accent"
                        >
                          <Link to={item.href}>
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    )
                  })}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </SidebarMenu>
        </Collapsible>
      </SidebarGroup>
    )
  }

  // ─── Render a flat group (Dashboard, etc) ───────────────────────────────────

  const renderFlatGroup = (group: MenuGroup, groupIndex: number) => (
    <SidebarGroup key={groupIndex} className="py-0.5">
      <SidebarMenu>
        {group.items.map((item) => {
          const isActive = isActiveHref(item.href)
          return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                tooltip={item.label}
                className="w-full justify-start gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 text-white/80 hover:!text-white data-[active=true]:!text-white"
              >
                <Link to={item.href}>
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )

  return (
    <Sidebar collapsible="icon" className="border-r-0" style={darkNavySidebarStyle}>
      <SidebarHeader className={cn("p-5 pb-4", isCollapsed && "p-2 pb-2")}>
        <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
          <img
            src="/logo.png"
            alt="Everest"
            className="h-9 w-9 rounded-lg object-cover shrink-0"
          />
          {!isCollapsed && (
            <div className="flex flex-col">
              <h1 className="text-base font-bold text-sidebar-foreground">
                Everest
              </h1>
              <p className="text-[11px] text-sidebar-foreground/50">
                {isAdministrator ? 'Admin' : isTeacher ? 'Professor' : 'Plataforma de Estudos'}
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className={cn("px-3", isCollapsed && "px-1.5")}>
        {visibleGroups.map((group, i) =>
          group.collapsible
            ? renderCollapsibleGroup(group, i)
            : renderFlatGroup(group, i)
        )}
      </SidebarContent>

      <SidebarFooter className={cn("p-3 space-y-2", isCollapsed && "p-1.5")}>
        {footerItems.length > 0 && (
          <SidebarMenu>
            {footerItems.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={item.label}
                    className="w-full justify-start gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 text-white/80 hover:!text-white data-[active=true]:!text-white"
                  >
                    <Link to={item.href}>
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        )}
        <div className={cn(
          "flex items-center gap-3 rounded-lg p-3",
          "bg-sidebar-accent",
          isCollapsed && "p-2 justify-center"
        )}>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={profile.avatar_url} alt={profile.first_name} />
            <AvatarFallback className="text-xs font-semibold bg-primary/20 text-primary">
              {profile.first_name?.[0]}{profile.last_name?.[0]}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate text-sidebar-foreground/90">
                  {profile.first_name} {profile.last_name}
                </p>
                <p className="text-[10px] text-sidebar-foreground/40">
                  {effectiveRole === 'administrator' ? 'Administrador' :
                    effectiveRole === 'teacher' ? 'Professor' : 'Estudante'}
                  {viewingAsStudent ? ' (preview)' : ''}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-md transition-colors shrink-0 text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                title="Sair da conta"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
