-- forums_likes.sql — Likes para hilos y comentarios

BEGIN;

CREATE TABLE IF NOT EXISTS forum_thread_likes (
  user_id   bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id bigint NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, thread_id)
);

CREATE TABLE IF NOT EXISTS forum_comment_likes (
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id bigint NOT NULL REFERENCES forum_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, comment_id)
);

COMMIT;
