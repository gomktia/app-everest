-- ============================================================
-- Fix ALL 25 foreign keys that block user deletion
-- Generated from pg_constraint query on production DB
-- ============================================================

-- CASCADE: user's own data (deletes with user)
-- SET NULL: audit/reference columns (preserve records)

-- 1. student_classes.user_id → CASCADE
ALTER TABLE student_classes DROP CONSTRAINT IF EXISTS student_classes_user_id_fkey;
ALTER TABLE student_classes ADD CONSTRAINT student_classes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 2. essays.student_id → CASCADE
ALTER TABLE essays DROP CONSTRAINT IF EXISTS essays_student_id_fkey;
ALTER TABLE essays ADD CONSTRAINT essays_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 3. essays.teacher_id → SET NULL
ALTER TABLE essays DROP CONSTRAINT IF EXISTS essays_teacher_id_fkey;
ALTER TABLE essays ADD CONSTRAINT essays_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- 4. affiliates.user_id → CASCADE
ALTER TABLE affiliates DROP CONSTRAINT IF EXISTS affiliates_user_id_fkey;
ALTER TABLE affiliates ADD CONSTRAINT affiliates_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 5. orders.user_id → SET NULL (preserve financial records)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- 6. refunds.admin_user_id → SET NULL
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_admin_user_id_fkey;
ALTER TABLE refunds ADD CONSTRAINT refunds_admin_user_id_fkey
  FOREIGN KEY (admin_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- 7. quizzes.created_by → SET NULL
ALTER TABLE quizzes DROP CONSTRAINT IF EXISTS quizzes_created_by_fkey;
ALTER TABLE quizzes ADD CONSTRAINT quizzes_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 8. import_jobs.created_by → SET NULL
ALTER TABLE import_jobs DROP CONSTRAINT IF EXISTS import_jobs_created_by_fkey;
ALTER TABLE import_jobs ADD CONSTRAINT import_jobs_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 9. community_comments (forum_posts_user_id_fkey) → CASCADE
ALTER TABLE community_comments DROP CONSTRAINT IF EXISTS forum_posts_user_id_fkey;
ALTER TABLE community_comments ADD CONSTRAINT forum_posts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 10. community_posts (forum_topics_user_id_fkey) → CASCADE
ALTER TABLE community_posts DROP CONSTRAINT IF EXISTS forum_topics_user_id_fkey;
ALTER TABLE community_posts ADD CONSTRAINT forum_topics_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 11. community_spaces.created_by → SET NULL
ALTER TABLE community_spaces DROP CONSTRAINT IF EXISTS community_spaces_created_by_fkey;
ALTER TABLE community_spaces ADD CONSTRAINT community_spaces_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 12. community_posts.resolved_by → SET NULL
ALTER TABLE community_posts DROP CONSTRAINT IF EXISTS community_posts_resolved_by_fkey;
ALTER TABLE community_posts ADD CONSTRAINT community_posts_resolved_by_fkey
  FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 13. community_mutes.muted_by → CASCADE
ALTER TABLE community_mutes DROP CONSTRAINT IF EXISTS community_mutes_muted_by_fkey;
ALTER TABLE community_mutes ADD CONSTRAINT community_mutes_muted_by_fkey
  FOREIGN KEY (muted_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 14. community_reports.reviewed_by (auth ref) → SET NULL
ALTER TABLE community_reports DROP CONSTRAINT IF EXISTS community_reports_reviewed_by_fkey;
ALTER TABLE community_reports ADD CONSTRAINT community_reports_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 15. community_reports.reviewed_by (users ref) → SET NULL
ALTER TABLE community_reports DROP CONSTRAINT IF EXISTS community_reports_reviewed_by_users_fkey;
ALTER TABLE community_reports ADD CONSTRAINT community_reports_reviewed_by_users_fkey
  FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 16. community_word_filter.created_by → SET NULL
ALTER TABLE community_word_filter DROP CONSTRAINT IF EXISTS community_word_filter_created_by_fkey;
ALTER TABLE community_word_filter ADD CONSTRAINT community_word_filter_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 17. correction_templates.created_by → SET NULL
ALTER TABLE correction_templates DROP CONSTRAINT IF EXISTS correction_templates_created_by_fkey;
ALTER TABLE correction_templates ADD CONSTRAINT correction_templates_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 18. essay_competency_scores.created_by → SET NULL
ALTER TABLE essay_competency_scores DROP CONSTRAINT IF EXISTS essay_competency_scores_created_by_fkey;
ALTER TABLE essay_competency_scores ADD CONSTRAINT essay_competency_scores_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 19. essay_content_analysis.created_by → SET NULL
ALTER TABLE essay_content_analysis DROP CONSTRAINT IF EXISTS essay_content_analysis_created_by_fkey;
ALTER TABLE essay_content_analysis ADD CONSTRAINT essay_content_analysis_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 20. essay_expression_errors.created_by → SET NULL
ALTER TABLE essay_expression_errors DROP CONSTRAINT IF EXISTS essay_expression_errors_created_by_fkey;
ALTER TABLE essay_expression_errors ADD CONSTRAINT essay_expression_errors_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 21. essay_structure_analysis.created_by → SET NULL
ALTER TABLE essay_structure_analysis DROP CONSTRAINT IF EXISTS essay_structure_analysis_created_by_fkey;
ALTER TABLE essay_structure_analysis ADD CONSTRAINT essay_structure_analysis_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 22. ai_provider_configs.created_by → SET NULL
ALTER TABLE ai_provider_configs DROP CONSTRAINT IF EXISTS ai_provider_configs_created_by_fkey;
ALTER TABLE ai_provider_configs ADD CONSTRAINT ai_provider_configs_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 23. job_queue.created_by → SET NULL
ALTER TABLE job_queue DROP CONSTRAINT IF EXISTS job_queue_created_by_fkey;
ALTER TABLE job_queue ADD CONSTRAINT job_queue_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 24. invites.created_by_user_id → SET NULL
ALTER TABLE invites DROP CONSTRAINT IF EXISTS invites_created_by_user_id_fkey;
ALTER TABLE invites ADD CONSTRAINT invites_created_by_user_id_fkey
  FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 25. system_settings.updated_by → SET NULL
ALTER TABLE system_settings DROP CONSTRAINT IF EXISTS system_settings_updated_by_fkey;
ALTER TABLE system_settings ADD CONSTRAINT system_settings_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 26. live_events.teacher_id — NOT NULL column, so keep RESTRICT but reassign before delete
-- (Cannot use SET NULL because column is NOT NULL)

-- ============================================================
-- Reassign data owned by test users to real users, then delete
-- ============================================================
DO $$
DECLARE
  v_real_teacher UUID := '0ffdbccb-6c79-4644-9701-adf2f2a579d6'; -- cursospreparatorios.everest@gmail.com
  v_real_admin UUID := '8b92eac6-af05-406f-8710-f1d65a688fdc';   -- geisonhoehr@gmail.com
  v_test_admin UUID;
  v_test_prof UUID;
BEGIN
  SELECT id INTO v_test_admin FROM auth.users WHERE email = 'admin@teste.com';
  SELECT id INTO v_test_prof FROM auth.users WHERE email = 'professor@teste.com';

  -- Reassign live_events to real teacher
  IF v_test_prof IS NOT NULL THEN
    UPDATE live_events SET teacher_id = v_real_teacher WHERE teacher_id = v_test_prof;
  END IF;
  IF v_test_admin IS NOT NULL THEN
    UPDATE live_events SET teacher_id = v_real_teacher WHERE teacher_id = v_test_admin;
  END IF;

  -- Reassign system_settings to real admin
  IF v_test_admin IS NOT NULL THEN
    UPDATE system_settings SET updated_by = v_real_admin WHERE updated_by = v_test_admin;
  END IF;

  -- Reassign video_courses created_by to real admin
  IF v_test_admin IS NOT NULL THEN
    UPDATE video_courses SET created_by_user_id = v_real_admin WHERE created_by_user_id = v_test_admin;
  END IF;
  IF v_test_prof IS NOT NULL THEN
    UPDATE video_courses SET created_by_user_id = v_real_teacher WHERE created_by_user_id = v_test_prof;
  END IF;

  -- Now delete test users (CASCADE + SET NULL will handle the rest)
  DELETE FROM auth.users WHERE email IN ('admin@teste.com', 'professor@teste.com');

  RAISE NOTICE 'Test users deleted successfully';
END $$;
