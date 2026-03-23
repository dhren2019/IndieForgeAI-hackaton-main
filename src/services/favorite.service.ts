import { getDB, addFavorite, removeFavorite, getFavorites } from "../db/client";
import type { Generation } from "../types/generate";

export function addToFavorites(sessionId: string, generationId: number): void {
  addFavorite(getDB(), sessionId, generationId);
}

export function removeFromFavorites(sessionId: string, generationId: number): void {
  removeFavorite(getDB(), sessionId, generationId);
}

export function getUserFavorites(sessionId: string): Generation[] {
  return getFavorites(getDB(), sessionId) as Generation[];
}
