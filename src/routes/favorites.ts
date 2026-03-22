/**
 * POST /api/favorite   { generation_id }  — toggle add
 * DELETE /api/favorite { generation_id }  — remove
 * GET  /api/favorites                     — list
 */

import { getDB, addFavorite, removeFavorite, getFavorites } from "../db/client";

export function handleFavoriteToggle(req: Request): Promise<Response> | Response {
  if (req.method === "GET") return handleGetFavorites(req);
  if (req.method === "POST") return handleAddFavorite(req);
  if (req.method === "DELETE") return handleRemoveFavorite(req);
  return json({ error: "Method not allowed" }, 405);
}

async function handleAddFavorite(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { generation_id?: number } | null;
  if (!body?.generation_id) return json({ error: "generation_id required" }, 400);

  const session_id = getSessionId(req);
  const db = getDB();
  addFavorite(db, session_id, body.generation_id);
  return json({ success: true });
}

async function handleRemoveFavorite(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { generation_id?: number } | null;
  if (!body?.generation_id) return json({ error: "generation_id required" }, 400);

  const session_id = getSessionId(req);
  const db = getDB();
  removeFavorite(db, session_id, body.generation_id);
  return json({ success: true });
}

function handleGetFavorites(req: Request): Response {
  const session_id = getSessionId(req);
  const db   = getDB();
  const rows = getFavorites(db, session_id);
  return json({ success: true, data: rows });
}

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
