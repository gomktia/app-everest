-- Allow authenticated users to insert their OWN profile in the users table.
-- This fixes the bug where students created via invite links cannot load
-- their profile (spinner infinito) because the INSERT policy only allowed
-- administrators.

-- Add policy: users can insert their own profile (id must match auth.uid())
CREATE POLICY "Users can insert own profile"
    ON public.users
    FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());
