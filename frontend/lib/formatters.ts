import { FIELD_LABELS } from "../types/generate";
import type { GenerationType } from "../types/generate";

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return "ahora mismo";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

export function authorName(sessionId: string): string {
  const raw = sessionId.replace(/^(anon-|sess-)/, "");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) hash = (hash * 31 + raw.charCodeAt(i)) & 0x7fff;
  return `Aventurero #${hash % 9000 + 1000}`;
}

export function getGenerationTitle(
  result: Record<string, unknown>,
  type: GenerationType,
  id: number
): string {
  return String(result.name ?? result.title ?? `${type} #${id}`);
}

export function getPreviewText(result: Record<string, unknown>): string {
  return String(
    result.personality   ??
    result.objective     ??
    result.description   ??
    result.summary       ??
    result.special_ability ??
    result.attack_style  ??
    ""
  );
}

export function labelFor(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, " ");
}

export function sanitizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
}

export function highlightJSON(str: string): string {
  return str.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) return `<span class="json-key">${match}</span>`;
        return `<span class="json-string">${match}</span>`;
      }
      if (/true|false/.test(match)) return `<span class="json-bool">${match}</span>`;
      if (/null/.test(match))       return `<span class="json-null">${match}</span>`;
      return `<span class="json-number">${match}</span>`;
    }
  );
}
