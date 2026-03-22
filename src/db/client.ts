import { Database } from "bun:sqlite";

// ---------------------------------------------------------------------------
// Connection — uses Bun native SQLite for local dev / SQLite-backed Postgres
// For production Postgres swap the import to `bun:postgres` and use Bun.sql
// ---------------------------------------------------------------------------

const DB_PATH = process.env.DATABASE_URL?.startsWith("postgres")
  ? null
  : (process.env.DATABASE_FILE ?? "./indieforge.db");

let _db: Database | null = null;

export function getDB(): Database {
  if (!_db) {
    if (!DB_PATH) throw new Error("Use getSQL() for Postgres connections");
    _db = new Database(DB_PATH, { create: true });
    _db.run("PRAGMA journal_mode = WAL;");
    _db.run("PRAGMA foreign_keys = ON;");
  }
  return _db;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export type GenerationType = "npc" | "quest" | "item" | "lore" | "weapon" | "enemy";

export interface Generation {
  id: number;
  session_id: string;
  type: GenerationType;
  prompt_meta: Record<string, unknown>;
  result: Record<string, unknown>;
  raw_output: string | null;
  source: "model" | "fallback";
  created_at: string;
}

export interface Favorite {
  id: number;
  session_id: string;
  generation_id: number;
  created_at: string;
}

export function insertGeneration(
  db: Database,
  params: {
    session_id: string;
    type: GenerationType;
    prompt_meta: Record<string, unknown>;
    result: Record<string, unknown>;
    raw_output: string | null;
    source: "model" | "fallback";
  }
): Generation {
  const stmt = db.prepare<Generation, unknown[]>(`
    INSERT INTO generations (session_id, type, prompt_meta, result, raw_output, source)
    VALUES (?, ?, ?, ?, ?, ?)
    RETURNING *
  `);
  return stmt.get(
    params.session_id,
    params.type,
    JSON.stringify(params.prompt_meta),
    JSON.stringify(params.result),
    params.raw_output,
    params.source
  )!;
}

export function getHistory(
  db: Database,
  session_id: string,
  limit = 20
): Generation[] {
  const rows = db
    .prepare<Generation, unknown[]>(
      `SELECT * FROM generations WHERE session_id = ?
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(session_id, limit);

  return rows.map(deserializeGeneration);
}

export function addFavorite(
  db: Database,
  session_id: string,
  generation_id: number
): void {
  db.prepare(
    `INSERT OR IGNORE INTO favorites (session_id, generation_id) VALUES (?, ?)`
  ).run(session_id, generation_id);
}

export function removeFavorite(
  db: Database,
  session_id: string,
  generation_id: number
): void {
  db.prepare(
    `DELETE FROM favorites WHERE session_id = ? AND generation_id = ?`
  ).run(session_id, generation_id);
}

export function getFavorites(
  db: Database,
  session_id: string
): Generation[] {
  const rows = db
    .prepare<Generation, unknown[]>(
      `SELECT g.* FROM generations g
       INNER JOIN favorites f ON f.generation_id = g.id
       WHERE f.session_id = ?
       ORDER BY f.created_at DESC`
    )
    .all(session_id);

  return rows.map(deserializeGeneration);
}

function deserializeGeneration(row: Generation): Generation {
  return {
    ...row,
    prompt_meta:
      typeof row.prompt_meta === "string"
        ? JSON.parse(row.prompt_meta)
        : row.prompt_meta,
    result:
      typeof row.result === "string" ? JSON.parse(row.result) : row.result,
  };
}

// ---------------------------------------------------------------------------
// Social — Posts
// ---------------------------------------------------------------------------

export interface Post {
  id: number;
  session_id: string;
  generation_id: number | null;
  title: string;
  description: string;
  type: GenerationType;
  result: Record<string, unknown>;
  created_at: string;
  like_count: number;
  comment_count: number;
  tags: string[];
  liked_by_me: boolean;
}

export interface Comment {
  id: number;
  post_id: number;
  session_id: string;
  author: string; // truncated display name
  content: string;
  created_at: string;
}

/** Crea una publicación y asocia etiquetas */
export function createPost(
  db: Database,
  params: {
    session_id: string;
    generation_id: number | null;
    title: string;
    description: string;
    type: GenerationType;
    result: Record<string, unknown>;
    tags: string[];
  }
): Post {
  const post = db
    .prepare<{ id: number; session_id: string; generation_id: number | null; title: string; description: string; type: string; result: string; created_at: string }, unknown[]>(
      `INSERT INTO posts (session_id, generation_id, title, description, type, result)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .get(
      params.session_id,
      params.generation_id,
      params.title.slice(0, 120),
      params.description.slice(0, 500),
      params.type,
      JSON.stringify(params.result)
    )!;

  const tagStmt = db.prepare(`INSERT OR IGNORE INTO post_tags (post_id, tag) VALUES (?, ?)`);
  for (const t of params.tags.slice(0, 8)) {
    tagStmt.run(post.id, t.toLowerCase().replace(/[^a-z0-9áéíóúñ_-]/gi, "").slice(0, 30));
  }

  return enrichPost(db, post, params.session_id);
}

/** Obtiene una publicación por ID con métricas */
export function getPostById(db: Database, id: number, session_id: string): Post | null {
  const row = db
    .prepare<{ id: number; session_id: string; generation_id: number | null; title: string; description: string; type: string; result: string; created_at: string }, unknown[]>(
      `SELECT * FROM posts WHERE id = ?`
    )
    .get(id);
  if (!row) return null;
  return enrichPost(db, row, session_id);
}

/** Feed recomendado: puntúa por etiquetas seguidas, tipo, likes y recencia */
export function getFeed(
  db: Database,
  session_id: string,
  limit = 20,
  offset = 0
): Post[] {
  const rows = db
    .prepare<{ id: number; session_id: string; generation_id: number | null; title: string; description: string; type: string; result: string; created_at: string }, unknown[]>(
      `SELECT p.*
       FROM posts p
       WHERE p.session_id != ?
       ORDER BY (
         -- etiquetas seguidas (peso mayor)
         (SELECT COUNT(*) FROM post_tags pt
          INNER JOIN tag_follows tf ON tf.tag = pt.tag
          WHERE pt.post_id = p.id AND tf.session_id = ?) * 4.0
         +
         -- likes
         (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) * 0.8
         +
         -- recencia: decae en 7 días
         MAX(0.0, 7.0 - (julianday('now') - julianday(p.created_at))) * 1.5
       ) DESC,
       p.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(session_id, session_id, limit, offset);

  return rows.map((r) => enrichPost(db, r, session_id));
}

/** Posts de exploración (todos, más recientes) */
export function explorePosts(
  db: Database,
  session_id: string,
  tag: string | null,
  limit = 20,
  offset = 0
): Post[] {
  let rows;
  if (tag) {
    rows = db
      .prepare<{ id: number; session_id: string; generation_id: number | null; title: string; description: string; type: string; result: string; created_at: string }, unknown[]>(
        `SELECT p.* FROM posts p
         INNER JOIN post_tags pt ON pt.post_id = p.id
         WHERE pt.tag = ?
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(tag, limit, offset);
  } else {
    rows = db
      .prepare<{ id: number; session_id: string; generation_id: number | null; title: string; description: string; type: string; result: string; created_at: string }, unknown[]>(
        `SELECT * FROM posts ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .all(limit, offset);
  }
  return rows.map((r) => enrichPost(db, r, session_id));
}

/** Posts propios del usuario */
export function getMyPosts(db: Database, session_id: string): Post[] {
  const rows = db
    .prepare<{ id: number; session_id: string; generation_id: number | null; title: string; description: string; type: string; result: string; created_at: string }, unknown[]>(
      `SELECT * FROM posts WHERE session_id = ? ORDER BY created_at DESC`
    )
    .all(session_id);
  return rows.map((r) => enrichPost(db, r, session_id));
}

/** Elimina una publicación propia */
export function deletePost(db: Database, id: number, session_id: string): boolean {
  const info = db.prepare(`DELETE FROM posts WHERE id = ? AND session_id = ?`).run(id, session_id);
  return (info.changes ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Social — Likes
// ---------------------------------------------------------------------------

export function toggleLike(db: Database, session_id: string, post_id: number): boolean {
  const existing = db
    .prepare<{ session_id: string; post_id: number }, unknown[]>(
      `SELECT 1 FROM post_likes WHERE session_id = ? AND post_id = ?`
    )
    .get(session_id, post_id);
  if (existing) {
    db.prepare(`DELETE FROM post_likes WHERE session_id = ? AND post_id = ?`).run(session_id, post_id);
    return false; // ya no tiene like
  } else {
    db.prepare(`INSERT OR IGNORE INTO post_likes (session_id, post_id) VALUES (?, ?)`).run(session_id, post_id);
    return true; // ahora tiene like
  }
}

// ---------------------------------------------------------------------------
// Social — Comentarios
// ---------------------------------------------------------------------------

export function addComment(
  db: Database,
  session_id: string,
  post_id: number,
  content: string
): Comment {
  const row = db
    .prepare<{ id: number; post_id: number; session_id: string; content: string; created_at: string }, unknown[]>(
      `INSERT INTO post_comments (session_id, post_id, content) VALUES (?, ?, ?) RETURNING *`
    )
    .get(session_id, post_id, content.slice(0, 300))!;
  return { ...row, author: authorName(row.session_id) };
}

export function getComments(db: Database, post_id: number): Comment[] {
  const rows = db
    .prepare<{ id: number; post_id: number; session_id: string; content: string; created_at: string }, unknown[]>(
      `SELECT * FROM post_comments WHERE post_id = ? ORDER BY created_at ASC`
    )
    .all(post_id);
  return rows.map((r) => ({ ...r, author: authorName(r.session_id) }));
}

// ---------------------------------------------------------------------------
// Social — Etiquetas
// ---------------------------------------------------------------------------

export function followTag(db: Database, session_id: string, tag: string): void {
  db.prepare(`INSERT OR IGNORE INTO tag_follows (session_id, tag) VALUES (?, ?)`).run(session_id, tag);
}

export function unfollowTag(db: Database, session_id: string, tag: string): void {
  db.prepare(`DELETE FROM tag_follows WHERE session_id = ? AND tag = ?`).run(session_id, tag);
}

export function getFollowedTags(db: Database, session_id: string): string[] {
  const rows = db
    .prepare<{ tag: string }, unknown[]>(`SELECT tag FROM tag_follows WHERE session_id = ? ORDER BY tag`)
    .all(session_id);
  return rows.map((r) => r.tag);
}

export function getPopularTags(db: Database, limit = 30): { tag: string; count: number }[] {
  return db
    .prepare<{ tag: string; count: number }, unknown[]>(
      `SELECT tag, COUNT(*) as count FROM post_tags GROUP BY tag ORDER BY count DESC LIMIT ?`
    )
    .all(limit);
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function enrichPost(
  db: Database,
  row: { id: number; session_id: string; generation_id: number | null; title: string; description: string; type: string; result: string; created_at: string },
  viewer_session: string
): Post {
  const like_count = (db
    .prepare<{ c: number }, unknown[]>(`SELECT COUNT(*) as c FROM post_likes WHERE post_id = ?`)
    .get(row.id)?.c) ?? 0;

  const comment_count = (db
    .prepare<{ c: number }, unknown[]>(`SELECT COUNT(*) as c FROM post_comments WHERE post_id = ?`)
    .get(row.id)?.c) ?? 0;

  const tags = db
    .prepare<{ tag: string }, unknown[]>(`SELECT tag FROM post_tags WHERE post_id = ? ORDER BY tag`)
    .all(row.id)
    .map((t) => t.tag);

  const liked_by_me = !!db
    .prepare<{ session_id: string; post_id: number }, unknown[]>(
      `SELECT 1 FROM post_likes WHERE session_id = ? AND post_id = ?`
    )
    .get(viewer_session, row.id);

  return {
    id: row.id,
    session_id: row.session_id,
    generation_id: row.generation_id,
    title: row.title,
    description: row.description,
    type: row.type as GenerationType,
    result: typeof row.result === "string" ? JSON.parse(row.result) : row.result,
    created_at: row.created_at,
    like_count,
    comment_count,
    tags,
    liked_by_me,
  };
}

/** Genera un nombre de autor visible a partir de la session */
function authorName(session_id: string): string {
  const short = session_id.replace(/^(anon-|sess-)/, "").slice(0, 8).toUpperCase();
  return `Aventurero#${short}`;
}
