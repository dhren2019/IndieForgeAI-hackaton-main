import React, { useState, useRef } from "react";
import { PageContainer }   from "../components/layout/PageContainer";
import { WorldMapPanel }   from "../components/results/WorldMap3D";
import { Button }          from "../components/ui/Button";
import { Loader }          from "../components/ui/Loader";
import type { WorldMapParams } from "../components/results/WorldMap3D";

interface WorldCreatorPageProps {
  onToast: (msg: string, kind?: "ok" | "error") => void;
}

const EXAMPLES = [
  "Un reino de volcanes activos donde dragones de obsidiana custodian templos subterráneos llenos de lava y ruinas antiguas",
  "Bosques mágicos eternos donde los árboles brillan de noche y los elfos construyeron ciudades en las copas. La niebla cubre el suelo y esconde criaturas ancestrales",
  "Tundra helada con torres de hielo negro que emergen de la nieve. Los muertos caminan bajo las auroras boreales",
  "Pantanos traicioneros de color verde putrefacto, llenos de ruinas hundidas de una civilización ahogada. Cocodrilos gigantes patrullan las aguas oscuras",
  "Desierto de dunas doradas con pirámides enterradas hasta la mitad. Bajo la arena duerme un dios olvidado",
];

function freshSeeds(): [number, number, number] {
  return [
    Math.floor(Math.random() * 99999) + 1,
    Math.floor(Math.random() * 99999) + 1,
    Math.floor(Math.random() * 99999) + 1,
  ];
}

// ── Fully client-side random world generator (no AI needed) ──────────────────

type BiomeKey = "forest" | "desert" | "tundra" | "swamp" | "volcanic" | "ocean" | "plains" | "mountains" | "dungeon" | "mystic";

const BIOME_POOL: BiomeKey[] = ["forest", "desert", "tundra", "swamp", "volcanic", "ocean", "plains", "mountains", "dungeon", "mystic"];

const BIOME_DATA: Record<BiomeKey, {
  terrain_color_1: string; terrain_color_2: string; terrain_color_3: string;
  water_color: string; sky_color: string; settlement_style: string;
  tree_density: number; terrain_style: string; has_lava: boolean;
  ambient_particles: string; lava_color: string; accent_color: string;
  landmarks: string[]; names: string[]; fog_density: number;
  water_level: [number, number]; mountain_height: [number, number];
  terrain_roughness: [number, number]; danger_level: [number, number]; mysticism: [number, number];
}> = {
  forest: {
    terrain_color_1: "3d6b35", terrain_color_2: "2a5224", terrain_color_3: "1e4a1a",
    water_color: "1d6fa0", sky_color: "1a2e1a", settlement_style: "village",
    tree_density: 0.75, terrain_style: "rolling", has_lava: false,
    ambient_particles: "fireflies", lava_color: "ff4500", accent_color: "44ff88",
    landmarks: ["giant_tree", "ancient_ruins", "watchtower"],
    names: ["Bosque Eterno", "El Gran Bosque", "Selva Primordial", "Bosque de las Sombras", "Arboleda Encantada", "Bosque Esmeralda", "El Corazón Verde"],
    fog_density: 0.22, water_level: [0.2, 0.32], mountain_height: [0.3, 0.55],
    terrain_roughness: [0.35, 0.6], danger_level: [0.2, 0.55], mysticism: [0.3, 0.7],
  },
  desert: {
    terrain_color_1: "c9a76c", terrain_color_2: "a0845a", terrain_color_3: "d4b483",
    water_color: "2a6a8a", sky_color: "4a3010", settlement_style: "ruins",
    tree_density: 0.03, terrain_style: "rolling", has_lava: false,
    ambient_particles: "ash", lava_color: "ff4500", accent_color: "ffd700",
    landmarks: ["pyramid", "ancient_ruins", "obelisk"],
    names: ["Mar de Arena", "Desierto Eterno", "Las Dunas Rojas", "El Desierto del Olvido", "Tierras Áridas", "Llanura del Sol", "El Gran Desierto"],
    fog_density: 0.08, water_level: [0.03, 0.12], mountain_height: [0.2, 0.5],
    terrain_roughness: [0.3, 0.65], danger_level: [0.35, 0.65], mysticism: [0.1, 0.45],
  },
  tundra: {
    terrain_color_1: "c8d8e8", terrain_color_2: "8aa4b8", terrain_color_3: "d8e8f0",
    water_color: "2a4a6a", sky_color: "1a2030", settlement_style: "fortress",
    tree_density: 0.08, terrain_style: "rolling", has_lava: false,
    ambient_particles: "snow", lava_color: "ff4500", accent_color: "88ccff",
    landmarks: ["ice_spikes", "watchtower", "ancient_ruins"],
    names: ["Tundra Helada", "Los Campos de Hielo", "El Norte Eterno", "Glaciar de las Almas", "Tierras Congeladas", "El Ártico Perdido", "Permafrost"],
    fog_density: 0.28, water_level: [0.15, 0.3], mountain_height: [0.4, 0.7],
    terrain_roughness: [0.5, 0.8], danger_level: [0.4, 0.75], mysticism: [0.2, 0.5],
  },
  swamp: {
    terrain_color_1: "2d4a1a", terrain_color_2: "3a5a22", terrain_color_3: "4a6a2a",
    water_color: "1a3a1a", sky_color: "0a1a0a", settlement_style: "ruins",
    tree_density: 0.4, terrain_style: "flat", has_lava: false,
    ambient_particles: "spores", lava_color: "ff4500", accent_color: "44cc44",
    landmarks: ["ancient_ruins", "pillars"],
    names: ["El Pantano Oscuro", "Ciénaga Maldita", "Los Humedales", "Pantano de las Almas", "El Fango Profundo", "Marisma Negra", "Ciénaga Olvidada"],
    fog_density: 0.35, water_level: [0.35, 0.5], mountain_height: [0.1, 0.3],
    terrain_roughness: [0.15, 0.35], danger_level: [0.4, 0.7], mysticism: [0.35, 0.65],
  },
  volcanic: {
    terrain_color_1: "1a0a0a", terrain_color_2: "2a0a0a", terrain_color_3: "3a1a08",
    water_color: "3a0a00", sky_color: "1a0500", settlement_style: "none",
    tree_density: 0.02, terrain_style: "crater", has_lava: true,
    ambient_particles: "embers", lava_color: "ff4500", accent_color: "ff8800",
    landmarks: ["volcano", "lava_river", "altar"],
    names: ["Volcán Primordial", "Las Tierras de Fuego", "Infierno de Roca", "El Corazón del Volcán", "Caldera Eterna", "Montañas de Magma", "El Núcleo Ardiente"],
    fog_density: 0.3, water_level: [0.05, 0.15], mountain_height: [0.6, 1.0],
    terrain_roughness: [0.6, 0.9], danger_level: [0.65, 1.0], mysticism: [0.2, 0.5],
  },
  ocean: {
    terrain_color_1: "1a3a5a", terrain_color_2: "1a4a6a", terrain_color_3: "2a5a7a",
    water_color: "083070", sky_color: "0a1a2a", settlement_style: "village",
    tree_density: 0.15, terrain_style: "archipelago", has_lava: false,
    ambient_particles: "none", lava_color: "ff4500", accent_color: "00aaff",
    landmarks: ["watchtower", "ancient_ruins"],
    names: ["Archipiélago Perdido", "Las Islas del Sur", "Mar Profundo", "Islas Flotantes", "El Laberinto de Islas", "Costas del Olvido", "Mares Eternos"],
    fog_density: 0.2, water_level: [0.5, 0.6], mountain_height: [0.25, 0.55],
    terrain_roughness: [0.3, 0.6], danger_level: [0.25, 0.6], mysticism: [0.15, 0.5],
  },
  plains: {
    terrain_color_1: "5a8a35", terrain_color_2: "4a7a28", terrain_color_3: "8a9a3a",
    water_color: "1d6fa0", sky_color: "0a1a3a", settlement_style: "village",
    tree_density: 0.25, terrain_style: "rolling", has_lava: false,
    ambient_particles: "none", lava_color: "ff4500", accent_color: "ffdd44",
    landmarks: ["watchtower", "pillars"],
    names: ["Llanuras del Viento", "Praderas Infinitas", "Las Tierras Abiertas", "Campo Eterno", "La Gran Llanura", "Praderas del Horizonte", "Tierras Verdes"],
    fog_density: 0.08, water_level: [0.18, 0.3], mountain_height: [0.2, 0.45],
    terrain_roughness: [0.2, 0.5], danger_level: [0.15, 0.45], mysticism: [0.1, 0.35],
  },
  mountains: {
    terrain_color_1: "5a5a5a", terrain_color_2: "4a4a4a", terrain_color_3: "7a7a7a",
    water_color: "1d6fa0", sky_color: "0a1020", settlement_style: "fortress",
    tree_density: 0.2, terrain_style: "jagged", has_lava: false,
    ambient_particles: "none", lava_color: "ff4500", accent_color: "aaaaff",
    landmarks: ["watchtower", "ancient_ruins", "pillars", "crystal"],
    names: ["Picos del Mundo", "Las Montañas Eternas", "Cumbres Perdidas", "El Techo del Mundo", "Sierra Oscura", "Los Picos Nevados", "Montañas del Dragón"],
    fog_density: 0.2, water_level: [0.1, 0.25], mountain_height: [0.65, 1.0],
    terrain_roughness: [0.65, 0.95], danger_level: [0.35, 0.65], mysticism: [0.2, 0.5],
  },
  dungeon: {
    terrain_color_1: "1a1a1a", terrain_color_2: "2a2a2a", terrain_color_3: "3a3a3a",
    water_color: "0a0a1a", sky_color: "030308", settlement_style: "towers",
    tree_density: 0.0, terrain_style: "canyon", has_lava: false,
    ambient_particles: "magic", lava_color: "8800ff", accent_color: "8800ff",
    landmarks: ["pillars", "altar", "obelisk", "ancient_ruins"],
    names: ["Mazmorra Negra", "Las Catacumbas", "Cripta Eterna", "El Laberinto de Piedra", "Cuevas del Olvido", "Dungeon Primordial", "Abismo de Roca"],
    fog_density: 0.38, water_level: [0.05, 0.15], mountain_height: [0.3, 0.6],
    terrain_roughness: [0.5, 0.85], danger_level: [0.55, 0.95], mysticism: [0.4, 0.8],
  },
  mystic: {
    terrain_color_1: "2a1a4a", terrain_color_2: "3a1a5a", terrain_color_3: "4a2a6a",
    water_color: "1a0a3a", sky_color: "05020f", settlement_style: "towers",
    tree_density: 0.3, terrain_style: "rolling", has_lava: false,
    ambient_particles: "magic", lava_color: "cc00ff", accent_color: "cc00ff",
    landmarks: ["crystal", "floating_rocks", "obelisk", "altar", "temple"],
    names: ["El Plano Astral", "Tierras del Éter", "Dimensión Arcana", "El Vacío Místico", "Nexo Mágico", "Reinos de Sombra", "El Umbral"],
    fog_density: 0.3, water_level: [0.15, 0.3], mountain_height: [0.35, 0.65],
    terrain_roughness: [0.4, 0.75], danger_level: [0.45, 0.8], mysticism: [0.65, 1.0],
  },
};

function rndBetween(a: number, b: number): number {
  return a + Math.random() * (b - a);
}
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomWorldParams(): WorldMapParams {
  const biomeKey = pickRandom(BIOME_POOL);
  const d = BIOME_DATA[biomeKey];
  // Use 1-3 random landmarks from the biome's pool
  const landmarkCount = 1 + Math.floor(Math.random() * Math.min(3, d.landmarks.length));
  const shuffled = [...d.landmarks].sort(() => Math.random() - 0.5);
  const landmarks = shuffled.slice(0, landmarkCount);
  const name = pickRandom(d.names);
  return {
    biome:             biomeKey,
    terrain_roughness: rndBetween(...d.terrain_roughness),
    water_level:       rndBetween(...d.water_level),
    mountain_height:   rndBetween(...d.mountain_height),
    danger_level:      rndBetween(...d.danger_level),
    mysticism:         rndBetween(...d.mysticism),
    terrain_color_1:   d.terrain_color_1,
    terrain_color_2:   d.terrain_color_2,
    terrain_color_3:   d.terrain_color_3,
    water_color:       d.water_color,
    sky_color:         d.sky_color,
    fog_density:       d.fog_density,
    region_name:       name,
    seeds:             freshSeeds(),
    settlement_style:  d.settlement_style,
    tree_density:      d.tree_density,
    terrain_style:     d.terrain_style,
    has_lava:          d.has_lava,
    ambient_particles: d.ambient_particles,
    lava_color:        d.lava_color,
    accent_color:      d.accent_color,
    landmarks,
  };
}

// ── Smart client-side parser: convierte el prompt del usuario a WorldMapParams ─
function parsePromptLocally(prompt: string): WorldMapParams {
  const p = prompt.toLowerCase();

  // ── Detección de bioma (primera coincidencia gana) ─────────────────────────
  let biomeKey: BiomeKey = "plains";
  if      (/volcan|lava|magma|obsidian|ceniza|ignea/.test(p))                 biomeKey = "volcanic";
  else if (/hielo|nieve|tundra|helad|glaciar|ártico|artico|permafrost/.test(p)) biomeKey = "tundra";
  else if (/pantano|ciénaga|cienaga|marisma|fango|turba|swamp/.test(p))       biomeKey = "swamp";
  else if (/bosque|selva|árbol|arbol|forest|jungla|jungle/.test(p))           biomeKey = "forest";
  else if (/desierto|arena|dunas|desert|árido|arid/.test(p))                  biomeKey = "desert";
  else if (/océano|ocean|mar\b|sea\b|isla\b|archipiélago|archipelago/.test(p)) biomeKey = "ocean";
  else if (/montaña|montañas|sierra|pico|cumbre|mountain|colina/.test(p))     biomeKey = "mountains";
  else if (/mazmorra|cripta|dungeon|catacumba|catacomba|cueva|subterr/.test(p)) biomeKey = "dungeon";
  else if (/místico|arcano|éter|astral|mágico|mystic|arcane|planar/.test(p))  biomeKey = "mystic";

  const d = BIOME_DATA[biomeKey];

  // ── Detección de landmarks ─────────────────────────────────────────────────
  const lset = new Set<string>(d.landmarks.slice(0, 1));
  if (/volcan|volcán/.test(p))                                           lset.add("volcano");
  if (/\blava\b|magma/.test(p))                                          lset.add("lava_river");
  if (/templo|temple|santuario|shrine/.test(p))                          lset.add("temple");
  if (/pirámide|piramide|pyramid/.test(p))                               lset.add("pyramid");
  if (/ruina|ruinas|antigua|ancient|abandonad/.test(p))                  lset.add("ancient_ruins");
  if (/cristal|crystal|gema|\bgem\b/.test(p))                            lset.add("crystal");
  if (/atalaya|watchtower|torre.*vigía|vigilante/.test(p))               lset.add("watchtower");
  if (/árbol.*gigan|gigan.*árbol|árbol.*inmen|giant.*tree/.test(p))      lset.add("giant_tree");
  if (/\baltar\b|sacrific/.test(p))                                      lset.add("altar");
  if (/obelisco|obelisk|monolito/.test(p))                               lset.add("obelisk");
  if (/pilar|pilares|columna|columnas|pillar/.test(p))                   lset.add("pillars");
  if (/roca.*flota|piedra.*flota|float.*rock/.test(p))                   lset.add("floating_rocks");
  if (/pico.*hielo|hielo.*pico|ice.*spike/.test(p))                      lset.add("ice_spikes");
  if (/subterr/.test(p))                                                 lset.add("pillars");
  // Garantías por bioma
  if (biomeKey === "volcanic") { lset.add("volcano"); lset.add("lava_river"); }
  if (biomeKey === "tundra")   lset.add("ice_spikes");
  if (biomeKey === "mystic")   { lset.add("crystal"); lset.add("obelisk"); }
  if (biomeKey === "desert")   lset.add("pyramid");
  if (biomeKey === "dungeon")  { lset.add("pillars"); lset.add("altar"); }
  const landmarks = Array.from(lset);

  // ── Nivel de peligro ───────────────────────────────────────────────────────
  const highDanger = /dragón|dragon|letal|demon|bestia|beast|peligro|mortal|muerte|maldic/.test(p);
  const lowDanger  = /pacífico|peaceful|seguro|safe|tranquil/.test(p);
  const danger     = highDanger ? rndBetween(0.65, 0.98)
                   : lowDanger  ? rndBetween(0.0, 0.28)
                   : rndBetween(...d.danger_level);

  // ── Misticismo ─────────────────────────────────────────────────────────────
  const highMystic = /mágico|magia|magic|arcano|arcane|místico|mystic|encantado|hechizo/.test(p);
  const mysticism  = highMystic ? rndBetween(0.6, 1.0) : rndBetween(...d.mysticism);

  // ── Estilo de asentamiento ─────────────────────────────────────────────────
  let settlement = d.settlement_style;
  if      (/ruina|ruinas|abandonad/.test(p))                     settlement = "ruins";
  else if (/ciudad|city|village|aldea|pueblo|villa/.test(p))     settlement = "village";
  else if (/fortaleza|fortress|castillo|castle/.test(p))         settlement = "fortress";
  else if (/\btorre\b|\btorres\b|\btower\b/.test(p))             settlement = "towers";

  // ── Altura de montañas ─────────────────────────────────────────────────────
  const highMtn = /cumbres|pico.*alto|alto.*pico|montaña.*gigan|imponente/.test(p);
  const mtnH    = highMtn ? rndBetween(0.75, 1.0) : rndBetween(...d.mountain_height);

  // ── Rugosidad ──────────────────────────────────────────────────────────────
  const highRough = /escarpado|rugoso|accidentado|rough|jagged/.test(p);
  const roughness = highRough ? rndBetween(0.65, 0.95) : rndBetween(...d.terrain_roughness);

  // ── Nombre de región — extraer del prompt o usar default del bioma ─────────
  const nameMatch = /(?:llamad[ao]s?|conocid[ao]s?|den[oa]minad[ao]s?|llaman?)\s*["«]?([A-ZÁÉÍÓÚÑ][a-záéíóúñ ]{2,28})["»]?/i.exec(prompt);
  const regionName = nameMatch ? nameMatch[1].trim() : pickRandom(d.names);

  return {
    biome:             biomeKey,
    terrain_roughness: roughness,
    water_level:       rndBetween(...d.water_level),
    mountain_height:   mtnH,
    danger_level:      danger,
    mysticism,
    terrain_color_1:   d.terrain_color_1,
    terrain_color_2:   d.terrain_color_2,
    terrain_color_3:   d.terrain_color_3,
    water_color:       d.water_color,
    sky_color:         d.sky_color,
    fog_density:       d.fog_density,
    region_name:       regionName,
    seeds:             freshSeeds(),
    settlement_style:  settlement,
    tree_density:      d.tree_density,
    terrain_style:     d.terrain_style,
    has_lava:          d.has_lava || biomeKey === "volcanic",
    ambient_particles: d.ambient_particles,
    lava_color:        d.lava_color,
    accent_color:      d.accent_color,
    landmarks,
  };
}

export function WorldCreatorPage({ onToast }: WorldCreatorPageProps) {
  const [prompt,      setPrompt]      = useState("");
  const [loading,     setLoading]     = useState(false);
  const [description, setDescription] = useState<string | null>(null);
  const [params,      setParams]      = useState<WorldMapParams | null>(null);
  const [useAssets,   setUseAssets]   = useState(false);
  // Base params without seeds — lets us regenerate terrain shape without re-calling the AI
  const baseParamsRef = useRef<WorldMapParams | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCreate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) { onToast("Escribe una descripción del mundo primero", "error"); return; }
    setLoading(true);
    setDescription(null);
    setParams(null);

    try {
      const res = await fetch("/api/worldmap", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ prompt: trimmed }),
      });

      if (!res.ok) {
        // AI failed — fall back silently to client-side random world, show a warning
        let errDetail = "";
        try {
          const errJson = await res.json() as { error?: string };
          if (errJson.error) errDetail = errJson.error;
        } catch { /* ignore */ }
        console.warn("[WorldCreator] AI failed:", errDetail || res.status);
        const fallback = parsePromptLocally(trimmed);
        const fallbackWithAssets = { ...fallback, use_assets: useAssets };
        baseParamsRef.current = fallbackWithAssets;
        setParams(fallbackWithAssets);
        onToast(`✨ Mapa generado: "${fallback.region_name}"`);
        return;
      }

      const json = await res.json() as { data: { description: string; params: WorldMapParams } };
      // Always inject fresh random seeds — world TYPE comes from AI, terrain SHAPE is always unique
      const withFreshSeeds: WorldMapParams = { ...json.data.params, seeds: freshSeeds(), use_assets: useAssets };
      baseParamsRef.current = withFreshSeeds;
      setDescription(json.data.description);
      setParams(withFreshSeeds);
      onToast("¡Mundo generado! 🌍");
    } catch (e) {
      // Network error — fall back to local prompt parser
      console.warn("[WorldCreator] Network error:", e);
      const fallback = parsePromptLocally(trimmed);
      const fallbackWithAssets = { ...fallback, use_assets: useAssets };
      baseParamsRef.current = fallbackWithAssets;
      setParams(fallbackWithAssets);
      onToast(`✨ Mapa generado: "${fallback.region_name}"`);
    } finally {
      setLoading(false);
    }
  };

  const handleRandom = () => {
    const p = { ...generateRandomWorldParams(), use_assets: useAssets };
    baseParamsRef.current = p;
    setDescription(null);
    setParams(p);
    onToast(`🎲 Mundo aleatorio generado: ${p.region_name}`);
  };

  const handleExample = (ex: string) => {
    setPrompt(ex);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleCreate();
  };

  return (
    <div className="page-bg-wrap">
      <div className="social-bg" aria-hidden="true">
        <div className="social-bg__orb social-bg__orb--1" />
        <div className="social-bg__orb social-bg__orb--2" />
        <div className="social-bg__orb social-bg__orb--3" />
        <div className="social-bg__orb social-bg__orb--4" />
        <div className="social-bg__grid" />
      </div>

      <PageContainer>
        <div className="page-hero">
          <h1 className="page-hero__title"><span className="plain-emoji">🌍</span> World Creator</h1>
          <p className="page-hero__sub">
            Describe tu mundo en palabras. La IA lo imaginará y construirá un mapa 3D interactivo en tiempo real.
          </p>
          <div className="wc-hero-random">
            <span className="wc-hero-random__label">¿Sin ideas? Genera un mapa completamente aleatorio al instante:</span>
            <button className="wc-hero-random-btn" onClick={handleRandom} disabled={loading}>
              🎲 Mapa Aleatorio
            </button>
          </div>
        </div>

        {/* Prompt area */}
        <div className="wc-prompt-card">
          <div className="wc-prompt-card__header">
            <span className="wc-prompt-card__icon">✍️</span>
            <span className="wc-prompt-card__title">Describe tu mundo</span>
            <span className="wc-prompt-card__hint">Ctrl + Enter para generar</span>
          </div>

          <textarea
            ref={textareaRef}
            className="wc-textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Un vasto reino de montañas nevadas donde antiguos dioses duermen bajo la roca..."
            rows={5}
            maxLength={800}
            disabled={loading}
          />

          <div className="wc-prompt-card__footer">
            <span className="wc-char-count">{prompt.length}/800</span>
            <Button
              variant="primary"
              size="md"
              loading={loading}
              onClick={handleCreate}
              disabled={!prompt.trim() || loading}
              icon="🗺️"
            >
              Crear Mundo
            </Button>
          </div>
        </div>

        {/* Examples */}
        {!params && (
          <div className="wc-examples">
            <span className="wc-examples__label">Inspiración rápida:</span>
            <div className="wc-examples__chips">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  className="wc-example-chip"
                  onClick={() => handleExample(ex)}
                  disabled={loading}
                >
                  {ex.slice(0, 52)}…
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="wc-loading">
            <Loader size="lg" />
            <p className="wc-loading__text">La IA está imaginando tu mundo...</p>
            <p className="wc-loading__sub">Generando lore, extrayendo parámetros de terreno y preparando el mapa 3D</p>
          </div>
        )}

        {/* AI description */}
        {description && !loading && (
          <div className="wc-description">
            <div className="wc-description__header">
              <span className="wc-description__icon">📜</span>
              <span className="wc-description__title">El mundo que la IA imaginó</span>
            </div>
            <p className="wc-description__text">{description}</p>
          </div>
        )}

        {/* Map options bar */}
        <div className="wc-options-bar">
          <label className="wc-assets-toggle" title="Usa modelos 3D reales (.gltf) del pack de naturaleza en lugar de geometría procedural">
            <input
              type="checkbox"
              checked={useAssets}
              onChange={e => {
                setUseAssets(e.target.checked);
                // Re-apply to current map immediately
                if (baseParamsRef.current) {
                  const updated = { ...baseParamsRef.current, use_assets: e.target.checked };
                  baseParamsRef.current = updated;
                  setParams(updated);
                }
              }}
              disabled={loading}
            />
            <span className="wc-assets-toggle__icon">🌲</span>
            <span className="wc-assets-toggle__label">Usar assets glTF reales</span>
            <span className="wc-assets-toggle__hint">{useAssets ? "Cargando modelos 3D…" : "Geometría procedural"}</span>
          </label>
        </div>

        {/* 3D Map Panel */}
        {params && !loading && (
          <div className="wc-map-section">
            <div className="wc-map-regen-bar">
              <span className="wc-map-regen-bar__label">
                🌐 Cada mapa es único:
              </span>
              <button
                className="wc-map-regen-btn"
                onClick={() => {
                  if (!baseParamsRef.current) return;
                  const newParams = { ...baseParamsRef.current, seeds: freshSeeds(), use_assets: useAssets };
                  baseParamsRef.current = newParams;
                  setParams(newParams);
                  onToast("🎲 ¡Nuevo terreno generado!");
                }}
              >
                🎲 Nueva Forma
              </button>
              <button
                className="wc-map-regen-btn"
                onClick={handleRandom}
              >
                🌍 Mundo Aleatorio
              </button>
            </div>
            <WorldMapPanel params={params} />
          </div>
        )}
      </PageContainer>
    </div>
  );
}
