/**
 * POST /api/trellis
 *
 * Generates a 3-D model (.glb) from a 2-D character image using
 * Microsoft TRELLIS.2 (hosted as a Gradio Space on Hugging Face).
 *
 * Body:   { imageUrl: string }
 * Returns: { glbUrl: string }
 *
 * Two-step Gradio 4.x flow (same session_hash):
 *   1. POST /gradio_api/call/image_to_3d  → HTML preview (stores mesh server-side)
 *   2. POST /gradio_api/call/extract_glb  → GLB FileData
 */
import { ENV }     from "../config/env";
import { ok, err } from "../utils/response";
import { logger }  from "../utils/logger";

const TRELLIS_BASE   = (process.env.TRELLIS_BASE ?? "https://microsoft-trellis-2.hf.space").replace(/\/$/, "");
const GRADIO_API     = `${TRELLIS_BASE}/gradio_api`;
const SUBMIT_TIMEOUT = 60_000;
const POLL_TIMEOUT   = 360_000;   // 6 min — TRELLIS can be slow

// ── Gradio 4.x helpers ────────────────────────────────────────────────────────

/** POST /gradio_api/call/{fn} — submit a job, returns event_id */
async function gradioSubmit(
  fn: string,
  data: unknown[],
  sessionHash: string,
  auth: Record<string, string>,
): Promise<string> {
  const res = await fetch(`${GRADIO_API}/call/${fn}`, {
    method:  "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body:    JSON.stringify({ data, session_hash: sessionHash }),
    signal:  AbortSignal.timeout(SUBMIT_TIMEOUT),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) throw new Error(`HF_AUTH:${res.status}`);
    if (res.status === 404) throw new Error(`NOT_FOUND:${fn}`);
    throw new Error(`SUBMIT_FAIL:${res.status}:${text.slice(0, 200)}`);
  }

  const j = await res.json() as { event_id?: string };
  if (!j.event_id) throw new Error("no event_id in submit response");
  return j.event_id;
}

/** GET /gradio_api/call/{fn}/{eventId} — SSE poll, returns last complete data[] */
async function gradioAwait(
  fn: string,
  eventId: string,
  auth: Record<string, string>,
): Promise<unknown[]> {
  const res = await fetch(`${GRADIO_API}/call/${fn}/${eventId}`, {
    headers: { ...auth, Accept: "text/event-stream" },
    signal:  AbortSignal.timeout(POLL_TIMEOUT),
  });

  if (!res.ok) throw new Error(`POLL_FAIL:${fn}:${res.status}`);

  const text = await res.text();
  return parseSSEComplete(text);
}

/**
 * Parse SSE stream — find the last "complete" event and return its data[].
 * Blocks in SSE are separated by blank lines; each block has optional
 * "event: <name>" and "data: <json>" lines.
 */
function parseSSEComplete(sseText: string): unknown[] {
  const blocks = sseText.split(/\n\n+/).reverse();
  for (const block of blocks) {
    const lines     = block.split("\n");
    const eventLine = lines.find((l) => l.startsWith("event:"));
    const dataLine  = lines.find((l) => l.startsWith("data:"));
    if (!dataLine) continue;
    const event = eventLine?.replace("event:", "").trim() ?? "";
    if (event === "complete" || event === "success" || event === "") {
      try {
        const parsed = JSON.parse(dataLine.slice(5).trim());
        if (Array.isArray(parsed)) return parsed;
        return [parsed];
      } catch { /* try next block */ }
    }
  }
  return [];
}

/**
 * Extract a .glb URL from extract_glb response data.
 * The response is [ FileData_model3d, FileData_download ].
 */
function extractGlbUrl(data: unknown[]): string | null {
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;

    // Prefer explicit URL field
    if (typeof obj.url === "string" && obj.url.length > 0) {
      // If relative (starts with /), make absolute
      if (obj.url.startsWith("/")) return `${TRELLIS_BASE}${obj.url}`;
      return obj.url;
    }
    // Fall back to server path
    if (typeof obj.path === "string" && obj.path.length > 0) {
      return `${GRADIO_API}/file=${obj.path}`;
    }
  }
  return null;
}

/** Simple numeric session hash (Gradio accepts any string) */
function newSessionHash(): string {
  return Math.random().toString(36).slice(2, 12);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function trellisRoute(req: Request, _sessionId: string): Promise<Response> {
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return err("Invalid JSON body"); }

  const imageUrl = body.imageUrl;
  if (!imageUrl || typeof imageUrl !== "string")
    return err("imageUrl es requerido");

  const auth: Record<string, string> = ENV.HF_TOKEN
    ? { Authorization: `Bearer ${ENV.HF_TOKEN}` } : {};

  const sessionHash = newSessionHash();
  logger.info(`[trellis] session=${sessionHash} img=${imageUrl.slice(0, 60)}`);

  // ── Step 1: image_to_3d ──────────────────────────────────────────────────
  // Parameters (in order, matching /gradio_api/info schema):
  //   image, seed, resolution, ss_guidance_strength, ss_guidance_rescale,
  //   ss_sampling_steps, ss_rescale_t, shape_slat_guidance_strength,
  //   shape_slat_guidance_rescale, shape_slat_sampling_steps, shape_slat_rescale_t,
  //   tex_slat_guidance_strength, tex_slat_guidance_rescale,
  //   tex_slat_sampling_steps, tex_slat_rescale_t
  const image3dData = [
    { url: imageUrl, orig_name: "character.png" },
    0,       // seed
    "1024",  // resolution (Radio: "512"|"1024"|"1536")
    7.5,     // ss_guidance_strength
    0.7,     // ss_guidance_rescale
    12,      // ss_sampling_steps
    5.0,     // ss_rescale_t
    7.5,     // shape_slat_guidance_strength
    0.5,     // shape_slat_guidance_rescale
    12,      // shape_slat_sampling_steps
    3.0,     // shape_slat_rescale_t
    1.0,     // tex_slat_guidance_strength
    0.0,     // tex_slat_guidance_rescale
    12,      // tex_slat_sampling_steps
    3.0,     // tex_slat_rescale_t
  ];

  try {
    logger.info("[trellis] submitting image_to_3d...");
    const eid1 = await gradioSubmit("image_to_3d", image3dData, sessionHash, auth);
    logger.info(`[trellis] polling image_to_3d event_id=${eid1}...`);
    await gradioAwait("image_to_3d", eid1, auth);
    logger.info("[trellis] image_to_3d done");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("HF_AUTH"))  return err("HF_TOKEN sin acceso al Space TRELLIS", 502);
    if (msg.startsWith("NOT_FOUND:image_to_3d"))
      return err("Endpoint image_to_3d no encontrado en el Space TRELLIS. El Space puede estar pausado.", 502);
    logger.error(`[trellis] image_to_3d error: ${msg}`);
    return err(`TRELLIS image_to_3d: ${msg}`, 502);
  }

  // ── Step 2: extract_glb (same session_hash → server passes mesh state) ───
  // Parameters: decimation_target, texture_size
  const extractData = [
    300000, // decimation_target
    2048,   // texture_size
  ];

  try {
    logger.info("[trellis] submitting extract_glb...");
    const eid2 = await gradioSubmit("extract_glb", extractData, sessionHash, auth);
    logger.info(`[trellis] polling extract_glb event_id=${eid2}...`);
    const result = await gradioAwait("extract_glb", eid2, auth);
    logger.info(`[trellis] extract_glb done, data=${JSON.stringify(result).slice(0, 200)}`);

    const glbUrl = extractGlbUrl(result);
    if (!glbUrl) {
      logger.error(`[trellis] no GLB in response: ${JSON.stringify(result).slice(0, 400)}`);
      return err("TRELLIS: no se encontró el archivo GLB en la respuesta", 502);
    }
    logger.info(`[trellis] glbUrl=${glbUrl.slice(0, 100)}`);
    return ok({ glbUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("HF_AUTH")) return err("HF_TOKEN sin acceso al Space TRELLIS", 502);
    logger.error(`[trellis] extract_glb error: ${msg}`);
    return err(`TRELLIS extract_glb: ${msg}`, 502);
  }
}

import { ENV }     from "../config/env";
import { ok, err } from "../utils/response";
import { logger }  from "../utils/logger";

const TRELLIS_BASE   = process.env.TRELLIS_BASE  ?? "https://microsoft-trellis-2.hf.space";
const TRELLIS_FN_ID  = process.env.TRELLIS_FN_ID ?? "";   // empty = auto-discover
const SUBMIT_TIMEOUT = 30_000;
const POLL_TIMEOUT   = 300_000;

// ── Endpoint discovery cache ───────────────────────────────────────────────────
interface SpaceInfo {
  format:   "gradio4" | "gradio3";
  fn:       string;   // fn_id (v4) or ignored (v3 uses fn_index)
  fnIndex?: number;   // for v3 fallback
}
let cachedInfo: SpaceInfo | null = null;

/** Probe the Space to determine its Gradio version and endpoint names */
async function discoverSpace(auth: Record<string, string>): Promise<SpaceInfo> {
  if (cachedInfo) return cachedInfo;

  // 1. Try Gradio 4.x /info
  try {
    const r = await fetch(`${TRELLIS_BASE}/info`, {
      headers: auth, signal: AbortSignal.timeout(10_000),
    });
    if (r.ok) {
      const info = await r.json() as {
        named_endpoints?:   Record<string, unknown>;
        unnamed_endpoints?: Record<string, unknown>;
      };
      const named = Object.keys(info.named_endpoints ?? {});
      logger.info(`[trellis] Gradio 4 named endpoints: [${named.join(", ") || "none"}]`);

      // Manual override wins
      if (TRELLIS_FN_ID) {
        cachedInfo = { format: "gradio4", fn: TRELLIS_FN_ID };
        return cachedInfo;
      }

      const candidates = ["run", "predict", "image_to_3d", "generate", "process", "image2mesh"];
      for (const c of candidates) {
        if (named.includes(c)) {
          cachedInfo = { format: "gradio4", fn: c };
          logger.info(`[trellis] Picked fn="${c}"`);
          return cachedInfo;
        }
      }
      // Pick first available named endpoint
      if (named.length > 0) {
        cachedInfo = { format: "gradio4", fn: named[0] };
        logger.info(`[trellis] Using first endpoint: "${named[0]}"`);
        return cachedInfo;
      }
      // Unnamed endpoints → use fn_index 0
      const unnamed = Object.keys(info.unnamed_endpoints ?? {});
      if (unnamed.length > 0) {
        cachedInfo = { format: "gradio3", fn: "predict", fnIndex: 0 };
        logger.info("[trellis] Falling back to unnamed endpoint idx 0");
        return cachedInfo;
      }
    }
  } catch (e) {
    logger.warn(`[trellis] /info failed: ${e instanceof Error ? e.message : e}`);
  }

  // 2. Fallback: try Gradio 3.x /run/predict style
  logger.info("[trellis] Falling back to Gradio 3.x /run/predict format");
  cachedInfo = { format: "gradio3", fn: "predict", fnIndex: 0 };
  return cachedInfo;
}

export async function trellisRoute(req: Request, _sessionId: string): Promise<Response> {
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return err("Invalid JSON body"); }

  const imageUrl = body.imageUrl;
  if (!imageUrl || typeof imageUrl !== "string")
    return err("imageUrl es requerido");

  const auth: Record<string, string> = ENV.HF_TOKEN
    ? { Authorization: `Bearer ${ENV.HF_TOKEN}` } : {};

  const info = await discoverSpace(auth);

  // Build the input payload (same fields regardless of format)
  const inputData = [
    { url: imageUrl, orig_name: "character.png" },
    0,     // seed
    12,    // steps
    7.5,   // guidance
    true,  // simplify
    1024,  // texture_size
  ];

  // ── Gradio 4.x: POST /call/{fn} ───────────────────────────────────────────
  if (info.format === "gradio4") {
    let eventId: string;
    try {
      const submitRes = await fetch(`${TRELLIS_BASE}/call/${info.fn}`, {
        method:  "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body:    JSON.stringify({ data: inputData }),
        signal:  AbortSignal.timeout(SUBMIT_TIMEOUT),
      });

      if (!submitRes.ok) {
        const text = await submitRes.text();
        logger.error(`[trellis] v4 submit ${submitRes.status}: ${text.slice(0, 400)}`);
        if (submitRes.status === 401 || submitRes.status === 403)
          return err("HF_TOKEN sin acceso al Space TRELLIS", 502);
        if (submitRes.status === 404) {
          // Reset cache; next request will re-discover
          cachedInfo = null;
          return err(
            `Endpoint TRELLIS "${info.fn}" no encontrado. ` +
            "El Space puede estar pausado o la API ha cambiado. " +
            "Vuelve a intentarlo en unos segundos.",
            404
          );
        }
        return err(`TRELLIS submit ${submitRes.status}`, 502);
      }

      const j = (await submitRes.json()) as { event_id?: string };
      if (!j.event_id) return err("TRELLIS: sin event_id", 502);
      eventId = j.event_id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return err(`TRELLIS no disponible: ${msg}`, 502);
    }

    try {
      const pollRes = await fetch(`${TRELLIS_BASE}/call/${info.fn}/${eventId}`, {
        headers: { ...auth, Accept: "text/event-stream" },
        signal:  AbortSignal.timeout(POLL_TIMEOUT),
      });
      if (!pollRes.ok) return err(`TRELLIS poll ${pollRes.status}`, 502);

      const glbUrl = extractGlbUrl(await pollRes.text(), TRELLIS_BASE);
      if (!glbUrl) return err("TRELLIS: no se encontró el GLB en la respuesta", 502);
      logger.info(`[trellis] GLB: ${glbUrl.slice(0, 80)}`);
      return ok({ glbUrl });
    } catch (e) {
      return err(`TRELLIS timeout: ${e instanceof Error ? e.message : e}`, 502);
    }
  }

  // ── Gradio 3.x: POST /run/predict ────────────────────────────────────────
  try {
    const runRes = await fetch(`${TRELLIS_BASE}/run/predict`, {
      method:  "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body:    JSON.stringify({ data: inputData, fn_index: info.fnIndex ?? 0 }),
      signal:  AbortSignal.timeout(POLL_TIMEOUT),
    });

    if (!runRes.ok) {
      const text = await runRes.text();
      cachedInfo = null;
      return err(`TRELLIS v3 ${runRes.status}: ${text.slice(0, 200)}`, 502);
    }

    const result = await runRes.json() as { data?: unknown[] };
    const glbUrl = extractGlbFromArray(result.data ?? [], TRELLIS_BASE);
    if (!glbUrl) return err("TRELLIS v3: no se encontró el GLB", 502);
    return ok({ glbUrl });
  } catch (e) {
    return err(`TRELLIS v3 error: ${e instanceof Error ? e.message : e}`, 502);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function extractGlbUrl(sseText: string, base: string): string | null {
  const blocks = sseText.split(/\n\n+/).reverse();
  for (const block of blocks) {
    const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
    if (!dataLine) continue;
    try {
      const payload = JSON.parse(dataLine.slice(5).trim());
      const url = extractGlbFromArray(Array.isArray(payload) ? payload : [payload], base);
      if (url) return url;
    } catch { /* try next */ }
  }
  return null;
}

function extractGlbFromArray(arr: unknown[], base: string): string | null {
  for (const item of arr) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const rec = item as Record<string, unknown>;
      const candidate = (rec.url ?? rec.path ?? rec.name) as string | undefined;
      if (candidate?.includes(".glb")) {
        return candidate.startsWith("http") ? candidate : `${base}/file=${candidate}`;
      }
    }
    if (Array.isArray(item)) {
      const found = extractGlbFromArray(item, base);
      if (found) return found;
    }
  }
  return null;
}

 *
 * Generates a 3-D model (.glb) from a 2-D character image using
 * Microsoft TRELLIS (hosted as a Gradio Space on Hugging Face).
 *
 * Body:   { imageUrl: string }   — data URL or https URL of the 2-D image
 * Returns: { glbUrl: string }    — URL the frontend can feed to <model-viewer>
 *
 * The Gradio 4.x REST API flow:
 *   0. GET  /info                  → discover available named endpoints
 *   1. POST /call/{fn_id}          → { event_id }
 *   2. GET  /call/{fn_id}/{event_id} → SSE stream; last "data:" line = output array
 */
import { ENV }    from "../config/env";
import { ok, err } from "../utils/response";
import { logger }  from "../utils/logger";

const TRELLIS_BASE   = process.env.TRELLIS_BASE  ?? "https://microsoft-trellis-2.hf.space";
// Override with TRELLIS_FN_ID env var, or we auto-discover it at runtime
const TRELLIS_FN_ID  = process.env.TRELLIS_FN_ID ?? "";
const SUBMIT_TIMEOUT = 30_000;   // 30 s to accept the job
const POLL_TIMEOUT   = 300_000;  // 5 min to finish generation

// Cache the discovered fn_id so we only hit /info once per process lifetime
let discoveredFnId: string | null = null;

/**
 * Ask the Gradio /info endpoint which named endpoints are available,
 * then pick the first one that looks like a 3-D generation function.
 * Falls back to "run" (common default) if nothing matches.
 */
async function resolveFnId(authHeaders: Record<string, string>): Promise<string> {
  // 1. Explicit env override — trust it without discovery
  if (TRELLIS_FN_ID) return TRELLIS_FN_ID;

  // 2. Already discovered in this process
  if (discoveredFnId) return discoveredFnId;

  try {
    const infoRes = await fetch(`${TRELLIS_BASE}/info`, {
      headers: authHeaders,
      signal:  AbortSignal.timeout(10_000),
    });

    if (infoRes.ok) {
      const info = await infoRes.json() as {
        named_endpoints?:   Record<string, unknown>;
        unnamed_endpoints?: Record<string, unknown>;
      };

      const named = info.named_endpoints ?? {};
      logger.info(`[trellis] Available endpoints: ${Object.keys(named).join(", ") || "(none)"}`);

      // Preference order — pick first match
      const candidates = [
        "image_to_3d", "run", "predict", "generate",
        "image2mesh", "image_to_mesh", "process",
      ];
      for (const c of candidates) {
        if (c in named) { discoveredFnId = c; return c; }
      }
      // Fallback: first endpoint listed
      const first = Object.keys(named)[0];
      if (first) { discoveredFnId = first; return first; }
    }
  } catch (e) {
    logger.warn(`[trellis] /info discovery failed: ${e instanceof Error ? e.message : e}`);
  }

  // Last resort
  discoveredFnId = "run";
  return discoveredFnId;
}

export async function trellisRoute(req: Request, _sessionId: string): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err("Invalid JSON body");
  }

  const imageUrl = body.imageUrl;
  if (!imageUrl || typeof imageUrl !== "string") {
    return err("imageUrl es requerido");
  }

  // HF token is optional for public Spaces but required for rate-limit bypass
  const authHeaders: Record<string, string> = ENV.HF_TOKEN
    ? { Authorization: `Bearer ${ENV.HF_TOKEN}` }
    : {};

  const fnId = await resolveFnId(authHeaders);
  logger.info(`[trellis] Using fn_id="${fnId}"`);

  // ── Step 1: submit job ─────────────────────────────────────────────────────
  let eventId: string;
  try {
    const submitRes = await fetch(`${TRELLIS_BASE}/call/${fnId}`, {
      method:  "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          // input image — Gradio File component accepts {url} or {path}
          { url: imageUrl, orig_name: "character.png" },
          0,     // seed  (0 = deterministic based on content)
          12,    // num_inference_steps
          7.5,   // guidance_scale
          true,  // simplify mesh
          1024,  // texture_size (1024 is faster, 2048 for quality)
        ],
      }),
      signal: AbortSignal.timeout(SUBMIT_TIMEOUT),
    });

    if (!submitRes.ok) {
      const text = await submitRes.text();
      logger.error(`[trellis] Submit ${submitRes.status}: ${text.slice(0, 400)}`);

      if (submitRes.status === 401 || submitRes.status === 403) {
        return err("HF_TOKEN expirado o sin acceso al Space de TRELLIS", 502);
      }
      if (submitRes.status === 404) {
        // Reset cache so next call re-discovers
        discoveredFnId = null;
        return err(
          `Endpoint TRELLIS no encontrado (fn_id="${fnId}"). ` +
          "El Space puede estar pausado o la API puede haber cambiado. " +
          "Intenta de nuevo para re-descubrir los endpoints disponibles.",
          404
        );
      }
      return err(`TRELLIS submit falló: ${submitRes.status}`, 502);
    }

    const json = (await submitRes.json()) as { event_id?: string };
    if (!json.event_id) return err("TRELLIS: respuesta de submit sin event_id", 502);
    eventId = json.event_id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`[trellis] Submit error: ${msg}`);
    return err(`TRELLIS no disponible: ${msg}`, 502);
  }

  // ── Step 2: poll SSE stream for output ─────────────────────────────────────
  try {
    const pollRes = await fetch(`${TRELLIS_BASE}/call/${fnId}/${eventId}`, {
      headers: { ...authHeaders, Accept: "text/event-stream" },
      signal:  AbortSignal.timeout(POLL_TIMEOUT),
    });

    if (!pollRes.ok) {
      return err(`TRELLIS poll falló: ${pollRes.status}`, 502);
    }

    // Read SSE text and parse the last "data:" event which carries the output
    const sseText = await pollRes.text();
    const glbUrl  = extractGlbUrl(sseText, TRELLIS_BASE);

    if (!glbUrl) {
      logger.error(`[trellis] Could not find GLB in SSE response:\n${sseText.slice(0, 600)}`);
      return err("TRELLIS: no se encontró el archivo GLB en la respuesta", 502);
    }

    logger.info(`[trellis] GLB ready: ${glbUrl.slice(0, 80)}`);
    return ok({ glbUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`[trellis] Poll error: ${msg}`);
    return err(`TRELLIS timeout o error al generar el modelo 3D: ${msg}`, 502);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Parse the SSE stream from Gradio and extract the first GLB file URL.
 * Gradio emits events like:
 *   event: complete
 *   data: [{"path":"...","url":"https://...","orig_name":"..."}]
 */
function extractGlbUrl(sseText: string, baseUrl: string): string | null {
  const blocks = sseText.split(/\n\n+/);

  for (const block of blocks.reverse()) {  // last complete event wins
    const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
    if (!dataLine) continue;

    try {
      const payload = JSON.parse(dataLine.slice(5).trim());
      if (!Array.isArray(payload)) continue;

      for (const item of payload) {
        if (item && typeof item === "object") {
          const candidate: string | undefined = item.url ?? item.path;
          if (candidate && (candidate.endsWith(".glb") || candidate.includes(".glb"))) {
            return candidate.startsWith("http")
              ? candidate
              : `${baseUrl}/file=${candidate}`;
          }
        }
        if (Array.isArray(item)) {
          for (const sub of item) {
            if (sub && typeof sub === "object") {
              const c: string | undefined = sub.url ?? sub.path;
              if (c && c.includes(".glb")) {
                return c.startsWith("http") ? c : `${baseUrl}/file=${c}`;
              }
            }
          }
        }
      }
    } catch {
      // malformed JSON in this event block — try next
    }
  }
  return null;
}

 *
 * Generates a 3-D model (.glb) from a 2-D character image using
 * Microsoft TRELLIS (hosted as a Gradio Space on Hugging Face).
 *
 * Body:   { imageUrl: string }   — data URL or https URL of the 2-D image
 * Returns: { glbUrl: string }    — URL the frontend can feed to <model-viewer>
 *
 * The Gradio 4.x REST API flow:
 *   1. POST /call/{fn_id}          → { event_id }
 *   2. GET  /call/{fn_id}/{event_id} → SSE stream; last "data:" line = output array
 *
 * TRELLIS_FN_ID defaults to "image_to_3d" (override with env TRELLIS_FN_ID).
 * TRELLIS_BASE  defaults to the public HF Space URL.
 */
import { ENV }    from "../config/env";
import { ok, err } from "../utils/response";
import { logger }  from "../utils/logger";

const TRELLIS_BASE   = process.env.TRELLIS_BASE  ?? "https://microsoft-trellis-2.hf.space";
const TRELLIS_FN_ID  = process.env.TRELLIS_FN_ID ?? "image_to_3d";
const SUBMIT_TIMEOUT = 30_000;   // 30 s to accept the job
const POLL_TIMEOUT   = 300_000;  // 5 min to finish generation

export async function trellisRoute(req: Request, _sessionId: string): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err("Invalid JSON body");
  }

  const imageUrl = body.imageUrl;
  if (!imageUrl || typeof imageUrl !== "string") {
    return err("imageUrl es requerido");
  }

  // HF token is optional for public Spaces but required for rate-limit bypass
  const authHeaders: Record<string, string> = ENV.HF_TOKEN
    ? { Authorization: `Bearer ${ENV.HF_TOKEN}` }
    : {};

  // ── Step 1: submit job ─────────────────────────────────────────────────────
  let eventId: string;
  try {
    const submitRes = await fetch(`${TRELLIS_BASE}/call/${TRELLIS_FN_ID}`, {
      method:  "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          // input image — Gradio File component accepts {url} or {path}
          { url: imageUrl, orig_name: "character.png" },
          0,     // seed  (0 = deterministic based on content)
          12,    // num_inference_steps
          7.5,   // guidance_scale
          true,  // simplify mesh
          1024,  // texture_size (1024 is faster, 2048 for quality)
        ],
      }),
      signal: AbortSignal.timeout(SUBMIT_TIMEOUT),
    });

    if (!submitRes.ok) {
      const text = await submitRes.text();
      logger.error(`[trellis] Submit ${submitRes.status}: ${text.slice(0, 400)}`);

      if (submitRes.status === 401 || submitRes.status === 403) {
        return err("HF_TOKEN expirado o sin acceso al Space de TRELLIS", 502);
      }
      if (submitRes.status === 404) {
        return err(
          `Endpoint TRELLIS no encontrado (fn_id="${TRELLIS_FN_ID}"). ` +
          "Ajusta la variable de entorno TRELLIS_FN_ID con el nombre correcto.",
          404
        );
      }
      return err(`TRELLIS submit falló: ${submitRes.status}`, 502);
    }

    const json = (await submitRes.json()) as { event_id?: string };
    if (!json.event_id) return err("TRELLIS: respuesta de submit sin event_id", 502);
    eventId = json.event_id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`[trellis] Submit error: ${msg}`);
    return err(`TRELLIS no disponible: ${msg}`, 502);
  }

  // ── Step 2: poll SSE stream for output ─────────────────────────────────────
  try {
    const pollRes = await fetch(`${TRELLIS_BASE}/call/${TRELLIS_FN_ID}/${eventId}`, {
      headers: { ...authHeaders, Accept: "text/event-stream" },
      signal:  AbortSignal.timeout(POLL_TIMEOUT),
    });

    if (!pollRes.ok) {
      return err(`TRELLIS poll falló: ${pollRes.status}`, 502);
    }

    // Read SSE text and parse the last "data:" event which carries the output
    const sseText = await pollRes.text();
    const glbUrl  = extractGlbUrl(sseText, TRELLIS_BASE);

    if (!glbUrl) {
      logger.error(`[trellis] Could not find GLB in SSE response:\n${sseText.slice(0, 600)}`);
      return err("TRELLIS: no se encontró el archivo GLB en la respuesta", 502);
    }

    logger.info(`[trellis] GLB ready: ${glbUrl.slice(0, 80)}`);
    return ok({ glbUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`[trellis] Poll error: ${msg}`);
    return err(`TRELLIS timeout o error al generar el modelo 3D: ${msg}`, 502);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Parse the SSE stream from Gradio and extract the first GLB file URL.
 * Gradio emits events like:
 *   event: complete
 *   data: [{"path":"...","url":"https://...","orig_name":"..."}]
 */
function extractGlbUrl(sseText: string, baseUrl: string): string | null {
  // Split events
  const blocks = sseText.split(/\n\n+/);

  for (const block of blocks.reverse()) {  // last complete event wins
    const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
    if (!dataLine) continue;

    try {
      const payload = JSON.parse(dataLine.slice(5).trim());
      // payload is an array of outputs
      if (!Array.isArray(payload)) continue;

      for (const item of payload) {
        // Gradio FileData objects
        if (item && typeof item === "object") {
          const candidate: string | undefined = item.url ?? item.path;
          if (candidate && (candidate.endsWith(".glb") || candidate.includes(".glb"))) {
            return candidate.startsWith("http")
              ? candidate
              : `${baseUrl}/file=${candidate}`;
          }
        }
        // Nested array (some Gradio versions wrap in another array)
        if (Array.isArray(item)) {
          for (const sub of item) {
            if (sub && typeof sub === "object") {
              const c: string | undefined = sub.url ?? sub.path;
              if (c && c.includes(".glb")) {
                return c.startsWith("http") ? c : `${baseUrl}/file=${c}`;
              }
            }
          }
        }
      }
    } catch {
      // malformed JSON in this event block — try next
    }
  }
  return null;
}
