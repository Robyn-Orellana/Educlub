-- forums.sql — Esquema básico de foros para EduClub
-- Ejecutar en la misma base de datos que el resto del proyecto

BEGIN;

-- Tabla de hilos (threads)
CREATE TABLE IF NOT EXISTS forum_threads (
  id            bigserial PRIMARY KEY,
  author_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         text NOT NULL,
  body          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  last_comment_at timestamptz,
  comments_count integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_forum_threads_created ON forum_threads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_threads_last_comment ON forum_threads(last_comment_at DESC NULLS LAST);

-- Tabla de comentarios
CREATE TABLE IF NOT EXISTS forum_comments (
  id          bigserial PRIMARY KEY,
  thread_id   bigint NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  author_id   bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id   bigint NULL REFERENCES forum_comments(id) ON DELETE CASCADE,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_comments_thread ON forum_comments(thread_id, created_at);

COMMIT;
