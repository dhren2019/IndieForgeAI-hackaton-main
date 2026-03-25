-- IndieForge AI — Database Schema (PostgreSQL)
-- Run: bun run db:migrate

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  session_id  TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS generations (
  id          SERIAL PRIMARY KEY,
  session_id  TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('npc', 'quest', 'item', 'lore', 'weapon', 'enemy')),
  prompt_meta TEXT NOT NULL DEFAULT '{}',
  result      TEXT NOT NULL,
  raw_output  TEXT,
  source      TEXT NOT NULL DEFAULT 'model' CHECK (source IN ('model', 'fallback')),
  image_url   TEXT,
  glb_url     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorites (
  id             SERIAL PRIMARY KEY,
  session_id     TEXT NOT NULL,
  generation_id  INTEGER NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, generation_id)
);

CREATE INDEX IF NOT EXISTS idx_generations_session ON generations(session_id);
CREATE INDEX IF NOT EXISTS idx_generations_type    ON generations(type);
CREATE INDEX IF NOT EXISTS idx_favorites_session   ON favorites(session_id);

-- ---------------------------------------------------------------------------
-- Social: publicaciones, etiquetas, likes y comentarios
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS posts (
  id            SERIAL PRIMARY KEY,
  session_id    TEXT NOT NULL,
  generation_id INTEGER REFERENCES generations(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  type          TEXT NOT NULL CHECK (type IN ('npc', 'quest', 'item', 'lore', 'weapon', 'enemy')),
  result        TEXT NOT NULL,
  image_url     TEXT,
  glb_url       TEXT,
  display_name  TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_tags (
  post_id  INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag      TEXT NOT NULL,
  PRIMARY KEY (post_id, tag)
);

CREATE TABLE IF NOT EXISTS tag_follows (
  session_id TEXT NOT NULL,
  tag        TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, tag)
);

CREATE TABLE IF NOT EXISTS post_likes (
  session_id TEXT NOT NULL,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, post_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id         SERIAL PRIMARY KEY,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  content    TEXT NOT NULL CHECK (LENGTH(content) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_session    ON posts(session_id);
CREATE INDEX IF NOT EXISTS idx_posts_type       ON posts(type);
CREATE INDEX IF NOT EXISTS idx_posts_created    ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag    ON post_tags(tag);
CREATE INDEX IF NOT EXISTS idx_post_likes_post  ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id);

-- Tabla de interacciones del usuario (señales para el algoritmo de recomendación ML)
-- action: 'view' (0.1), 'expand' (1.0), 'like' (3.0), 'comment' (2.5)
CREATE TABLE IF NOT EXISTS user_interactions (
  id           SERIAL PRIMARY KEY,
  session_id   TEXT NOT NULL,
  post_id      INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  action       TEXT NOT NULL CHECK (action IN ('view', 'expand', 'like', 'comment')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ui_session         ON user_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_ui_post            ON user_interactions(post_id);
CREATE INDEX IF NOT EXISTS idx_ui_session_post    ON user_interactions(session_id, post_id);
CREATE INDEX IF NOT EXISTS idx_ui_session_action  ON user_interactions(session_id, action);

-- ---------------------------------------------------------------------------
-- Projects: carpetas para organizar generaciones (requiere login con Clerk)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS projects (
  id          SERIAL PRIMARY KEY,
  session_id  TEXT NOT NULL,
  name        TEXT NOT NULL CHECK (LENGTH(name) >= 1 AND LENGTH(name) <= 100),
  emoji       TEXT NOT NULL DEFAULT '📁',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_items (
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  generation_id INTEGER NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, generation_id)
);

CREATE INDEX IF NOT EXISTS idx_projects_session       ON projects(session_id);
CREATE INDEX IF NOT EXISTS idx_project_items_project  ON project_items(project_id);
CREATE INDEX IF NOT EXISTS idx_project_items_gen      ON project_items(generation_id);

-- ---------------------------------------------------------------------------
-- Additive column migrations (idempotent — safe to run multiple times)
-- ---------------------------------------------------------------------------

ALTER TABLE posts ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';
