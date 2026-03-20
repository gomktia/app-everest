# AI Features — Design Spec

**Data:** 2026-03-19
**Provider:** Gemini Flash (via Edge Function existente)
**Escopo:** 5 features de IA para alunos e admin

---

## Visao Geral

| # | Feature | Quem usa | Onde aparece |
|---|---------|----------|-------------|
| 1 | Auditar questoes com IA | Admin | Banco de Questoes — botao "Auditar com IA" |
| 2 | Explicar questao errada | Aluno | Resultado do quiz/simulado (explicacao pre-gerada) |
| 3 | Gerar quiz a partir da aula | Professor | Pagina da aula — le PDF/PPT e gera questoes |
| 4 | Tirar duvida da aula | Aluno | Player da aula — chat limitado ao PDF/PPT |
| 5 | Plano de estudos IA | Aluno | Plano de Estudos — diagnostico + cronograma |

**Kill switch:** Cada feature tem toggle on/off no admin. Toggle master "Desligar TUDO".
**Custo estimado:** R$150-400/mes para 700-1000 alunos.
**Limites:** Sem limite de uso por aluno. Rate limit tecnico de 10 chamadas/min por aluno.

---

## Decisoes Tecnicas Globais

- **Provider unico:** Gemini Flash (`gemini-2.5-flash`) via tabela `ai_provider_configs` existente
- **Edge Function:** Nova Edge Function `ai-assistant` (separada da `ai-essay-correction`)
- **Chave API:** Reutiliza a chave Gemini ja configurada em `ai_provider_configs`
- **Cache:** Explicacoes de questoes sao salvas no campo `explanation` de `quiz_questions` — zero custo apos primeira geracao
- **Kill switch:** Tabela `system_settings` com chaves `ai_feature_audit`, `ai_feature_lesson_chat`, `ai_feature_quiz_gen`, `ai_feature_study_plan`, `ai_features_master`
- **Monitoramento:** Tabela `ai_usage_log` registra cada chamada (user_id, feature, tokens_in, tokens_out, cost_estimate, created_at)

---

## Feature 1: Auditar Questoes com IA

### Objetivo
Admin clica um botao no Banco de Questoes e a IA revisa questoes em lote:
- Corrige erros de ortografia/gramatica **diretamente no banco**
- Gera campo `explanation` para questoes que nao tem
- Marca gabarito suspeito em `needs_review = true` (nao altera automaticamente)

### UX (Admin)

1. Pagina Banco de Questoes → botao "Auditar com IA" no header
2. Modal com opcoes:
   - "Todas as questoes" / "Apenas sem explicacao" / "Apenas novas (ultima semana)"
   - Checkbox: "Corrigir ortografia automaticamente"
   - Checkbox: "Gerar explicacoes"
   - Checkbox: "Verificar gabaritos"
3. Clica "Iniciar Auditoria"
4. Progress bar: "Auditando... 150/4000 questoes"
5. Ao finalizar, relatorio:
   - X questoes corrigidas (ortografia)
   - X explicacoes geradas
   - X gabaritos suspeitos (link para lista filtrada)

### Backend

**Edge Function `ai-assistant`** — action: `audit_questions`

```
Input: {
  action: 'audit_questions',
  questions: [{ id, question_text, options, correct_answer, question_type }] // lote de 10
}

Prompt Gemini:
"Voce e um revisor de questoes para concursos militares brasileiros.
Para cada questao:
1. Corrija erros de ortografia e gramatica no enunciado e alternativas. Retorne o texto corrigido.
2. Verifique se a resposta marcada como correta esta realmente correta. Se tiver duvida, marque como 'suspeito' com justificativa.
3. Gere uma explicacao detalhada de por que a resposta correta esta certa e por que cada alternativa errada esta errada.
Responda em JSON."

Output: {
  results: [{
    id: string,
    question_text_fixed: string | null,   // null = sem correcao necessaria
    options_fixed: string[] | null,        // null = sem correcao
    correct_answer_suspect: boolean,
    suspect_reason: string | null,
    explanation: string
  }]
}
```

**Processamento client-side:**
- Envia em lotes de 10 questoes via `supabase.functions.invoke('ai-assistant')`
- Para cada resultado:
  - Se `question_text_fixed` != null → `UPDATE quiz_questions SET question_text = ...`
  - Se `options_fixed` != null → `UPDATE quiz_questions SET options = ...`
  - Sempre → `UPDATE quiz_questions SET explanation = ..., needs_review = correct_answer_suspect`
- Salva log em `ai_usage_log`

### Database Changes

```sql
-- Adicionar coluna needs_review
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS ai_audited_at timestamptz;
```

---

## Feature 2: Explicar Questao Errada

### Objetivo
Quando o aluno erra uma questao no quiz/simulado, a explicacao aparece automaticamente — ja foi pre-gerada pela Feature 1.

### UX (Aluno)

1. Aluno termina quiz → tela de resultado
2. Para cada questao errada, mostra a explicacao do campo `explanation`
3. Se a questao nao tem explicacao (raro — questao nova), botao "Gerar explicacao com IA"
   - Chama Edge Function para gerar sob demanda
   - Salva no campo `explanation` (cache para proximos alunos)

### Backend

Para o caso raro de questao sem explicacao:

**Edge Function `ai-assistant`** — action: `explain_question`

```
Input: {
  action: 'explain_question',
  question_text: string,
  options: string[],
  correct_answer: string,
  question_type: string
}

Output: {
  explanation: string
}
```

Salva direto em `quiz_questions.explanation` apos gerar.

### Componente

- Modificar a tela de resultado do quiz (QuizResultsPage ou similar)
- Se `question.explanation` existe → mostra direto
- Se nao → mostra botao "Explicar com IA" → chama Edge Function → salva → mostra

---

## Feature 3: Gerar Quiz a partir da Aula

### Objetivo
Professor clica "Gerar Quiz com IA" na pagina de uma aula. A IA le o PDF/PPT anexo e gera questoes no formato do banco.

### UX (Professor)

1. Pagina da aula (admin) → botao "Gerar Quiz com IA"
2. Modal:
   - Mostra o PDF/PPT da aula ja selecionado
   - Quantidade de questoes: 5 / 10 / 15 / 20
   - Dificuldade: Facil / Medio / Dificil / Misto
   - Tipo: Multipla escolha / Certo-Errado / Misto
3. Clica "Gerar"
4. Loading com "Analisando material da aula..."
5. Preview das questoes geradas (editavel)
6. Botao "Salvar no Banco de Questoes" → salva como rascunho vinculado a aula

### Backend

**Edge Function `ai-assistant`** — action: `generate_quiz`

```
Input: {
  action: 'generate_quiz',
  content_text: string,        // texto extraido do PDF/PPT
  num_questions: number,
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed',
  question_type: 'multiple_choice' | 'true_false' | 'mixed'
}

Prompt Gemini:
"Voce e um professor especialista em concursos militares brasileiros.
Com base no conteudo abaixo, crie {num_questions} questoes no estilo CEBRASPE/multipla escolha.
Cada questao deve ter: enunciado, 5 alternativas (A-E), resposta correta, e explicacao detalhada.
Dificuldade: {difficulty}.
Responda em JSON."

Output: {
  questions: [{
    question_text: string,
    question_type: 'multiple_choice' | 'true_false',
    options: string[],
    correct_answer: string,
    explanation: string,
    difficulty: number,        // 1-5
    tags: string[]
  }]
}
```

**Extracao de texto do PDF/PPT:**
- PDFs do acervo estao no Supabase Storage (bucket `course_materials`)
- Client faz download do PDF → extrai texto via biblioteca JS (pdf.js ou similar)
- Envia o texto extraido para a Edge Function
- Alternativa: Edge Function recebe a URL do Storage e extrai no servidor

**Salvamento:**
- Questoes geradas sao inseridas em `quiz_questions` vinculadas a um quiz da aula
- Campo `source_type = 'ai_generated'`, `source_exam = 'IA - [nome da aula]'`
- Professor pode editar antes de salvar

---

## Feature 4: Tirar Duvida da Aula (Chat Limitado)

### Objetivo
Aluno tem um chat na pagina da aula para tirar duvidas. A IA responde apenas com base no PDF/PPT daquela aula.

### UX (Aluno)

1. LessonPlayerPage → icone de chat no canto inferior direito (ou aba lateral)
2. Abre painel de chat
3. Aluno digita pergunta (ex: "O que e mandado de seguranca?")
4. IA responde com base no PDF/PPT da aula (max ~300 tokens)
5. Se a pergunta esta fora do conteudo da aula: "Essa duvida nao esta no conteudo desta aula. Tente perguntar algo relacionado ao tema [nome do modulo]."
6. Cada pergunta e independente — sem historico de conversa (economia de tokens)

### Backend

**Edge Function `ai-assistant`** — action: `lesson_chat`

```
Input: {
  action: 'lesson_chat',
  question: string,            // pergunta do aluno
  lesson_content: string,      // texto extraido do PDF/PPT
  lesson_title: string,
  module_name: string
}

Prompt Gemini:
"Voce e um tutor de um curso preparatorio para concursos militares.
O aluno esta estudando a aula '{lesson_title}' do modulo '{module_name}'.
Responda a duvida do aluno APENAS com base no conteudo abaixo.
Se a pergunta nao for relacionada ao conteudo, diga educadamente que nao pode ajudar com esse tema.
Seja conciso (maximo 200 palavras).
Conteudo da aula:
{lesson_content}"

Output: {
  answer: string,
  is_on_topic: boolean
}
```

### Cache

- Texto do PDF/PPT e extraido uma vez e cacheado em `localStorage` por aula
- Nao cachear respostas do chat (cada pergunta e unica)

### Componente

- Novo componente `LessonAIChat.tsx`
- Renderizado dentro do `LessonPlayerPage.tsx`
- Botao flutuante ou aba "Tirar Duvida com IA" ao lado de "Anotacoes", "Comentarios"

---

## Feature 5: Plano de Estudos IA

### Objetivo
Aluno clica "Gerar com IA" na pagina de Plano de Estudos. A IA analisa o desempenho e gera diagnostico + cronograma.

### UX (Aluno)

1. Pagina Plano de Estudos → botao "Gerar Plano com IA"
2. Loading "Analisando seu desempenho..."
3. Mostra 2 secoes:
   - **Diagnostico:** grafico/lista de materias com % de acerto (ex: "Portugues 45%, Direito 78%, Matematica 62%")
   - **Cronograma sugerido:** lista de topicos priorizados por fraqueza, com sugestao de horas/semana
4. Aluno pode ajustar e salvar no plano de estudos existente

### Backend

**Edge Function `ai-assistant`** — action: `study_plan`

```
Input: {
  action: 'study_plan',
  performance: {
    quizzes: [{ subject: string, total: number, correct: number }],
    simulados: [{ subject: string, total: number, correct: number }],
    flashcards: [{ topic: string, total: number, correct: number, avg_ease: number }],
    study_hours: { total: number, by_subject: Record<string, number> }
  },
  available_hours_per_week: number,
  target_exam: string           // ex: "CIAAR", "ESFCEX"
}

Prompt Gemini:
"Voce e um coach de estudos para concursos militares brasileiros.
Com base no desempenho do aluno abaixo, crie:
1. DIAGNOSTICO: liste cada materia com nivel (fraco/medio/forte) e % de acerto
2. CRONOGRAMA SEMANAL: distribua {available_hours_per_week}h/semana priorizando materias fracas
3. RECOMENDACOES: 3-5 dicas especificas baseadas nos dados
Responda em JSON."

Output: {
  diagnosis: [{
    subject: string,
    accuracy_percent: number,
    level: 'weak' | 'medium' | 'strong',
    recommendation: string
  }],
  weekly_schedule: [{
    day: string,
    blocks: [{ subject: string, hours: number, focus: string }]
  }],
  tips: string[]
}
```

**Coleta de dados (client-side):**
- Quiz attempts: `quiz_answers` JOIN `quiz_questions` agrupado por subject/tags
- Flashcard progress: `flashcard_progress` JOIN `flashcards` agrupado por topic
- Study hours: `study_planner` / `pomodoro_sessions`
- Monta o objeto `performance` e envia para a Edge Function

---

## Kill Switch & Monitoramento

### Tabela `system_settings` (ja existe)

Adicionar chaves:
```
ai_features_master: true/false        -- desliga TUDO
ai_feature_audit: true/false          -- auditar questoes
ai_feature_lesson_chat: true/false    -- tirar duvida da aula
ai_feature_quiz_gen: true/false       -- gerar quiz
ai_feature_study_plan: true/false     -- plano de estudos
ai_rate_limit_per_minute: 10          -- rate limit por aluno
ai_cost_alert_threshold: 500          -- alerta em R$ (mensal)
```

### Tabela `ai_usage_log` (nova)

```sql
CREATE TABLE ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  feature text NOT NULL,              -- 'audit' | 'explain' | 'quiz_gen' | 'lesson_chat' | 'study_plan'
  tokens_input int,
  tokens_output int,
  cost_estimate_brl numeric(10,4),
  model text DEFAULT 'gemini-2.5-flash',
  created_at timestamptz DEFAULT now()
);
```

### Painel Admin — Integrações

Adicionar secao "Features de IA" abaixo do painel de provedores existente:

- Toggle por feature (on/off)
- Toggle master "Desligar todas as features IA"
- Grafico de uso mensal (chamadas + custo estimado)
- Tabela: ultimas 50 chamadas (usuario, feature, tokens, custo, data)

### Comportamento quando desligado

| Feature | Toggle off | O que acontece |
|---------|-----------|---------------|
| Auditar questoes | off | Botao "Auditar com IA" desaparece do admin |
| Explicar questao | — | Sempre funciona (dado pre-gerado, sem IA) |
| Gerar quiz | off | Botao "Gerar Quiz com IA" desaparece |
| Tirar duvida | off | Painel de chat nao aparece na aula |
| Plano de estudos | off | Botao "Gerar com IA" desaparece, plano manual funciona |
| Master off | off | Tudo acima desaparece de uma vez |

---

## Edge Function: `ai-assistant`

Uma unica Edge Function que roteia por `action`:

```typescript
// supabase/functions/ai-assistant/index.ts
Deno.serve(async (req) => {
  const { action, ...params } = await req.json()

  // Busca provider ativo (Gemini)
  const provider = await getActiveProvider(supabase)

  // Verifica kill switch
  const settings = await getAISettings(supabase)
  if (!settings.ai_features_master) {
    return error('Features de IA desabilitadas')
  }

  // Rate limit
  await checkRateLimit(supabase, userId, settings.ai_rate_limit_per_minute)

  switch (action) {
    case 'audit_questions': return handleAudit(provider, params)
    case 'explain_question': return handleExplain(provider, params)
    case 'generate_quiz': return handleGenerateQuiz(provider, params)
    case 'lesson_chat': return handleLessonChat(provider, params)
    case 'study_plan': return handleStudyPlan(provider, params)
  }
})
```

---

## Resumo de Mudancas

### Banco de Dados
- `quiz_questions`: + `needs_review boolean`, `ai_audited_at timestamptz`
- `system_settings`: + 7 chaves de AI config
- `ai_usage_log`: nova tabela

### Edge Functions
- `ai-assistant/index.ts`: nova (5 actions)

### Frontend — Novos Componentes
- `src/components/admin/QuestionAuditModal.tsx` — modal de auditoria
- `src/components/lessons/LessonAIChat.tsx` — chat da aula
- `src/components/study-planner/AIStudyPlanGenerator.tsx` — gerador de plano
- `src/components/admin/AIFeaturesPanel.tsx` — painel de toggles + monitoramento

### Frontend — Modificacoes
- `QuestionBank.tsx` — botao "Auditar com IA"
- `QuizResultsPage.tsx` (ou equivalente) — mostrar explanation + botao fallback
- Pagina de aula admin — botao "Gerar Quiz com IA"
- `LessonPlayerPage.tsx` — integrar LessonAIChat
- `StudyPlannerPage.tsx` — botao "Gerar com IA"
- `AIProviderConfig.tsx` — adicionar secao de features toggle
