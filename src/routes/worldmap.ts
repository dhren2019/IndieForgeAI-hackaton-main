/**
 * POST /api/worldmap
 *
 * Accepts either:
 *   { prompt: string }                     — free World Creator mode
 *   { type: string, result: object }       — legacy RPG content mode
 *
 * Returns { data: { description, params } }
 */
import { callGroq }  from "../lib/groq";
import { ok, err }   from "../utils/response";
import { ENV }       from "../config/env";

export interface WorldMapParams {
  biome:             string;
  terrain_roughness: number;
  water_level:       number;
  mountain_height:   number;
  danger_level:      number;
  mysticism:         number;
  terrain_color_1:   string;
  terrain_color_2:   string;
  terrain_color_3:   string;
  water_color:       string;
  sky_color:         string;
  fog_density:       number;
  region_name:       string;
  seeds:             number[];
  settlement_style:  string; // "village" | "fortress" | "ruins" | "towers" | "none"
  tree_density:      number; // 0-1
  landmarks:         string[];  // e.g. ["volcano","lava_river","temple","pyramid","ice_spikes","crystal","ancient_ruins","watchtower","giant_tree","floating_rocks","pillars","cave_entrance"]
  terrain_style:     string;    // "rolling" | "jagged" | "canyon" | "flat" | "crater" | "archipelago"
  has_lava:          boolean;
  ambient_particles: string;    // "none" | "embers" | "snow" | "fireflies" | "ash" | "spores" | "magic"
  lava_color:        string;    // hex 6 chars
  accent_color:      string;    // hex 6 chars, for glowing elements
}

const BIOMES = [
  "forest", "desert", "tundra", "swamp", "volcanic",
  "ocean", "plains", "mountains", "dungeon", "mystic",
] as const;

// ── Prompts ────────────────────────────────────────────────────────────────

function buildFreePrompt(userPrompt: string): string {
  return `Eres el arquitecto de mundos de fantasía más imaginativo del universo RPG.
Generas mundos 3D procedurales ÚNICOS y DETALLADOS que reflejan EXACTAMENTE lo que el usuario describe.

El usuario ha descrito el siguiente mundo:
"${userPrompt}"

Tu misión (doble):
1. Escribir una descripción vívida y evocadora del mundo (2-3 párrafos cortos, máx 320 palabras, en el MISMO idioma que el prompt del usuario). Habla del clima, la historia, los peligros, la magia. Haz que el lector sienta que está ahí.
2. Extraer los parámetros técnicos para generar el terreno 3D procedural. ANALIZA el prompt cuidadosamente y genera landmarks que CORRESPONDAN a lo descrito.

REGLA CRÍTICA: Los seeds DEBEN ser aleatorios y DIFERENTES cada vez. Nunca repitas seeds. Genera 3 números aleatorios entre 1 y 9999.

Responde SOLO con este JSON (sin markdown, sin texto extra):
{
  "description": "<2-3 párrafos vívidos del mundo>",
  "biome": "${BIOMES.join(" | ")}",
  "terrain_roughness": <0.0-1.0>,
  "water_level": <0.0-0.6>,
  "mountain_height": <0.0-1.0>,
  "danger_level": <0.0-1.0>,
  "mysticism": <0.0-1.0>,
  "terrain_color_1": "<hex 6 chars sin #, color base suelo>",
  "terrain_color_2": "<hex 6 chars sin #, color secundario>",
  "terrain_color_3": "<hex 6 chars sin #, color alturas medias>",
  "water_color":     "<hex 6 chars sin #>",
  "sky_color":       "<hex 6 chars sin #>",
  "fog_density":     <0.0-0.4>,
  "region_name":     "<nombre evocador del lugar, máx 32 chars>",
  "seeds":           [<entero aleatorio 1-9999>, <entero aleatorio 1-9999>, <entero aleatorio 1-9999>],
  "settlement_style": "village | fortress | ruins | towers | none",
  "tree_density":    <0.0-1.0>,
  "landmarks":       [<array de strings, features específicos del mundo. Opciones: "volcano", "lava_river", "temple", "pyramid", "ice_spikes", "crystal", "ancient_ruins", "watchtower", "giant_tree", "floating_rocks", "pillars", "cave_entrance", "altar", "obelisk">],
  "terrain_style":   "rolling | jagged | canyon | flat | crater | archipelago",
  "has_lava":        <true | false>,
  "ambient_particles": "none | embers | snow | fireflies | ash | spores | magic",
  "lava_color":      "<hex 6 chars sin #, color de lava/fuego>",
  "accent_color":    "<hex 6 chars sin #, color de acento brillante para elementos especiales>"
}

IMPORTANTE - landmarks debe reflejar el prompt:
- Si menciona volcanes → incluir "volcano" y posiblemente "lava_river"
- Si menciona templos → incluir "temple"
- Si menciona ruinas → incluir "ancient_ruins"
- Si menciona pirámides → incluir "pyramid"
- Si menciona cristales/gemas → incluir "crystal"
- Si menciona torres → incluir "watchtower"
- Si menciona árboles gigantes → incluir "giant_tree"
- Si menciona lava/fuego → has_lava=true, "lava_river"
- Si menciona hielo/nieve → incluir "ice_spikes"
- Si menciona pilares/columnas → incluir "pillars"
- Si menciona altares/santuarios → incluir "altar"
- Si menciona obeliscos/monolitos → incluir "obelisk"

Guías de bioma:
- forest: suelo marrón, verde bosque, settlement=village, árboles altos, terrain_style=rolling
- desert: arena dorada, terracota, sin agua, settlement=ruins, sin árboles, landmarks=["pyramid","ancient_ruins"]
- tundra: blanco nieve, azul hielo, cielo lavanda, sin árboles, landmarks=["ice_spikes"], ambient_particles=snow
- swamp: verde pantano, marrón turbio, settlement=ruins, tree_density 0.3, terrain_style=flat
- volcanic: negro ceniza, rojo lava, cielo rojo, has_lava=true, landmarks=["volcano","lava_river"], ambient_particles=embers, terrain_style=crater
- ocean: azules profundos, alta water_level ≥0.5, terrain_style=archipelago
- plains: verde hierba, amarillo tierra, village, terrain_style=rolling
- mountains: gris piedra, picos nevados, settlement=fortress, terrain_style=jagged
- dungeon: negro|gris oscuro, sin agua, settlement=towers, landmarks=["pillars","altar"], terrain_style=canyon
- mystic: púrpura|violeta, cielo índigo, landmarks=["crystal","floating_rocks","obelisk"], ambient_particles=magic`;
}

function buildRpgPrompt(type: string, content: Record<string, unknown>): string {
  return `Eres un experto en diseño de mundos RPG.
Analiza este contenido de tipo "${type}" y genera parámetros para un mapa 3D que represente su ambiente.

CONTENIDO:
${JSON.stringify(content, null, 2)}

Responde SOLO con este JSON (sin markdown, sin texto extra):
{
  "description": "",
  "biome": "${BIOMES.join(" | ")}",
  "terrain_roughness": <0.0-1.0>,
  "water_level": <0.0-0.6>,
  "mountain_height": <0.0-1.0>,
  "danger_level": <0.0-1.0>,
  "mysticism": <0.0-1.0>,
  "terrain_color_1": "<hex 6 chars>",
  "terrain_color_2": "<hex 6 chars>",
  "terrain_color_3": "<hex 6 chars>",
  "water_color":     "<hex 6 chars>",
  "sky_color":       "<hex 6 chars>",
  "fog_density":     <0.0-0.4>,
  "region_name":     "<nombre del lugar, máx 30 chars>",
  "seeds":           [<1-9999>, <1-9999>, <1-9999>],
  "settlement_style": "village | fortress | ruins | towers | none",
  "tree_density":    <0.0-1.0>
}`;
}

// ── Sanitizer ─────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function sanitize(raw: Record<string, unknown>): WorldMapParams {
  const validBiomes     = new Set(BIOMES as ReadonlyArray<string>);
  const validSettlements = new Set(["village", "fortress", "ruins", "towers", "none"]);
  const validTerrainStyles = new Set(["rolling", "jagged", "canyon", "flat", "crater", "archipelago"]);
  const validParticles  = new Set(["none", "embers", "snow", "fireflies", "ash", "spores", "magic"]);
  const validLandmarks  = new Set([
    "volcano", "lava_river", "temple", "pyramid", "ice_spikes", "crystal",
    "ancient_ruins", "watchtower", "giant_tree", "floating_rocks", "pillars",
    "cave_entrance", "altar", "obelisk",
  ]);
  const hexRe           = /^[0-9a-fA-F]{6}$/;

  const safeHex = (v: unknown, fallback: string): string => {
    const s = String(v ?? "").replace(/^#/, "");
    return hexRe.test(s) ? s : fallback;
  };

  const seeds = Array.isArray(raw.seeds)
    ? raw.seeds.slice(0, 3).map((s) => Math.max(1, Math.min(9999, Number(s) || 1)))
    : [Math.floor(Math.random() * 9999) + 1, Math.floor(Math.random() * 9999) + 1, Math.floor(Math.random() * 9999) + 1];
  while (seeds.length < 3) seeds.push(Math.floor(Math.random() * 9999) + 1);

  const landmarks = Array.isArray(raw.landmarks)
    ? raw.landmarks.filter((l) => validLandmarks.has(String(l))).map(String)
    : [];

  const biome = validBiomes.has(String(raw.biome)) ? String(raw.biome) : "plains";

  // Auto-add landmarks based on biome if none provided
  if (landmarks.length === 0) {
    if (biome === "volcanic") landmarks.push("volcano", "lava_river");
    if (biome === "tundra") landmarks.push("ice_spikes");
    if (biome === "mystic") landmarks.push("crystal", "floating_rocks");
    if (biome === "desert") landmarks.push("pyramid");
    if (biome === "dungeon") landmarks.push("pillars", "altar");
  }

  return {
    biome,
    terrain_roughness: clamp(Number(raw.terrain_roughness) || 0.5, 0, 1),
    water_level:       clamp(Number(raw.water_level)       || 0.2, 0, 0.6),
    mountain_height:   clamp(Number(raw.mountain_height)   || 0.5, 0, 1),
    danger_level:      clamp(Number(raw.danger_level)      || 0.3, 0, 1),
    mysticism:         clamp(Number(raw.mysticism)         || 0.2, 0, 1),
    terrain_color_1:   safeHex(raw.terrain_color_1, "4a6741"),
    terrain_color_2:   safeHex(raw.terrain_color_2, "2d5a27"),
    terrain_color_3:   safeHex(raw.terrain_color_3, "8b7355"),
    water_color:       safeHex(raw.water_color,     "1d6fa0"),
    sky_color:         safeHex(raw.sky_color,       "1a2a3a"),
    fog_density:       clamp(Number(raw.fog_density)       || 0.12, 0, 0.4),
    region_name:       String(raw.region_name ?? "Tierras Desconocidas").slice(0, 40),
    seeds:             seeds as [number, number, number],
    settlement_style:  validSettlements.has(String(raw.settlement_style)) ? String(raw.settlement_style) : "none",
    tree_density:      clamp(Number(raw.tree_density) || 0.2, 0, 1),
    landmarks,
    terrain_style:     validTerrainStyles.has(String(raw.terrain_style)) ? String(raw.terrain_style) : "rolling",
    has_lava:          raw.has_lava === true || raw.has_lava === "true",
    ambient_particles: validParticles.has(String(raw.ambient_particles)) ? String(raw.ambient_particles) : "none",
    lava_color:        safeHex(raw.lava_color,    "ff4500"),
    accent_color:      safeHex(raw.accent_color,  "ffaa00"),
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function worldMapRoute(req: Request, _sessionId: string): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err("Invalid JSON body");
  }

  const hasFreePrompt = typeof body.prompt === "string" && body.prompt.trim().length > 0;
  const prompt        = hasFreePrompt
    ? buildFreePrompt(String(body.prompt).slice(0, 800))
    : buildRpgPrompt(
        typeof body.type === "string" ? body.type : "lore",
        typeof body.result === "object" && body.result !== null
          ? body.result as Record<string, unknown>
          : {}
      );

  const model   = ENV.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  const groqRes = await callGroq(prompt, model);

  if (!groqRes.ok) {
    const fallbackParams = sanitize({
      biome: "plains", terrain_roughness: 0.5, water_level: 0.2,
      mountain_height: 0.5, danger_level: 0.3, mysticism: 0.2,
      terrain_color_1: "4a6741", terrain_color_2: "2d5a27", terrain_color_3: "8b7355",
      water_color: "1d6fa0", sky_color: "1a2a3a", fog_density: 0.1,
      region_name: "Tierras del Horizonte",
      seeds: [Math.floor(Math.random() * 9999) + 1, Math.floor(Math.random() * 9999) + 1, Math.floor(Math.random() * 9999) + 1],
      settlement_style: "village", tree_density: 0.2,
      landmarks: [], terrain_style: "rolling", has_lava: false,
      ambient_particles: "none", lava_color: "ff4500", accent_color: "ffaa00",
    });
    return ok({ description: "", params: fallbackParams });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(groqRes.raw) as Record<string, unknown>;
  } catch {
    return err("Failed to parse terrain parameters");
  }

  const description = typeof parsed.description === "string" ? parsed.description : "";
  const params      = sanitize(parsed);
  return ok({ description, params });
}

