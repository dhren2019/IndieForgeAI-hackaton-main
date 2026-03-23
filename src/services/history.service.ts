import { getDB, getHistory } from "../db/client";
import type { Generation } from "../types/generate";

export function getGenerationHistory(
  sessionId: string,
  limit = 20
): Generation[] {
  return getHistory(getDB(), sessionId, limit) as Generation[];
}
