/**
 * Prompt templates for each generation type.
 * Rules:
 *  - Always requests JSON only
 *  - Short output (fits in 256 tokens)
 *  - Fixed schema per type
 *  - No extra text / explanation
 */

export type GenerationType = "npc" | "quest" | "item" | "lore" | "weapon" | "enemy";

export interface NPCMeta {
  name?: string;
  genre?: string;  // fantasy, sci-fi, cyberpunk, western, etc.
  role?: string;   // merchant, villain, mentor, guard, etc.
}

export interface QuestMeta {
  title?: string;
  genre?: string;
  difficulty?: string; // easy, medium, hard
}

export interface ItemMeta {
  name?: string;
  genre?: string;
  rarity?: string; // common, rare, legendary
}

export interface LoreMeta {
  topic?: string;
  genre?: string;
  tone?: string; // dark, epic, mysterious, comedic
}

export interface WeaponMeta {
  name?: string;
  genre?: string;
  weaponClass?: string; // sword, axe, bow, staff, gun, hammer, dagger
  element?: string;     // fire, ice, lightning, dark, holy, poison, none
  style?: string;       // one-handed, two-handed, ranged, magic
}

export interface EnemyMeta {
  name?: string;
  genre?: string;
  enemyType?: string;  // beast, undead, demon, mechanical, elemental, humanoid
  difficulty?: string; // easy, medium, hard, boss
}

export type PromptMeta = NPCMeta | QuestMeta | ItemMeta | LoreMeta | WeaponMeta | EnemyMeta;

// ---------------------------------------------------------------------------
// Prompt builders — each returns a single string for the HF model
// ---------------------------------------------------------------------------

export function buildPrompt(type: GenerationType, meta: PromptMeta): string {
  switch (type) {
    case "npc":    return npcPrompt(meta as NPCMeta);
    case "quest":  return questPrompt(meta as QuestMeta);
    case "item":   return itemPrompt(meta as ItemMeta);
    case "lore":   return lorePrompt(meta as LoreMeta);
    case "weapon": return weaponPrompt(meta as WeaponMeta);
    case "enemy":  return enemyPrompt(meta as EnemyMeta);
  }
}

function npcPrompt(m: NPCMeta): string {
  const name  = m.name  || "un personaje aleatorio";
  const genre = m.genre || "fantasía";
  const role  = m.role  || "aldeano";
  return `Eres un escritor creativo de videojuegos de rol. Genera un NPC rico en detalles de ${genre} llamado ${name} que es un ${role}. TODO EN ESPAÑOL.
Responde SOLO con JSON válido con este esquema exacto, sin texto adicional ni markdown:
{"name":"string","role":"string","race":"string","age":"string","appearance":"descripción física detallada (25-35 palabras)","personality":"rasgos de personalidad completos (20-30 palabras)","backstory":"historia de fondo (30-40 palabras)","secret":"secreto oscuro o revelación (15-20 palabras)","motivation":"qué quiere conseguir (15-20 palabras)","dialogue":"frase característica del personaje (20-30 palabras)","combat_style":"cómo pelea o se defiende (10-15 palabras)"}`;
}

function questPrompt(m: QuestMeta): string {
  const title      = m.title      || "una aventura";
  const genre      = m.genre      || "fantasía";
  const difficulty = m.difficulty || "media";
  return `Eres un diseñador de videojuegos de rol. Genera una misión detallada de ${genre} titulada "${title}" con dificultad ${difficulty}. TODO EN ESPAÑOL.
Responde SOLO con JSON válido con este esquema exacto, sin texto adicional ni markdown:
{"title":"string","type":"string","difficulty":"string","objective":"objetivo principal detallado (25-35 palabras)","description":"contexto narrativo de la misión (30-40 palabras)","reward":"recompensas completas","location":"lugar específico con descripción breve (15-20 palabras)","enemies":["enemigo1","enemigo2"],"twist":"giro argumental impactante (20-25 palabras)","steps":["paso1","paso2","paso3"]}`;
}

function itemPrompt(m: ItemMeta): string {
  const name   = m.name   || "un objeto mágico";
  const genre  = m.genre  || "fantasía";
  const rarity = m.rarity || "raro";
  return `Eres un diseñador de objetos para videojuegos de rol. Genera un objeto ${rarity} de ${genre} llamado "${name}". TODO EN ESPAÑOL.
Responde SOLO con JSON válido con este esquema exacto, sin texto adicional ni markdown:
{"name":"string","type":"string","rarity":"string","description":"descripción visual y táctil detallada (25-35 palabras)","lore":"historia del objeto (25-35 palabras)","effect":"efecto mecánico completo con números (20-25 palabras)","requirements":"requisitos para usarlo (10-15 palabras)","value":number,"weight":"string"}`;
}

function lorePrompt(m: LoreMeta): string {
  const topic = m.topic || "el mundo";
  const genre = m.genre || "fantasía";
  const tone  = m.tone  || "épico";
  return `Eres un escritor de trasfondo para videojuegos de rol. Genera una entrada de lore ${tone} de ${genre} sobre "${topic}". TODO EN ESPAÑOL.
Responde SOLO con JSON válido con este esquema exacto, sin texto adicional ni markdown:
{"title":"string","era":"string","region":"string","summary":"resumen narrativo completo (40-55 palabras)","factions":["facción1 con descripción breve","facción2 con descripción breve"],"key_figures":["personaje importante 1","personaje importante 2"],"secret":"verdad oculta o conspiración (20-30 palabras)","impact":"cómo afecta al mundo actual (20-25 palabras)"}`;
}

function weaponPrompt(m: WeaponMeta): string {
  const name        = m.name        || "un arma legendaria";
  const genre       = m.genre       || "fantasía";
  const weaponClass = m.weaponClass || "espada";
  const element     = m.element     || "ninguno";
  const style       = m.style       || "una mano";
  return `Eres un herrero legendario y escritor de videojuegos de rol. Genera un ${weaponClass} de ${genre} para ${style} llamada "${name}" con elemento ${element}. TODO EN ESPAÑOL.
Responde SOLO con JSON válido con este esquema exacto, sin texto adicional ni markdown:
{"name":"string","class":"string","element":"string","style":"string","damage":"rango de daño con tipos (ej: 75-110 físico + 35 fuego)","speed":"velocidad de ataque","range":"alcance del arma","special_ability":"habilidad especial única con mecánica completa (20-30 palabras)","passive":"efecto pasivo (15-20 palabras)","lore":"historia del arma (30-40 palabras)","crafting_material":"materiales para forjarla (10-15 palabras)","value":number}`;
}

function enemyPrompt(m: EnemyMeta): string {
  const name       = m.name       || "un enemigo temible";
  const genre      = m.genre      || "fantasía";
  const enemyType  = m.enemyType  || "bestia";
  const difficulty = m.difficulty || "medio";
  return `Eres un diseñador de enemigos para videojuegos de rol. Genera un enemigo ${difficulty} de tipo ${enemyType} en género ${genre} llamado "${name}". TODO EN ESPAÑOL.
Responde SOLO con JSON válido con este esquema exacto, sin texto adicional ni markdown:
{"name":"string","type":"string","difficulty":"string","hp":number,"armor":number,"speed":"string","attack_style":"estilo de combate detallado (20-25 palabras)","abilities":["habilidad1 con descripción","habilidad2 con descripción"],"weakness":"debilidades específicas (15-20 palabras)","resistance":"resistencias del enemigo (10-15 palabras)","drops":"botín completo con probabilidades (15-20 palabras)","description":"descripción física y personalidad (30-40 palabras)","lore":"origen e historia (25-30 palabras)"}`;
}
