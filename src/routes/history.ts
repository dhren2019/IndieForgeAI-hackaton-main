/**
 * GET /api/history?limit=20
 */
import { getGenerationHistory } from "../services/history.service";
import { ok } from "../utils/response";

export async function historyRoute(req: Request, sessionId: string): Promise<Response> {
  const url   = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 100);
  const rows  = await getGenerationHistory(sessionId, limit);
  return ok(rows);
}

/** @deprecated */
export async function handleHistory(req: Request): Promise<Response> {
  const cookie    = req.headers.get("cookie") ?? "";
  const match     = cookie.match(/session_id=([^;]+)/);
  const sessionId = match?.[1] ?? `anon-${crypto.randomUUID()}`;
  return historyRoute(req, sessionId);
}
