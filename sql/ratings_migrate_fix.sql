-- Idempotent migration to align existing ratings table with expected schema
-- Safe to run multiple times

BEGIN;

-- Create table if missing (minimal); subsequent ALTERs will align details
CREATE TABLE IF NOT EXISTS ratings (
  id           bigserial PRIMARY KEY
);

-- Column renames (common legacy names -> new ones)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'ratings' AND column_name = 'rated_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'ratings' AND column_name = 'ratee_id'
  ) THEN
    ALTER TABLE ratings RENAME COLUMN rated_id TO ratee_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'ratings' AND column_name = 'user_rater_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'ratings' AND column_name = 'rater_id'
  ) THEN
    ALTER TABLE ratings RENAME COLUMN user_rater_id TO rater_id;
  END IF;
END $$;

-- Ensure required columns exist
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS rater_id   bigint;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS ratee_id   bigint;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS session_id bigint;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS reservation_id bigint;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS score      integer;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS comment    text;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Legacy columns compatibility: relax NOT NULL and backfill if possible
DO $$
BEGIN
  -- tutor_id: si existe, intentar rellenar con ratee_id y volverlo nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ratings' AND column_name = 'tutor_id'
  ) THEN
    -- Backfill básico: donde tutor_id sea NULL y exista ratee_id, copiar
    EXECUTE 'UPDATE ratings SET tutor_id = ratee_id WHERE tutor_id IS NULL AND ratee_id IS NOT NULL';
    -- Quitar NOT NULL si lo tuviera
    EXECUTE 'ALTER TABLE ratings ALTER COLUMN tutor_id DROP NOT NULL';
  END IF;

  -- student_id: si existe, intentar rellenar con rater_id y volverlo nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ratings' AND column_name = 'student_id'
  ) THEN
    EXECUTE 'UPDATE ratings SET student_id = rater_id WHERE student_id IS NULL AND rater_id IS NOT NULL';
    EXECUTE 'ALTER TABLE ratings ALTER COLUMN student_id DROP NOT NULL';
  END IF;
END $$;

-- Add FKs (ignore if already exist)
DO $$ BEGIN
  ALTER TABLE ratings ADD CONSTRAINT ratings_rater_fk FOREIGN KEY (rater_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE ratings ADD CONSTRAINT ratings_ratee_fk FOREIGN KEY (ratee_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE ratings ADD CONSTRAINT ratings_session_fk FOREIGN KEY (session_id) REFERENCES tutoring_sessions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Optional FK to reservations if column exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='ratings' AND column_name='reservation_id'
  ) THEN
    ALTER TABLE ratings ADD CONSTRAINT ratings_reservation_fk FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Legacy course_id compatibility: backfill and relax NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ratings' AND column_name = 'course_id'
  ) THEN
    -- Backfill desde session_id si es posible
    EXECUTE $$
      UPDATE ratings r
      SET course_id = ts.course_id
      FROM tutoring_sessions ts
      WHERE r.session_id = ts.id AND r.course_id IS NULL
    $$;

    -- Backfill desde reservation_id si es posible
    IF EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='reservations'
    ) THEN
      EXECUTE $$
        UPDATE ratings r
        SET course_id = ts.course_id
        FROM reservations rv
        JOIN tutoring_sessions ts ON ts.id = rv.session_id
        WHERE r.reservation_id = rv.id AND r.course_id IS NULL
      $$;
    END IF;

    -- Quitar NOT NULL para no forzar a proveer course_id cuando no aplica
    EXECUTE 'ALTER TABLE ratings ALTER COLUMN course_id DROP NOT NULL';
  END IF;
END $$;

-- Legacy stars compatibility: backfill and relax NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ratings' AND column_name = 'stars'
  ) THEN
    -- Si score existe, poblarlo desde stars cuando esté NULL
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='ratings' AND column_name='score'
    ) THEN
      EXECUTE 'UPDATE ratings SET score = stars WHERE score IS NULL AND stars IS NOT NULL';
    END IF;
    -- Mantener stars coherente desde score cuando star esté NULL
    EXECUTE 'UPDATE ratings SET stars = score WHERE stars IS NULL AND score IS NOT NULL';
    -- Quitar NOT NULL si lo tuviera para no bloquear inserts
    EXECUTE 'ALTER TABLE ratings ALTER COLUMN stars DROP NOT NULL';
  END IF;
END $$;

-- Score constraint 1..5
DO $$ BEGIN
  ALTER TABLE ratings ADD CONSTRAINT ratings_score_check CHECK (score BETWEEN 1 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Unique constraint (rater, ratee, session)
DO $$
BEGIN
  -- Solo agregar si la constraint no existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ratings'::regclass
      AND conname = 'ratings_unique_triplet'
  ) THEN
    -- Si ya existe un índice único con ese nombre sobre ratings, adjuntarlo como constraint
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_index i ON i.indexrelid = c.oid
      JOIN pg_class t ON t.oid = i.indrelid
      WHERE c.relname = 'ratings_unique_triplet'
        AND t.relname = 'ratings'
        AND i.indisunique
    ) THEN
      ALTER TABLE ratings ADD CONSTRAINT ratings_unique_triplet UNIQUE USING INDEX ratings_unique_triplet;
    ELSE
      ALTER TABLE ratings ADD CONSTRAINT ratings_unique_triplet UNIQUE (rater_id, ratee_id, session_id);
    END IF;
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_ratings_ratee   ON ratings (ratee_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rater   ON ratings (rater_id);
CREATE INDEX IF NOT EXISTS idx_ratings_session ON ratings (session_id);
CREATE INDEX IF NOT EXISTS idx_ratings_reservation ON ratings (reservation_id);

-- View for quick summaries
CREATE OR REPLACE VIEW rating_summary AS
SELECT
  ratee_id,
  COUNT(*)::int AS total,
  ROUND(AVG(score)::numeric, 2) AS avg_score
FROM ratings
GROUP BY ratee_id;

COMMIT;
