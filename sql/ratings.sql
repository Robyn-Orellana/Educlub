-- Ratings table for tutor/student reviews tied to sessions
-- Run this file in your database (Neon/Postgres)

CREATE TABLE IF NOT EXISTS ratings (
  id           bigserial PRIMARY KEY,
  rater_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ratee_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id   bigint REFERENCES tutoring_sessions(id) ON DELETE SET NULL,
  score        integer NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rater_id, ratee_id, session_id)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_ratings_ratee ON ratings (ratee_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rater ON ratings (rater_id);
CREATE INDEX IF NOT EXISTS idx_ratings_session ON ratings (session_id);

-- Optional helper view for quick summaries (average + count)
CREATE OR REPLACE VIEW rating_summary AS
SELECT
  ratee_id,
  COUNT(*)::int AS total,
  ROUND(AVG(score)::numeric, 2) AS avg_score
FROM ratings
GROUP BY ratee_id;
