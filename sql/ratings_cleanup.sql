-- Idempotent cleanup to simplify ratings table and reduce hard dependencies
-- Safe to run multiple times

BEGIN;

-- 1) Drop legacy columns if present
ALTER TABLE ratings DROP COLUMN IF EXISTS tutor_id;
ALTER TABLE ratings DROP COLUMN IF EXISTS student_id;
-- Also drop course_id to make ratings fully general (no hard course dependency)
ALTER TABLE ratings DROP COLUMN IF EXISTS course_id;
-- Drop stars (legacy duplicate of score)
ALTER TABLE ratings DROP COLUMN IF EXISTS stars;

-- 2) Make optional columns nullable (session_id, reservation_id, course_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ratings' AND column_name='session_id') THEN
    EXECUTE 'ALTER TABLE ratings ALTER COLUMN session_id DROP NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ratings' AND column_name='reservation_id') THEN
    EXECUTE 'ALTER TABLE ratings ALTER COLUMN reservation_id DROP NOT NULL';
  END IF;
  -- course_id dropped above; nothing to relax here
END $$;

-- 3) Reduce hard dependencies: drop FKs on optional columns if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ratings'::regclass AND conname = 'ratings_session_fk'
  ) THEN
    ALTER TABLE ratings DROP CONSTRAINT ratings_session_fk;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ratings'::regclass AND conname = 'ratings_reservation_fk'
  ) THEN
    ALTER TABLE ratings DROP CONSTRAINT ratings_reservation_fk;
  END IF;
  -- No course FK remains (column dropped)
END $$;

-- 4) Keep essential FKs to users (idempotent via exception)
DO $$ BEGIN
  ALTER TABLE ratings ADD CONSTRAINT ratings_rater_fk FOREIGN KEY (rater_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE ratings ADD CONSTRAINT ratings_ratee_fk FOREIGN KEY (ratee_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) Replace strict UNIQUE constraint with a partial unique index (no duplicates only when session_id IS NOT NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ratings'::regclass AND conname = 'ratings_unique_triplet'
  ) THEN
    ALTER TABLE ratings DROP CONSTRAINT ratings_unique_triplet;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_unique_triplet_not_null
  ON ratings (rater_id, ratee_id, session_id)
  WHERE session_id IS NOT NULL;

-- Prevent duplicate general ratings when session_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_unique_pair_no_session
  ON ratings (rater_id, ratee_id)
  WHERE session_id IS NULL;

-- 6) Helpful indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_ratings_ratee   ON ratings (ratee_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rater   ON ratings (rater_id);
CREATE INDEX IF NOT EXISTS idx_ratings_session ON ratings (session_id);
CREATE INDEX IF NOT EXISTS idx_ratings_reservation ON ratings (reservation_id);

-- 7) View remains the same; no change needed

COMMIT;
