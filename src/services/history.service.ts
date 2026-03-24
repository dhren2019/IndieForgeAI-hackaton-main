import { getHistory } from "../db/client";
import type { Generation } from "../types/generate";

export async function getGenerationHistory(
  sessionId: string,
  limit = 20
): Promise<Generation[]> {
  return getHistory(sessionId, limit) as Promise<Generation[]>;
}
