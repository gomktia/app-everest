# Rotas da Aplicacao

Arquivo principal: `src/App.tsx`

## Rotas Publicas

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/` | Index.tsx | Homepage/landing |
| `/login` | Login.tsx | Login (email/senha + magic link) |
| `/register` | → /login | Redireciona para login |
| `/forgot-password` | → /login | Redireciona para login |
| `/reset-password` | ResetPassword.tsx | Redefinir senha |

## Rotas do Aluno (Protegidas)

### Cursos e Aulas

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/courses` | MyCoursesPage.tsx | Grid de cursos matriculados |
| `/meus-cursos` | MyCoursesPage.tsx | Alias para /courses |
| `/courses/:courseId` | CourseDetailPage.tsx | Modulos em accordion |
| `/courses/:courseId/lessons/:lessonId` | LessonPlayerPage.tsx | Player Panda Video + sidebar |
| `/meus-cursos/:courseId/lesson/:lessonId` | LessonPlayerPage.tsx | Alias para lesson player |

### Flashcards

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/flashcards` | Flashcards.tsx | Grid de materias |
| `/flashcards/:subjectId` | FlashcardTopics.tsx | Topicos da materia |
| `/flashcards/:subjectId/:topicId/study` | FlashcardStudyPage.tsx | Modo estudo |
| `/flashcards/session/:sessionId/result` | FlashcardSessionResult.tsx | Resultado da sessao |
| `/meus-conjuntos` | MyFlashcardSets.tsx | Conjuntos do usuario |
| `/conjuntos/novo` | FlashcardSetEditor.tsx | Criar conjunto |
| `/conjuntos/:setId/editar` | FlashcardSetEditor.tsx | Editar conjunto |
| `/conjuntos/:setId/colaboradores` | FlashcardSetCollaborators.tsx | Colaboradores do conjunto |
| `/conjuntos/:setId/estudo-em-grupo` | GroupStudyLobby.tsx | Lobby estudo em grupo |
| `/estudo-em-grupo/:sessionId` | GroupStudySession.tsx | Sessao ativa em grupo |

### Quizzes

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/quizzes` | Quizzes.tsx | Lista de materias |
| `/quizzes/:subjectId` | QuizTopics.tsx | Topicos do quiz |
| `/quiz/:quizId` | QuizPlayerPage.tsx | Resolver quiz |
| `/quiz/:quizId/results` | QuizResultSummaryPage.tsx | Resultados do quiz |

### Redacoes

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/redacoes` | Essays.tsx | Lista de redacoes |
| `/redacoes/nova` | EssaySubmission.tsx | Submeter redacao |
| `/redacoes/:essayId` | EssayDetails.tsx | Feedback e detalhes |
| `/redacoes/:essayId/report` | EssayReportPage.tsx | Relatorio de analise |
| `/redacoes/evolucao` | EssayEvolutionReportPage.tsx | Evolucao ao longo do tempo |

### Simulados

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/simulados` | Simulations.tsx | Lista de simulados |
| `/simulados/:simulationId` | SimulationExam.tsx | Prova simulada |
| `/simulados/:simulationId/resultado` | SimulationResults.tsx | Resultado do simulado |

### Cartoes de Resposta

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/cartoes-resposta` | AnswerSheetsListPage.tsx | Lista de cartoes |
| `/cartao-resposta/:sheetId` | AnswerSheetFillPage.tsx | Preencher cartao |
| `/cartao-resposta/:sheetId/resultado` | AnswerSheetResultPage.tsx | Resultado |

### Banco de Questoes e Acervo

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/banco-de-questoes` | QuestionBank.tsx | Banco de questoes com filtros |
| `/acervo` | AcervoDigital.tsx | Biblioteca digital (PDFs) |

### Evercast (Audio)

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/evercast` | Evercast.tsx | Lista de audio-aulas |
| `/evercast/curso/:courseId` | EvercastAlbumPage.tsx | Aulas de um curso |
| `/evercast/:audioId` | AudioLessonPlayerPage.tsx | Player de audio |

### Comunidade

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/comunidade` | CommunityPage.tsx | Espacos da comunidade |
| `/comunidade/:spaceSlug` | SpaceFeedPage.tsx | Feed de posts |
| `/comunidade/post/:postId` | PostDetailPage.tsx | Detalhe do post |
| `/comunidade/moderacao` | ModerationPage.tsx | Painel de moderacao |
| `/forum` | → /comunidade | Redirect legado |

### Gamificacao e Progresso

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/dashboard` | StudentDashboard.tsx | Dashboard do aluno |
| `/ranking` | Ranking.tsx | Ranking/leaderboard |
| `/achievements` | Achievements.tsx | Conquistas e badges |
| `/progresso` | Progress.tsx | Progresso geral |
| `/progresso/historico-flashcards` | FlashcardSessionHistory.tsx | Historico de sessoes |
| `/study-planner` | StudyPlannerPage.tsx | Plano de estudos + Pomodoro |
| `/calendario` | Calendar.tsx | Calendario de eventos |
| `/anotacoes` | MyNotesPage.tsx | Minhas anotacoes |

### Conta e Informacoes

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/configuracoes` | Settings.tsx | Configuracoes do usuario |
| `/notificacoes` | Notifications.tsx | Central de notificacoes |
| `/faq` | Faq.tsx | Perguntas frequentes |
| `/contato` | Contact.tsx | Formulario de contato |
| `/termos` | Terms.tsx | Termos de uso |
| `/privacidade` | Privacy.tsx | Politica de privacidade |

## Rotas do Professor

Professores acessam todas as rotas do aluno mais as rotas de conteudo do admin (cursos, quizzes, flashcards, redacoes, simulados, questoes, calendario, evercast).

Dashboard proprio: `TeacherDashboard.tsx`

## Rotas do Admin

### Dashboard e Sistema

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/admin` | Dashboard.tsx | Dashboard com KPIs e alertas |
| `/admin/system-control` | AdminSystemControlPage.tsx | Diagnostico, stats do banco, cache |
| `/admin/reports` | AdminReportsPage.tsx | Relatorios e analytics |
| `/admin/settings` | AdminSettingsPage.tsx | Configuracoes do sistema |

### Usuarios e Turmas

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/admin/management` | AdminManagementPage.tsx | Gestao de usuarios e turmas (tabs) |
| `/admin/users/:userId/edit` | AdminUserFormPage.tsx | Editar usuario |
| `/admin/users/:userId/classes` | AdminStudentClassesPage.tsx | Turmas do aluno |
| `/admin/classes` | AdminClassesPage.tsx | Lista de turmas |
| `/admin/classes/new` | AdminClassFormPage.tsx | Criar turma |
| `/admin/classes/:classId/edit` | AdminClassFormPage.tsx | Editar turma |
| `/admin/classes/:classId/students` | AdminClassStudentsPage.tsx | Alunos da turma |
| `/admin/permissions` | AdminClassPermissionsPage.tsx | Permissoes por turma |
| `/admin/gamification` | AdminGamificationPage.tsx | Conquistas e pontuacao |

### Cursos (Admin + Professor)

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/admin/courses` | AdminCoursesPage.tsx | Lista de cursos |
| `/admin/courses/new` | AdminCourseEditorPage.tsx | Criar curso |
| `/admin/courses/:courseId/edit` | AdminCourseEditorPage.tsx | Editar curso |
| `/admin/courses/:courseId/content` | AdminCourseEditorPage.tsx | Conteudo do curso |
| `/admin/courses/:courseId/classes` | AdminCourseClassesPage.tsx | Turmas do curso |

### Flashcards (Admin + Professor)

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/admin/flashcards` | AdminFlashcardsPage.tsx | Materias |
| `/admin/flashcards/new` | AdminSubjectFormPage.tsx | Criar materia |
| `/admin/flashcards/:subjectId` | AdminFlashcardTopicsPage.tsx | Topicos |
| `/admin/flashcards/:subjectId/edit` | AdminSubjectFormPage.tsx | Editar materia |
| `/admin/flashcards/:subjectId/topics/new` | AdminTopicFormPage.tsx | Criar topico |
| `/admin/flashcards/:subjectId/topics/:topicId/edit` | AdminTopicFormPage.tsx | Editar topico |
| `/admin/flashcards/:subjectId/:topicId` | AdminFlashcardsManagementPage.tsx | Gerenciar cards |

### Quizzes (Admin + Professor)

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/admin/quizzes` | AdminQuizzesPage.tsx | Lista de quizzes |
| `/admin/quizzes/new` | AdminQuizFormPage.tsx | Criar quiz |
| `/admin/quizzes/:quizId/edit` | AdminQuizFormPage.tsx | Editar quiz |
| `/admin/quizzes/:quizId/questions` | AdminQuizQuestionsPage.tsx | Questoes do quiz |
| `/admin/quizzes/:quizId/reports` | AdminQuizReportsPage.tsx | Analytics do quiz |

### Simulados (Admin + Professor)

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/admin/simulations` | AdminSimulationsPage.tsx | Lista de simulados |
| `/admin/simulations/new` | AdminSimulationFormPage.tsx | Criar simulado |
| `/admin/simulations/:simulationId/edit` | AdminSimulationFormPage.tsx | Editar simulado |
| `/admin/simulations/:simulationId/reports` | AdminSimulationReportsPage.tsx | Analytics |

### Questoes (Admin + Professor)

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/admin/questions` | AdminQuestionsPage.tsx | Banco de questoes |
| `/admin/questions/new` | AdminQuestionFormPage.tsx | Criar questao |
| `/admin/questions/:questionId/edit` | AdminQuestionFormPage.tsx | Editar questao |

### Redacoes (Admin + Professor)

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/admin/essays` | AdminEssaysPage.tsx | Temas de redacao |
| `/admin/essays/new` | AdminEssayFormPage.tsx | Criar tema |
| `/admin/essays/:promptId/edit` | AdminEssayFormPage.tsx | Editar tema |
| `/admin/essays/:promptId/submissions` | AdminEssaySubmissionsPage.tsx | Submissoes |
| `/admin/essays/submissions/:submissionId` | AdminEssayCorrectionPage.tsx | Corrigir redacao |
| `/admin/essays/compare` | AdminEssayComparisonPage.tsx | Comparar redacoes |
| `/admin/essays/settings` | AdminEssaySettingsPage.tsx | Criterios de avaliacao |

### Calendario e Evercast (Admin + Professor)

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/admin/calendar` | AdminCalendarPage.tsx | Eventos |
| `/admin/evercast` | AdminEvercastPage.tsx | Audio-aulas |
| `/admin/evercast/new` | AdminEvercastFormPage.tsx | Criar audio-aula |
| `/admin/evercast/:evercastId/edit` | AdminEvercastFormPage.tsx | Editar audio-aula |

### Acervo e Integracoes (Admin Only)

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/admin/acervo` | AdminAcervoPage.tsx | Biblioteca digital (PDFs) |
| `/admin/integrations` | AdminIntegrationsPage.tsx | Status das integracoes |
| `/admin/integrations/memberkit-import` | MemberkitImportPage.tsx | Import MemberKit |
