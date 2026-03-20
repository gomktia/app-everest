CREATE TABLE IF NOT EXISTS mind_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  topic text NOT NULL,
  title text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  icon text DEFAULT 'brain',
  color text DEFAULT 'purple',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mind_maps_subject ON mind_maps(subject);

ALTER TABLE mind_maps ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Authenticated users can read mind_maps" ON mind_maps
  FOR SELECT TO authenticated USING (true);

-- Only admins/teachers can insert/update/delete
CREATE POLICY "Admins can manage mind_maps" ON mind_maps
  FOR ALL USING (get_auth_user_role() IN ('administrator', 'teacher'));
