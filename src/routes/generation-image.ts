/**
 * PATCH /api/generations/:id/image
 * Saves the generated image URL for a generation.
 */
import { getDB, updateGenerationImage } from "../db/client";
import { ok, err }                       from "../utils/response";

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

  const db = getDB();
  // Only allow the owner to update
  const gen = db
    .prepare<{ id: number; session_id: string }, [number]>(
      "SELECT id, session_id FROM generations WHERE id = ?"
    )
    .get(id);

  if (!gen) return err("Not found", 404);
  if (gen.session_id !== sessionId) return err("Forbidden", 403);

  updateGenerationImage(db, id, body.image_url);
  return ok({ saved: true });
}
