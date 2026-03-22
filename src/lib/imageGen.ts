/**
 * HuggingFace free image generation via Inference API.
 * Model: black-forest-labs/FLUX.1-schnell (Apache 2.0, free)
 *
 * Generates a CHARACTER DESIGN SHEET — one image containing
 * frontal, back/side and face close-up views, like professional RPG concept art.
 */

const HF_TOKEN      = process.env.HF_TOKEN ?? "";
const IMAGE_MODEL   = process.env.HF_IMAGE_MODEL ?? "black-forest-labs/FLUX.1-schnell";
const IMAGE_API_URL = `https://router.huggingface.co/hf-inference/models/${IMAGE_MODEL}`;

export type CharacterType = "npc" | "quest" | "item" | "lore" | "weapon" | "enemy";

const TYPE_STYLE: Record<CharacterType, string> = {
  npc:    "fantasy RPG character, detailed costume and accessories",
  quest:  "fantasy RPG characters and scene, epic concept art",
  item:   "fantasy magical item on pedestal, glowing, product concept art, dark studio background",
  lore:   "fantasy world / faction emblem illustration, detailed, parchment style",
  weapon: "fantasy weapon design sheet, multiple angles, detailed metalwork, glowing runes, dark background",
  enemy:  "fantasy RPG monster or villain, terrifying, muscular, detailed armor",
};

export interface ImageGenResult {
  base64: string | null;
  mimeType: string;
  error?: string;
}

/**
 * Builds a prompt that requests a CHARACTER DESIGN SHEET with multiple views
 * (front, back/side, face close-up) in one single image composition.
 */
export function buildImagePrompt(
  type: CharacterType,
  result: Record<string, unknown>
): string {
  const name = String(result.name ?? result.title ?? "mysterious figure");

  // Build a rich descriptor from available fields
  const descriptors: string[] = [];
  if (result.race)        descriptors.push(String(result.race));
  if (result.role)        descriptors.push(String(result.role));
  if (result.type && type !== "npc") descriptors.push(String(result.type));
  if (result.element)     descriptors.push(`${result.element} elemental`);
  if (result.class)       descriptors.push(String(result.class));
  if (result.difficulty)  descriptors.push(`${result.difficulty} tier`);
  if (result.rarity)      descriptors.push(String(result.rarity));
  if (result.appearance)  descriptors.push(String(result.appearance).slice(0, 100));
  else if (result.description) descriptors.push(String(result.description).slice(0, 100));

  const desc   = descriptors.join(", ");
  const style  = TYPE_STYLE[type] ?? "fantasy RPG concept art";

  // The key: request a design sheet with multiple views in ONE composition
  const sheetInstructions = type === "item" || type === "lore" || type === "weapon"
    ? "multiple angles and details, design reference sheet, white background panels"
    : "character design sheet, THREE PANELS SIDE BY SIDE: [left panel: full body frontal view] [center panel: full body back view] [right panel: face and upper body close-up], white background, clean layout, professional concept art";

  return `${name}, ${desc}, ${style}, ${sheetInstructions}, high quality, detailed linework, professional game concept art, vibrant colors, dramatic lighting`
    .replace(/\s+/g, " ").trim();
}

/**
 * Calls the HuggingFace Inference API to generate an image and returns it as base64.
 */
export async function generateImage(prompt: string): Promise<ImageGenResult> {
  if (!HF_TOKEN) {
    return { base64: null, mimeType: "image/png", error: "HF_TOKEN no configurado. Añade HF_TOKEN=tu_token en las variables de entorno del servidor." };
  }

  try {
    const res = await fetch(IMAGE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
        "x-wait-for-model": "true",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { num_inference_steps: 4 }, // FLUX.1-schnell optimal
      }),
      signal: AbortSignal.timeout(90_000), // 90s — model can be cold
    });

    if (!res.ok) {
      const body = await res.text();
      return { base64: null, mimeType: "image/png", error: `HF API ${res.status}: ${body.slice(0, 300)}` };
    }

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const arrayBuffer = await res.arrayBuffer();
    const base64      = Buffer.from(arrayBuffer).toString("base64");

    return { base64, mimeType: contentType };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { base64: null, mimeType: "image/png", error: msg };
  }
}
