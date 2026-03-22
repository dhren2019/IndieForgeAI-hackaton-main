/**
 * POST /api/generate
 * Body: { type, ...meta }
 * Returns the generated + persisted object
 */

import { getDB, insertGeneration, type GenerationType } from "../db/client";
import { buildPrompt }          from "../lib/prompts";
import { callModel }            from "../lib/hf";
import { parseJSON, validateAndSanitize } from "../lib/parser";
import { getFallback }          from "../lib/fallback";

export async function handleGenerate(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const type = body.type as GenerationType;
  if (!["npc", "quest", "item", "lore", "weapon", "enemy"].includes(type)) {
    return json({ error: "type must be one of: npc, quest, item, lore, weapon, enemy" }, 400);
  }

  const session_id = getSessionId(req);
  const meta = { ...body };
  delete meta.type;

  const prompt   = buildPrompt(type, meta as never);
  const hfResult = await callModel(prompt);

  let result: Record<string, unknown>;
  let source: "model" | "fallback" = "model";

  if (hfResult.ok) {
    const parsed = parseJSON(hfResult.raw);
    if (parsed.ok && parsed.data) {
      const { valid, data, missingFields } = validateAndSanitize(type, parsed.data);
      if (valid) {
        result = data;
      } else {
        console.warn(`[generate] Missing fields ${missingFields.join(",")} — using fallback`);
        result = getFallback(type, meta);
        source = "fallback";
      }
    } else {
      console.warn(`[generate] Parse failed: ${parsed.error} — using fallback`);
      result = getFallback(type, meta);
      source = "fallback";
    }
  } else {
    console.warn(`[generate] Model error: ${hfResult.error} — using fallback`);
    result = getFallback(type, meta);
    source = "fallback";
  }

  const db  = getDB();
  const row = insertGeneration(db, {
    session_id,
    type,
    prompt_meta: meta,
    result,
    raw_output: hfResult.raw || null,
    source,
  });

  return json({ success: true, data: { ...row, result, prompt_meta: meta } });
}

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
