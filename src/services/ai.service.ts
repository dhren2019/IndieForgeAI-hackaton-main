/**
 * AI service — builds prompts, calls Groq or HuggingFace, parses results, applies fallback.
 * Routing: if model starts with "https://" → HuggingFace client
 *           otherwise → Groq client
 */
import { callGroq }              from "../lib/groq";
import { callTextModel }         from "../lib/huggingface";
import { buildPrompt }           from "../lib/prompts";
import { parseJSON }             from "../utils/json-parser";
import { validateAndSanitize }   from "../lib/parser";
import { getFallback }           from "../lib/fallback";
import { insertGeneration } from "../db/client";
import { logger }                from "../utils/logger";
import { ENV }                   from "../config/env";
import type { GenerationType, PromptMeta, Generation } from "../types/generate";

export interface GenerateResult {
  generation: Generation;
}

export async function generateContent(
  sessionId: string,
  type: GenerationType,
  meta: PromptMeta,
  model: string = ENV.GROQ_MODEL
): Promise<GenerateResult> {
  const prompt = buildPrompt(type, meta);

  // Route to correct backend based on model identifier
  const isHF = model.startsWith("https://");
  const rawResult = isHF
    ? await callTextModel(prompt, model)
    : await callGroq(prompt, model);

  let result: Record<string, unknown>;
  let source: "model" | "fallback" = "model";

  if (rawResult.ok) {
    const parsed = parseJSON(rawResult.raw);
    if (parsed.ok && parsed.data) {
      const { valid, data, missingFields } = validateAndSanitize(type, parsed.data);
      if (valid) {
        result = data;
      } else {
        logger.warn(`[ai.service] Missing fields [${missingFields.join(", ")}] — fallback`);
        result = getFallback(type, meta as Record<string, unknown>);
        source = "fallback";
      }
    } else {
      logger.warn(`[ai.service] Parse failed: ${parsed.error} — fallback`);
      result = getFallback(type, meta as Record<string, unknown>);
      source = "fallback";
    }
  } else {
    logger.warn(`[ai.service] Model error (${isHF ? "HF" : "Groq"}): ${rawResult.error} — fallback`);
    result = getFallback(type, meta as Record<string, unknown>);
    source = "fallback";
  }

  const metaRaw = meta as Record<string, unknown>;
  if (metaRaw.userPrompt) result.userPrompt = metaRaw.userPrompt;
  if (metaRaw.genre)      result._genre     = metaRaw.genre;
  const generation = await insertGeneration({
    session_id:  sessionId,
    type,
    prompt_meta: meta as Record<string, unknown>,
    result,
    raw_output:  rawResult.raw || null,
    source,
  });

  return { generation: { ...generation, result, prompt_meta: meta as Record<string, string> } };
}
