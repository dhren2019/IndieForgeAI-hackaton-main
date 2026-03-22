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
  const name  = m.name  || "a random character";
  const genre = m.genre || "fantasy";
  const role  = m.role  || "villager";
  return `Generate a ${genre} NPC named ${name} who is a ${role}.
Respond ONLY with valid JSON matching this exact schema, nothing else:
{"name":"string","role":"string","race":"string","personality":"string (max 15 words)","secret":"string (max 15 words)","dialogue":"string (max 20 words)"}`;
}

function questPrompt(m: QuestMeta): string {
  const title      = m.title      || "an adventure";
  const genre      = m.genre      || "fantasy";
  const difficulty = m.difficulty || "medium";
  return `Generate a ${genre} quest titled "${title}" with ${difficulty} difficulty.
Respond ONLY with valid JSON matching this exact schema, nothing else:
{"title":"string","type":"string","objective":"string (max 20 words)","reward":"string","location":"string","twist":"string (max 15 words)"}`;
}

function itemPrompt(m: ItemMeta): string {
  const name   = m.name   || "a magical object";
  const genre  = m.genre  || "fantasy";
  const rarity = m.rarity || "rare";
  return `Generate a ${rarity} ${genre} item named "${name}".
Respond ONLY with valid JSON matching this exact schema, nothing else:
{"name":"string","type":"string","rarity":"string","description":"string (max 20 words)","effect":"string (max 15 words)","value":number}`;
}

function lorePrompt(m: LoreMeta): string {
  const topic = m.topic || "the world";
  const genre = m.genre || "fantasy";
  const tone  = m.tone  || "epic";
  return `Generate a ${tone} ${genre} lore entry about "${topic}".
Respond ONLY with valid JSON matching this exact schema, nothing else:
{"title":"string","era":"string","summary":"string (max 30 words)","factions":["string","string"],"secret":"string (max 20 words)"}`;
}

function weaponPrompt(m: WeaponMeta): string {
  const name        = m.name        || "a legendary weapon";
  const genre       = m.genre       || "fantasy";
  const weaponClass = m.weaponClass || "sword";
  const element     = m.element     || "none";
  const style       = m.style       || "one-handed";
  return `Generate a ${genre} ${style} ${weaponClass} named "${name}" with ${element} element.
Respond ONLY with valid JSON matching this exact schema, nothing else:
{"name":"string","class":"string","element":"string","style":"string","damage":"string","special_ability":"string (max 15 words)","lore":"string (max 20 words)","value":number}`;
}

function enemyPrompt(m: EnemyMeta): string {
  const name       = m.name       || "a fearsome enemy";
  const genre      = m.genre      || "fantasy";
  const enemyType  = m.enemyType  || "beast";
  const difficulty = m.difficulty || "medium";
  return `Generate a ${difficulty} ${genre} ${enemyType} enemy named "${name}".
Respond ONLY with valid JSON matching this exact schema, nothing else:
{"name":"string","type":"string","difficulty":"string","hp":number,"attack_style":"string (max 15 words)","weakness":"string","drops":"string (max 10 words)","description":"string (max 20 words)"}`;
}
