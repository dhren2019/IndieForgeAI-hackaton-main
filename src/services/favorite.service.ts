import { addFavorite, removeFavorite, getFavorites } from "../db/client";
import type { Generation } from "../types/generate";

export async function addToFavorites(sessionId: string, generationId: number): Promise<void> {
  await addFavorite(sessionId, generationId);
}

export async function removeFromFavorites(sessionId: string, generationId: number): Promise<void> {
  await removeFavorite(sessionId, generationId);
}

export async function getUserFavorites(sessionId: string, cookieSessionId?: string | null): Promise<Generation[]> {
  return getFavorites(sessionId, cookieSessionId) as Promise<Generation[]>;
}
