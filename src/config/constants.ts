import type { GenerationType } from "../types/generate";

export const GROQ_MODELS = [
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Recomendado)" },
  { id: "llama-3.1-8b-instant",    label: "Llama 3.1 8B (Rápido)" },
  { id: "mixtral-8x7b-32768",      label: "Mixtral 8x7B" },
  { id: "gemma2-9b-it",            label: "Gemma 2 9B" },
  { id: "qwen-qwq-32b",            label: "QwQ 32B (Razonamiento)" },
] as const;

export type GroqModelId = typeof GROQ_MODELS[number]["id"];

export const GENERATION_TYPES: GenerationType[] = [
  "npc", "quest", "item", "lore", "weapon", "enemy",
];

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export const SESSION_COOKIE = {
  name:     "session_id",
  maxAge:   2_592_000, // 30 days
  path:     "/",
  httpOnly: true,
  sameSite: "Lax" as const,
};

export const RATE_LIMIT = {
  windowMs:    60_000, // 1 minute
  maxRequests: 30,
} as const;
