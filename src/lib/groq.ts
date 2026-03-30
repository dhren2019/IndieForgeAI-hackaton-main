/**
 * Groq API client — OpenAI-compatible endpoint.
 * Docs: https://console.groq.com/docs/openai
 */
import { ENV }    from "../config/env";
import { logger } from "../utils/logger";

export interface GroqTextResponse {
  raw:    string;
  ok:     boolean;
  error?: string;
}

export async function callGroq(prompt: string, model: string): Promise<GroqTextResponse> {
  if (!ENV.GROQ_API_KEY) {
    logger.error("[groq] GROQ_API_KEY not set — request aborted");
    return { raw: "", ok: false, error: "GROQ_API_KEY not set in environment" };
  }

  logger.info(`[groq] → Request  model="${model}"  prompt_chars=${prompt.length}`);

  const body = JSON.stringify({
    model,
    messages: [
      {
        role:    "system",
        content: "Eres un experto creador de contenido RPG para videojuegos indie. Responde SIEMPRE con JSON estricto y válido, sin comentarios, sin bloques de código markdown, sin texto adicional. Solo el objeto JSON.",
      },
      { role: "user", content: prompt },
    ],
    temperature:     0.85,
    max_tokens:      4096,
    response_format: { type: "json_object" },
  });

  try {
    const t0  = Date.now();
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ENV.GROQ_API_KEY}`,
        "Content-Type":  "application/json",
      },
      body,
      signal: AbortSignal.timeout(60_000),
    });

    const elapsed = Date.now() - t0;

    if (!res.ok) {
      const errBody = await res.text();
      logger.error(`[groq] ✗ HTTP ${res.status} after ${elapsed}ms — ${errBody}`);
      return { raw: "", ok: false, error: `Groq ${res.status}: ${errBody}` };
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
      usage?:  { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model?:  string;
    };

    const raw    = data.choices?.[0]?.message?.content ?? "";
    const usage  = data.usage;
    const realModel = data.model ?? model;

    logger.info(
      `[groq] ✓ Response  model="${realModel}"  elapsed=${elapsed}ms` +
      (usage
        ? `  tokens=prompt:${usage.prompt_tokens}+completion:${usage.completion_tokens}=total:${usage.total_tokens}`
        : "") +
      `  response_chars=${raw.length}`
    );

    if (!raw) {
      logger.warn("[groq] ⚠ Empty content in response choices[0].message.content");
    }

    logger.debug(`[groq] Raw response preview: ${raw.slice(0, 300)}...`);

    return { raw, ok: raw.length > 0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`[groq] ✗ Fetch exception: ${msg}`);
    return { raw: "", ok: false, error: msg };
  }
}
