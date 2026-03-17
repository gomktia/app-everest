-- ============================================================
-- Add new feature keys (acervo, calendar, study_planner, ranking, community)
-- to all classes that already have at least one feature permission.
-- This ensures existing students don't lose access to pages that
-- were previously always visible.
-- ============================================================

-- Get all class_ids that have at least one permission (active classes)
INSERT INTO public.class_feature_permissions (class_id, feature_key)
SELECT DISTINCT cfp.class_id, new_key.key
FROM public.class_feature_permissions cfp
CROSS JOIN (
  VALUES ('acervo'), ('calendar'), ('study_planner'), ('ranking'), ('community')
) AS new_key(key)
WHERE NOT EXISTS (
  SELECT 1 FROM public.class_feature_permissions existing
  WHERE existing.class_id = cfp.class_id
    AND existing.feature_key = new_key.key
);
