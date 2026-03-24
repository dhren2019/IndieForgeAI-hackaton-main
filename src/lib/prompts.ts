/**
 * Prompt templates for each generation type.
 * Rules:
 *  - Always requests JSON only
 *  - Detailed output (~512 tokens)
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
  return `Eres un escritor creativo de videojuegos de rol. Genera un NPC rico en detalles de ${genre} llamado ${name} que es un ${role}. TODO EN ESPAÑOL. Sé muy detallado y creativo, especialmente en apariencia, historia y diálogo.
Responde SOLO con JSON válido con este esquema exacto, sin texto adicional ni markdown:
{"name":"string","role":"string","race":"string","age":"string","appearance":"descripción física exhaustiva y visual: altura, complexión, rasgos faciales exactos, color de cabello/ojos/piel, cicatrices o marcas, ropa pieza por pieza con colores y materiales, accesorios, posturas habituales y detalles únicos que lo distinguen (120-150 palabras)","personality":"rasgos de personalidad completos con matices, virtudes, defectos y contradicciones internas (40-60 palabras)","backstory":"historia de fondo extensa y detallada: infancia, eventos traumáticos o decisivos, relaciones importantes, giros del destino que lo convirtieron en quien es hoy, con fechas o épocas si aplica (150-200 palabras)","secret":"secreto oscuro o revelación que cambia la perspectiva del personaje (30-40 palabras)","motivation":"qué quiere conseguir y por qué es importante para él (30-40 palabras)","dialogue":"dos o tres frases características del personaje que reflejen su voz única, acento, vocabulario y estado emocional habitual — deben sonar como diálogos reales de un videojuego (60-80 palabras)","combat_style":"cómo pelea o se defiende, tácticas y armas (20-30 palabras)"}`;
}

function questPrompt(m: QuestMeta): string {
  const title      = m.title      || "una aventura";
  const genre      = m.genre      || "fantasía";
  const difficulty = m.difficulty || "media";
  return `Eres un diseñador de videojuegos de rol. Genera una misión detallada de ${genre} titulada "${title}" con dificultad ${difficulty}. TODO EN ESPAÑOL. Sé detallado y creativo.
Responde SOLO con JSON válido con este esquema exacto, sin texto adicional ni markdown:
{"title":"string","type":"string","difficulty":"string","objective":"objetivo principal detallado con contexto y urgencia (50-70 palabras)","description":"contexto narrativo completo de la misión con trasfondo (60-80 palabras)","reward":"recompensas completas con cantidades específicas y objetos únicos","location":"lugar específico con descripción ambiental detallada (30-40 palabras)","enemies":["enemigo1 con descripción breve","enemigo2 con descripción breve"],"twist":"giro argumental impactante que cambia el significado de la misión (40-50 palabras)","steps":["paso1 detallado","paso2 detallado","paso3 detallado"]}`;
}

function itemPrompt(m: ItemMeta): string {
  const name   = m.name   || "un objeto mágico";
  const genre  = m.genre  || "fantasía";
  const rarity = m.rarity || "raro";
  return `Eres un diseñador de objetos para videojuegos de rol. Genera un objeto ${rarity} de ${genre} llamado "${name}". TODO EN ESPAÑOL. Sé detallado y creativo.
Responde SOLO con JSON válido con este esquema exacto, sin texto adicional ni markdown:
{"name":"string","type":"string","rarity":"string","description":"descripción visual y táctil muy detallada: materiales, colores, grabados, sensaciones (60-80 palabras)","lore":"historia completa del objeto con origen, propietarios famosos y leyendas (50-70 palabras)","effect":"efecto mecánico completo con números, condiciones de activación y limitaciones (40-50 palabras)","requirements":"requisitos detallados para usarlo (20-25 palabras)","value":number,"weight":"string"}`;
}

function lorePrompt(m: LoreMeta): string {
  const topic = m.topic || "el mundo";
  const genre = m.genre || "fantasía";
  const tone  = m.tone  || "épico";
  return `Eres un escritor de trasfondo para videojuegos de rol. Genera una entrada de lore ${tone} de ${genre} sobre "${topic}". TODO EN ESPAÑOL. Sé detallado y evocador.
Responde SOLO con JSON válido con este esquema exacto, sin texto adicional ni markdown:
{"title":"string","era":"string","region":"string","summary":"resumen narrativo completo y detallado con hechos históricos clave (80-100 palabras)","factions":["facción1 con descripción completa de ideología y métodos","facción2 con descripción completa de ideología y métodos"],"key_figures":["personaje importante 1 con descripción y rol","personaje importante 2 con descripción y rol"],"secret":"verdad oculta o conspiración que cambia todo lo que se sabía (40-60 palabras)","impact":"cómo afecta al mundo actual, qué cicatrices o consecuencias dejó (40-50 palabras)"}`;
}

function weaponPrompt(m: WeaponMeta): string {
  const name        = m.name        || "un arma legendaria";
  const genre       = m.genre       || "fantasía";
  const weaponClass = m.weaponClass || "espada";
  const element     = m.element     || "ninguno";
  const style       = m.style       || "una mano";
  return `Eres un herrero legendario y escritor de videojuegos de rol. Genera un ${weaponClass} de ${genre} para ${style} llamada "${name}" con elemento ${element}. TODO EN ESPAÑOL. Sé detallado y épico.
Responde SOLO con JSON válido con este esquema exacto, sin texto adicional ni markdown:
{"name":"string","class":"string","element":"string","style":"string","damage":"rango de daño con tipos (ej: 75-110 físico + 35 fuego)","speed":"velocidad de ataque","range":"alcance del arma","special_ability":"habilidad especial única con mecánica completa, condiciones de activación y efectos secundarios (40-60 palabras)","passive":"efecto pasivo detallado con condiciones y números (30-40 palabras)","lore":"historia completa del arma con forjador, batallas y maldiciones (60-80 palabras)","crafting_material":"materiales necesarios para forjarla con detalles únicos (20-30 palabras)","value":number}`;
}

function enemyPrompt(m: EnemyMeta): string {
  const name       = m.name       || "un enemigo temible";
  const genre      = m.genre      || "fantasía";
  const enemyType  = m.enemyType  || "bestia";
  const difficulty = m.difficulty || "medio";
  return `Eres un diseñador de enemigos para videojuegos de rol. Genera un enemigo ${difficulty} de tipo ${enemyType} en género ${genre} llamado "${name}". TODO EN ESPAÑOL. Sé detallado y aterrador.
Responde SOLO con JSON válido con este esquema exacto, sin texto adicional ni markdown:
{"name":"string","type":"string","difficulty":"string","hp":number,"armor":number,"speed":"string","attack_style":"estilo de combate completo con tácticas, patrones de ataque y comportamiento (40-60 palabras)","abilities":["habilidad1 con descripción completa de mecánica y efecto","habilidad2 con descripción completa de mecánica y efecto"],"weakness":"debilidades específicas con explicación de por qué existen (30-40 palabras)","resistance":"resistencias del enemigo con explicación narrativa (20-30 palabras)","drops":"botín completo con probabilidades y objetos únicos (25-35 palabras)","description":"descripción física impactante y personalidad aterradora (60-80 palabras)","lore":"origen, historia y motivaciones del enemigo (50-70 palabras)"}`;
}
