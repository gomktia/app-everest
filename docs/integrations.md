# Integracoes

## Supabase (Backend Principal)

| Item | Valor |
|------|-------|
| URL | `https://hnhzindsfuqnaxosujay.supabase.co` |
| Regiao | sa-east-1 (Sao Paulo) |
| Client | `src/lib/supabase/client.ts` |
| PostgreSQL | v17 |

### Funcionalidades Usadas

- **Auth** — Email/senha, magic link (OTP), PKCE flow
- **Database** — PostgreSQL com RLS (Row-Level Security)
- **Realtime** — WebSocket para notificacoes e live events
- **Storage** — 5 buckets (essays, course_materials, course-covers, community-attachments, question-images)
- **Edge Functions** — Proxy para APIs externas

### Edge Functions

| Function | Descricao |
|----------|-----------|
| `panda-proxy` | Proxy para Panda Video API v2 |
| `memberkit-proxy` | Proxy para MemberKit API |
| `ai-essay-correction` | Correcao de redacoes via OpenAI/Claude |
| `session-guard` | Limite de sessoes simultaneas (max 2) |
| `pdf-watermark` | Marca d'agua em PDFs do acervo |

### Auth Config

| Setting | Valor |
|---------|-------|
| Magic link OTP expira | 3600s (1 hora) |
| Autoconfirm | Habilitado |
| Leaked password protection | Habilitado (HaveIBeenPwned) |
| Reauthentication para trocar senha | Habilitado |
| Refresh token rotation | Habilitado |
| Refresh token reuse interval | 10s |
| Session timeout | Nenhum (sem inatividade) |
| SMTP | Resend (smtp.resend.com:465) |
| Sender | noreply@app.everestpreparatorios.com.br |

---

## Panda Video (Video Streaming)

| Item | Valor |
|------|-------|
| API | `https://api-v2.pandavideo.com.br` |
| API Key | `panda-33e2092c...` |
| Player Base | `https://player-vz-e9d62059-4a4.tv.pandavideo.com.br/embed/?v=` |
| Library ID | `a747d22e-bc6f-4563-96c6-711ec74f9ae5` |
| Videos | 555+ |
| Rate Limit | 200 req/min por IP |
| Dominio liberado | app.everestpreparatorios.com.br |

### Services

| Service | Arquivo | Descricao |
|---------|---------|-----------|
| Client | `src/services/pandaVideo.ts` | Videos, folders |
| Proxy | `src/services/pandaVideoService.ts` | Upload via proxy |
| Live | `src/services/pandaLiveService.ts` | RTMP, DVR, live events |
| Analytics | `src/services/videoAnalyticsService.ts` | Views, retencao |

### Player API v2

Parametros uteis do player embed:

| Param | Descricao |
|-------|-----------|
| `saveProgress` | Salvar progresso automaticamente |
| `disableForward` | Desabilitar avanco |
| `customName` | Nome do aluno no player |
| `startTime` | Tempo inicial (segundos) |
| `defaultSpeed` | Velocidade padrao |
| `initQuality` | Qualidade inicial |

### Funcionalidades

- Streaming HLS
- Analytics (views/plays por dia, retencao por segundo, geo, OS/browser)
- Legendas automaticas (45+ idiomas)
- AI: quiz, resumo, mapa mental a partir do video
- Live: RTMP, DVR, chat, conversao para VOD
- DRM e seguranca
- Webhooks: `video.changeStatus`, `live.changeStatus`

### Integracao Local vs Producao

- **Local:** Vite proxy (`/panda-api`) injeta API key via header `proxyReq`
- **Producao:** Supabase Edge Function `panda-proxy`

---

## MemberKit (Import de Cursos/Alunos)

| Item | Valor |
|------|-------|
| API Key | `3cG57cb4CAgAKMX7Fg59qY8f` |
| Cursos | 21 disponiveis |
| Turmas | 51 disponiveis |

### Services

| Service | Arquivo | Descricao |
|---------|---------|-----------|
| CRUD | `src/services/memberkitService.ts` | Membros, assinaturas |
| Import | `src/services/memberkitImportService.ts` | Import em lote |

### Pipeline de Import

1. Busca membros/cursos da API MemberKit
2. Cria usuarios na tabela `users`
3. Cria matriculas em `student_classes`
4. Sincroniza metadados de video do Panda

Pagina admin: `/admin/integrations/memberkit-import`

---

## Kiwify (Vendas e Matricula Automatica)

Tabela `kiwify_products` vincula produtos Kiwify a turmas.

Fluxo:
1. Webhook de compra Kiwify → Supabase
2. Cria usuario se nao existe
3. Matricula na turma vinculada ao produto
4. Envia magic link por email

Source de matricula: `student_classes.source = 'kiwify'`

---

## Resend (Email/SMTP)

| Item | Valor |
|------|-------|
| SMTP Host | smtp.resend.com |
| SMTP Port | 465 |
| SMTP User | resend |
| Sender | noreply@app.everestpreparatorios.com.br |
| Sender Name | Everest Preparatorios |

Emails enviados:
- Magic link de login (template customizado com branding Everest)
- Confirmacao de cadastro
- Reset de senha
- Convites
- Notificacoes de mudanca de email/senha

---

## AI (Correcao de Redacoes)

### Provedores Configurados

| Provedor | Modelo |
|----------|--------|
| Claude (Anthropic) | claude-sonnet-4-5-20250514 |
| OpenAI (GPT-4) | gpt-4o |
| Custom | Base URL customizavel |

### Integracao

- Configs armazenadas em `ai_provider_configs` (RLS protegido)
- API keys nunca expostas ao frontend
- Edge Function `ai-essay-correction` faz as chamadas
- Suporta metodologia CIAAR (concursos militares) e ENEM

### Services

| Service | Arquivo | Descricao |
|---------|---------|-----------|
| Correcao | `src/services/ai/aiCorrectionService.ts` | Servico de correcao via Edge Function |
| Prompt | `src/services/ai/correctionPrompt.ts` | Builder de prompts CIAAR |

---

## Outras Integracoes

| Integracao | Uso |
|------------|-----|
| Dicebear Avatars | Geracao de avatares por seed (email) |
| Google Fonts | Tipografia (cache 1 ano via PWA) |
| HaveIBeenPwned | Verificacao de senhas vazadas (via Supabase Auth) |
