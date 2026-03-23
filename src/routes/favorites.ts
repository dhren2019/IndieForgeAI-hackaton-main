/**
 * POST   /api/favorite   { generation_id }  — add
 * DELETE /api/favorite   { generation_id }  — remove
 * GET    /api/favorites                     — list
 */
import { addToFavorites, removeFromFavorites, getUserFavorites } from "../services/favorite.service";
import { ok, err } from "../utils/response";

export function favoritesRoute(req: Request, sessionId: string): Promise<Response> | Response {
  if (req.method === "GET")    return ok(getUserFavorites(sessionId));
  if (req.method === "POST")   return addFavoriteRoute(req, sessionId);
  if (req.method === "DELETE") return removeFavoriteRoute(req, sessionId);
  return err("Method not allowed", 405);
}

async function addFavoriteRoute(req: Request, sessionId: string): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { generation_id?: number } | null;
  if (!body?.generation_id) return err("generation_id required");
  addToFavorites(sessionId, body.generation_id);
  return ok({ added: true });
}

async function removeFavoriteRoute(req: Request, sessionId: string): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { generation_id?: number } | null;
  if (!body?.generation_id) return err("generation_id required");
  removeFromFavorites(sessionId, body.generation_id);
  return ok({ removed: true });
}

/** @deprecated */
export function handleFavoriteToggle(req: Request): Promise<Response> | Response {
  const cookie    = req.headers.get("cookie") ?? "";
  const match     = cookie.match(/session_id=([^;]+)/);
  const sessionId = match?.[1] ?? `anon-${crypto.randomUUID()}`;
  return favoritesRoute(req, sessionId);
}
