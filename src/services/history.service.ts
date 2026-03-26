import { getHistory } from "../db/client";
import type { Generation } from "../types/generate";

export async function getGenerationHistory(
  sessionId: string,
  limit = 20,
  cookieSessionId?: string | null
): Promise<Generation[]> {
  return getHistory(sessionId, limit, cookieSessionId) as Promise<Generation[]>;
}
