/**
 * GET /api/history?limit=20
 */
import { getGenerationHistory } from "../services/history.service";
import { ok } from "../utils/response";

export function historyRoute(req: Request, sessionId: string): Response {
  const url   = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 100);
  const rows  = getGenerationHistory(sessionId, limit);
  return ok(rows);
}

/** @deprecated */
export function handleHistory(req: Request): Response {
  const cookie    = req.headers.get("cookie") ?? "";
  const match     = cookie.match(/session_id=([^;]+)/);
  const sessionId = match?.[1] ?? `anon-${crypto.randomUUID()}`;
  return historyRoute(req, sessionId);
}
