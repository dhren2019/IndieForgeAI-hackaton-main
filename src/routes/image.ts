/**
 * POST /api/imagen
 */
import { generateImage }         from "../services/image.service";
import { ok, err }               from "../utils/response";
import { isValidGenerationType } from "../utils/validators";
import type { GenerationType }   from "../types/generate";

export async function imageRoute(req: Request, _sessionId?: string): Promise<Response> {
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
    const msg    = result.error ?? "Error de generación";
    // 401/403 from HF → 502 (bad gateway / upstream auth), not 503
    const status = msg.startsWith("HF_AUTH_ERROR") ? 502 : 503;
    return err(
      status === 502
        ? "HF_TOKEN inválido o expirado (HF devuelvió 401). " +
          "1) Genera un nuevo token READ en huggingface.co/settings/tokens. " +
          "2) Actualiza HF_TOKEN en tu archivo .env. " +
          "3) REINICIA el servidor (bun run dev) para que cargue el nuevo valor."
        : msg,
      status
    );
  }

  return ok({ url: result.url, prompt: result.prompt });
}

/** @deprecated kept for backwards-compat */
export { imageRoute as handleImageGen };
