/**
 * Rutas sociales — /api/social/*
 */
import {
  createSocialPost,
  getSocialPost,
  getSocialFeed,
  exploreSocialPosts,
  getTrending,
  getOwnPosts,
  deleteSocialPost,
  togglePostLike,
  getPostComments,
  addPostComment,
  followUserTag,
  unfollowUserTag,
  getUserFollowedTags,
  getPopularTagsList,
  recordUserInteraction,
} from "../services/post.service";
import { ok, err } from "../utils/response";
import type { UserInteractionType } from "../types/social";
import type { GenerationType } from "../types/generate";

export async function handleSocial(
  req: Request,
  sessionId: string,
  cookieSessionId?: string | null,
): Promise<Response> {
  const url      = new URL(req.url);
  const pathname = url.pathname; // e.g. /api/social/posts/3/like
  const session  = sessionId;
  const method   = req.method;

  // POST  /api/social/posts
  if (pathname === "/api/social/posts" && method === "POST")
    return handleCreatePost(req, session);

  // GET   /api/social/feed
  if (pathname === "/api/social/feed" && method === "GET")
    return handleFeed(url, session);

  // GET   /api/social/trending
  if (pathname === "/api/social/trending" && method === "GET")
    return handleTrending(url, session);

  // GET   /api/social/explore
  if (pathname === "/api/social/explore" && method === "GET")
    return handleExplore(url, session);

  // GET   /api/social/misposts
  if (pathname === "/api/social/misposts" && method === "GET")
    return handleMyPosts(session, cookieSessionId);

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

  // POST  /api/social/interactions  (señales ML del usuario)
  if (pathname === "/api/social/interactions" && method === "POST")
    return handleRecordInteraction(req, session);

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
  catch { return err("JSON inválido"); }

  const title        = String(body.title ?? "").trim();
  const description  = String(body.description ?? "").trim();
  const type         = body.type as GenerationType;
  const result       = body.result as Record<string, unknown>;
  const tags         = Array.isArray(body.tags) ? body.tags.map(String) : [];
  const gen_id       = typeof body.generation_id === "number" ? body.generation_id : null;
  const image_url    = typeof body.image_url === "string" ? body.image_url : null;
  const glb_url      = typeof body.glb_url === "string" ? body.glb_url : null;
  const display_name = typeof body.display_name === "string" ? body.display_name.trim().slice(0, 80) : "";

  if (!title)  return err("El título es obligatorio");
  if (!type || !["npc","quest","item","lore","weapon","enemy"].includes(type))
    return err("Tipo inválido");
  if (!result || typeof result !== "object")
    return err("Resultado inválido");

  const post = await createSocialPost({
    session_id: session, generation_id: gen_id,
    title, description, type, result, tags, image_url, glb_url, display_name,
  });
  return ok(post);
}

async function handleTrending(url: URL, session: string): Promise<Response> {
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 50);
  return ok(await getTrending(session, limit));
}

async function handleFeed(url: URL, session: string): Promise<Response> {
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 50);
  return ok(await getSocialFeed(session, limit));
}

async function handleExplore(url: URL, session: string): Promise<Response> {
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 50);
  const tag   = url.searchParams.get("tag") || null;
  const sort  = url.searchParams.get("sort") || "reciente";
  return ok(await exploreSocialPosts(session, tag, sort, limit));
}

async function handleMyPosts(session: string, cookieSessionId?: string | null): Promise<Response> {
  return ok(await getOwnPosts(session, cookieSessionId));
}

async function handleGetPost(id: number, session: string): Promise<Response> {
  const post = await getSocialPost(id, session);
  if (!post) return err("Publicación no encontrada", 404);
  return ok(post);
}

async function handleDeletePost(id: number, session: string): Promise<Response> {
  const deleted = await deleteSocialPost(id, session);
  if (!deleted) return err("No autorizado o no encontrado", 403);
  return ok({ deleted: true });
}

async function handleLike(postId: number, session: string): Promise<Response> {
  const liked = await togglePostLike(postId, session);
  if (liked) await recordUserInteraction(session, postId, "like");
  return ok({ liked });
}

async function handleGetComments(postId: number): Promise<Response> {
  return ok(await getPostComments(postId));
}

async function handleAddComment(req: Request, postId: number, session: string): Promise<Response> {
  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return err("JSON inválido"); }

  const content = String(body.content ?? "").trim();
  if (!content)         return err("El comentario no puede estar vacío");
  if (content.length > 300) return err("Máximo 300 caracteres");

  const comment = await addPostComment(postId, session, content);
  await recordUserInteraction(session, postId, "comment");
  return ok(comment);
}

async function handlePopularTags(): Promise<Response> {
  return ok(await getPopularTagsList());
}

async function handleFollowedTags(session: string): Promise<Response> {
  return ok(await getUserFollowedTags(session));
}

async function handleFollowTag(req: Request, session: string): Promise<Response> {
  const body = await req.json().catch(() => null) as { tag?: string } | null;
  const tag  = body?.tag?.trim().toLowerCase();
  if (!tag) return err("Etiqueta requerida");
  await followUserTag(session, tag);
  return ok({ following: tag });
}

async function handleUnfollowTag(req: Request, session: string): Promise<Response> {
  const body = await req.json().catch(() => null) as { tag?: string } | null;
  const tag  = body?.tag?.trim().toLowerCase();
  if (!tag) return err("Etiqueta requerida");
  await unfollowUserTag(session, tag);
  return ok({ unfollowed: tag });
}

async function handleRecordInteraction(req: Request, session: string): Promise<Response> {
  const body    = await req.json().catch(() => null) as { post_id?: number; action?: string } | null;
  const post_id = Number(body?.post_id);
  const action  = body?.action as UserInteractionType | undefined;
  if (!post_id || isNaN(post_id)) return err("post_id inválido");
  if (!action || !["view", "expand", "like", "comment"].includes(action))
    return err("action inválida");
  await recordUserInteraction(session, post_id, action);
  return ok({ recorded: true });
}

// getSessionId helper removed — sessionId is now resolved by the main server
// middleware (supports both Clerk JWT and cookie-based anonymous sessions)
