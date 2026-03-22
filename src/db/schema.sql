-- IndieForge AI — Database Schema (SQLite compatible)
-- Run: bun run db:migrate

CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS generations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('npc', 'quest', 'item', 'lore', 'weapon', 'enemy')),
  prompt_meta TEXT NOT NULL DEFAULT '{}',
  result      TEXT NOT NULL,
  raw_output  TEXT,
  source      TEXT NOT NULL DEFAULT 'model' CHECK (source IN ('model', 'fallback')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS favorites (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id     TEXT NOT NULL,
  generation_id  INTEGER NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (session_id, generation_id)
);

CREATE INDEX IF NOT EXISTS idx_generations_session ON generations(session_id);
CREATE INDEX IF NOT EXISTS idx_generations_type    ON generations(type);
CREATE INDEX IF NOT EXISTS idx_favorites_session   ON favorites(session_id);

-- ---------------------------------------------------------------------------
-- Social: publicaciones, etiquetas, likes y comentarios
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS posts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    TEXT NOT NULL,
  generation_id INTEGER REFERENCES generations(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  type          TEXT NOT NULL CHECK (type IN ('npc', 'quest', 'item', 'lore', 'weapon', 'enemy')),
  result        TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS post_tags (
  post_id  INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag      TEXT NOT NULL,
  PRIMARY KEY (post_id, tag)
);

CREATE TABLE IF NOT EXISTS tag_follows (
  session_id TEXT NOT NULL,
  tag        TEXT NOT NULL,
  PRIMARY KEY (session_id, tag)
);

CREATE TABLE IF NOT EXISTS post_likes (
  session_id TEXT NOT NULL,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (session_id, post_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_session    ON posts(session_id);
CREATE INDEX IF NOT EXISTS idx_posts_type       ON posts(type);
CREATE INDEX IF NOT EXISTS idx_posts_created    ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag    ON post_tags(tag);
CREATE INDEX IF NOT EXISTS idx_post_likes_post  ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id);
