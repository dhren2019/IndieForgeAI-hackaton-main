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

/** Satisfies Bun SQLite's SQLQueryBindings constraint */
type BindParams = (string | number | null | boolean | Uint8Array)[];

export interface Generation {
  id: number;
  session_id: string;
  type: GenerationType;
  prompt_meta: Record<string, unknown>;
  result: Record<string, unknown>;
  raw_output: string | null;
  source: "model" | "fallback";
  image_url: string | null;
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
  const stmt = db.prepare<Generation, BindParams>(`
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
    .prepare<Generation, BindParams>(
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
    .prepare<Generation, BindParams>(
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
    image_url: row.image_url ?? null,
    prompt_meta:
      typeof row.prompt_meta === "string"
        ? JSON.parse(row.prompt_meta)
        : row.prompt_meta,
    result:
      typeof row.result === "string" ? JSON.parse(row.result) : row.result,
  };
}

export function updateGenerationImage(
  db: Database,
  id: number,
  image_url: string
): void {
  db.prepare(
    `UPDATE generations SET image_url = ? WHERE id = ?`
  ).run(image_url, id);
}

export function updateGenerationGlb(
  db: Database,
  id: number,
  glb_url: string
): void {
  db.prepare(
    `UPDATE generations SET glb_url = ? WHERE id = ?`
  ).run(glb_url, id);
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
  image_url: string | null;
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
    image_url?: string | null;
    glb_url?: string | null;
  }
): Post {
  const post = db
    .prepare<{ id: number; session_id: string; generation_id: number | null; title: string; description: string; type: string; result: string; image_url: string | null; glb_url: string | null; created_at: string }, BindParams>(
      `INSERT INTO posts (session_id, generation_id, title, description, type, result, image_url, glb_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .get(
      params.session_id,
      params.generation_id,
      params.title.slice(0, 120),
      params.description.slice(0, 500),
      params.type,
      JSON.stringify(params.result),
      params.image_url ?? null,
      params.glb_url ?? null
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
    .prepare<{ id: number; session_id: string; generation_id: number | null; title: string; description: string; type: string; result: string; image_url: string | null; glb_url: string | null; created_at: string }, BindParams>(
      `SELECT * FROM posts WHERE id = ?`
    )
    .get(id);
  if (!row) return null;
  return enrichPost(db, row, session_id);
}

export type UserInteractionType = "view" | "expand" | "like" | "comment";

/**
 * Registra una interacción del usuario con una publicación.
 * 'view' se deduplica por sesión+post en la última hora para no inflar la señal.
 */
export function recordInteraction(
  db: Database,
  session_id: string,
  post_id: number,
  action: UserInteractionType
): void {
  // Para 'view' evitar registro duplicado si ya hay uno en los últimos 30 min
  if (action === "view") {
    const recent = db
      .prepare<{ c: number }, BindParams>(
        `SELECT COUNT(*) as c FROM user_interactions
         WHERE session_id = ? AND post_id = ? AND action = 'view'
           AND created_at > datetime('now', '-30 minutes')`
      )
      .get(session_id, post_id);
    if ((recent?.c ?? 0) > 0) return;
  }
  db.prepare(
    `INSERT INTO user_interactions (session_id, post_id, action) VALUES (?, ?, ?)`
  ).run(session_id, post_id, action);
}

/**
 * Feed de recomendación con algoritmo ML de 6 señales:
 *
 *  S1  Etiquetas seguidas directamente                     peso 5.0
 *  S2  Afinidad por tipo basada en historial de acciones   peso ~0.5×suma
 *  S3  Afinidad histórica por etiqueta (interacciones)     peso 2.0
 *  S4  Filtrado colaborativo (usuarios con gustos similares) peso 3.5
 *  S5  Popularidad social (likes totales)                  peso 0.4
 *  S6  Recencia — decaimiento exponencial (t½ ≈ 3 días)    peso 4.0 × e^(-d/3)
 *  P   Penalización: ya visto recientemente                -1.5 por vista
 *
 * Los posts ya marcados con ❤️ por el usuario se excluyen del feed.
 */
export function getFeed(
  db: Database,
  session_id: string,
  limit = 20,
  offset = 0
): Post[] {
  type PostRow = {
    id: number;
    session_id: string;
    generation_id: number | null;
    title: string;
    description: string;
    type: string;
    result: string;
    image_url: string | null;
    created_at: string;
  };

  const rows = db
    .prepare<PostRow, BindParams>(
      `SELECT p.id, p.session_id, p.generation_id, p.title,
              p.description, p.type, p.result, p.image_url, p.created_at
       FROM posts p
       WHERE p.session_id != ?
         AND NOT EXISTS (
           SELECT 1 FROM post_likes
           WHERE session_id = ? AND post_id = p.id
         )
       ORDER BY (

         /* ── S1: Etiquetas seguidas directamente ── */
         COALESCE((
           SELECT COUNT(*) * 5.0
           FROM post_tags pt
           INNER JOIN tag_follows tf ON tf.tag = pt.tag
           WHERE pt.post_id = p.id AND tf.session_id = ?
         ), 0.0)

         +

         /* ── S2: Afinidad por tipo de contenido (historial ponderado) ── */
         COALESCE((
           SELECT SUM(CASE ui.action
             WHEN 'like'    THEN 3.0
             WHEN 'comment' THEN 2.5
             WHEN 'expand'  THEN 1.0
             ELSE 0.1
           END) * 0.5
           FROM user_interactions ui
           INNER JOIN posts p2 ON p2.id = ui.post_id
           WHERE ui.session_id = ?
             AND p2.type = p.type
             AND ui.created_at > datetime('now', '-45 days')
         ), 0.0)

         +

         /* ── S3: Afinidad histórica por etiqueta ── */
         COALESCE((
           SELECT COUNT(*) * 2.0
           FROM post_tags pt_curr
           INNER JOIN post_tags pt_hist ON pt_hist.tag = pt_curr.tag
           INNER JOIN user_interactions ui2 ON ui2.post_id = pt_hist.post_id
           WHERE pt_curr.post_id = p.id
             AND ui2.session_id = ?
             AND ui2.action IN ('like', 'comment', 'expand')
             AND ui2.created_at > datetime('now', '-30 days')
         ), 0.0)

         +

         /* ── S4: Filtrado colaborativo (usuarios con gustos similares) ── */
         COALESCE((
           SELECT COUNT(DISTINCT pl_sim.session_id) * 3.5
           FROM post_likes pl_sim
           WHERE pl_sim.post_id = p.id
             AND pl_sim.session_id IN (
               SELECT DISTINCT pl_shared.session_id
               FROM post_likes pl_shared
               WHERE pl_shared.post_id IN (
                 SELECT post_id FROM post_likes WHERE session_id = ?
               )
               AND pl_shared.session_id != ?
             )
         ), 0.0)

         +

         /* ── S5: Popularidad social (likes totales) ── */
         COALESCE((
           SELECT COUNT(*) * 0.4
           FROM post_likes pl_pop
           WHERE pl_pop.post_id = p.id
         ), 0.0)

         +

         /* ── S6: Recencia — decaimiento exponencial (t½ ≈ 3 días) ── */
         EXP(-(julianday('now') - julianday(p.created_at)) / 3.0) * 4.0

         -

         /* ── Penalización: ya visto en las últimas 24 h ── */
         COALESCE((
           SELECT COUNT(*) * 1.5
           FROM user_interactions vi_seen
           WHERE vi_seen.session_id = ?
             AND vi_seen.post_id = p.id
             AND vi_seen.action = 'view'
             AND vi_seen.created_at > datetime('now', '-24 hours')
         ), 0.0)

       ) DESC, p.created_at DESC
       LIMIT ? OFFSET ?`
    )
    // params: s1_exclude, s1_nolikes, s1_tags, s2_type, s3_tags, s4_shared, s4_notme, s6_seen, limit, offset
    .all(
      session_id, session_id,
      session_id, session_id, session_id,
      session_id, session_id,
      session_id,
      limit, offset
    );

  return rows.map((r) => enrichPost(db, r, session_id));
}

/** Posts de exploración (todos, más recientes o más populares) */
export function explorePosts(
  db: Database,
  session_id: string,
  tag: string | null,
  sort: string = "reciente",
  limit = 20,
  offset = 0
): Post[] {
  const orderBy = sort === "popular"
    ? "(SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) DESC, p.created_at DESC"
    : "p.created_at DESC";
  let rows;
  if (tag) {
    rows = db
      .prepare<{ id: number; session_id: string; generation_id: number | null; title: string; description: string; type: string; result: string; image_url: string | null; created_at: string }, BindParams>(
        `SELECT p.* FROM posts p
         INNER JOIN post_tags pt ON pt.post_id = p.id
         WHERE pt.tag = ?
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`
      )
      .all(tag, limit, offset);
  } else {
    rows = db
      .prepare<{ id: number; session_id: string; generation_id: number | null; title: string; description: string; type: string; result: string; image_url: string | null; created_at: string }, BindParams>(
        `SELECT p.* FROM posts p ORDER BY ${orderBy} LIMIT ? OFFSET ?`
      )
      .all(limit, offset);
  }
  return rows.map((r) => enrichPost(db, r, session_id));
}

/** Posts propios del usuario */
export function getMyPosts(db: Database, session_id: string): Post[] {
  const rows = db
    .prepare<{ id: number; session_id: string; generation_id: number | null; title: string; description: string; type: string; result: string; image_url: string | null; created_at: string }, BindParams>(
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
    .prepare<{ session_id: string; post_id: number }, BindParams>(
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
    .prepare<{ id: number; post_id: number; session_id: string; content: string; created_at: string }, BindParams>(
      `INSERT INTO post_comments (session_id, post_id, content) VALUES (?, ?, ?) RETURNING *`
    )
    .get(session_id, post_id, content.slice(0, 300))!;
  return { ...row, author: authorName(row.session_id) };
}

export function getComments(db: Database, post_id: number): Comment[] {
  const rows = db
    .prepare<{ id: number; post_id: number; session_id: string; content: string; created_at: string }, BindParams>(
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
    .prepare<{ tag: string }, BindParams>(`SELECT tag FROM tag_follows WHERE session_id = ? ORDER BY tag`)
    .all(session_id);
  return rows.map((r) => r.tag);
}

export function getPopularTags(db: Database, limit = 30): { tag: string; count: number }[] {
  return db
    .prepare<{ tag: string; count: number }, BindParams>(
      `SELECT tag, COUNT(*) as count FROM post_tags GROUP BY tag ORDER BY count DESC LIMIT ?`
    )
    .all(limit);
}

/** Posts con más actividad en las últimas 48 h (trending) */
export function getTrendingPosts(
  db: Database,
  session_id: string,
  limit = 20,
  offset = 0
): Post[] {
  const rows = db
    .prepare<{ id: number; session_id: string; generation_id: number | null; title: string; description: string; type: string; result: string; image_url: string | null; created_at: string }, BindParams>(
      `SELECT p.id, p.session_id, p.generation_id, p.title,
              p.description, p.type, p.result, p.created_at
       FROM posts p
       WHERE p.created_at > datetime('now', '-7 days')
       ORDER BY (
         COALESCE((SELECT COUNT(*) FROM post_likes    pl WHERE pl.post_id  = p.id AND pl.created_at  > datetime('now','-48 hours')),0) * 3 +
         COALESCE((SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id  = p.id AND pc.created_at  > datetime('now','-48 hours')),0) * 2 +
         COALESCE((SELECT COUNT(*) FROM user_interactions ui WHERE ui.post_id = p.id AND ui.created_at > datetime('now','-48 hours')),0)
       ) DESC, p.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset);
  return rows.map((r) => enrichPost(db, r, session_id));
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function enrichPost(
  db: Database,
  row: { id: number; session_id: string; generation_id: number | null; title: string; description: string; type: string; result: string; image_url: string | null; glb_url: string | null; created_at: string },
  viewer_session: string
): Post {
  const like_count = (db
    .prepare<{ c: number }, BindParams>(`SELECT COUNT(*) as c FROM post_likes WHERE post_id = ?`)
    .get(row.id)?.c) ?? 0;

  const comment_count = (db
    .prepare<{ c: number }, BindParams>(`SELECT COUNT(*) as c FROM post_comments WHERE post_id = ?`)
    .get(row.id)?.c) ?? 0;

  const tags = db
    .prepare<{ tag: string }, BindParams>(`SELECT tag FROM post_tags WHERE post_id = ? ORDER BY tag`)
    .all(row.id)
    .map((t) => t.tag);

  const liked_by_me = !!db
    .prepare<{ session_id: string; post_id: number }, BindParams>(
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
    image_url: row.image_url,
    glb_url: row.glb_url ?? null,
    created_at: row.created_at,
    like_count,
    comment_count,
    tags,
    liked_by_me,
  };
}

/** Genera un nombre de autor visible a partir de la session */
function authorName(session_id: string): string {
  // Derive a short numeric code instead of raw hex to look friendlier
  const raw = session_id.replace(/^(anon-|sess-)/, "");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) hash = (hash * 31 + raw.charCodeAt(i)) & 0x7fff;
  return `Aventurero #${hash % 9000 + 1000}`;
}
