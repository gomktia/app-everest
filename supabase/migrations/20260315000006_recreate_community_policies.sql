-- Recreate community RLS policies that were dropped by CASCADE when user_profiles view was recreated

-- Spaces
CREATE POLICY "spaces_insert" ON community_spaces FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('administrator', 'teacher')));
CREATE POLICY "spaces_update" ON community_spaces FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('administrator', 'teacher')));
CREATE POLICY "spaces_delete" ON community_spaces FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'administrator'));

-- Posts
CREATE POLICY "posts_update" ON community_posts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('administrator', 'teacher')));
CREATE POLICY "posts_delete" ON community_posts FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('administrator', 'teacher')));

-- Comments
CREATE POLICY "comments_update" ON community_comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('administrator', 'teacher')));
CREATE POLICY "comments_delete" ON community_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('administrator', 'teacher')));

-- Attachments
CREATE POLICY "attachments_delete" ON community_attachments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('administrator', 'teacher')));

-- Reports
CREATE POLICY "reports_select" ON community_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('administrator', 'teacher')));
CREATE POLICY "reports_update" ON community_reports FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('administrator', 'teacher')));

-- Mutes
CREATE POLICY "mutes_select" ON community_mutes FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('administrator', 'teacher')));
CREATE POLICY "mutes_insert" ON community_mutes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('administrator', 'teacher')));
CREATE POLICY "mutes_delete" ON community_mutes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('administrator', 'teacher')));

-- Word filter
CREATE POLICY "word_filter_insert" ON community_word_filter FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'administrator'));
CREATE POLICY "word_filter_delete" ON community_word_filter FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'administrator'));

-- Storage (community-attachments delete policy)
DROP POLICY IF EXISTS "community_storage_delete" ON storage.objects;
CREATE POLICY "community_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'community-attachments' AND ((storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('administrator', 'teacher'))));
