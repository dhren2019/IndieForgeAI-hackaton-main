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
  quest:  "character full body, main protagonist or quest NPC, detailed costume and equipment",
  item:   "single magical item, glowing, product concept art, dark studio background, no character, no hands",
  lore:   "epic cinematic scene illustration, atmospheric environment, dramatic lighting, vivid world-building",
  weapon: "single weapon, detailed metalwork and engravings, dark studio background, no character, no hands holding it",
  enemy:  "creature or monster full body design, terrifying, detailed anatomy and armor, consistent species and form",
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
  npc:    "ONLY the same individual character in 2 orthographic views (front and back), same outfit, same face, same design, no extra panels, no different characters, character only",
  quest:  "ONLY the same individual character in 2 orthographic views (front and back), no scene backgrounds, character only",
  item:   "ONLY the exact same item in exactly 2 views (front and back of the same object), NO character, NO hands, NO person, NO different item variation, same item from two sides only on clean white background",
  lore:   "world scene illustration only, no character sheets, no split panels",
  weapon: "ONLY the exact same weapon in exactly 2 views (front face and back face of the same weapon), NO character, NO hands, NO person holding it, NO different weapon, same weapon design from two angles only on clean white background",
  enemy:  "ONLY the same single creature in exactly 2 orthographic views (front and back of the same entity), DO NOT generate a different species, DO NOT add a humanoid variant, DO NOT draw two different creatures, same creature from front and from behind only, no floating separate weapons",
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

  // 2-view design sheet layout instructions per type — each must be extremely explicit
  // so the AI renders the SAME object/character from front AND back, not two separate items
  let sheetInstructions: string;
  if (type === "weapon") {
    sheetInstructions =
      "weapon design reference sheet, 16:9 horizontal single-image layout, EXACTLY TWO views of THE EXACT SAME WEAPON on one image: " +
      "[LEFT HALF: front face of the weapon, flat orthographic view, full weapon visible, centered vertically] " +
      "[RIGHT HALF: rear/back face of THE IDENTICAL SAME WEAPON rotated 180 degrees to show the other side, same proportions, same engravings, same materials], " +
      "pure white background, NO hands, NO character, NO person, NO second different weapon, soft studio lighting from above";
  } else if (type === "item") {
    sheetInstructions =
      "item design reference sheet, 16:9 horizontal single-image layout, EXACTLY TWO views of THE EXACT SAME ITEM on one image: " +
      "[LEFT HALF: front face of the item, flat orthographic view, full item visible, centered] " +
      "[RIGHT HALF: rear/back face of THE IDENTICAL SAME ITEM rotated to show the back side, same shape, same materials], " +
      "pure white background, NO hands, NO character, NO person, NO different item, soft studio product lighting";
  } else if (type === "enemy") {
    sheetInstructions =
      "creature/monster design reference sheet, 16:9 horizontal single-image layout, EXACTLY TWO orthographic views of THE SAME SINGLE CREATURE on one image: " +
      "[LEFT HALF: full body FRONT view, creature facing directly toward the viewer, neutral stance, full body visible from head to feet] " +
      "[RIGHT HALF: full body REAR/BACK view of THE EXACT SAME CREATURE rotated 180 degrees, same body shape, same armor, same textures, seen from behind], " +
      "pure white background, DO NOT draw a different creature species, DO NOT add a humanoid variant if creature is a beast, DO NOT generate two different entities, same creature only";
  } else if (type === "lore") {
    sheetInstructions =
      "epic panoramic scene illustration, 16:9 horizontal wide shot, showing the world, environment and events described above, cinematic atmospheric lighting, no text, no UI, no emblems, painterly game concept art style";
  } else {
    // npc, quest — character design sheet
    sheetInstructions =
      "character design reference sheet, 16:9 horizontal single-image layout, EXACTLY TWO orthographic views of THE SAME INDIVIDUAL CHARACTER on one image: " +
      "[LEFT HALF: full body FRONT view, character facing directly toward the viewer, neutral standing pose, arms slightly out from body, full body visible from head to feet] " +
      "[RIGHT HALF: full body REAR/BACK view of THE EXACT SAME CHARACTER rotated 180 degrees, identical outfit, identical hair, identical design, seen from behind], " +
      "pure white background, NO extra panels, NO different characters, NO weapons floating separately, same individual only";
  }

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
