/**
 * PATCH /api/generations/:id/image  — saves image_url
 * PATCH /api/generations/:id/glb    — saves glb_url
 */
import { sql }                              from "bun";
import { updateGenerationImage, updateGenerationGlb } from "../db/client";
import { ok, err }                          from "../utils/response";

export async function saveGenerationImageRoute(
  req: Request,
  sessionId: string,
  id: number
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err("Invalid JSON body");
  }

  if (!body.image_url || typeof body.image_url !== "string") {
    return err("image_url requerida");
  }

  const rows = await sql`SELECT id, session_id FROM generations WHERE id = ${id}`;
  const gen  = rows[0] as { id: number; session_id: string } | undefined;

  if (!gen) return err("Not found", 404);
  if (gen.session_id !== sessionId) return err("Forbidden", 403);

  await updateGenerationImage(id, body.image_url);
  return ok({ saved: true });
}

export async function saveGenerationGlbRoute(
  req: Request,
  sessionId: string,
  id: number
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err("Invalid JSON body");
  }

  if (!body.glb_url || typeof body.glb_url !== "string") {
    return err("glb_url requerida");
  }

  const rows = await sql`SELECT id, session_id FROM generations WHERE id = ${id}`;
  const gen  = rows[0] as { id: number; session_id: string } | undefined;

  if (!gen) return err("Not found", 404);
  if (gen.session_id !== sessionId) return err("Forbidden", 403);

  await updateGenerationGlb(id, body.glb_url);
  return ok({ saved: true });
}
