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
  npc:    "character full body, detailed costume and accessories worn on the character",
  quest:  "adventure scene, epic concept art, characters in action",
  item:   "single magical item, glowing, product concept art, dark studio background, no character, no hands",
  lore:   "epic cinematic scene illustration, atmospheric environment, dramatic lighting, vivid world-building",
  weapon: "single weapon design, detailed metalwork, dark background, no character, no hands holding it",
  enemy:  "monster or villain full body, terrifying, muscular, detailed armor",
};

// Genre-to-aesthetic mapping — applied on top of TYPE_STYLE
const GENRE_AESTHETIC: Record<string, string> = {
  "fantasía":          "high fantasy RPG art style, magical, medieval",
  "fantasy":           "high fantasy RPG art style, magical, medieval",
  "sci-fi":            "science fiction RPG, futuristic technology, sleek surfaces, neon accents",
  "cyberpunk":         "cyberpunk aesthetic, neon-lit, cybernetic implants, rain-soaked urban, high-tech low-life",
  "post-apocalíptico": "post-apocalyptic wasteland, rusted metal, torn cloth, makeshift armor, dust and debris, survivor aesthetic",
  "post-apocaliptico": "post-apocalyptic wasteland, rusted metal, torn cloth, makeshift armor, dust and debris, survivor aesthetic",
  "post apocalíptico": "post-apocalyptic wasteland, rusted metal, torn cloth, makeshift armor, dust and debris, survivor aesthetic",
  "western":           "wild west frontier, leather duster, worn boots, desert setting, cowboy aesthetic",
  "horror":            "dark horror, gothic shadows, unsettling details, desaturated palette",
  "steampunk":         "steampunk aesthetic, brass gears, clockwork gadgets, Victorian industrial",
  "medieval":          "dark ages medieval, realistic armor, historical details",
};

// Strict isolation instructions per type — prevent the model from mixing in other content
const TYPE_ISOLATION: Record<CharacterType, string> = {
  npc:    "ONLY the character's body in 2 orthographic views, no floating weapons, no item callout panels, no separate object sheets, character only",
  quest:  "scene illustration only",
  item:   "ONLY the item itself in 2 views, no character, no hands, no person, item only on clean background",
  lore:   "world illustration only",
  weapon: "ONLY the weapon itself in 2 views, no character, no hands, no person holding it, weapon only on clean background",
  enemy:  "ONLY the enemy creature's body in 2 orthographic views, no floating weapons separate from creature, enemy character only",
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

  // Resolve genre aesthetic
  const rawGenre   = result._genre ? String(result._genre).toLowerCase().trim() : "";
  const genreStyle = GENRE_AESTHETIC[rawGenre] ?? (rawGenre ? `${rawGenre} aesthetic` : "fantasy RPG art style");

  // Build a rich descriptor from AI-generated fields
  const descriptors: string[] = [];
  if (result.race)        descriptors.push(String(result.race));
  if (result.role)        descriptors.push(String(result.role));
  if (result.type && type !== "npc") descriptors.push(String(result.type));
  if (result.element)     descriptors.push(`${result.element} element`);
  if (result.class)       descriptors.push(String(result.class));
  if (result.difficulty)  descriptors.push(`${result.difficulty} difficulty`);
  if (result.rarity)      descriptors.push(String(result.rarity));
  // For lore: add era, region, geography as key narrative context
  if (type === "lore") {
    if (result.era)      descriptors.push(String(result.era).slice(0, 60));
    if (result.region)   descriptors.push(String(result.region).slice(0, 80));
    if (result.geography) descriptors.push(String(result.geography).slice(0, 100));
  }

  // Use the AI-generated visual description first, then fallback fields
  const visualDesc =
    result.appearance   ? String(result.appearance).slice(0, 140) :
    result.description  ? String(result.description).slice(0, 140) :
    null;
  if (visualDesc) descriptors.push(visualDesc);

  // Include backstory/lore/history for mood and context
  const loreSnippet =
    result.history   ? String(result.history).slice(0, 120) :
    result.overview  ? String(result.overview).slice(0, 100) :
    result.backstory ? String(result.backstory).slice(0, 80) :
    result.lore      ? String(result.lore).slice(0, 80) :
    result.summary   ? String(result.summary).slice(0, 80) :
    null;
  if (loreSnippet) descriptors.push(loreSnippet);

  // User's own visual prompt overrides/extends everything else
  const userHint = result.userPrompt ? String(result.userPrompt).trim() : null;

  const desc      = descriptors.filter(Boolean).join(", ");
  const style     = TYPE_STYLE[type] ?? "concept art";
  const isolation = TYPE_ISOLATION[type] ?? "";

  // 2-view design sheet layout instructions per type
  const sheetInstructions = type === "item" || type === "weapon"
    ? "design sheet, 16:9 horizontal layout, exactly TWO views of the same object side by side: [left half: front view] [right half: back view], plain white background, no character, no hands, studio product lighting"
    : type === "lore"
    ? "epic panoramic scene illustration, 16:9 horizontal wide shot, showing the world, environment and events described above, cinematic atmospheric lighting, no text, no UI, no emblems, painterly game concept art style"
    : "character design reference sheet, 16:9 horizontal layout, exactly TWO views of the same character: [left half: full body front view facing forward, neutral standing pose, arms slightly out] [right half: full body back view, same pose seen from behind], plain white background, no extra panels, no weapons floating separately";

  const basePrompt = `${name}, ${desc}, ${style}, ${genreStyle}, ${sheetInstructions}, ${isolation}, high quality, detailed linework, professional game concept art, dramatic lighting`;
  const finalPrompt = userHint ? `${basePrompt}, ${userHint}` : basePrompt;

  return finalPrompt.replace(/\s+/g, " ").trim();
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
        parameters: {
          num_inference_steps: 4, // FLUX.1-schnell optimal
          width:  1280,
          height:  720,           // 16:9 aspect ratio
        },
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
