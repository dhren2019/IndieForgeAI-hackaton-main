/**
 * POST /api/trellis
 *
 * Generates a 3-D model (.glb) from a 2-D character image using
 * Microsoft TRELLIS.2 (ZeroGPU Space on HuggingFace).
 *
 * Body:   { imageUrl: string }   — data URI or https URL
 * Returns: { glbUrl: string }
 *
 * Uses @gradio/client which handles ZeroGPU JWT, queue, and WebSocket/SSE
 * automatically. The raw REST /gradio_api/call/ endpoint does NOT work for
 * ZeroGPU spaces — only the official client does.
 */
import { Client } from "@gradio/client";
import { ENV }     from "../config/env";
import { ok, err } from "../utils/response";
import { logger }  from "../utils/logger";

const SPACE_ID = process.env.TRELLIS_SPACE_ID ?? "microsoft/TRELLIS.2";

// -- Helpers ------------------------------------------------------------------

/**
 * Convert a data: URI or https:// URL to a Blob for @gradio/client.
 */
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

// -- Route handler ------------------------------------------------------------

export async function trellisRoute(req: Request, _sessionId: string): Promise<Response> {
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return err("Invalid JSON body"); }

  const imageUrl = body.imageUrl;
  if (!imageUrl || typeof imageUrl !== "string")
    return err("imageUrl es requerido");

  logger.info(`[trellis] space=${SPACE_ID} img=${imageUrl.slice(0, 60)}`);

  // -- Build image Blob -------------------------------------------------------
  let imageBlob: Blob;
  try {
    imageBlob = await toBlob(imageUrl);
    logger.info(`[trellis] imageBlob size=${imageBlob.size} type=${imageBlob.type}`);
  } catch (e) {
    return err(`TRELLIS: no se pudo preparar la imagen: ${e instanceof Error ? e.message : e}`, 502);
  }

  // -- Connect (\@gradio/client handles ZeroGPU JWT automatically) ------------
  let client: Client;
  try {
    client = await Client.connect(SPACE_ID, {
      token: ENV.HF_TOKEN as `hf_${string}` | undefined,
    });
    logger.info("[trellis] connected to Space");
  } catch (e) {
    const msg = serializeError(e);
    logger.error(`[trellis] connect error: ${msg}`);
    return err(`TRELLIS: no se pudo conectar al Space: ${msg}`, 502);
  }

  // -- Step 1: preprocess_image (best-effort) --------------------------------
  let processedBlob: Blob = imageBlob;
  try {
    logger.info("[trellis] preprocessing image...");
    const ppResult = await client.predict("/preprocess_image", { input: imageBlob });
    const ppItem = (ppResult.data as unknown[])[0];
    // output is a string URL or FileData — re-fetch as Blob
    const ppUrl = typeof ppItem === "string"
      ? ppItem
      : (ppItem as Record<string, unknown> | null)?.url as string | undefined
        ?? (ppItem as Record<string, unknown> | null)?.path as string | undefined;
    if (ppUrl) {
      const r = await fetch(ppUrl, { signal: AbortSignal.timeout(30_000) });
      if (r.ok) { processedBlob = await r.blob(); logger.info("[trellis] image preprocessed"); }
    }
  } catch (e) {
    logger.warn(`[trellis] preprocess_image failed (non-fatal): ${serializeError(e)}`);
  }

  // -- Step 2: get_seed -------------------------------------------------------
  let seed = 0;
  try {
    const seedResult = await client.predict("/get_seed", { randomize_seed: true, seed: 0 });
    const s = (seedResult.data as unknown[])[0];
    if (typeof s === "number") { seed = s; logger.info(`[trellis] seed=${seed}`); }
  } catch (e) {
    logger.warn(`[trellis] get_seed failed (using 0): ${serializeError(e)}`);
  }

  // -- Step 3: image_to_3d ----------------------------------------------------
  try {
    logger.info("[trellis] submitting image_to_3d...");
    await client.predict("/image_to_3d", {
      image:                        processedBlob,
      seed,
      resolution:                   "1024",
      ss_guidance_strength:         7.5,
      ss_guidance_rescale:          0.7,
      ss_sampling_steps:            12,
      ss_rescale_t:                 5,
      shape_slat_guidance_strength: 7.5,
      shape_slat_guidance_rescale:  0.5,
      shape_slat_sampling_steps:    12,
      shape_slat_rescale_t:         3,
      tex_slat_guidance_strength:   1,
      tex_slat_guidance_rescale:    0,
      tex_slat_sampling_steps:      12,
      tex_slat_rescale_t:           3,
    });
    logger.info("[trellis] image_to_3d done");
  } catch (e) {
    const msg = serializeError(e);
    logger.error(`[trellis] image_to_3d error: ${msg}`);
    return err(`TRELLIS image_to_3d: ${msg}`, 502);
  }

  // -- Step 4: extract_glb ----------------------------------------------------
  try {
    logger.info("[trellis] extracting GLB...");
    const glbResult = await client.predict("/extract_glb", {
      decimation_target: 300000,
      texture_size:      2048,
    });
    logger.info(`[trellis] extract_glb data=${JSON.stringify(glbResult.data).slice(0, 300)}`);

    const glbUrl = extractGlbUrl(glbResult.data as unknown[]);
    if (!glbUrl) {
      logger.error(`[trellis] no GLB URL in: ${JSON.stringify(glbResult.data).slice(0, 400)}`);
      return err("TRELLIS: no se encontro el archivo GLB en la respuesta", 502);
    }
    logger.info(`[trellis] glbUrl=${glbUrl.slice(0, 100)}`);
    return ok({ glbUrl });
  } catch (e) {
    const msg = serializeError(e);
    logger.error(`[trellis] extract_glb error: ${msg}`);
    return err(`TRELLIS extract_glb: ${msg}`, 502);
  }
}
