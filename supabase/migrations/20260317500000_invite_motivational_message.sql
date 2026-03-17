-- Add motivational message field to invites
ALTER TABLE invites ADD COLUMN IF NOT EXISTS motivational_message text;
