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

// ── Biome keyword extractor (used for prompt hints and fallback) ───────────

function extractBiomeFromPrompt(prompt: string): string | undefined {
  const p = prompt.toLowerCase();
  if (/volcan|lava|magma|obsidian|ceniza|ignea|pyroclast/.test(p))               return "volcanic";
  if (/hielo|nieve|tundra|helad|glaciar|ártico|artico|permafrost/.test(p))       return "tundra";
  if (/pantano|ciénaga|cienaga|marisma|fango|turba|swamp/.test(p))               return "swamp";
  if (/bosque|selva|árbol|arbol|forest|jungla|jungle/.test(p))                   return "forest";
  if (/desierto|arena|dunas|desert|árido|arid/.test(p))                          return "desert";
  if (/océano|ocean|\bmar\b|\bsea\b|\bisla\b|archipiélago|archipelago/.test(p)) return "ocean";
  if (/montaña|montañas|sierra|pico|cumbre|mountain|colina/.test(p))             return "mountains";
  if (/mazmorra|cripta|dungeon|catacumba|cueva|subterr/.test(p))                 return "dungeon";
  if (/místico|arcano|éter|astral|mágico|mystic|arcane|planar/.test(p))         return "mystic";
  return undefined;
}

// ── Prompts ────────────────────────────────────────────────────────────────

function buildFreePrompt(userPrompt: string): string {
  const detectedBiome = extractBiomeFromPrompt(userPrompt);
  const biomeHint = detectedBiome
    ? `\nBIOME OBLIGATORIO: El prompt menciona claramente características de "${detectedBiome}". DEBES usar biome="${detectedBiome}". No elijas otro bioma salvo que el prompt lo contradiga explícitamente.\n`
    : "";
  return `Eres el arquitecto de mundos de fantasía más imaginativo del universo RPG.
Tu output se convierte DIRECTAMENTE en un mapa 3D procedural — cada parámetro tiene impacto visual real.
FIDELIDAD TOTAL: el mapa DEBE reflejar lo que el usuario describe. Si dice volcanes → biome=volcanic, has_lava=true. Si dice dragones → danger_level alto. Si dice magia → mysticism alto.
${biomeHint}
PROMPT DEL USUARIO:
"${userPrompt}"

Tu misión (doble):
1. Escribir una descripción vívida (2-3 párrafos, máx 300 palabras, en el idioma del prompt). Clima, historia, peligros, magia. Que el lector sienta que está ahí.
2. Extraer parámetros técnicos. CADA palabra del prompt importa. Extrae TODO lo que puedas.

REGLAS CRÍTICAS:
- Seeds DEBEN ser 3 enteros completamente ALEATORIOS entre 1 y 9999 — nunca iguales entre sí.
- landmarks DEBE ser un array con TODOS los elementos que menciona el prompt.
- Si el prompt menciona lava, fuego, volcanes → has_lava=true SIEMPRE.
- Los colores deben REFLEJAR el mood del prompt: volcánico=negros/rojos, místico=púrpuras, etc.
- danger_level: dragones/demonios/monstruos=0.8-1.0. Tranquilo/seguro=0.0-0.3.
- mysticism: magia/hechizos/dimensiones=0.7-1.0. Sin magia=0.0-0.3.
- terrain_roughness: montañas escarpadas/volcanes=0.7-1.0. Llanuras/pantanos=0.1-0.4.

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
    ? raw.seeds.slice(0, 3).map((s) => Math.max(1, Math.min(99999, Number(s) || 1)))
    : [Math.floor(Math.random() * 99999) + 1, Math.floor(Math.random() * 99999) + 1, Math.floor(Math.random() * 99999) + 1];
  while (seeds.length < 3) seeds.push(Math.floor(Math.random() * 99999) + 1);

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

// ── Fallback world generator (used when AI is unavailable) ───────────────────

const BIOME_DEFAULTS: Record<string, Partial<Record<string, unknown>>> = {
  forest:    { terrain_color_1: "4a6741", terrain_color_2: "2d5a27", terrain_color_3: "8b7355", water_color: "1d6fa0", sky_color: "2a3d5c", settlement_style: "village", tree_density: 0.75, ambient_particles: "none" },
  desert:    { terrain_color_1: "c9a76c", terrain_color_2: "d4885a", terrain_color_3: "b8860b", water_color: "1e90ff", sky_color: "6a8cc7", settlement_style: "ruins",   tree_density: 0.05, landmarks: ["pyramid", "ancient_ruins"], terrain_style: "flat" },
  tundra:    { terrain_color_1: "b0c4d8", terrain_color_2: "ffffff", terrain_color_3: "8fafc0", water_color: "6aaed6", sky_color: "8ab4d8", settlement_style: "none",    tree_density: 0.05, landmarks: ["ice_spikes"], ambient_particles: "snow" },
  swamp:     { terrain_color_1: "3a4a2a", terrain_color_2: "2a3a1a", terrain_color_3: "5a6a3a", water_color: "2a4a2a", sky_color: "2a3a2a", settlement_style: "ruins",   tree_density: 0.35, terrain_style: "flat" },
  volcanic:  { terrain_color_1: "2a1a1a", terrain_color_2: "1a0a0a", terrain_color_3: "3a1a1a", water_color: "ff4500", sky_color: "2a0a0a", settlement_style: "none",    tree_density: 0.0,  has_lava: true, lava_color: "ff4500", landmarks: ["volcano", "lava_river"], ambient_particles: "embers", terrain_style: "crater" },
  plains:    { terrain_color_1: "6aaa50", terrain_color_2: "4a8840", terrain_color_3: "8ab060", water_color: "1d6fa0", sky_color: "3a5a8a", settlement_style: "village", tree_density: 0.25, terrain_style: "rolling" },
  mountains: { terrain_color_1: "787878", terrain_color_2: "585858", terrain_color_3: "a0a0a0", water_color: "4a8aaa", sky_color: "2a3a4a", settlement_style: "fortress", tree_density: 0.18, terrain_style: "jagged", mountain_height: 0.9 },
  mystic:    { terrain_color_1: "5a3a7a", terrain_color_2: "3a1a5a", terrain_color_3: "8a5aaa", water_color: "7a3abb", sky_color: "1a0a2a", settlement_style: "towers",  tree_density: 0.4,  landmarks: ["crystal", "floating_rocks", "obelisk"], ambient_particles: "magic", accent_color: "c084fc" },
  ocean:     { terrain_color_1: "0a2a4a", terrain_color_2: "0a1a3a", terrain_color_3: "1a3a5a", water_color: "1d6fa0", sky_color: "2a4a6a", settlement_style: "none",    tree_density: 0.05, terrain_style: "archipelago", water_level: 0.55 },
  dungeon:   { terrain_color_1: "2a2a2a", terrain_color_2: "1a1a1a", terrain_color_3: "3a3a3a", water_color: "1a1a2a", sky_color: "0a0a0a", settlement_style: "towers",  tree_density: 0.0,  landmarks: ["pillars", "altar"], terrain_style: "canyon" },
};

function generateFallbackParams(biomeHint?: string): { description: string; params: WorldMapParams } {
  const validBiomes = Object.keys(BIOME_DEFAULTS);
  const biome = validBiomes.includes(biomeHint ?? "") ? (biomeHint as string) : validBiomes[Math.floor(Math.random() * validBiomes.length)];
  const baseDefaults = BIOME_DEFAULTS[biome] ?? {};
  const description = `Un mundo ${biome} generado proceduralmente. La IA no estaba disponible, pero el terreno fue creado con los parámetros por defecto del bioma ${biome}.`;
  const params = sanitize({
    biome,
    terrain_roughness: biome === "mountains" ? 0.82 : biome === "volcanic" ? 0.75 : biome === "plains" ? 0.25 : 0.5,
    water_level:       biome === "ocean" ? 0.55 : biome === "desert" || biome === "volcanic" ? 0.05 : 0.25,
    mountain_height:   biome === "mountains" ? 0.9 : biome === "volcanic" ? 0.7 : 0.45,
    danger_level:      biome === "volcanic" ? 0.85 : biome === "dungeon" ? 0.9 : biome === "mystic" ? 0.55 : 0.3,
    mysticism:         biome === "mystic" ? 0.88 : biome === "dungeon" ? 0.45 : 0.15,
    fog_density:       biome === "swamp" ? 0.22 : biome === "dungeon" ? 0.18 : 0.1,
    region_name:       `Tierras ${biome.charAt(0).toUpperCase() + biome.slice(1)}`,
    seeds:             [Math.floor(Math.random() * 9999) + 1, Math.floor(Math.random() * 9999) + 1, Math.floor(Math.random() * 9999) + 1],
    ...baseDefaults,
  });
  return { description, params };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function worldMapRoute(req: Request, _sessionId: string): Promise<Response> {
  try {
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
      console.warn("[worldmap] Groq unavailable:", groqRes.error);
      const biomeHint =
        typeof body.type   === "string" ? body.type :
        typeof body.prompt === "string" ? extractBiomeFromPrompt(body.prompt) :
        undefined;
      const { description, params } = generateFallbackParams(biomeHint);
      return ok({ description: `⚠️ IA no disponible — mundo de respaldo generado.\n\n${description}`, params, fallback: true });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(groqRes.raw) as Record<string, unknown>;
    } catch {
      console.warn("[worldmap] JSON parse failed, using fallback. Raw:", groqRes.raw.slice(0, 120));
      const biomeHint =
        typeof body.type   === "string" ? body.type :
        typeof body.prompt === "string" ? extractBiomeFromPrompt(body.prompt) :
        undefined;
      const { description, params } = generateFallbackParams(biomeHint);
      return ok({ description: `⚠️ Error de formato IA — mundo de respaldo generado.\n\n${description}`, params, fallback: true });
    }

    const description = typeof parsed.description === "string" ? parsed.description : "";
    const params      = sanitize(parsed);
    return ok({ description, params });

  } catch (e) {
    console.error("[worldmap] Unhandled error:", e);
    const { description, params } = generateFallbackParams();
    return ok({ description: `🔧 Error interno — mundo de respaldo generado.\n\n${description}`, params, fallback: true });
  }
}

