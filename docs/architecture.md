# Arquitetura

## Stack

| Camada | Tecnologia | Versao |
|--------|-----------|--------|
| Framework | React | 19.1.1 |
| Linguagem | TypeScript | - |
| Bundler | Vite (rolldown) | 7.3.1 |
| Roteamento | React Router | 6.30.1 |
| UI Components | Shadcn/UI + Radix UI | - |
| Estilizacao | Tailwind CSS | 3.4.17 |
| Icones | Lucide React | 0.544 |
| Formularios | React Hook Form | 7.63.0 |
| Validacao | Zod | 3.25.76 |
| Editor Rich Text | Tiptap | 3.6.3 |
| Graficos | Recharts | 2.15.4 |
| Backend | Supabase | 2.58.0 |
| Video | Panda Video API v2 | - |
| PDF | jsPDF | 4.2.0 |
| Sanitizacao | DOMPurify | 3.3.2 |
| Datas | date-fns | 4.1.0 |
| Offline | idb (IndexedDB) | 8.0.0 |
| Toasts | Sonner | 2.0.7 |
| Carousel | Embla Carousel | 8.6.0 |

## Estrutura de Pastas

```
src/
├── components/          # Componentes reutilizaveis
│   ├── ui/              # Shadcn/UI base components
│   ├── admin/           # Componentes do painel admin
│   ├── community/       # Componentes da comunidade
│   ├── study-planner/   # Pomodoro, plano de estudos
│   ├── CommandPalette.tsx
│   ├── Header.tsx
│   ├── UnifiedSidebar.tsx
│   ├── MobileSidebar.tsx
│   ├── ProtectedRoute.tsx
│   └── PublicRoute.tsx
├── contexts/            # React contexts (auth, theme, view-mode)
├── hooks/               # Custom hooks
├── lib/                 # Utilitarios e configuracao
│   ├── supabase/        # Client e types
│   ├── queryCache.ts    # Cache TTL em memoria
│   ├── offlineStorage.ts # IndexedDB
│   ├── sanitize.ts      # DOMPurify wrapper
│   ├── logger.ts        # Logger (dev only)
│   └── utils.ts
├── pages/               # Paginas (1 arquivo = 1 rota)
│   ├── admin/           # Painel administrativo
│   ├── courses/         # Cursos do aluno
│   ├── community/       # Comunidade/forum
│   └── dashboard/       # Dashboards por role
├── services/            # Camada de acesso a dados (Supabase queries)
│   └── ai/              # Servicos de IA (correcao de redacao)
└── App.tsx              # Router principal
```

## Padroes de Projeto

### Autenticacao

```
Login → Supabase Auth (email/senha ou magic link)
     → fetchUserProfile()
     → Cria perfil se nao existe
     → Carrega role do usuario
     → Redireciona por role (student→dashboard, admin→/admin)
```

- PKCE flow habilitado
- Sessao persistida em localStorage (`everest-auth-token`)
- Token auto-refresh habilitado
- Limite de sessao: 2 dispositivos simultaneos (via Edge Function `session-guard`)

### Proxy de APIs Externas

```
Frontend → Supabase Edge Function → API Externa (Panda, MemberKit, OpenAI)
```

API keys nunca sao expostas ao frontend. Edge Functions fazem o proxy:
- `panda-proxy` — Panda Video API
- `memberkit-proxy` — MemberKit API
- `ai-essay-correction` — OpenAI/Claude para correcao de redacoes

Em desenvolvimento local, o Vite proxy (`/panda-api`) injeta a API key via header.

### Cache

Cache em memoria com TTL (`src/lib/queryCache.ts`):

| Tipo | TTL |
|------|-----|
| Dashboard | 30 min |
| Cursos | 30 min |
| Ranking | 5 min |
| Analytics | 15 min |
| Video | 1 hora |

### Offline-First

```
Online → Supabase queries + IndexedDB cache
Offline → IndexedDB only
Reconnect → syncService.syncAll()
```

Dados cacheados offline: flashcards, quizzes, progresso, fila de sync.

### Realtime

Supabase Realtime WebSocket para:
- Notificacoes (`useNotifications` hook)
- Eventos ao vivo (`live_events` table)

### RBAC (Role-Based Access Control)

```
User role (student | teacher | administrator)
  → Frontend: useAuth() verifica role em cada pagina
  → Backend: Supabase RLS policies filtram dados por role
  → Granular: class_feature_permissions controla features por turma
```

### Command Palette

`Ctrl+K` / `Cmd+K` abre paleta de comandos global:
- 16 itens de navegacao com keywords em PT-BR
- Busca sem acentos (normalizada)
- Navegacao por teclado (setas + Enter + Esc)
- Componente: `src/components/CommandPalette.tsx`

### Tema

Dark/Light/System via `ThemeProvider`:
- Persistido em localStorage (`vite-ui-theme`)
- Deteccao automatica de preferencia do sistema

### View Mode (Professor)

Professores podem alternar para "visualizar como aluno":
- `ViewModeContext` com `toggleViewAsStudent()`
- Persistido em sessionStorage
