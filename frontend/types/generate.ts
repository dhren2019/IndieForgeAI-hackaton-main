export type GenerationType = "npc" | "quest" | "item" | "lore" | "weapon" | "enemy" | "worldmap";
export type GenerationSource = "model" | "fallback";

export const AI_MODELS = [
  // ── HuggingFace ────────────────────────────────────────────────
  {
    id:       "https://router.huggingface.co/hf-inference/models/Dhren/Qwen3-0.6B-heretic",
    label:    "Qwen3-0.6B Heretic (Dhren Model)",
    provider: "hf" as const,
  },
  // ── Groq ───────────────────────────────────────────────────────
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B — Groq (Recomendado)", provider: "groq" as const },
  { id: "llama-3.1-8b-instant",    label: "Llama 3.1 8B — Groq (R\u00e1pido)",      provider: "groq" as const },
  { id: "mixtral-8x7b-32768",      label: "Mixtral 8x7B — Groq",                provider: "groq" as const },
  { id: "gemma2-9b-it",            label: "Gemma 2 9B — Groq",                  provider: "groq" as const },
  { id: "qwen-qwq-32b",            label: "QwQ 32B — Groq (Razonamiento)",       provider: "groq" as const },
] as const;

// Keep GROQ_MODELS alias for backwards compat
export const GROQ_MODELS = AI_MODELS;

export type AiModelId = typeof AI_MODELS[number]["id"];
export type GroqModelId = AiModelId;  // alias

export const DEFAULT_MODEL: AiModelId = "llama-3.3-70b-versatile";

export interface Generation {
  id: number;
  type: GenerationType;
  prompt_meta: Record<string, string>;
  result: Record<string, unknown>;
  source: GenerationSource;
  image_url: string | null;
  glb_url?: string | null;
  created_at: string;
}

export const TYPE_META = {
  npc:      { icon: "🧙", label: "NPC",        desc: "Personajes y personalidades",       color: "#f59e0b" },
  quest:    { icon: "⚔️", label: "Misín",     desc: "Misiones y objetivos",              color: "#3b82f6" },
  item:     { icon: "💎", label: "Objeto",    desc: "Armaduras, reliquias y objetos",    color: "#10b981" },
  lore:     { icon: "📜", label: "Trasfondo", desc: "Historia del mundo y secretos",     color: "#a78bfa" },
  weapon:   { icon: "🗡️", label: "Arma",      desc: "Espadas, bastones y armas",         color: "#ef4444" },
  enemy:    { icon: "💀", label: "Enemigo",   desc: "Bestias, demonios y jefes",         color: "#6b7280" },
  worldmap: { icon: "🌍", label: "Mundo 3D",   desc: "Mapas de terreno procedurales",     color: "#22d3ee" },
} as const;

export const GENEROS         = ["Fantasía", "Ciencia Ficción", "Cyberpunk", "Western", "Terror", "Steampunk", "Post-Apocalíptico"];
export const ROLES_NPC       = ["Mercader", "Villano", "Mentor", "Guardia", "Espía", "Sanador", "Asesino", "Errante"];
export const RAREZAS         = ["Común", "Infrecuente", "Raro", "Épico", "Legendario"];
export const DIFICULTADES    = ["Fácil", "Medio", "Difícil"];
export const DIFS_ENEMIGO    = ["Fácil", "Medio", "Difícil", "Jefe"];
export const TONOS           = ["Épico", "Oscuro", "Misterioso", "Cómico", "Trágico", "Esperanzador"];
export const CLASES_ARMA     = ["Espada", "Hacha", "Arco", "Bastón", "Pistola", "Martillo", "Daga", "Lanza"];
export const ELEMENTOS       = ["Ninguno", "Fuego", "Hielo", "Rayo", "Oscuro", "Sagrado", "Veneno", "Viento"];
export const ESTILOS_ARMA    = ["Una mano", "Dos manos", "A distancia", "Mágico"];
export const TIPOS_ENEMIGO   = ["Bestia", "No-muerto", "Demonio", "Mecánico", "Elemental", "Humanoide", "Dragón"];

export const FIELD_LABELS: Record<string, string> = {
  name: "Nombre", role: "Rol", race: "Raza", personality: "Personalidad",
  secret: "Secreto", dialogue: "Diálogo", title: "Título", type: "Tipo",
  region_name: "Nombre del mundo", biome: "Bioma", description: "Descripción",
  objective: "Objetivo", reward: "Recompensa", location: "Ubicación", twist: "Giro",
  rarity: "Rareza", description: "Descripción", effect: "Efecto", value: "Valor",
  era: "Era", summary: "Resumen", factions: "Facciones", element: "Elemento",
  style: "Estilo", damage: "Daño", special_ability: "Habilidad especial", lore: "Trasfondo",
  difficulty: "Dificultad", hp: "HP", attack_style: "Estilo de ataque",
  weakness: "Debilidad", drops: "Botín", class: "Clase", backstory: "Historia",
  appearance: "Apariencia", motivation: "Motivación", combat_style: "Combate",
  abilities: "Habilidades", resistance: "Resistencia", armor: "Armadura",
  speed: "Velocidad", range: "Alcance", passive: "Pasivo", crafting_material: "Materiales",
  steps: "Pasos", enemies: "Enemigos", region: "Región", factions_desc: "Facciones",
  key_figures: "Figuras clave", impact: "Impacto",
};
