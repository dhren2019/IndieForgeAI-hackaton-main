/**
 * POST /api/generate
 */
import { generateContent }        from "../services/ai.service";
import { ok, err }                from "../utils/response";
import { isValidGenerationType }  from "../utils/validators";
import { checkRateLimit, rateLimitResponse } from "../middleware/rate-limit";
import type { PromptMeta }        from "../types/generate";

export async function generateRoute(req: Request, sessionId: string): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err("Invalid JSON body");
  }

  const type = body.type;
  if (!isValidGenerationType(type)) {
    return err("type must be one of: npc, quest, item, lore, weapon, enemy");
  }

  if (!checkRateLimit(sessionId)) return rateLimitResponse();

  const model = typeof body.model === "string" ? body.model : undefined;
  const meta  = { ...body } as PromptMeta;
  delete (meta as Record<string, unknown>).type;
  delete (meta as Record<string, unknown>).model;

  const { generation } = await generateContent(sessionId, type, meta, model);
  return ok(generation);
}

/** @deprecated use generateRoute — kept for backwards-compat during transition */
export async function handleGenerate(req: Request): Promise<Response> {
  const cookie    = req.headers.get("cookie") ?? "";
  const match     = cookie.match(/session_id=([^;]+)/);
  const sessionId = match?.[1] ?? `anon-${crypto.randomUUID()}`;
  return generateRoute(req, sessionId);
}
