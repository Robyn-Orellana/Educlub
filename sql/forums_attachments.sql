-- forums_attachments.sql — Adjuntos (imágenes y links) para hilos y comentarios

BEGIN;

CREATE TABLE IF NOT EXISTS forum_attachments (
  id          bigserial PRIMARY KEY,
  thread_id   bigint NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  comment_id  bigint NULL REFERENCES forum_comments(id) ON DELETE CASCADE,
  author_id   bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('image','link')),
  url         text NOT NULL,
  title       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forum_attachments_target_chk CHECK (
    (thread_id IS NOT NULL AND comment_id IS NULL) OR (thread_id IS NULL AND comment_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_forum_attachments_thread ON forum_attachments(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_forum_attachments_comment ON forum_attachments(comment_id, created_at);

COMMIT;
