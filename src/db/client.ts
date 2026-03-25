import { sql } from "bun";

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
  image_url: string | null;
  glb_url: string | null;
  created_at: string;
}

export interface Favorite {
  id: number;
  session_id: string;
  generation_id: number;
  created_at: string;
}

/** No-op kept for backwards-compat â€” callers can be cleaned up over time */
export function getDB(): null { return null; }

function deserializeGeneration(row: Record<string, unknown>): Generation {
  return {
    id:          row.id as number,
    session_id:  row.session_id as string,
    type:        row.type as GenerationType,
    prompt_meta: typeof row.prompt_meta === "string"
      ? JSON.parse(row.prompt_meta)
      : (row.prompt_meta as Record<string, unknown>) ?? {},
    result: typeof row.result === "string"
      ? JSON.parse(row.result)
      : (row.result as Record<string, unknown>) ?? {},
    raw_output: (row.raw_output as string | null) ?? null,
    source:     (row.source as "model" | "fallback") ?? "model",
    image_url:  (row.image_url as string | null) ?? null,
    glb_url:    (row.glb_url as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// Generations
// ---------------------------------------------------------------------------

export async function insertGeneration(params: {
  session_id: string;
  type: GenerationType;
  prompt_meta: Record<string, unknown>;
  result: Record<string, unknown>;
  raw_output: string | null;
  source: "model" | "fallback";
}): Promise<Generation> {
  const rows = await sql`
    INSERT INTO generations (session_id, type, prompt_meta, result, raw_output, source)
    VALUES (${params.session_id}, ${params.type},
            ${JSON.stringify(params.prompt_meta)}, ${JSON.stringify(params.result)},
            ${params.raw_output}, ${params.source})
    RETURNING *
  `;
  return deserializeGeneration(rows[0] as Record<string, unknown>);
}

export async function getHistory(session_id: string, limit = 20): Promise<Generation[]> {
  const rows = await sql`
    SELECT * FROM generations
    WHERE session_id = ${session_id}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return (rows as Record<string, unknown>[]).map(deserializeGeneration);
}

export async function addFavorite(session_id: string, generation_id: number): Promise<void> {
  await sql`
    INSERT INTO favorites (session_id, generation_id)
    VALUES (${session_id}, ${generation_id})
    ON CONFLICT DO NOTHING
  `;
}

export async function removeFavorite(session_id: string, generation_id: number): Promise<void> {
  await sql`
    DELETE FROM favorites
    WHERE session_id = ${session_id} AND generation_id = ${generation_id}
  `;
}

export async function getFavorites(session_id: string): Promise<Generation[]> {
  const rows = await sql`
    SELECT g.* FROM generations g
    INNER JOIN favorites f ON f.generation_id = g.id
    WHERE f.session_id = ${session_id}
    ORDER BY f.created_at DESC
  `;
  return (rows as Record<string, unknown>[]).map(deserializeGeneration);
}

export async function updateGenerationImage(id: number, image_url: string): Promise<void> {
  await sql`UPDATE generations SET image_url = ${image_url} WHERE id = ${id}`;
}

export async function updateGenerationGlb(id: number, glb_url: string): Promise<void> {
  await sql`UPDATE generations SET glb_url = ${glb_url} WHERE id = ${id}`;
}

// ---------------------------------------------------------------------------
// Social â€” Posts
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
  glb_url: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  tags: string[];
  liked_by_me: boolean;
  author: string;        // display_name from DB, or computed "Aventurero #XXXX"
}

export interface Comment {
  id: number;
  post_id: number;
  session_id: string;
  author: string;
  content: string;
  created_at: string;
}

/** Crea una publicación y asocia etiquetas */
export async function createPost(params: {
  session_id: string;
  generation_id: number | null;
  title: string;
  description: string;
  type: GenerationType;
  result: Record<string, unknown>;
  tags: string[];
  image_url?: string | null;
  glb_url?: string | null;
  display_name?: string;
}): Promise<Post> {
  const displayName = (params.display_name ?? "").slice(0, 80);
  const rows = await sql`
    INSERT INTO posts (session_id, generation_id, title, description, type, result, image_url, glb_url, display_name)
    VALUES (${params.session_id}, ${params.generation_id},
            ${params.title.slice(0, 120)}, ${params.description.slice(0, 500)},
            ${params.type}, ${JSON.stringify(params.result)},
            ${params.image_url ?? null}, ${params.glb_url ?? null}, ${displayName})
    RETURNING *
  `;
  const post = rows[0] as Record<string, unknown>;

  const cleanTags = params.tags
    .slice(0, 8)
    .map((t) => t.toLowerCase().replace(/[^a-z0-9\u00e0-\u00ff_-]/gi, "").slice(0, 30))
    .filter(Boolean);

  for (const tag of cleanTags) {
    await sql`
      INSERT INTO post_tags (post_id, tag) VALUES (${post.id as number}, ${tag})
      ON CONFLICT DO NOTHING
    `;
  }

  return enrichPost(post, params.session_id);
}

/** Obtiene una publicaciÃ³n por ID con mÃ©tricas */
export async function getPostById(id: number, session_id: string): Promise<Post | null> {
  const rows = await sql`SELECT * FROM posts WHERE id = ${id}`;
  if (rows.length === 0) return null;
  return enrichPost(rows[0] as Record<string, unknown>, session_id);
}

export type UserInteractionType = "view" | "expand" | "like" | "comment";

/**
 * Registra una interacciÃ³n del usuario con una publicaciÃ³n.
 * 'view' se deduplica por sesiÃ³n+post en los Ãºltimos 30 min.
 */
export async function recordInteraction(
  session_id: string,
  post_id: number,
  action: UserInteractionType
): Promise<void> {
  if (action === "view") {
    const recent = await sql`
      SELECT COUNT(*) as c FROM user_interactions
      WHERE session_id = ${session_id} AND post_id = ${post_id} AND action = 'view'
        AND created_at > NOW() - INTERVAL '30 minutes'
    `;
    if (Number((recent[0] as Record<string, unknown>)?.c ?? 0) > 0) return;
  }
  await sql`
    INSERT INTO user_interactions (session_id, post_id, action)
    VALUES (${session_id}, ${post_id}, ${action})
  `;
}

/**
 * Feed de recomendaciÃ³n con algoritmo ML de 6 seÃ±ales:
 *
 *  S1  Etiquetas seguidas directamente                     peso 5.0
 *  S2  Afinidad por tipo basada en historial de acciones   peso ~0.5Ã—suma
 *  S3  Afinidad histÃ³rica por etiqueta (interacciones)     peso 2.0
 *  S4  Filtrado colaborativo (usuarios con gustos similares) peso 3.5
 *  S5  Popularidad social (likes totales)                  peso 0.4
 *  S6  Recencia â€” decaimiento exponencial (tÂ½ â‰ˆ 3 dÃ­as)    peso 4.0 Ã— e^(-d/3)
 *  P   PenalizaciÃ³n: ya visto recientemente                -1.5 por vista
 *
 * Los posts ya marcados con â¤ï¸ por el usuario se excluyen del feed.
 */
export async function getFeed(
  session_id: string,
  limit = 20,
  offset = 0
): Promise<Post[]> {
  const rows = await sql`
    SELECT p.id, p.session_id, p.generation_id, p.title,
           p.description, p.type, p.result, p.image_url, p.glb_url, p.created_at
    FROM posts p
    WHERE p.session_id != ${session_id}
      AND NOT EXISTS (
        SELECT 1 FROM post_likes
        WHERE session_id = ${session_id} AND post_id = p.id
      )
    ORDER BY (

      /* â”€â”€ S1: Etiquetas seguidas directamente â”€â”€ */
      COALESCE((
        SELECT COUNT(*) * 5.0
        FROM post_tags pt
        INNER JOIN tag_follows tf ON tf.tag = pt.tag
        WHERE pt.post_id = p.id AND tf.session_id = ${session_id}
      ), 0.0)

      +

      /* â”€â”€ S2: Afinidad por tipo de contenido (historial ponderado) â”€â”€ */
      COALESCE((
        SELECT SUM(CASE ui.action
          WHEN 'like'    THEN 3.0
          WHEN 'comment' THEN 2.5
          WHEN 'expand'  THEN 1.0
          ELSE 0.1
        END) * 0.5
        FROM user_interactions ui
        INNER JOIN posts p2 ON p2.id = ui.post_id
        WHERE ui.session_id = ${session_id}
          AND p2.type = p.type
          AND ui.created_at > NOW() - INTERVAL '45 days'
      ), 0.0)

      +

      /* â”€â”€ S3: Afinidad histÃ³rica por etiqueta â”€â”€ */
      COALESCE((
        SELECT COUNT(*) * 2.0
        FROM post_tags pt_curr
        INNER JOIN post_tags pt_hist ON pt_hist.tag = pt_curr.tag
        INNER JOIN user_interactions ui2 ON ui2.post_id = pt_hist.post_id
        WHERE pt_curr.post_id = p.id
          AND ui2.session_id = ${session_id}
          AND ui2.action IN ('like', 'comment', 'expand')
          AND ui2.created_at > NOW() - INTERVAL '30 days'
      ), 0.0)

      +

      /* â”€â”€ S4: Filtrado colaborativo (usuarios con gustos similares) â”€â”€ */
      COALESCE((
        SELECT COUNT(DISTINCT pl_sim.session_id) * 3.5
        FROM post_likes pl_sim
        WHERE pl_sim.post_id = p.id
          AND pl_sim.session_id IN (
            SELECT DISTINCT pl_shared.session_id
            FROM post_likes pl_shared
            WHERE pl_shared.post_id IN (
              SELECT post_id FROM post_likes WHERE session_id = ${session_id}
            )
            AND pl_shared.session_id != ${session_id}
          )
      ), 0.0)

      +

      /* â”€â”€ S5: Popularidad social (likes totales) â”€â”€ */
      COALESCE((
        SELECT COUNT(*) * 0.4
        FROM post_likes pl_pop
        WHERE pl_pop.post_id = p.id
      ), 0.0)

      +

      /* â”€â”€ S6: Recencia â€” decaimiento exponencial (tÂ½ â‰ˆ 3 dÃ­as) â”€â”€ */
      EXP(-(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400.0) / 3.0) * 4.0

      -

      /* â”€â”€ PenalizaciÃ³n: ya visto en las Ãºltimas 24 h â”€â”€ */
      COALESCE((
        SELECT COUNT(*) * 1.5
        FROM user_interactions vi_seen
        WHERE vi_seen.session_id = ${session_id}
          AND vi_seen.post_id = p.id
          AND vi_seen.action = 'view'
          AND vi_seen.created_at > NOW() - INTERVAL '24 hours'
      ), 0.0)

    ) DESC, p.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const results: Post[] = [];
  for (const row of rows as Record<string, unknown>[]) {
    results.push(await enrichPost(row, session_id));
  }
  return results;
}

/** Posts de exploraciÃ³n (todos, mÃ¡s recientes o mÃ¡s populares) */
export async function explorePosts(
  session_id: string,
  tag: string | null,
  sort: string = "reciente",
  limit = 20,
  offset = 0
): Promise<Post[]> {
  let rows: Record<string, unknown>[];

  if (sort === "popular") {
    if (tag) {
      rows = await sql`
        SELECT p.* FROM posts p
        INNER JOIN post_tags pt ON pt.post_id = p.id
        WHERE pt.tag = ${tag}
        ORDER BY (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) DESC, p.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      ` as Record<string, unknown>[];
    } else {
      rows = await sql`
        SELECT p.* FROM posts p
        ORDER BY (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) DESC, p.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      ` as Record<string, unknown>[];
    }
  } else {
    if (tag) {
      rows = await sql`
        SELECT p.* FROM posts p
        INNER JOIN post_tags pt ON pt.post_id = p.id
        WHERE pt.tag = ${tag}
        ORDER BY p.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      ` as Record<string, unknown>[];
    } else {
      rows = await sql`
        SELECT p.* FROM posts p
        ORDER BY p.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      ` as Record<string, unknown>[];
    }
  }

  const results: Post[] = [];
  for (const row of rows) {
    results.push(await enrichPost(row, session_id));
  }
  return results;
}

/** Posts propios del usuario (incluye posts del cookie-session si el usuario está en Clerk) */
export async function getMyPosts(session_id: string, cookie_session_id?: string | null): Promise<Post[]> {
  let rows: Record<string, unknown>[];
  if (cookie_session_id && cookie_session_id !== session_id) {
    // Clerk user: merge their Clerk posts + their old anonymous cookie posts
    rows = await sql`
      SELECT * FROM posts
      WHERE session_id = ${session_id} OR session_id = ${cookie_session_id}
      ORDER BY created_at DESC
    ` as Record<string, unknown>[];
  } else {
    rows = await sql`
      SELECT * FROM posts WHERE session_id = ${session_id} ORDER BY created_at DESC
    ` as Record<string, unknown>[];
  }
  const results: Post[] = [];
  for (const row of rows) {
    results.push(await enrichPost(row, session_id));
  }
  return results;
}

/** Elimina una publicaciÃ³n propia */
export async function deletePost(id: number, session_id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM posts WHERE id = ${id} AND session_id = ${session_id}
    RETURNING id
  `;
  return result.length > 0;
}

/** Posts con mÃ¡s actividad en las Ãºltimas 48 h (trending) */
export async function getTrendingPosts(
  session_id: string,
  limit = 20,
  offset = 0
): Promise<Post[]> {
  const rows = await sql`
    SELECT p.id, p.session_id, p.generation_id, p.title,
           p.description, p.type, p.result, p.image_url, p.glb_url, p.created_at
    FROM posts p
    WHERE p.created_at > NOW() - INTERVAL '7 days'
    ORDER BY (
      COALESCE((SELECT COUNT(*) FROM post_likes    pl WHERE pl.post_id = p.id AND pl.created_at  > NOW() - INTERVAL '48 hours'), 0) * 3 +
      COALESCE((SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id AND pc.created_at  > NOW() - INTERVAL '48 hours'), 0) * 2 +
      COALESCE((SELECT COUNT(*) FROM user_interactions ui WHERE ui.post_id = p.id AND ui.created_at > NOW() - INTERVAL '48 hours'), 0)
    ) DESC, p.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const results: Post[] = [];
  for (const row of rows as Record<string, unknown>[]) {
    results.push(await enrichPost(row, session_id));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Social â€” Likes
// ---------------------------------------------------------------------------

export async function toggleLike(session_id: string, post_id: number): Promise<boolean> {
  const existing = await sql`
    SELECT 1 FROM post_likes WHERE session_id = ${session_id} AND post_id = ${post_id}
  `;
  if (existing.length > 0) {
    await sql`DELETE FROM post_likes WHERE session_id = ${session_id} AND post_id = ${post_id}`;
    return false;
  } else {
    await sql`
      INSERT INTO post_likes (session_id, post_id) VALUES (${session_id}, ${post_id})
      ON CONFLICT DO NOTHING
    `;
    return true;
  }
}

// ---------------------------------------------------------------------------
// Social â€” Comentarios
// ---------------------------------------------------------------------------

export async function addComment(
  session_id: string,
  post_id: number,
  content: string
): Promise<Comment> {
  const rows = await sql`
    INSERT INTO post_comments (session_id, post_id, content)
    VALUES (${session_id}, ${post_id}, ${content.slice(0, 300)})
    RETURNING *
  `;
  const row = rows[0] as Record<string, unknown>;
  return { ...row, author: authorName(row.session_id as string) } as unknown as Comment;
}

export async function getComments(post_id: number): Promise<Comment[]> {
  const rows = await sql`
    SELECT * FROM post_comments WHERE post_id = ${post_id} ORDER BY created_at ASC
  `;
  return (rows as Record<string, unknown>[]).map((r) => ({
    ...r,
    author: authorName(r.session_id as string),
  })) as unknown as Comment[];
}

// ---------------------------------------------------------------------------
// Social â€” Etiquetas
// ---------------------------------------------------------------------------

export async function followTag(session_id: string, tag: string): Promise<void> {
  await sql`
    INSERT INTO tag_follows (session_id, tag) VALUES (${session_id}, ${tag})
    ON CONFLICT DO NOTHING
  `;
}

export async function unfollowTag(session_id: string, tag: string): Promise<void> {
  await sql`DELETE FROM tag_follows WHERE session_id = ${session_id} AND tag = ${tag}`;
}

export async function getFollowedTags(session_id: string): Promise<string[]> {
  const rows = await sql`
    SELECT tag FROM tag_follows WHERE session_id = ${session_id} ORDER BY tag
  `;
  return (rows as { tag: string }[]).map((r) => r.tag);
}

export async function getPopularTags(limit = 30): Promise<{ tag: string; count: number }[]> {
  const rows = await sql`
    SELECT tag, COUNT(*) as count FROM post_tags
    GROUP BY tag ORDER BY count DESC LIMIT ${limit}
  `;
  return rows as { tag: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

async function enrichPost(
  row: Record<string, unknown>,
  viewer_session: string
): Promise<Post> {
  const postId = row.id as number;

  const [likeRows, commentRows, tagRows, likedRows] = await Promise.all([
    sql`SELECT COUNT(*) as c FROM post_likes    WHERE post_id = ${postId}`,
    sql`SELECT COUNT(*) as c FROM post_comments WHERE post_id = ${postId}`,
    sql`SELECT tag FROM post_tags WHERE post_id = ${postId} ORDER BY tag`,
    sql`SELECT 1 FROM post_likes WHERE session_id = ${viewer_session} AND post_id = ${postId}`,
  ]);

  const like_count    = Number((likeRows[0]    as Record<string, unknown>)?.c ?? 0);
  const comment_count = Number((commentRows[0] as Record<string, unknown>)?.c ?? 0);
  const tags          = (tagRows as { tag: string }[]).map((t) => t.tag);
  const liked_by_me   = likedRows.length > 0;

  const storedName = (row.display_name as string | null) ?? "";
  return {
    id:            postId,
    session_id:    row.session_id as string,
    generation_id: (row.generation_id as number | null) ?? null,
    title:         row.title as string,
    description:   row.description as string,
    type:          row.type as GenerationType,
    result:        typeof row.result === "string"
      ? JSON.parse(row.result)
      : (row.result as Record<string, unknown>),
    image_url:     (row.image_url as string | null) ?? null,
    glb_url:       (row.glb_url as string | null) ?? null,
    created_at:    row.created_at as string,
    like_count,
    comment_count,
    tags,
    liked_by_me,
    author: storedName || authorName(row.session_id as string),
  };
}

/** Genera un nombre de autor visible a partir de la session */
function authorName(session_id: string): string {
  const raw = session_id.replace(/^(anon-|sess-)/, "");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) hash = (hash * 31 + raw.charCodeAt(i)) & 0x7fff;
  return `Aventurero #${hash % 9000 + 1000}`;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export interface Project {
  id:         number;
  session_id: string;
  name:       string;
  emoji:      string;
  created_at: string;
  item_count: number;
}

export async function createProject(session_id: string, name: string, emoji = "📁"): Promise<Project> {
  const rows = await sql`
    INSERT INTO projects (session_id, name, emoji)
    VALUES (${session_id}, ${name.slice(0, 100)}, ${emoji})
    RETURNING *
  `;
  return { ...(rows[0] as Record<string, unknown>), item_count: 0 } as unknown as Project;
}

export async function getProjects(session_id: string): Promise<Project[]> {
  const rows = await sql`
    SELECT p.*, COALESCE(i.c, 0) as item_count
    FROM projects p
    LEFT JOIN (
      SELECT project_id, COUNT(*) as c FROM project_items GROUP BY project_id
    ) i ON i.project_id = p.id
    WHERE p.session_id = ${session_id}
    ORDER BY p.created_at DESC
  `;
  return rows as unknown as Project[];
}

export async function deleteProject(id: number, session_id: string): Promise<boolean> {
  const res = await sql`
    DELETE FROM projects WHERE id = ${id} AND session_id = ${session_id} RETURNING id
  `;
  return res.length > 0;
}

export async function addToProject(project_id: number, generation_id: number, session_id: string): Promise<boolean> {
  // verify ownership of the project
  const own = await sql`SELECT 1 FROM projects WHERE id = ${project_id} AND session_id = ${session_id}`;
  if (own.length === 0) return false;
  await sql`
    INSERT INTO project_items (project_id, generation_id) VALUES (${project_id}, ${generation_id})
    ON CONFLICT DO NOTHING
  `;
  return true;
}

export async function removeFromProject(project_id: number, generation_id: number, session_id: string): Promise<boolean> {
  const own = await sql`SELECT 1 FROM projects WHERE id = ${project_id} AND session_id = ${session_id}`;
  if (own.length === 0) return false;
  await sql`
    DELETE FROM project_items WHERE project_id = ${project_id} AND generation_id = ${generation_id}
  `;
  return true;
}

export async function getProjectItems(project_id: number, session_id: string): Promise<Generation[]> {
  const own = await sql`SELECT 1 FROM projects WHERE id = ${project_id} AND session_id = ${session_id}`;
  if (own.length === 0) return [];
  const rows = await sql`
    SELECT g.* FROM generations g
    INNER JOIN project_items pi ON pi.generation_id = g.id
    WHERE pi.project_id = ${project_id}
    ORDER BY pi.added_at DESC
  `;
  return (rows as Record<string, unknown>[]).map(deserializeGeneration);
}

export async function updateProject(id: number, session_id: string, name: string, emoji: string): Promise<Project | null> {
  const rows = await sql`
    UPDATE projects SET name = ${name.slice(0, 100)}, emoji = ${emoji}
    WHERE id = ${id} AND session_id = ${session_id}
    RETURNING *
  `;
  if (rows.length === 0) return null;
  const cnt = await sql`SELECT COUNT(*) as c FROM project_items WHERE project_id = ${id}`;
  const item_count = Number((cnt[0] as { c: string }).c);
  return { ...(rows[0] as Record<string, unknown>), item_count } as unknown as Project;
}

/** Returns a set of project_ids that contain a given generation (for the current user) */
export async function getGenerationProjects(generation_id: number, session_id: string): Promise<number[]> {
  const rows = await sql`
    SELECT pi.project_id FROM project_items pi
    INNER JOIN projects p ON p.id = pi.project_id
    WHERE pi.generation_id = ${generation_id} AND p.session_id = ${session_id}
  `;
  return (rows as { project_id: number }[]).map((r) => r.project_id);
}
