-- Add must_change_password flag for users created with temporary passwords.
-- When true, forces a password change modal on next login.

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Set flag for the 4 users just created with temp passwords
UPDATE public.users SET must_change_password = true
WHERE email IN (
  'sgtcarol@gmail.com',
  'giovannegpq@gmail.com',
  'meloacgm33@gmail.com',
  'nicolauwieth@gmail.com'
);
