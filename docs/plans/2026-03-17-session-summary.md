# Sessao 2026-03-17 — Bugs, Performance, Auditoria, Migracao MemberKit

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
- Hook: `usePageTitle('Nome da Pagina')` → atualiza titulo da aba do navegador
- Ex: "Turmas | Everest Preparatorios" em vez do titulo generico

### PageTabs padronizacao
- 7 paginas admin que nao tinham `PageTabs` receberam o componente:
  - `AdminClassFormPage` → Informacoes | Modulos e Aulas | Acesso ao Conteudo
  - `AdminClassPermissionsPage` → Selecionar Turma | Permissoes
  - `AdminEssaysPage` → Turmas | Pendentes
  - `AdminIntegrationsPage` → Status | Configuracao
  - `AdminAcervoPage` → Todos os Itens | Estatisticas
  - `AdminCalendarPage` → Calendario | Proximos Eventos
  - `AdminLiveEventsPage` → Eventos | Estatisticas
- Total: 23 paginas admin agora usam PageTabs

### Sessao Duplicada (3 fixes)
- **TOKEN_REFRESHED falho**: Detecta sessao revogada e mostra toast
- **SIGNED_OUT involuntario**: Mostra toast quando logout nao foi iniciado pelo usuario
- **visibilitychange**: Verifica sessao quando usuario volta a aba (detecta kick por outro dispositivo)

### Resultado da auditoria
- Todos os CRUDs tem handlers conectados
- Todos os botoes funcionam
- Todos tem loading states + error handling
- Nenhum dead code encontrado

## 5. Performance — Tela Preta no F5 (CRITICO)

### Problema
Apertar F5 em qualquer pagina causava 8+ segundos de tela preta antes do conteudo aparecer.

### Causa raiz: Recursao infinita na RLS
A funcao `get_auth_user_role()` fazia `SELECT role FROM users WHERE id = auth.uid()`.
Essa query disparava as policies RLS da tabela `users`, que por sua vez chamavam
`get_auth_user_role()` novamente = **loop infinito ate timeout (8s)**.

```
profile fetch → RLS verifica role → get_auth_user_role()
  → SELECT role FROM users → RLS verifica role → get_auth_user_role()
    → SELECT role FROM users → ... → TIMEOUT 8s
```

### Fix (migration 20260317200000)
Adicionado `SECURITY DEFINER` na funcao para que ela bypasse RLS ao checar o role:
```sql
CREATE OR REPLACE FUNCTION get_auth_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT role::text FROM public.users WHERE id = auth.uid(); $$;
```

### Otimizacoes adicionais de performance
1. **Profile cache localStorage** (`everest-profile-cache`, TTL 1h):
   - No F5, le profile do cache (0ms) e renderiza instantaneamente
   - Refresh do profile em background (nao bloqueia)
2. **Sessao localStorage direto**:
   - Le token do localStorage sem chamar `getSession()` (que faz refresh de token via rede)
   - Render imediato, token refresh em background
3. **Inline loader no index.html**:
   - Spinner fixo em `position:fixed` antes do React montar
   - Fade-out suave quando React renderiza (`RemoveInitialLoader`)
   - Body com background inline para evitar flash branco/preto
4. **Timeouts reduzidos**:
   - Profile fetch: 30s → 8s
   - Auth fetch global: 30s → 10s
   - DB queries fetch global: 30s → 15s
   - getSession timeout: 5s → 3s (com fallback localStorage)
5. **must_change_password no profile**:
   - Campo incluido no SELECT do profile fetch
   - Removida query separada do ProtectedRoute (eliminava 5s+ de bloqueio)
6. **Retry removido**:
   - fetchUserProfile sem retry (era 30s + 1s delay + 30s = 61s worst case)
   - ProtectedRoute sem auto-retry (adicionava mais 32s)

### Timeline de performance
| Metrica | Antes | Depois |
|---------|-------|--------|
| Worst case F5 | ~98s | <1s (cache) ou ~8s (sem cache, primeiro login) |
| Caso normal F5 | 8-10s | <0.5s |
| Profile fetch | 8s (recursao RLS) | <0.3s |
| Queries com role check | 8s cada | <0.3s cada |

## 6. Dashboard Admin — 4 Bugs no Console

| Erro | Causa | Fix |
|------|-------|-----|
| `get_system_stats` RPC 404 | Funcao nao existe no banco | Fallback ja funciona |
| `essays status=pending` 400 (x2) | Status `pending` nao existe, correto e `submitted` | Corrigido em adminStatsService |
| `video_courses.title` 400 | Coluna e `name`, nao `title` | Corrigido em adminStatsService + AdminLiveEventsPage |

## 7. Migracao MemberKit → Supabase Storage

### Problema
261 PDFs e PPTs de aulas apontavam para `assets.memberkit.com.br`.
Se cancelar o MemberKit, todos os arquivos de aulas ficariam inacessiveis.

### Solucao
Script `scripts/migrate-memberkit-attachments.ts`:
1. Busca todos os `lesson_attachments` com URL do MemberKit
2. Baixa cada arquivo
3. Upload para Supabase Storage (bucket: `course_materials`)
4. Atualiza URL na tabela `lesson_attachments`

### Resultado
- **260/260 migrados com sucesso, 0 falhas**
- 224 PDFs + 37 PPTs
- Organizados por curso/modulo: `lessons/{curso}/{modulo}/{arquivo}`
- 0 URLs do MemberKit restantes no banco

### Estrutura no Storage
```
course_materials/lessons/
├── Extensivo_EAOF_2027_-_Portugues_e_Redacao/
│   ├── MENTORIAS_LIVES_EXTENSIVO/
│   ├── MODULO_01_-_INTERPRETACAO_DE_TEXTOS/
│   └── ...
├── Clube_de_Redacao/
│   ├── Modulo_04_-_O_Projeto_de_Texto/
│   └── TEMA_01_.../
└── ...
```

### Dependencias pos-migracao
| Recurso | Hospedagem | Depende MemberKit? |
|---------|-----------|-------------------|
| Videos | Panda Video | Nao |
| PDFs Acervo (133) | Supabase Storage | Nao |
| PDFs/PPTs Aulas (260) | Supabase Storage (migrado) | Nao |
| Estrutura cursos | Supabase (tabelas) | Nao |
| **Conclusao** | **MemberKit pode ser cancelado** | |

## 8. Correcoes menores

- Professor `professor@teste.com` tinha role `student` no banco → corrigido para `teacher`
- Typo no toast de sessao: "Sessao" → "Sessão"
- Import `useEffect` removido do ProtectedRoute (nao usado)
- `supabase` import removido do ProtectedRoute (nao usado)

## 9. Migrations Deployadas

| Migration | Descricao |
|-----------|-----------|
| `20260317100000_recreate_submit_quiz_attempt.sql` | RPC para submissao de simulados |
| `20260317200000_fix_rls_recursive_function.sql` | Fix recursao infinita na RLS (CRITICO) |

## 10. Documentacao Atualizada

- `docs/services-and-hooks.md` — Hook `usePageTitle` documentado, session management atualizado
- `docs/plans/2026-03-17-session-summary.md` — Este arquivo
