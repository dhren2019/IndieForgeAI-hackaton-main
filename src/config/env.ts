export const ENV = {
  PORT:                 Number(process.env.PORT           ?? 3000),
  // Groq — primary text generation backend
  GROQ_API_KEY:         process.env.GROQ_API_KEY          ?? "",
  GROQ_MODEL:           process.env.GROQ_MODEL            ?? "llama-3.3-70b-versatile",
  // HuggingFace — text + image generation
  HF_TOKEN:             process.env.HF_TOKEN              ?? "",
  HF_MODEL_URL:         process.env.HF_MODEL_URL          ?? "https://router.huggingface.co/hf-inference/models/Dhren/Qwen3-0.6B-heretic",
  HF_IMAGE_MODEL:       process.env.HF_IMAGE_MODEL        ?? "black-forest-labs/FLUX.1-schnell",
  DATABASE_URL:         process.env.DATABASE_URL          ?? "",
  // Clerk — if CLERK_SECRET_KEY is set it is used for JWKS lookup;
  // otherwise CLERK_PUBLISHABLE_KEY is used to derive the public JWKS URL
  // (no network-auth required). Set at least one for cross-device auth to work.
  CLERK_SECRET_KEY:     process.env.CLERK_SECRET_KEY      ?? "",
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY ?? "",
  NODE_ENV:             process.env.NODE_ENV              ?? "development",
} as const;
