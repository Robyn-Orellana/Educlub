-- Adds Jitsi columns to tutoring_sessions (idempotent)
BEGIN;
ALTER TABLE IF EXISTS tutoring_sessions
  ADD COLUMN IF NOT EXISTS room_name text,
  ADD COLUMN IF NOT EXISTS meet_link text,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz;

-- Optional: set starts_at/ends_at from scheduled_at + duration
UPDATE tutoring_sessions
SET starts_at = COALESCE(starts_at, scheduled_at),
    ends_at   = COALESCE(ends_at, scheduled_at + make_interval(mins => duration_min))
WHERE scheduled_at IS NOT NULL;

COMMIT;
