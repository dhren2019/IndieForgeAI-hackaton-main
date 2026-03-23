import { GENERATION_TYPES } from "../config/constants";
import type { GenerationType } from "../types/generate";

export function isValidGenerationType(type: unknown): type is GenerationType {
  return typeof type === "string" && (GENERATION_TYPES as string[]).includes(type);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isValidPost(body: unknown): body is Record<string, unknown> {
  return typeof body === "object" && body !== null;
}
