/**
 * POST /api/instant-mesh
 *
 * Generates a 3D GLB from a 2D image using SIGMitch/InstantMesh (HuggingFace Space).
 * Flow: preprocess → generate_mvs (multi-view) → make3d
 *
 * Body:   { imageUrl: string }  — data URI or https URL
 * Returns: { glbUrl: string }
 */
import { Client } from "@gradio/client";
import { ENV }     from "../config/env";
import { ok, err } from "../utils/response";
import { logger }  from "../utils/logger";

const SPACE_ID = "SIGMitch/InstantMesh";

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

function extractUrl(item: unknown): string | null {
  if (typeof item === "string" && item.length > 0) return item;
  if (item && typeof item === "object") {
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

export async function instantMeshRoute(req: Request, _sessionId: string): Promise<Response> {
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return err("Invalid JSON body"); }

  const imageUrl = body.imageUrl;
  if (!imageUrl || typeof imageUrl !== "string")
    return err("imageUrl es requerido");

  logger.info(`[instant-mesh] img=${imageUrl.slice(0, 60)}`);

  let imageBlob: Blob;
  try {
    imageBlob = await toBlob(imageUrl);
    logger.info(`[instant-mesh] imageBlob size=${imageBlob.size} type=${imageBlob.type}`);
  } catch (e) {
    return err(`InstantMesh: no se pudo preparar la imagen: ${serializeError(e)}`, 502);
  }

  let client: Client;
  try {
    client = await Client.connect(SPACE_ID, {
      token: ENV.HF_TOKEN as `hf_${string}` | undefined,
    });
    logger.info("[instant-mesh] connected to Space");
  } catch (e) {
    return err(`InstantMesh: no se pudo conectar al Space: ${serializeError(e)}`, 502);
  }

  // -- Step 1: preprocess_image (best-effort) --------------------------------
  let processedBlob: Blob = imageBlob;
  try {
    logger.info("[instant-mesh] preprocessing image...");
    const ppResult = await client.predict("/preprocess", {
      input_image:          imageBlob,
      do_remove_background: true,
    });
    const ppUrl = extractUrl((ppResult.data as unknown[])[0]);
    if (ppUrl) {
      const r = await fetch(ppUrl, { signal: AbortSignal.timeout(30_000) });
      if (r.ok) { processedBlob = await r.blob(); logger.info("[instant-mesh] image preprocessed"); }
    }
  } catch (e) {
    logger.warn(`[instant-mesh] preprocess failed (non-fatal): ${serializeError(e)}`);
  }

  // -- Step 2: generate multi-view -------------------------------------------
  try {
    logger.info("[instant-mesh] generating multi-view...");
    const mvsResult = await client.predict("/generate_mvs", {
      input_image:  processedBlob,
      sample_steps: 75,
      sample_seed:  42,
    });
    logger.info(`[instant-mesh] mvs done, url=${extractUrl((mvsResult.data as unknown[])[0])?.slice(0, 80)}`);
  } catch (e) {
    const msg = serializeError(e);
    logger.error(`[instant-mesh] generate_mvs error: ${msg}`);
    return err(`InstantMesh generate_mvs: ${msg}`, 502);
  }

  // -- Step 3: make3d --------------------------------------------------------
  try {
    logger.info("[instant-mesh] generating 3D model...");
    const result = await client.predict("/make3d", undefined);
    const data   = result.data as unknown[];
    logger.info(`[instant-mesh] make3d data=${JSON.stringify(data).slice(0, 300)}`);

    // [0] = OBJ, [1] = GLB
    const glbUrl = extractUrl(data[1]) ?? extractUrl(data[0]);
    if (!glbUrl) {
      logger.error(`[instant-mesh] no GLB in: ${JSON.stringify(data).slice(0, 400)}`);
      return err("InstantMesh: no se encontró el archivo GLB en la respuesta", 502);
    }
    logger.info(`[instant-mesh] glbUrl=${glbUrl.slice(0, 100)}`);
    return ok({ glbUrl });
  } catch (e) {
    const msg = serializeError(e);
    logger.error(`[instant-mesh] make3d error: ${msg}`);
    return err(`InstantMesh make3d: ${msg}`, 502);
  }
}
