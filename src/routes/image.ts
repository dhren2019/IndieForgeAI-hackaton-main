/**
 * POST /api/imagen
 */
import { generateImage }         from "../services/image.service";
import { ok, err }               from "../utils/response";
import { isValidGenerationType } from "../utils/validators";
import type { GenerationType }   from "../types/generate";

export async function imageRoute(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err("Invalid JSON body");
  }

  if (!isValidGenerationType(body.type)) {
    return err("Tipo inválido");
  }

  if (!body.result || typeof body.result !== "object") {
    return err("Resultado inválido");
  }

  const result = await generateImage(
    body.type as GenerationType,
    body.result as Record<string, unknown>
  );

  if (!result.url) {
    return err(result.error ?? "Error de generación", 503);
  }

  return ok({ url: result.url, prompt: result.prompt });
}

/** @deprecated kept for backwards-compat */
export { imageRoute as handleImageGen };
