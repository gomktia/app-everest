# Servicos e Hooks

## Services (`src/services/`)

### Autenticacao e Usuarios

| Service | Arquivo | Descricao |
|---------|---------|-----------|
| Auth | authService.ts | Magic link, reset de senha |
| User | userService.ts | Perfil do usuario |
| User Settings | userSettingsService.ts | Preferencias (localStorage + DB) |
| Teacher | teacherService.ts | Dados de professor, matriculas |
| Admin User | adminUserService.ts | CRUD de usuarios (admin) |
| Admin Stats | adminStatsService.ts | Estatisticas do sistema |

### Cursos e Aulas

| Service | Arquivo | Descricao |
|---------|---------|-----------|
| Course | courseService.ts | Cursos, modulos, aulas do aluno |
| Admin Course | adminCourseService.ts | CRUD de cursos (admin/professor) |
| Lesson Interaction | lessonInteractionService.ts | Comentarios, ratings, engajamento |
| Audio Lesson | audioLessonService.ts | Evercast/audio-aulas |
| Calendar | calendarService.ts | Eventos do calendario |

### Quizzes e Avaliacoes

| Service | Arquivo | Descricao |
|---------|---------|-----------|
| Quiz | quizService.ts | Quizzes, tentativas, suporte offline |
| Admin Quiz | adminQuizService.ts | CRUD quizzes (admin/professor) |
| Simulation | simulationService.ts | Simulados estilo ENEM |
| Admin Simulation | adminSimulationService.ts | CRUD simulados |
| Trial Limits | trialLimitsService.ts | Restricoes de conteudo trial |

### Flashcards

| Service | Arquivo | Descricao |
|---------|---------|-----------|
| Flashcard | flashcardService.ts | Estudo, progresso, suporte offline |
| Subject | subjectService.ts | Materias e topicos |

### Redacoes

| Service | Arquivo | Descricao |
|---------|---------|-----------|
| Essay | essayService.ts | Submissao, correcao, anotacoes |
| Admin Essay | adminEssayService.ts | Temas de redacao (admin) |
| Essay Settings | essaySettingsService.ts | Categorias de erro, criterios |
| CIAAR Correction | ciaarCorrectionService.ts | Algoritmo CIAAR |
| AI Correction | ai/aiCorrectionService.ts | Correcao via Edge Function |
| Correction Prompt | ai/correctionPrompt.ts | Builder de prompts CIAAR |

### Gamificacao

| Service | Arquivo | Descricao |
|---------|---------|-----------|
| Gamification | gamificationService.ts | Conquistas, XP, niveis |
| Ranking | rankingService.ts | Leaderboard por materia |
| Dashboard | dashboardService.ts | Stats do dashboard |

### Turmas e Acesso

| Service | Arquivo | Descricao |
|---------|---------|-----------|
| Class | classService.ts | Turmas e matriculas |
| Class Permissions | classPermissionsService.ts | Permissoes por turma |
| Content Access | contentAccessService.ts | Regras de acesso a conteudo |
| Module Rules | moduleRulesService.ts | Regras de liberacao de modulos |

### Comunidade

| Service | Arquivo | Descricao |
|---------|---------|-----------|
| Community | communityService.ts | Posts, espacos, grupos |
| Notification | notificationService.ts | Notificacoes |
| Invite | inviteService.ts | Links de convite |

### Video e Media

| Service | Arquivo | Descricao |
|---------|---------|-----------|
| Panda Video | pandaVideo.ts | Client direto da API Panda |
| Panda Video Proxy | pandaVideoService.ts | Upload via proxy |
| Panda Live | pandaLiveService.ts | RTMP, DVR, live |
| Video Analytics | videoAnalyticsService.ts | Views, retencao |

### Import e Integracoes

| Service | Arquivo | Descricao |
|---------|---------|-----------|
| MemberKit | memberkitService.ts | Membros e assinaturas |
| MemberKit Import | memberkitImportService.ts | Import em lote |
| Live Event | liveEventService.ts | Eventos ao vivo |

### Sistema

| Service | Arquivo | Descricao |
|---------|---------|-----------|
| System Settings | systemSettingsService.ts | Config global |
| Study Planner | studyPlannerService.ts | Plano de estudos + Pomodoro |
| Queue | queueService.ts | Jobs em background |
| Acervo | acervoService.ts | Biblioteca digital + watermark |

---

## Hooks (`src/hooks/`)

### Autenticacao e Permissoes

| Hook | Arquivo | Descricao |
|------|---------|-----------|
| useAuth | use-auth.tsx | Auth com loading e error handling |
| useFeaturePermissions | use-feature-permissions.tsx | Permissoes por turma |
| useTrialLimits | use-trial-limits.tsx | Restricoes de conteudo trial |

### Data Fetching

| Hook | Arquivo | Descricao |
|------|---------|-----------|
| useAsyncData | use-async-data.ts | Fetch generico com loading/error |
| useCachedData | useCachedData.ts | Cache em memoria |
| useJobStatus | useJobStatus.ts | Poll status de jobs |

### Acesso a Conteudo

| Hook | Arquivo | Descricao |
|------|---------|-----------|
| useContentAccess | useContentAccess.ts | IDs permitidos por tipo/turma |
| useModuleAccess | useModuleAccess.ts | Status de liberacao de modulos |
| useAccessExpiration | use-access-expiration.ts | Verificacao de expiracao |

### UI e UX

| Hook | Arquivo | Descricao |
|------|---------|-----------|
| useDebounce | use-debounce.ts | Debounce para inputs de busca |
| useToast | use-toast.ts | Sistema de toasts (Shadcn) |
| useAnimations | useAnimations.ts | Utilitarios de animacao |
| useMobile | use-mobile.tsx | Deteccao de viewport mobile |
| useErrorHandler | use-error-handler.ts | Erro centralizado com toast |

### Dominio

| Hook | Arquivo | Descricao |
|------|---------|-----------|
| useNotifications | useNotifications.ts | Notificacoes via WebSocket |
| useTeacherClasses | useTeacherClasses.ts | Turmas do professor |
| useAchievements | useAchievements.ts | Conquistas e XP |
| useIntegrations | useIntegrations.tsx | Status das integracoes |

---

## Contexts (`src/contexts/`)

### AuthProvider (`auth-provider.tsx`)

Provê autenticacao para toda a aplicacao.

**Valores:**
- `user` — Usuario Supabase Auth (ou null)
- `session` — Sessao ativa (ou null)
- `profile` — Perfil completo do usuario (role, nome, etc)
- `loading` — Estado de carregamento

**Metodos:**
- `signIn(email, password)` — Login com senha
- `signInWithMagicLink(email)` — Login com magic link
- `signUp(email, password, metadata)` — Cadastro
- `signOut()` — Logout
- `refreshProfile()` — Recarregar perfil
- `getRedirectPath()` — Caminho por role (student→/dashboard, admin→/admin)

**Comportamento:**
- Cria perfil automaticamente para novos usuarios
- Listener `onAuthStateChange` para mudancas de sessao
- Auto-refresh de tokens

### ThemeProvider (`theme-provider.tsx`)

**Valores:**
- `theme` — 'dark', 'light', 'system'
- `setTheme(theme)` — Alterar tema

Storage: localStorage `vite-ui-theme`

### ViewModeContext (`view-mode-context.tsx`)

Permite professores visualizarem como aluno.

**Valores:**
- `viewingAsStudent` — boolean
- `toggleViewAsStudent()` — Alternar
- `exitStudentView()` — Sair do modo aluno

Storage: sessionStorage `everest-view-as-student`

---

## Utilitarios (`src/lib/`)

| Arquivo | Descricao |
|---------|-----------|
| `supabase/client.ts` | Client Supabase com timeout customizado |
| `supabase/types.ts` | Types auto-gerados do schema |
| `queryCache.ts` | Cache TTL em memoria (30min dashboard, 5min ranking) |
| `offlineStorage.ts` | IndexedDB para flashcards, quizzes, progresso |
| `syncService.ts` | Deteccao online/offline + sync automatico |
| `fileCompression.ts` | Compressao de imagens (max 1600px, JPEG 0.75) |
| `sanitize.ts` | DOMPurify: sanitizeText, sanitizeHtml, isValidUrl |
| `logger.ts` | Logger dev-only (error() em prod, preparado para Sentry) |
| `design-tokens.ts` | Tokens de cor, espacamento, tipografia |
| `dashboard-config.ts` | Config de widgets do dashboard |
| `utils.ts` | Utilitarios gerais |
