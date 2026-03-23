/**
 * Groq API client — OpenAI-compatible endpoint.
 * Docs: https://console.groq.com/docs/openai
 */
import { ENV } from "../config/env";

export interface GroqTextResponse {
  raw:    string;
  ok:     boolean;
  error?: string;
}

export async function callGroq(prompt: string, model: string): Promise<GroqTextResponse> {
  if (!ENV.GROQ_API_KEY) {
    return { raw: "", ok: false, error: "GROQ_API_KEY not set in environment" };
  }

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ENV.GROQ_API_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role:    "system",
            content: "Eres un experto creador de contenido RPG para videojuegos indie. Responde SIEMPRE con JSON estricto y válido, sin comentarios, sin bloques de código markdown, sin texto adicional. Solo el objeto JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature:     0.85,
        max_tokens:      1024,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const body = await res.text();
      return { raw: "", ok: false, error: `Groq ${res.status}: ${body}` };
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const raw  = data.choices?.[0]?.message?.content ?? "";
    return { raw, ok: raw.length > 0 };
  } catch (e) {
    return { raw: "", ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
