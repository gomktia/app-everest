# Sessao 2026-03-17 — Bugs Simulado, Comunidade, Auditoria Admin

## 1. Bugs da Pagina de Simulado (3 fixes)

### 406 Errors (trialLimitsService + simulationService)
- **Causa:** `.single()` retornava 406 quando nao havia dados (ex: aluno nao-trial)
- **Fix:** Substituido por `.limit(1)` + checagem `data?.[0]`
- **Arquivos:** `trialLimitsService.ts`, `simulationService.ts`

### RadioGroup controlled/uncontrolled
- **Causa:** `value={answer}` onde `answer` era `undefined` para questoes nao respondidas
- **Fix:** `value={answer ?? ""}` nos 2 RadioGroups (multiple_choice e true_false)
- **Arquivo:** `QuestionRenderer.tsx`

### submit_quiz_attempt RPC 404
- **Causa:** Funcao existia na migration mas nao foi deployada no banco de producao
- **Fix:** Nova migration `20260317100000_recreate_submit_quiz_attempt.sql` + fallback client-side
- **Arquivos:** `simulationService.ts`, `quizService.ts`, migration SQL

## 2. Sentry — 6 Issues Resolvidos

Todos os 6 erros ja estavam resolvidos por fixes anteriores:
- 4x stale chunks (auto-reload ja implementado)
- 1x Link not found (Header ja importa Link)
- 1x AbortError (ruido benigno)

**Adicionado `ignoreErrors`** no Sentry (`instrument.ts`) para filtrar ruido futuro.

## 3. Comunidade — Visibilidade de Espacos por Turma

### Logica
| Espaco | Visibilidade |
|--------|-------------|
| Geral | Sempre visivel (fixo) |
| Espaco da turma | So para alunos matriculados (automatico) |
| Tematicos (EAOF, CADAR...) | Configuravel por turma pelo admin |

### Arquivos modificados
- `AdminClassFormPage.tsx` — Nova secao "Comunidade — Espacos Visiveis" com checkboxes
- `SpacesSidebar.tsx` — Filtra espacos por role + turma + content_access
- `CommunityPage.tsx` — Feed filtra posts por espacos permitidos
- `SpaceFeedPage.tsx` — Bloqueia acesso direto a espaco restrito
- `communityService.ts` — `getPosts()` aceita `allowedSpaceIds`
- `PostFeed.tsx` — Passa `allowedSpaceIds` para o service

### Tipo de content_access
- `content_type: 'community_space'` no `class_content_access`

## 4. Auditoria Admin — 49 Paginas

### usePageTitle
- Adicionado em **todas as 49 paginas admin** (nenhuma tinha antes)
- Titulo aparece na aba do navegador (ex: "Turmas | Everest Preparatorios")

### Tela Preta (3 fixes)
- **index.html**: Loader inline com spinner antes do React montar
- **PageLoader.tsx**: Adicionado `bg-background` + texto "Carregando..."
- **ProtectedRoute.tsx**: Auto-retry de profile fetch + botao "Tentar Novamente"

### Sessao Duplicada (3 fixes)
- **TOKEN_REFRESHED falho**: Detecta sessao revogada e mostra toast
- **SIGNED_OUT involuntario**: Mostra toast quando logout nao foi iniciado pelo usuario
- **visibilitychange**: Verifica sessao quando usuario volta a aba (detecta kick por outro dispositivo)

### Resultado da auditoria
- Todos os CRUDs tem handlers conectados
- Todos os botoes funcionam
- Todos tem loading states + error handling
- Nenhum dead code encontrado

## 5. Migrations Deployadas

- `20260317100000_recreate_submit_quiz_attempt.sql` — Funcao RPC para submissao de simulados
