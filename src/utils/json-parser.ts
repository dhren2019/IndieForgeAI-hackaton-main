/**
 * Robust JSON parser — attempts multiple strategies to extract valid JSON
 * from raw model output that may contain markdown fences or extra text.
 */

export interface ParseResult<T = Record<string, unknown>> {
  ok: boolean;
  data: T | null;
  error?: string;
}

export function parseJSON<T = Record<string, unknown>>(raw: string): ParseResult<T> {
  const cleaned = raw.trim();

  // Strategy 1 — direct parse
  try {
    return { ok: true, data: JSON.parse(cleaned) as T };
  } catch {}

  // Strategy 2 — extract first {...} block
  const braceMatch = cleaned.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return { ok: true, data: JSON.parse(braceMatch[0]) as T };
    } catch {}
  }

  // Strategy 3 — strip markdown code fences
  const stripped = cleaned.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const braceMatch2 = stripped.match(/\{[\s\S]*\}/);
  if (braceMatch2) {
    try {
      return { ok: true, data: JSON.parse(braceMatch2[0]) as T };
    } catch {}
  }

  return { ok: false, data: null, error: "No valid JSON found in model output" };
}
