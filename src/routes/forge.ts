/**
 * POST /api/forge
 * Fuses two existing generations into a hybrid creation via AI.
 */
import { getGenerationById, insertGeneration } from "../db/client";
import { callGroq }                            from "../lib/groq";
import { callTextModel }                       from "../lib/huggingface";
import { parseJSON }                           from "../utils/json-parser";
import { ok, err }                             from "../utils/response";
import { checkRateLimit, rateLimitResponse }   from "../middleware/rate-limit";
import { ENV }                                 from "../config/env";
import { logger }                              from "../utils/logger";
import type { GenerationType }                 from "../types/generate";

const VALID_TYPES = new Set<string>(["npc", "quest", "item", "lore", "weapon", "enemy"]);

function pickFusionType(a: string, b: string): GenerationType {
  // If both the same type, the result is the same type
  if (a === b) return a as GenerationType;
  // NPC + weapon/item/enemy → NPC (armed/equipped/corrupted NPC)
  if ((a === "npc" || b === "npc") && (a === "weapon" || b === "weapon" || a === "item" || b === "item" || a === "enemy" || b === "enemy"))
    return "npc";
  // weapon + item → weapon
  if ((a === "weapon" && b === "item") || (a === "item" && b === "weapon")) return "weapon";
  // enemy + weapon/item → enemy
  if ((a === "enemy" || b === "enemy") && (a === "weapon" || b === "weapon" || a === "item" || b === "item"))
    return "enemy";
  // quest + lore → quest
  if ((a === "quest" || b === "quest") && (a === "lore" || b === "lore")) return "quest";
  // Default: use the first type
  return a as GenerationType;
}

/** Trim long string fields to keep prompt within token budget */
function summarizeResult(result: Record<string, unknown>): Record<string, unknown> {
  const MAX_FIELD = 200; // chars per field
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(result)) {
    if (k.startsWith("_")) continue; // skip internal
    if (typeof v === "string") {
      out[k] = v.length > MAX_FIELD ? v.slice(0, MAX_FIELD) + "…" : v;
    } else if (Array.isArray(v)) {
      out[k] = v.slice(0, 3).map(item =>
        typeof item === "string" && item.length > 120 ? item.slice(0, 120) + "…" : item
      );
    } else {
      out[k] = v;
    }
  }
  return out;
}

function buildFusionPrompt(
  genA: { type: string; result: Record<string, unknown> },
  genB: { type: string; result: Record<string, unknown> },
  outputType: GenerationType,
): string {
  const nameA = (genA.result.name || genA.result.title || `${genA.type}`) as string;
  const nameB = (genB.result.name || genB.result.title || `${genB.type}`) as string;
  const sumA = JSON.stringify(summarizeResult(genA.result));
  const sumB = JSON.stringify(summarizeResult(genB.result));

  return `Eres un maestro forjador de fusiones para un videojuego de rol épico. Fusiona DOS creaciones en un híbrido legendario. La fusión debe ser narrativamente coherente, épica y única.

CREACIÓN A — ${genA.type.toUpperCase()}: "${nameA}"
${sumA}

CREACIÓN B — ${genB.type.toUpperCase()}: "${nameB}"
${sumB}

INSTRUCCIONES:
1. Resultado de tipo ${outputType.toUpperCase()}
2. Combina rasgos, lore, apariencia y habilidades de AMBAS creaciones
3. Nombre que suene a fusión épica (mezcla sílabas o conceptos)
4. La apariencia muestra rasgos visuales de ambos originales fusionados
5. El lore explica CÓMO y POR QUÉ se fusionaron
6. Habilidades/efectos combinados y potenciados
7. Añade un efecto sinérgico único de la fusión
8. TODO EN ESPAÑOL. Detallado y cinematográfico. Campos extensos con VARIOS PÁRRAFOS separados por \\n\\n

Responde SOLO con JSON válido (sin markdown, sin texto extra) siguiendo el esquema estándar del tipo ${outputType}.`;
}

export async function forgeRoute(req: Request, sessionId: string): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err("Invalid JSON body");
  }

  const idA = Number(body.generation_id_a);
  const idB = Number(body.generation_id_b);
  if (!idA || !idB || idA === idB) {
    return err("Se requieren dos IDs de generación diferentes (generation_id_a, generation_id_b)");
  }

  if (!checkRateLimit(sessionId)) return rateLimitResponse();

  const [genA, genB] = await Promise.all([
    getGenerationById(idA),
    getGenerationById(idB),
  ]);

  if (!genA || !genB) {
    return err("Una o ambas generaciones no fueron encontradas");
  }

  if (!VALID_TYPES.has(genA.type) || !VALID_TYPES.has(genB.type)) {
    return err("Solo se pueden fusionar tipos: npc, quest, item, lore, weapon, enemy");
  }

  const outputType = pickFusionType(genA.type, genB.type);
  const prompt = buildFusionPrompt(genA, genB, outputType);

  const model = typeof body.model === "string" ? body.model : ENV.GROQ_MODEL;
  const isHF = model.startsWith("https://");

  const rawResult = isHF
    ? await callTextModel(prompt, model)
    : await callGroq(prompt, model);

  if (!rawResult.ok) {
    logger.warn(`[forge] Model error: ${rawResult.error}`);
    return err("Error del modelo AI al fusionar. Intenta de nuevo.");
  }

  const parsed = parseJSON(rawResult.raw);
  if (!parsed.ok || !parsed.data) {
    logger.warn(`[forge] Parse failed: ${parsed.error}`);
    return err("No se pudo parsear la respuesta de fusión. Intenta de nuevo.");
  }

  const result = parsed.data as Record<string, unknown>;
  result._fusion = true;
  result._source_a = { id: genA.id, type: genA.type, name: (genA.result.name || genA.result.title) as string };
  result._source_b = { id: genB.id, type: genB.type, name: (genB.result.name || genB.result.title) as string };

  const generation = await insertGeneration({
    session_id: sessionId,
    type: outputType,
    prompt_meta: {
      fusion: true,
      source_a_id: genA.id,
      source_b_id: genB.id,
      source_a_type: genA.type,
      source_b_type: genB.type,
    },
    result,
    raw_output: rawResult.raw || null,
    source: "model",
  });

  return ok({
    ...generation,
    result,
    prompt_meta: { fusion: true, source_a_id: genA.id, source_b_id: genB.id },
  });
}
