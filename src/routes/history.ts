/**
 * GET /api/history?limit=20
 */

import { getDB, getHistory } from "../db/client";

export function handleHistory(req: Request): Response {
  const url    = new URL(req.url);
  const limit  = Math.min(Number(url.searchParams.get("limit") ?? "20"), 100);
  const session_id = getSessionId(req);

  const db   = getDB();
  const rows = getHistory(db, session_id, limit);

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
