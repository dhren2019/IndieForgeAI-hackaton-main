export type GenerationType = "npc" | "quest" | "item" | "lore" | "weapon" | "enemy";
export type GenerationSource = "model" | "fallback";

export interface Generation {
  id: number;
  session_id: string;
  type: GenerationType;
  prompt_meta: Record<string, string>;
  result: Record<string, unknown>;
  raw_output: string | null;
  source: GenerationSource;
  created_at: string;
}

export interface NPCMeta {
  name?: string;
  genre?: string;
  role?: string;
  userPrompt?: string;
}

export interface QuestMeta {
  title?: string;
  genre?: string;
  difficulty?: string;
  userPrompt?: string;
}

export interface ItemMeta {
  name?: string;
  genre?: string;
  rarity?: string;
  userPrompt?: string;
}

export interface LoreMeta {
  topic?: string;
  genre?: string;
  tone?: string;
  userPrompt?: string;
}

export interface WeaponMeta {
  name?: string;
  genre?: string;
  weaponClass?: string;
  element?: string;
  style?: string;
  userPrompt?: string;
}

export interface EnemyMeta {
  name?: string;
  genre?: string;
  enemyType?: string;
  difficulty?: string;
  userPrompt?: string;
}

export type PromptMeta = NPCMeta | QuestMeta | ItemMeta | LoreMeta | WeaponMeta | EnemyMeta;
