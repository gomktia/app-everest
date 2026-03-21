-- Add parent_module_id to support one level of submodules
ALTER TABLE public.video_modules
  ADD COLUMN IF NOT EXISTS parent_module_id UUID REFERENCES public.video_modules(id) ON DELETE CASCADE;

-- Index for fast lookups of children
CREATE INDEX IF NOT EXISTS idx_video_modules_parent_module_id
  ON public.video_modules(parent_module_id)
  WHERE parent_module_id IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.video_modules.parent_module_id IS
  'If set, this module is a submodule of the referenced parent. Only 1 level of nesting allowed (enforced in app).';
