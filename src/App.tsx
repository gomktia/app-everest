import { Suspense, useEffect } from 'react'
import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AchievementNotificationContainer } from '@/components/achievements/AchievementNotification'
import { PWAUpdatePrompt } from '@/components/PWAUpdatePrompt'
import { InstallPWA } from '@/components/InstallPWA'
import { ThemeProvider } from '@/contexts/theme-provider'
import { AuthProvider } from '@/contexts/auth-provider'
import { ViewModeProvider } from '@/contexts/view-mode-context'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { PublicRoute } from '@/components/PublicRoute'
import { PageLoader } from '@/components/PageLoader'
import ErrorBoundary from '@/components/ErrorBoundary'

const Layout = lazy(() => import('@/components/Layout'))
const Index = lazy(() => import('@/pages/Index'))
const LoginPage = lazy(() => import('@/pages/Login'))
const ResetPasswordPage = lazy(() => import('@/pages/ResetPassword'))
const NotFound = lazy(() => import('@/pages/NotFound'))
const FaqPage = lazy(() => import('@/pages/Faq'))
const ContactPage = lazy(() => import('@/pages/Contact'))
const TermsPage = lazy(() => import('@/pages/Terms'))
const PrivacyPage = lazy(() => import('@/pages/Privacy'))

const DashboardPage = lazy(() => import('@/pages/Dashboard'))

const CalendarPage = lazy(() => import('@/pages/Calendar'))
const ProgressPage = lazy(() => import('@/pages/Progress'))
const EssaysPage = lazy(() => import('@/pages/Essays'))
const EssaySubmissionPage = lazy(() => import('@/pages/EssaySubmission'))
const EssayDetailsPage = lazy(() => import('@/pages/EssayDetails'))
const EssayReportPage = lazy(() => import('@/pages/EssayReportPage'))
const EssayEvolutionReportPage = lazy(
  () => import('@/pages/EssayEvolutionReportPage'),
)
const SimulationsPage = lazy(() => import('@/pages/Simulations'))
const SimulationExamPage = lazy(() => import('@/pages/SimulationExam'))
const SimulationResultsPage = lazy(() => import('@/pages/SimulationResults'))
const AnswerSheetsListPage = lazy(() => import('@/pages/AnswerSheetsListPage'))
const AnswerSheetFillPage = lazy(() => import('@/pages/AnswerSheetFillPage'))
const AnswerSheetResultPage = lazy(() => import('@/pages/AnswerSheetResultPage'))
const CommunityPage = lazy(() => import('@/pages/community/CommunityPage'))
const SpaceFeedPage = lazy(() => import('@/pages/community/SpaceFeedPage'))
const PostDetailPage = lazy(() => import('@/pages/community/PostDetailPage'))
const ModerationPage = lazy(() => import('@/pages/community/ModerationPage'))
const SettingsPage = lazy(() => import('@/pages/Settings'))
const FlashcardsPage = lazy(() => import('@/pages/Flashcards'))
const FlashcardTopicsPage = lazy(() => import('@/pages/FlashcardTopics'))
const FlashcardStudyPage = lazy(() => import('@/pages/FlashcardStudyPage'))
const FlashcardSessionResultPage = lazy(
  () => import('@/pages/FlashcardSessionResult'),
)
const QuizzesPage = lazy(() => import('@/pages/Quizzes'))
const QuizTopicsPage = lazy(() => import('@/pages/QuizTopics'))
const EvercastPage = lazy(() => import('@/pages/Evercast'))
const EvercastAlbumPage = lazy(() => import('@/pages/EvercastAlbumPage'))
const QuestionBankPage = lazy(() => import('@/pages/QuestionBank'))
const AcervoDigitalPage = lazy(() => import('@/pages/AcervoDigital'))
const MyFlashcardSetsPage = lazy(() => import('@/pages/MyFlashcardSets'))
const FlashcardSetEditorPage = lazy(() => import('@/pages/FlashcardSetEditor'))
const FlashcardSetCollaboratorsPage = lazy(
  () => import('@/pages/FlashcardSetCollaborators'),
)
const GroupStudyLobbyPage = lazy(() => import('@/pages/GroupStudyLobby'))
const GroupStudySessionPage = lazy(() => import('@/pages/GroupStudySession'))
const NotificationsPage = lazy(() => import('@/pages/Notifications'))
const QuizPlayerPage = lazy(() => import('@/pages/QuizPlayerPage'))
const QuizResultSummaryPage = lazy(
  () => import('@/pages/QuizResultSummaryPage'),
)
const FlashcardSessionHistoryPage = lazy(
  () => import('@/pages/FlashcardSessionHistory'),
)
const RankingPage = lazy(() => import('@/pages/Ranking'))
const AchievementsPage = lazy(() => import('@/pages/Achievements'))
const StudyPlannerPage = lazy(() => import('@/pages/StudyPlannerPage'))
const MindMapsPage = lazy(() => import('@/pages/MindMapsPage'))

const LiveEventsPage = lazy(() => import('@/pages/LiveEvents'))
const LivePlayerPage = lazy(() => import('@/pages/LivePlayer'))

const AdminLayout = lazy(() => import('@/components/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'))
const AdminManagementPage = lazy(
  () => import('@/pages/admin/management/AdminManagementPage'),
)
const AdminUserFormPage = lazy(
  () => import('@/pages/admin/users/AdminUserFormPage'),
)
const AdminCoursesPage = lazy(
  () => import('@/pages/admin/courses/AdminCoursesPage'),
)
const AdminCourseEditorPage = lazy(
  () => import('@/pages/admin/courses/AdminCourseEditorPage'),
)
const AdminCourseClassesPage = lazy(
  () => import('@/pages/admin/courses/AdminCourseClassesPage'),
)
const AdminAcervoPage = lazy(
  () => import('@/pages/admin/acervo/AdminAcervoPage'),
)
const AdminFlashcardsPage = lazy(
  () => import('@/pages/admin/flashcards/AdminFlashcardsPage'),
)
const AdminFlashcardTopicsPage = lazy(
  () => import('@/pages/admin/flashcards/AdminFlashcardTopicsPage'),
)
const AdminFlashcardsManagementPage = lazy(
  () => import('@/pages/admin/flashcards/AdminFlashcardsManagementPage'),
)
const AdminSubjectFormPage = lazy(
  () => import('@/pages/admin/flashcards/AdminSubjectFormPage'),
)
const AdminTopicFormPage = lazy(
  () => import('@/pages/admin/flashcards/AdminTopicFormPage'),
)
const AdminQuizzesPage = lazy(
  () => import('@/pages/admin/quizzes/AdminQuizzesPage'),
)
const AdminQuizFormPage = lazy(
  () => import('@/pages/admin/quizzes/AdminQuizFormPage'),
)
const AdminQuizQuestionsPage = lazy(
  () => import('@/pages/admin/quizzes/AdminQuizQuestionsPage'),
)
const AdminQuizReportsPage = lazy(
  () => import('@/pages/admin/quizzes/AdminQuizReportsPage'),
)
const AdminSimulationsPage = lazy(
  () => import('@/pages/admin/simulations/AdminSimulationsPage'),
)
const AdminSimulationFormPage = lazy(
  () => import('@/pages/admin/simulations/AdminSimulationFormPage'),
)
const AdminSimulationReportsPage = lazy(
  () => import('@/pages/admin/simulations/AdminSimulationReportsPage'),
)
const AdminQuestionsPage = lazy(
  () => import('@/pages/admin/questions/AdminQuestionsPage'),
)
const AdminQuestionFormPage = lazy(
  () => import('@/pages/admin/questions/AdminQuestionFormPage'),
)
const AdminCalendarPage = lazy(
  () => import('@/pages/admin/calendar/AdminCalendarPage'),
)
const AdminBroadcastPage = lazy(
  () => import('@/pages/admin/AdminBroadcastPage'),
)
const AdminLiveEventsPage = lazy(
  () => import('@/pages/admin/lives/AdminLiveEventsPage'),
)
const AdminEvercastPage = lazy(
  () => import('@/pages/admin/evercast/AdminEvercastPage'),
)
const AdminEvercastFormPage = lazy(
  () => import('@/pages/admin/evercast/AdminEvercastFormPage'),
)
const AdminEssaysPage = lazy(
  () => import('@/pages/admin/essays/AdminEssaysPage'),
)
const AdminEssayFormPage = lazy(
  () => import('@/pages/admin/essays/AdminEssayFormPage'),
)
const AdminEssaySubmissionsPage = lazy(
  () => import('@/pages/admin/essays/AdminEssaySubmissionsPage'),
)
const AdminEssayCorrectionPage = lazy(
  () => import('@/pages/admin/essays/AdminEssayCorrectionPage'),
)
const AdminEssaySettingsPage = lazy(
  () => import('@/pages/admin/essays/AdminEssaySettingsPage'),
)
const AdminEssayComparisonPage = lazy(
  () => import('@/pages/admin/essays/AdminEssayComparisonPage'),
)
const AdminEssayPromptsPage = lazy(
  () => import('@/pages/admin/essays/AdminEssayPromptsPage'),
)
const AdminReportsPage = lazy(
  () => import('@/pages/admin/reports/AdminReportsPage'),
)
const VideoAnalyticsPage = lazy(
  () => import('@/pages/admin/reports/VideoAnalyticsPage'),
)
const AdminSettingsPage = lazy(
  () => import('@/pages/admin/settings/AdminSettingsPage'),
)
const AdminClassPermissionsPage = lazy(
  () => import('@/pages/admin/permissions/AdminClassPermissionsPage'),
)
const AdminClassesPage = lazy(
  () => import('@/pages/admin/classes/AdminClassesPage'),
)
const AdminGamificationPage = lazy(
  () => import('@/pages/admin/gamification/AdminGamificationPage'),
)
const AdminClassStudentsPage = lazy(
  () => import('@/pages/admin/classes/AdminClassStudentsPage'),
)
const AdminClassFormPage = lazy(
  () => import('@/pages/admin/classes/AdminClassFormPage'),
)
const AdminStudentClassesPage = lazy(
  () => import('@/pages/admin/users/AdminStudentClassesPage'),
)
const AdminUserProfilePage = lazy(
  () => import('@/pages/admin/users/AdminUserProfilePage'),
)
const AdminInvitesPage = lazy(
  () => import('@/pages/admin/invites/AdminInvitesPage'),
)
const AdminInviteFormPage = lazy(
  () => import('@/pages/admin/invites/AdminInviteFormPage'),
)
const TrialClassWizard = lazy(
  () => import('@/pages/admin/invites/TrialClassWizard'),
)
const InvitePage = lazy(
  () => import('@/pages/public/InvitePage'),
)
const MemberkitImportPage = lazy(
  () => import('@/pages/admin/integrations/MemberkitImportPage'),
)
const AdminIntegrationsPage = lazy(
  () => import('@/pages/admin/integrations/AdminIntegrationsPage'),
)
const AdminKiwifyProductsPage = lazy(
  () => import('@/pages/admin/integrations/AdminKiwifyProductsPage'),
)
const FinancialDashboardPage = lazy(
  () => import('@/pages/admin/financeiro/FinancialDashboardPage'),
)
const SalesListPage = lazy(
  () => import('@/pages/admin/financeiro/SalesListPage'),
)
const CouponsPage = lazy(
  () => import('@/pages/admin/financeiro/CouponsPage'),
)
const AffiliatesPage = lazy(
  () => import('@/pages/admin/financeiro/AffiliatesPage'),
)
const FinancialReportsPage = lazy(
  () => import('@/pages/admin/financeiro/ReportsPage'),
)
const StripeProductsPage = lazy(
  () => import('@/pages/admin/financeiro/StripeProductsPage'),
)
const AudioLessonPlayerPage = lazy(
  () => import('@/pages/AudioLessonPlayerPage'),
)
const MyCoursesPage = lazy(
  () => import('@/pages/courses/MyCoursesPage'),
)
const CourseDetailPage = lazy(
  () => import('@/pages/courses/CourseDetailPage'),
)
const LessonPlayerPage = lazy(
  () => import('@/pages/courses/LessonPlayerPage'),
)
const MyNotesPage = lazy(
  () => import('@/pages/MyNotesPage'),
)
const CheckoutPage = lazy(
  () => import('@/pages/checkout/CheckoutPage'),
)
const CheckoutSuccessPage = lazy(
  () => import('@/pages/checkout/CheckoutSuccessPage'),
)

// Remove initial loader once React has rendered
function RemoveInitialLoader() {
  useEffect(() => {
    const loader = document.getElementById('initial-loader')
    if (loader) {
      loader.style.transition = 'opacity 0.2s'
      loader.style.opacity = '0'
      setTimeout(() => loader.remove(), 200)
    }
  }, [])
  return null
}

const App = () => (
  <ErrorBoundary>
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <AuthProvider>
          <ViewModeProvider>
          <TooltipProvider>
          <RemoveInitialLoader />
          <Toaster />
          <Sonner />
          <PWAUpdatePrompt />
          <InstallPWA />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route element={<PublicRoute />}>
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<Navigate to="/login" replace />} />
                <Route path="/forgot-password" element={<Navigate to="/login" replace />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/invite/:slug" element={<InvitePage />} />
              </Route>

              {/* Checkout routes — accessible without login (for recovery links) */}
              <Route path="/checkout/sucesso" element={<CheckoutSuccessPage />} />
              <Route path="/checkout/:slug" element={<CheckoutPage />} />

              <Route
                element={
                  <ProtectedRoute allowedRoles={['student', 'teacher', 'administrator']} />
                }
              >
                {/* Lesson player renders WITHOUT main sidebar for immersive experience */}
                <Route
                  path="/courses/:courseId/lessons/:lessonId"
                  element={<LessonPlayerPage />}
                />
                <Route
                  path="/meus-cursos/:courseId/lesson/:lessonId"
                  element={<LessonPlayerPage />}
                />

                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/meus-cursos" element={<MyCoursesPage />} />
                  <Route path="/courses" element={<MyCoursesPage />} />
                  <Route
                    path="/courses/:courseId"
                    element={<CourseDetailPage />}
                  />
                  <Route
                    path="/meus-cursos/:courseId"
                    element={<CourseDetailPage />}
                  />
                  <Route path="/anotacoes" element={<MyNotesPage />} />
                  <Route path="/calendario" element={<CalendarPage />} />
                  <Route path="/flashcards" element={<FlashcardsPage />} />
                  <Route
                    path="/flashcards/:subjectId"
                    element={<FlashcardTopicsPage />}
                  />
                  <Route
                    path="/flashcards/:subjectId/:topicId/study"
                    element={<FlashcardStudyPage />}
                  />
                  <Route
                    path="/flashcards/session/:sessionId/result"
                    element={<FlashcardSessionResultPage />}
                  />
                  <Route
                    path="/meus-conjuntos"
                    element={<MyFlashcardSetsPage />}
                  />
                  <Route
                    path="/conjuntos/novo"
                    element={<FlashcardSetEditorPage />}
                  />
                  <Route
                    path="/conjuntos/:setId/editar"
                    element={<FlashcardSetEditorPage />}
                  />
                  <Route
                    path="/conjuntos/:setId/colaboradores"
                    element={<FlashcardSetCollaboratorsPage />}
                  />
                  <Route
                    path="/conjuntos/:setId/estudo-em-grupo"
                    element={<GroupStudyLobbyPage />}
                  />
                  <Route
                    path="/estudo-em-grupo/:sessionId"
                    element={<GroupStudySessionPage />}
                  />
                  <Route path="/quizzes" element={<QuizzesPage />} />
                  <Route
                    path="/quizzes/:subjectId"
                    element={<QuizTopicsPage />}
                  />
                  <Route path="/quiz/:quizId" element={<QuizPlayerPage />} />
                  <Route
                    path="/quiz/:quizId/results"
                    element={<QuizResultSummaryPage />}
                  />
                  <Route path="/evercast" element={<EvercastPage />} />
                  <Route path="/lives" element={<LiveEventsPage />} />
                  <Route path="/lives/:liveId" element={<LivePlayerPage />} />
                  <Route
                    path="/evercast/curso/:courseId"
                    element={<EvercastAlbumPage />}
                  />
                  <Route
                    path="/evercast/:audioId"
                    element={<AudioLessonPlayerPage />}
                  />
                  <Route path="/progresso" element={<ProgressPage />} />
                  <Route
                    path="/progresso/historico-flashcards"
                    element={<FlashcardSessionHistoryPage />}
                  />
                  <Route path="/redacoes" element={<EssaysPage />} />
                  <Route
                    path="/redacoes/nova"
                    element={<EssaySubmissionPage />}
                  />
                  <Route
                    path="/redacoes/:essayId"
                    element={<EssayDetailsPage />}
                  />
                  <Route
                    path="/redacoes/:essayId/report"
                    element={<EssayReportPage />}
                  />
                  <Route
                    path="/redacoes/evolucao"
                    element={<EssayEvolutionReportPage />}
                  />
                  <Route path="/simulados" element={<SimulationsPage />} />
                  <Route
                    path="/simulados/:simulationId"
                    element={<SimulationExamPage />}
                  />
                  <Route
                    path="/simulados/:simulationId/resultado"
                    element={<SimulationResultsPage />}
                  />
                  <Route path="/cartoes-resposta" element={<AnswerSheetsListPage />} />
                  <Route
                    path="/cartao-resposta/:sheetId"
                    element={<AnswerSheetFillPage />}
                  />
                  <Route
                    path="/cartao-resposta/:sheetId/resultado"
                    element={<AnswerSheetResultPage />}
                  />
                  <Route
                    path="/banco-de-questoes"
                    element={<QuestionBankPage />}
                  />
                  <Route path="/acervo" element={<AcervoDigitalPage />} />
                  <Route path="/comunidade" element={<CommunityPage />} />
                  <Route path="/comunidade/post/:postId" element={<PostDetailPage />} />
                  <Route path="/comunidade/:spaceSlug" element={<SpaceFeedPage />} />
                  <Route path="/comunidade/moderacao" element={<ModerationPage />} />
                  <Route path="/forum" element={<Navigate to="/comunidade" replace />} />
                  <Route path="/forum/:topicId" element={<Navigate to="/comunidade" replace />} />
                  <Route path="/configuracoes" element={<SettingsPage />} />
                  <Route path="/notificacoes" element={<NotificationsPage />} />
                  <Route path="/ranking" element={<RankingPage />} />
                  <Route path="/conquistas" element={<AchievementsPage />} />
                  <Route path="/achievements" element={<Navigate to="/conquistas" replace />} />
                  <Route path="/plano-de-estudos" element={<StudyPlannerPage />} />
                  <Route path="/mapas-mentais" element={<MindMapsPage />} />
                  <Route path="/study-planner" element={<Navigate to="/plano-de-estudos" replace />} />
                  <Route path="/faq" element={<FaqPage />} />
                  <Route path="/contato" element={<ContactPage />} />
                  <Route path="/termos" element={<TermsPage />} />
                  <Route path="/privacidade" element={<PrivacyPage />} />
                </Route>
              </Route>

              {/* ROTAS ADMIN (administrator + teacher) */}
              <Route
                element={
                  <ProtectedRoute allowedRoles={['administrator', 'teacher']} />
                }
              >
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  {/* Rotas exclusivas de administrator */}
                  <Route element={<ProtectedRoute allowedRoles={['administrator']} />}>
                    <Route path="permissions" element={<AdminClassPermissionsPage />} />
                    <Route path="integrations" element={<AdminIntegrationsPage />} />
                    <Route path="integrations/memberkit-import" element={<MemberkitImportPage />} />
                    <Route path="integrations/kiwify" element={<AdminKiwifyProductsPage />} />
                    <Route path="settings" element={<AdminSettingsPage />} />
                    <Route path="invites" element={<AdminInvitesPage />} />
                    <Route path="invites/new" element={<AdminInviteFormPage />} />
                    <Route path="invites/:inviteId/edit" element={<AdminInviteFormPage />} />
                    <Route path="convites/novo" element={<TrialClassWizard />} />
                    <Route path="turmas/wizard" element={<TrialClassWizard />} />
                    <Route path="broadcast" element={<AdminBroadcastPage />} />
                    <Route path="courses" element={<AdminCoursesPage />} />
                    <Route path="courses/new" element={<AdminCourseEditorPage />} />
                    <Route path="courses/:courseId/edit" element={<AdminCourseEditorPage />} />
                    <Route path="courses/:courseId/content" element={<AdminCourseEditorPage />} />
                    <Route path="courses/:courseId/classes" element={<AdminCourseClassesPage />} />
                    <Route path="flashcards" element={<AdminFlashcardsPage />} />
                    <Route path="flashcards/new" element={<AdminSubjectFormPage />} />
                    <Route path="flashcards/:subjectId" element={<AdminFlashcardTopicsPage />} />
                    <Route path="flashcards/:subjectId/edit" element={<AdminSubjectFormPage />} />
                    <Route path="flashcards/:subjectId/topics/new" element={<AdminTopicFormPage />} />
                    <Route path="flashcards/:subjectId/topics/:topicId/edit" element={<AdminTopicFormPage />} />
                    <Route path="flashcards/:subjectId/:topicId" element={<AdminFlashcardsManagementPage />} />
                    <Route path="quizzes" element={<AdminQuizzesPage />} />
                    <Route path="quizzes/new" element={<AdminQuizFormPage />} />
                    <Route path="quizzes/:quizId/edit" element={<AdminQuizFormPage />} />
                    <Route path="quizzes/:quizId/questions" element={<AdminQuizQuestionsPage />} />
                    <Route path="quizzes/:quizId/reports" element={<AdminQuizReportsPage />} />
                    <Route path="simulations" element={<AdminSimulationsPage />} />
                    <Route path="simulations/new" element={<AdminSimulationFormPage />} />
                    <Route path="simulations/:simulationId/edit" element={<AdminSimulationFormPage />} />
                    <Route path="simulations/:simulationId/reports" element={<AdminSimulationReportsPage />} />
                    <Route path="lives" element={<AdminLiveEventsPage />} />
                    <Route path="questions" element={<AdminQuestionsPage />} />
                    <Route path="questions/new" element={<AdminQuestionFormPage />} />
                    <Route path="questions/:questionId/edit" element={<AdminQuestionFormPage />} />
                    <Route path="classes/new" element={<AdminClassFormPage />} />
                    <Route path="classes/:classId/edit" element={<AdminClassFormPage />} />
                    <Route path="users/:userId/edit" element={<AdminUserFormPage />} />
                    <Route path="acervo" element={<AdminAcervoPage />} />
                    <Route path="financeiro" element={<FinancialDashboardPage />} />
                    <Route path="financeiro/vendas" element={<SalesListPage />} />
                    <Route path="financeiro/cupons" element={<CouponsPage />} />
                    <Route path="financeiro/afiliados" element={<AffiliatesPage />} />
                    <Route path="financeiro/relatorios" element={<FinancialReportsPage />} />
                    <Route path="financeiro/produtos" element={<StripeProductsPage />} />
                  </Route>
                  {/* Rotas compartilhadas (administrator + teacher) */}
                  <Route path="management" element={<AdminManagementPage />} />
                  <Route path="classes" element={<AdminClassesPage />} />
                  <Route path="classes/:classId/students" element={<AdminClassStudentsPage />} />
                  <Route path="gamification" element={<AdminGamificationPage />} />
                  <Route path="users/:userId/classes" element={<AdminStudentClassesPage />} />
                  <Route path="users/:userId/profile" element={<AdminUserProfilePage />} />
                  <Route path="reports" element={<AdminReportsPage />} />
                  <Route path="reports/videos" element={<VideoAnalyticsPage />} />
                  <Route path="calendar" element={<AdminCalendarPage />} />
                  <Route path="evercast" element={<AdminEvercastPage />} />
                  <Route
                    path="evercast/new"
                    element={<AdminEvercastFormPage />}
                  />
                  <Route
                    path="evercast/:evercastId/edit"
                    element={<AdminEvercastFormPage />}
                  />
                  <Route path="essays" element={<AdminEssaysPage />} />
                  <Route path="essays/prompts" element={<AdminEssayPromptsPage />} />
                  <Route path="essays/new" element={<AdminEssayFormPage />} />
                  <Route
                    path="essays/:promptId/edit"
                    element={<AdminEssayFormPage />}
                  />
                  <Route
                    path="essays/turma/:classId"
                    element={<AdminEssaySubmissionsPage />}
                  />
                  <Route
                    path="essays/submissions/:submissionId"
                    element={<AdminEssayCorrectionPage />}
                  />
                  <Route
                    path="essays/compare"
                    element={<AdminEssayComparisonPage />}
                  />
                  <Route
                    path="essays/settings"
                    element={<AdminEssaySettingsPage />}
                  />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </TooltipProvider>
        <AchievementNotificationContainer />
        </ViewModeProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </ErrorBoundary>
)

export default App
