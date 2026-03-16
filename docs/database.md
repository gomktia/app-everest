# Banco de Dados

Supabase PostgreSQL 17 — Projeto `hnhzindsfuqnaxosujay` (sa-east-1)

## Tabelas por Dominio

### Usuarios e Autenticacao

**users**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | |
| email | TEXT UNIQUE | |
| first_name, last_name | TEXT | |
| phone, cpf_cnpj | TEXT | |
| role | TEXT | 'student', 'teacher', 'administrator' |
| is_active, is_banned | BOOLEAN | |
| is_unlimited_access | BOOLEAN | Acesso ilimitado (sem restricao de turma) |
| subscription_end_date | TIMESTAMPTZ | Data fim do acesso |
| last_seen_at | TIMESTAMPTZ | Ultima atividade |
| created_at, updated_at | TIMESTAMPTZ | |

**user_settings**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | |
| user_id | UUID FK UNIQUE → users | |
| flashcard_theme, background_sound | TEXT | Preferencias de estudo |
| timer_alerts, use_pomodoro | BOOLEAN | |
| pomodoro_duration_minutes | INTEGER | Duracao do pomodoro |
| pomodoro_break_minutes | INTEGER | Duracao do intervalo |
| daily_study_goal_minutes | INTEGER | Meta diaria |

**user_sessions** — Sessoes ativas para analytics

---

### Turmas e Matriculas

**classes**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | |
| name, description | TEXT | |
| class_type | TEXT | 'standard', 'trial' |
| status | TEXT | 'active', 'inactive', 'archived' |
| start_date, end_date | TIMESTAMPTZ | Periodo da turma |
| access_duration_days | INTEGER | Dias de acesso apos matricula |
| trial_flashcard_limit_per_day | INTEGER | Limite flashcards (trial) |
| trial_quiz_limit_per_day | INTEGER | Limite quizzes (trial) |
| trial_essay_submission_limit | INTEGER | Limite redacoes (trial) |
| is_default | BOOLEAN | Turma padrao |

**student_classes**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| class_id | UUID FK → classes | |
| source | TEXT | 'manual', 'tasting', 'invite', 'kiwify' |
| UNIQUE | (user_id, class_id) | |

**class_feature_permissions** — Features habilitadas por turma (ex: `essay_module`, `evercast_module`)

**class_content_access** — Conteudo especifico liberado por turma

**class_module_rules** — Regras de liberacao de modulos por turma (`free`, `scheduled_date`, `days_after_enrollment`, `hidden`, `blocked`, `module_completed`)

**class_lesson_rules** — Regras de liberacao de aulas por turma (mesmos tipos)

---

### Cursos e Aulas

**video_courses**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | |
| name, description | TEXT | |
| acronym | TEXT | Sigla do curso |
| thumbnail_url | TEXT | Capa |
| category | TEXT | Default: 'Meus Cursos' |
| status | TEXT | 'draft', 'published' |
| show_in_storefront | BOOLEAN | Exibir na vitrine |
| moderate_comments | BOOLEAN | Moderar comentarios |
| onboarding_text | TEXT | Texto de boas-vindas |
| created_by_user_id | UUID FK → users | |

**video_modules**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | |
| course_id | UUID FK → video_courses | |
| name, description | TEXT | |
| order_index | INTEGER | Ordem |
| module_type | TEXT | Default: 'video' |
| quiz_id | UUID FK → quizzes | Quiz vinculado (opcional) |
| is_active | BOOLEAN | |

**video_lessons**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | |
| module_id | UUID FK → video_modules | |
| title, description | TEXT | |
| order_index | INTEGER | Ordem |
| video_source_type | TEXT | 'panda_video', 'youtube', 'vimeo' |
| video_source_id | TEXT | ID do video no provedor |
| duration_seconds | INTEGER | |
| is_active, is_preview | BOOLEAN | |
| quiz_id | UUID FK → quizzes | Quiz vinculado (opcional) |

**video_progress** — Progresso do aluno por aula (current_time, percentage, is_completed). UNIQUE(user_id, lesson_id)

**lesson_attachments** — Arquivos anexos a aulas (PDFs, materiais)

**lesson_comments** — Comentarios em aulas (com parent_id para replies)

**lesson_ratings** — Avaliacao de aulas (1-5 estrelas). UNIQUE(lesson_id, user_id)

**lesson_notes** — Anotacoes do aluno por aula (texto + drawing_data para canvas)

**class_courses** — Vinculo turma ↔ curso. UNIQUE(class_id, course_id)

---

### Quizzes e Avaliacoes

**quizzes**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | |
| name, description | TEXT | |
| type | TEXT | 'quiz', 'simulation', 'answer_sheet' |
| status | TEXT | 'draft', 'published' |
| total_points, passing_score | INTEGER | |
| show_results_immediately | BOOLEAN | |
| shuffle_questions, shuffle_options | BOOLEAN | |
| allow_review | BOOLEAN | Permitir revisao apos envio |
| instructions | TEXT | |
| created_by | UUID FK → users | |

**quiz_questions**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | |
| quiz_id | UUID FK → quizzes | |
| question_text | TEXT | Texto plano |
| question_html | TEXT | Rich text |
| question_format | TEXT | 'multiple_choice', 'true_false', 'multiple_response', 'fill_blank', 'matching', 'ordering', 'essay' |
| options | JSONB | Opcoes legado |
| options_rich | JSONB | Opcoes rich text com imagens |
| correct_answer | TEXT | |
| correct_answers | JSONB | Para multiple_response |
| explanation, explanation_html | TEXT | |
| difficulty | TEXT | 'easy', 'medium', 'hard', 'expert' |
| points | INTEGER | Default: 1 |
| tags | TEXT[] | |
| source_exam, source_banca | TEXT | Rastreabilidade de importacao |
| source_year | INTEGER | |
| acervo_item_id | UUID FK → acervo_items | PDF de origem |

**quiz_reading_texts** — Textos de apoio vinculados a questoes

**quiz_classes** — Vinculo quiz ↔ turma

**quiz_attempts** — Tentativas do aluno (score, percentage, status, answers JSONB)

**quiz_attempt_answers** — Respostas individuais por questao

---

### Flashcards

**subjects** — Materias (nome, categoria: 'ENEM', 'Militares', etc)

**topics** — Topicos dentro de materias

**flashcards**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | |
| topic_id | UUID FK → topics | |
| question, answer | TEXT | Texto plano |
| question_html, answer_html | TEXT | Rich text |
| explanation | TEXT | |
| flashcard_set_id | UUID FK → flashcard_sets | Conjunto (opcional) |
| source_exam, source_banca | TEXT | Importacao |
| source_type | TEXT | 'manual', 'imported_csv', 'extracted_pdf', 'generated_ai' |
| acervo_item_id | UUID FK → acervo_items | |

**flashcard_progress** — Progresso por card (confidence_rating, next_review_at para spaced repetition). UNIQUE(user_id, flashcard_id)

**flashcard_session_history** — Historico de sessoes (cards_reviewed, correct, incorrect)

**flashcard_sets** — Conjuntos colaborativos de flashcards

**flashcard_set_collaborators** — Colaboradores de conjuntos (viewer/editor)

**user_favorite_flashcards** — Flashcards favoritos do usuario

**group_study_sessions** — Sessoes de estudo em grupo (pending/active/completed)

**group_session_participants** — Participantes de sessoes em grupo

---

### Redacoes

**essay_prompts** — Temas de redacao (title, description, prompt_text, criteria_template_id)

**essays**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | |
| student_id | UUID FK → users | |
| essay_prompt_id | UUID FK → essay_prompts | |
| correction_type | TEXT | 'ciaar' ou 'enem' |
| status | TEXT | 'draft', 'submitted', 'correcting', 'corrected' |
| file_url | TEXT | Arquivo enviado |
| content | TEXT | Texto rico |
| annotated_text_html | TEXT | Markup do professor |
| annotation_image_url | TEXT | Anotacoes em canvas |
| final_grade | DECIMAL | Nota final |
| final_grade_enem | NUMERIC | Nota ENEM (0-1000) |
| ai_analysis | JSONB | Feedback da IA |

**essay_annotations** — Anotacoes do professor por redacao

**essay_competency_scores** — Notas por competencia ENEM (5 competencias, 0-200 cada)

**correction_templates** — Templates de correcao (CIAAR/ENEM)

**evaluation_criteria_templates** — Templates de criterios de avaliacao

---

### Simulados

Simulados usam a mesma tabela `quizzes` com `type = 'simulation'` e `quiz_attempts` para resultados.

Cartoes de resposta usam `type = 'answer_sheet'`.

---

### Gamificacao

**scores** — Pontuacoes (user_id, activity_type, score_value)

**achievements** — Conquistas disponiveis (name, description, icon_url, category, xp_reward). 45+ seeds

**user_achievements** — Conquistas desbloqueadas por usuario. UNIQUE(user_id, achievement_id)

**user_progress** — XP total, level, streak

**rpg_ranks** — Ranks RPG (nome, min/max XP)

---

### Comunidade

**community_spaces** — Espacos/categorias (name, slug, icon, space_type: 'general'/'course'/'event')

**community_posts** — Posts (title, content, type: 'text'/'poll'/'question', likes_count, comments_count)

**community_comments** — Comentarios (com parent_comment_id para threads)

**community_reactions** — Reacoes com emoji. UNIQUE(user_id, target_type, target_id, emoji)

**community_attachments** — Arquivos em posts/comentarios

**community_reports** — Denuncias (spam, inappropriate, harassment)

**community_mutes** — Usuarios silenciados

**community_poll_options** — Opcoes de enquete

**community_poll_votes** — Votos em enquetes

**community_word_filter** — Filtro de palavras proibidas

---

### Eventos ao Vivo

**live_events**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID PK | |
| title, description | TEXT | |
| provider | TEXT | 'panda', 'youtube', 'meet' |
| stream_url | TEXT | |
| panda_live_id, panda_rtmp, panda_stream_key | TEXT | Dados Panda Live |
| class_id | UUID FK → classes | |
| course_id | UUID FK → video_courses | |
| teacher_id | UUID FK → users | |
| scheduled_start, scheduled_end | TIMESTAMPTZ | |
| status | TEXT | 'scheduled', 'live', 'ended', 'cancelled' |
| recording_url | TEXT | Gravacao |
| Realtime habilitado | | |

---

### Acervo Digital e Import

**acervo_items** — PDFs do acervo (title, file_url, category, concurso, banca, year). 133 itens, 427 MB

**import_jobs** — Jobs de importacao (enem_csv, military_pdf, etc). Status, contadores, error_log

---

### Notificacoes e Calendario

**notifications** — Notificacoes por usuario (type, title, message, is_read). Realtime habilitado

**calendar_events** — Eventos do calendario (title, class_id, event_type, event_date)

---

### Convites e Kiwify

**invites** — Links de convite (slug, title, course_id, class_id, max_slots, status)

**invite_registrations** — Registros de convite (invite_id, user_id)

**kiwify_products** — Produtos Kiwify para matricula automatica

---

### Plano de Estudos

**study_topics** — Topicos de estudo do usuario (title, category, type, status, pomodoros)

**pomodoro_sessions** — Sessoes Pomodoro (topic_id, duration_minutes, completed)

---

### Fila de Jobs

**job_queue** — Fila de jobs em background (type, status, payload JSONB, result JSONB, attempts)

**circuit_breaker_state** — Circuit breaker para servicos externos (service, state, failure_count)

---

## RPC Functions

| Funcao | Descricao |
|--------|-----------|
| `get_system_stats()` | Stats do admin: total usuarios, cursos, flashcards, redacoes |
| `get_ranking(limit)` | Ranking global por XP |
| `get_ranking_by_class(class_id, limit)` | Ranking por turma |
| `get_ranking_by_activity_type(type, limit)` | Ranking por atividade |
| `get_total_xp()` | XP total do usuario autenticado |
| `get_gamification_stats()` | Stats de gamificacao |
| `get_user_score_history(user_id, limit)` | Historico de pontuacao |
| `add_user_score(user_id, type, value, activity_id)` | Adicionar pontuacao |
| `get_import_stats()` | Stats de importacao (questoes, flashcards, acervo) |
| `update_last_seen(user_id)` | Atualizar ultima atividade (debounce 5min) |
| `handle_updated_at()` | Trigger: atualiza updated_at |
| `increment_topic_pomodoros(topic_id)` | Incrementar pomodoros de um topico |
| `get_study_stats(user_id)` | Stats do plano de estudos |
| `validate_answer_sheet(attempt_id)` | Corrigir cartao de resposta |
| `get_question_performance_for_quiz(quiz_id)` | Performance por questao |

## Views

| View | Descricao |
|------|-----------|
| `quiz_questions_legacy` | Compatibilidade: questoes multiple_choice |
| `user_available_answer_sheets` | Cartoes disponiveis por permissao |
| `class_stats` | Metricas agregadas por turma |
| `user_ranking` | Ranking global com posicao |

## Storage Buckets

| Bucket | Publico | Limite | Uso |
|--------|---------|--------|-----|
| `essays` | Nao | - | Redacoes dos alunos |
| `course_materials` | Sim | 50 MB | Materiais de curso |
| `course-covers` | Sim | - | Capas de cursos |
| `community-attachments` | Sim | 25 MB | Anexos da comunidade |
| `question-images` | Sim | 10 MB | Imagens de questoes |

## Dados Atuais (2026-03-15)

| Metrica | Quantidade |
|---------|-----------|
| Quiz Questions | ~3,877 |
| Flashcards | ~4,995 |
| Acervo Items | 133 (427 MB) |
| Subjects | 14+ |
| Topics | 60+ |
| Achievements | 45+ |
| Videos (Panda) | 555 |
| Cursos (MemberKit) | 21 |
| Turmas (MemberKit) | 51 |
