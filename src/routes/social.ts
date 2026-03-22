/**
 * Rutas sociales — /api/social/*
 * Publicaciones, etiquetas, likes y comentarios en español.
 */

import {
  getDB,
  createPost,
  getPostById,
  getFeed,
  explorePosts,
  getMyPosts,
  deletePost,
  toggleLike,
  addComment,
  getComments,
  followTag,
  unfollowTag,
  getFollowedTags,
  getPopularTags,
  type GenerationType,
} from "../db/client";

// ---------------------------------------------------------------------------
// Dispatcher principal
// ---------------------------------------------------------------------------

export async function handleSocial(req: Request): Promise<Response> {
  const url      = new URL(req.url);
  const pathname = url.pathname; // e.g. /api/social/posts/3/like
  const session  = getSessionId(req);
  const method   = req.method;

  // POST  /api/social/posts
  if (pathname === "/api/social/posts" && method === "POST")
    return handleCreatePost(req, session);

  // GET   /api/social/feed
  if (pathname === "/api/social/feed" && method === "GET")
    return handleFeed(url, session);

  // GET   /api/social/explore
  if (pathname === "/api/social/explore" && method === "GET")
    return handleExplore(url, session);

  // GET   /api/social/misposts
  if (pathname === "/api/social/misposts" && method === "GET")
    return handleMyPosts(session);

  // GET   /api/social/tags/populares
  if (pathname === "/api/social/tags/populares" && method === "GET")
    return handlePopularTags();

  // GET   /api/social/tags/siguiendo
  if (pathname === "/api/social/tags/siguiendo" && method === "GET")
    return handleFollowedTags(session);

  // POST  /api/social/tags/seguir
  if (pathname === "/api/social/tags/seguir" && method === "POST")
    return handleFollowTag(req, session);

  // POST  /api/social/tags/dejar
  if (pathname === "/api/social/tags/dejar" && method === "POST")
    return handleUnfollowTag(req, session);

  // Rutas con ID: /api/social/posts/:id[/...]
  const postMatch = pathname.match(/^\/api\/social\/posts\/(\d+)(\/.*)?$/);
  if (postMatch) {
    const postId = Number(postMatch[1]);
    const sub    = postMatch[2] ?? "";

    if (sub === "" && method === "GET")    return handleGetPost(postId, session);
    if (sub === "" && method === "DELETE") return handleDeletePost(postId, session);
    if (sub === "/like" && method === "POST") return handleLike(postId, session);
    if (sub === "/comentarios" && method === "GET")  return handleGetComments(postId);
    if (sub === "/comentarios" && method === "POST") return handleAddComment(req, postId, session);
  }

  return json({ error: "Ruta no encontrada" }, 404);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleCreatePost(req: Request, session: string): Promise<Response> {
  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return json({ error: "JSON inválido" }, 400); }

  const title       = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const type        = body.type as GenerationType;
  const result      = body.result as Record<string, unknown>;
  const tags        = Array.isArray(body.tags) ? body.tags.map(String) : [];
  const gen_id      = typeof body.generation_id === "number" ? body.generation_id : null;

  if (!title)  return json({ error: "El título es obligatorio" }, 400);
  if (!type || !["npc","quest","item","lore","weapon","enemy"].includes(type))
    return json({ error: "Tipo inválido" }, 400);
  if (!result || typeof result !== "object")
    return json({ error: "Resultado inválido" }, 400);

  const db   = getDB();
  const post = createPost(db, { session_id: session, generation_id: gen_id, title, description, type, result, tags });
  return json({ success: true, data: post });
}

function handleFeed(url: URL, session: string): Response {
  const limit  = Math.min(Number(url.searchParams.get("limit")  ?? "20"), 50);
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const db     = getDB();
  const posts  = getFeed(db, session, limit, offset);
  return json({ success: true, data: posts });
}

function handleExplore(url: URL, session: string): Response {
  const limit  = Math.min(Number(url.searchParams.get("limit")  ?? "20"), 50);
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const tag    = url.searchParams.get("tag") || null;
  const db     = getDB();
  const posts  = explorePosts(db, session, tag, limit, offset);
  return json({ success: true, data: posts });
}

function handleMyPosts(session: string): Response {
  const db    = getDB();
  const posts = getMyPosts(db, session);
  return json({ success: true, data: posts });
}

function handleGetPost(id: number, session: string): Response {
  const db   = getDB();
  const post = getPostById(db, id, session);
  if (!post) return json({ error: "Publicación no encontrada" }, 404);
  return json({ success: true, data: post });
}

function handleDeletePost(id: number, session: string): Response {
  const db = getDB();
  const ok = deletePost(db, id, session);
  if (!ok) return json({ error: "No autorizado o no encontrado" }, 403);
  return json({ success: true });
}

function handleLike(postId: number, session: string): Response {
  const db    = getDB();
  const liked = toggleLike(db, session, postId);
  return json({ success: true, liked });
}

function handleGetComments(postId: number): Response {
  const db       = getDB();
  const comments = getComments(db, postId);
  return json({ success: true, data: comments });
}

async function handleAddComment(req: Request, postId: number, session: string): Promise<Response> {
  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return json({ error: "JSON inválido" }, 400); }

  const content = String(body.content ?? "").trim();
  if (!content) return json({ error: "El comentario no puede estar vacío" }, 400);
  if (content.length > 300) return json({ error: "Máximo 300 caracteres" }, 400);

  const db      = getDB();
  const comment = addComment(db, session, postId, content);
  return json({ success: true, data: comment });
}

function handlePopularTags(): Response {
  const db   = getDB();
  const tags = getPopularTags(db, 40);
  return json({ success: true, data: tags });
}

function handleFollowedTags(session: string): Response {
  const db   = getDB();
  const tags = getFollowedTags(db, session);
  return json({ success: true, data: tags });
}

async function handleFollowTag(req: Request, session: string): Promise<Response> {
  const body = await req.json().catch(() => null) as { tag?: string } | null;
  const tag  = body?.tag?.trim().toLowerCase();
  if (!tag)  return json({ error: "Etiqueta requerida" }, 400);
  followTag(getDB(), session, tag);
  return json({ success: true });
}

async function handleUnfollowTag(req: Request, session: string): Promise<Response> {
  const body = await req.json().catch(() => null) as { tag?: string } | null;
  const tag  = body?.tag?.trim().toLowerCase();
  if (!tag)  return json({ error: "Etiqueta requerida" }, 400);
  unfollowTag(getDB(), session, tag);
  return json({ success: true });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getSessionId(req: Request): string {
  const cookie = req.headers.get("cookie") ?? "";
  const match  = cookie.match(/session_id=([^;]+)/);
  return match?.[1] ?? `anon-${crypto.randomUUID()}`;
}
