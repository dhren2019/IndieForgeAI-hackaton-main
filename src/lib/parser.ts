/**
 * Robust JSON parser.
 * Attempts multiple strategies to extract valid JSON from model output.
 */

export interface ParseResult<T = Record<string, unknown>> {
  ok: boolean;
  data: T | null;
  error?: string;
}

/**
 * Try to extract and parse JSON from raw model text.
 * Strategy order:
 *  1. Parse full string directly
 *  2. Extract first {...} block
 *  3. Extract first {...} block after stripping markdown fences
 */
export function parseJSON<T = Record<string, unknown>>(
  raw: string
): ParseResult<T> {
  const cleaned = raw.trim();

  // Strategy 1 — direct parse
  try {
    const data = JSON.parse(cleaned) as T;
    return { ok: true, data };
  } catch {}

  // Strategy 2 — extract first {...} block
  const braceMatch = cleaned.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      const data = JSON.parse(braceMatch[0]) as T;
      return { ok: true, data };
    } catch {}
  }

  // Strategy 3 — strip markdown code fences first
  const stripped = cleaned
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  const braceMatch2 = stripped.match(/\{[\s\S]*\}/);
  if (braceMatch2) {
    try {
      const data = JSON.parse(braceMatch2[0]) as T;
      return { ok: true, data };
    } catch {}
  }

  return { ok: false, data: null, error: "No valid JSON found in model output" };
}

// ---------------------------------------------------------------------------
// Per-type validators — ensure required fields exist and sanitize values
// ---------------------------------------------------------------------------

export type GenerationType = "npc" | "quest" | "item" | "lore" | "weapon" | "enemy";

export function validateAndSanitize(
  type: GenerationType,
  data: Record<string, unknown>
): { valid: boolean; data: Record<string, unknown>; missingFields: string[] } {
  const required = REQUIRED_FIELDS[type];
  const missingFields = required.filter((f) => !data[f]);

  if (missingFields.length > 0) {
    return { valid: false, data, missingFields };
  }

  // Truncate excessively long strings to keep responses clean
  const sanitized = sanitizeStrings(data, 600);
  return { valid: true, data: sanitized, missingFields: [] };
}

const REQUIRED_FIELDS: Record<GenerationType, string[]> = {
  npc:    ["name", "role", "personality", "dialogue"],
  quest:  ["title", "objective", "reward"],
  item:   ["name", "type", "description", "effect"],
  lore:   ["title", "summary"],
  weapon: ["name", "class", "damage", "special_ability"],
  enemy:  ["name", "type", "attack_style", "weakness"],
};

function sanitizeStrings(
  obj: Record<string, unknown>,
  maxLen: number
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.length > maxLen) {
      result[k] = v.slice(0, maxLen).trimEnd() + "…";
    } else {
      result[k] = v;
    }
  }
  return result;
}
