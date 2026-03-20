-- ============================================================
-- Community RLS: Filter spaces/posts/comments by class membership
-- ============================================================
-- Previously all community_spaces/posts/comments had USING (true)
-- for SELECT, meaning any authenticated user could see everything.
-- Now students only see spaces their class has access to (via
-- class_content_access), while admins/teachers see everything.
-- Uses get_auth_user_role() (SECURITY DEFINER) to avoid RLS recursion.
-- ============================================================

-- 1. Drop old permissive SELECT policies
DROP POLICY IF EXISTS "spaces_select" ON community_spaces;
DROP POLICY IF EXISTS "posts_select" ON community_posts;
DROP POLICY IF EXISTS "comments_select" ON community_comments;

-- 2. community_spaces: students see only spaces linked to their enrolled classes
CREATE POLICY "spaces_select" ON community_spaces
  FOR SELECT TO authenticated
  USING (
    -- Admins and teachers see all spaces
    get_auth_user_role() IN ('administrator', 'teacher')
    OR
    -- Students see spaces their class grants access to
    EXISTS (
      SELECT 1
      FROM public.class_content_access cca
      INNER JOIN public.student_classes sc ON sc.class_id = cca.class_id
      WHERE cca.content_type = 'community_space'
        AND cca.content_id = community_spaces.id::text
        AND sc.user_id = auth.uid()
    )
  );

-- 3. community_posts: students see posts in spaces they can access
CREATE POLICY "posts_select" ON community_posts
  FOR SELECT TO authenticated
  USING (
    get_auth_user_role() IN ('administrator', 'teacher')
    OR
    EXISTS (
      SELECT 1
      FROM public.class_content_access cca
      INNER JOIN public.student_classes sc ON sc.class_id = cca.class_id
      WHERE cca.content_type = 'community_space'
        AND cca.content_id = community_posts.space_id::text
        AND sc.user_id = auth.uid()
    )
  );

-- 4. community_comments: students see comments on posts in accessible spaces
CREATE POLICY "comments_select" ON community_comments
  FOR SELECT TO authenticated
  USING (
    get_auth_user_role() IN ('administrator', 'teacher')
    OR
    EXISTS (
      SELECT 1
      FROM public.community_posts cp
      INNER JOIN public.class_content_access cca ON cca.content_type = 'community_space'
        AND cca.content_id = cp.space_id::text
      INNER JOIN public.student_classes sc ON sc.class_id = cca.class_id
      WHERE cp.id = community_comments.post_id
        AND sc.user_id = auth.uid()
    )
  );

-- 5. Also restrict INSERT for posts/comments to accessible spaces only
-- (students should not be able to post in spaces they cannot see)

DROP POLICY IF EXISTS "posts_insert" ON community_posts;
CREATE POLICY "posts_insert" ON community_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      get_auth_user_role() IN ('administrator', 'teacher')
      OR
      EXISTS (
        SELECT 1
        FROM public.class_content_access cca
        INNER JOIN public.student_classes sc ON sc.class_id = cca.class_id
        WHERE cca.content_type = 'community_space'
          AND cca.content_id = community_posts.space_id::text
          AND sc.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "comments_insert" ON community_comments;
CREATE POLICY "comments_insert" ON community_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      get_auth_user_role() IN ('administrator', 'teacher')
      OR
      EXISTS (
        SELECT 1
        FROM public.community_posts cp
        INNER JOIN public.class_content_access cca ON cca.content_type = 'community_space'
          AND cca.content_id = cp.space_id::text
        INNER JOIN public.student_classes sc ON sc.class_id = cca.class_id
        WHERE cp.id = community_comments.post_id
          AND sc.user_id = auth.uid()
      )
    )
  );
