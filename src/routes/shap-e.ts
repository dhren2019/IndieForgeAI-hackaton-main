/**
 * POST /api/shap-e
 *
 * Generates a 3D GLB from a 2D image using hysts/Shap-E (HuggingFace Space).
 * Designed for quick generation of simple shapes — ideal for items, weapons,
 * enemies with non-complex geometry.
 *
 * Body:   { imageUrl: string }  — data URI or https URL
 * Returns: { glbUrl: string }
 */
import { Client } from "@gradio/client";
import { ENV }     from "../config/env";
import { ok, err } from "../utils/response";
import { logger }  from "../utils/logger";

const SPACE_ID = "hysts/Shap-E";

async function toBlob(imageUrl: string): Promise<Blob> {
  if (imageUrl.startsWith("data:")) {
    const comma = imageUrl.indexOf(",");
    const mime  = imageUrl.slice(5, imageUrl.indexOf(";"));
    const bytes = Buffer.from(imageUrl.slice(comma + 1), "base64");
    return new Blob([bytes], { type: mime });
  }
  const res = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`fetch image ${res.status}`);
  return res.blob();
}

function extractGlbUrl(data: unknown[]): string | null {
  for (const item of data) {
    if (typeof item === "string" && item.length > 0) return item;
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.url  === "string" && obj.url.length  > 0) return obj.url;
    if (typeof obj.path === "string" && obj.path.length > 0) return obj.path;
  }
  return null;
}

function serializeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}

export async function shapERoute(req: Request, _sessionId: string): Promise<Response> {
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return err("Invalid JSON body"); }

  const imageUrl = body.imageUrl;
  if (!imageUrl || typeof imageUrl !== "string")
    return err("imageUrl es requerido");

  logger.info(`[shap-e] img=${imageUrl.slice(0, 60)}`);

  let imageBlob: Blob;
  try {
    imageBlob = await toBlob(imageUrl);
    logger.info(`[shap-e] imageBlob size=${imageBlob.size} type=${imageBlob.type}`);
  } catch (e) {
    return err(`Shap-E: no se pudo preparar la imagen: ${serializeError(e)}`, 502);
  }

  let client: Client;
  try {
    client = await Client.connect(SPACE_ID, {
      token: ENV.HF_TOKEN as `hf_${string}` | undefined,
    });
    logger.info("[shap-e] connected to Space");
  } catch (e) {
    return err(`Shap-E: no se pudo conectar al Space: ${serializeError(e)}`, 502);
  }

  try {
    logger.info("[shap-e] running image-to-3d...");
    const result = await client.predict("/image-to-3d", {
      image:               imageBlob,
      seed:                0,
      guidance_scale:      3,
      num_inference_steps: 64,
    });
    logger.info(`[shap-e] result=${JSON.stringify(result.data).slice(0, 300)}`);

    const glbUrl = extractGlbUrl(result.data as unknown[]);
    if (!glbUrl) {
      logger.error(`[shap-e] no GLB in: ${JSON.stringify(result.data).slice(0, 400)}`);
      return err("Shap-E: no se encontró el modelo GLB en la respuesta", 502);
    }
    logger.info(`[shap-e] glbUrl=${glbUrl.slice(0, 100)}`);
    return ok({ glbUrl });
  } catch (e) {
    const msg = serializeError(e);
    logger.error(`[shap-e] error: ${msg}`);
    return err(`Shap-E: ${msg}`, 502);
  }
}
