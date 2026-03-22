/**
 * Fallback generator — returns a handcrafted valid object
 * when the model fails or produces invalid output.
 * 
 * Each pool has multiple entries so repeated fallbacks look varied.
 */

import type { GenerationType } from "./parser";


export function getFallback(
  type: GenerationType,
  meta: Record<string, unknown>
): Record<string, unknown> {
  const pool = FALLBACKS[type];
  const base = pool[Math.floor(Math.random() * pool.length)];

  // Merge user-supplied name/title if available
  const merged = { ...base };
  if (type === "npc"    && meta.name)  merged.name  = meta.name;
  if (type === "quest"  && meta.title) merged.title = meta.title;
  if (type === "item"   && meta.name)  merged.name  = meta.name;
  if (type === "lore"   && meta.topic) merged.title = meta.topic;
  if (type === "weapon" && meta.name)  merged.name  = meta.name;
  if (type === "enemy"  && meta.name)  merged.name  = meta.name;

  return merged;
}

const FALLBACKS: Record<GenerationType, Record<string, unknown>[]> = {
  npc: [
    {
      name: "Aldric the Wanderer",
      role: "Merchant",
      race: "Human",
      personality: "Jovial but hides a dark past",
      secret: "Sold forbidden relics to the Crimson Guild",
      dialogue: "Ah, a traveler! Everything has a price, friend.",
    },
    {
      name: "Sylla Nightshade",
      role: "Assassin",
      race: "Elf",
      personality: "Cold, calculating, loyal to coin",
      secret: "Spares children on every contract",
      dialogue: "I was never here. Remember that.",
    },
    {
      name: "Torben Ironclad",
      role: "Guard Captain",
      race: "Dwarf",
      personality: "Strict but fair, deep sense of honor",
      secret: "Accepting bribes to fund his sister's medicine",
      dialogue: "State your business or move along.",
    },
  ],

  quest: [
    {
      title: "The Stolen Relic",
      type: "Retrieval",
      objective: "Recover the Sun Amulet stolen from the temple vaults",
      reward: "500 gold + faction reputation",
      location: "Dusthaven Underground",
      twist: "The thief is the priest's own apprentice",
    },
    {
      title: "Silence the Bell Tower",
      type: "Elimination",
      objective: "Destroy the cursed bell before midnight rings doom",
      reward: "Legendary hammer + town gratitude",
      location: "Ironspire Cathedral",
      twist: "The bell is possessed by a trapped innocent soul",
    },
    {
      title: "Caravan to the Ashlands",
      type: "Escort",
      objective: "Protect the merchant caravan through bandit territory",
      reward: "Rare crafting materials + map fragment",
      location: "Ashland Road, Sector 7",
      twist: "One caravan member is the bandit informant",
    },
  ],

  item: [
    {
      name: "Veilbreaker Blade",
      type: "Sword",
      rarity: "Legendary",
      description: "A blade forged from crystallized shadows and moonfire steel",
      effect: "Reveals hidden creatures; +15 damage to undead",
      value: 4500,
    },
    {
      name: "Merchant's Lucky Coin",
      type: "Trinket",
      rarity: "Rare",
      description: "Ancient coin stamped with a smiling god's face",
      effect: "Shop prices reduced by 12%",
      value: 800,
    },
    {
      name: "Stormweave Cloak",
      type: "Armor",
      rarity: "Epic",
      description: "Cloak woven from captured lightning threads",
      effect: "Immune to electricity; dash speed +20%",
      value: 2200,
    },
  ],

  lore: [
    {
      title: "The Sundering War",
      era: "Age of Ashes, Year 412",
      summary:
        "A century-long conflict between the Ember Throne and the Veil Council that shattered the continent into seven fragments",
      factions: ["Ember Throne", "Veil Council"],
      secret:
        "Both sides were manipulated by an ancient entity seeking to break the world seal",
    },
    {
      title: "The Hollow Stars",
      era: "Pre-Collapse Era",
      summary:
        "Ancient astronomers discovered the stars were not light but holes in reality through which something watched",
      factions: ["Order of the Blind Eye", "Star Cartographers Guild"],
      secret: "The holes are breathing — slowly opening wider each century",
    },
    {
      title: "Origin of the Blight Mages",
      era: "Third Dynasty",
      summary:
        "Scholars who sought to reverse death through forbidden entropy magic, corrupting their bodies into living plague vessels",
      factions: ["Blight Conclave", "Purifier Knights"],
      secret:
        "Their founder found the cure but destroyed it to maintain control over his followers",
    },
  ],

  weapon: [
    {
      name: "Ashfang Greatsword",
      class: "Sword",
      element: "Fire",
      style: "Two-handed",
      damage: "85–120 physical + 40 fire",
      special_ability: "Enemies hit are set ablaze for 3 seconds",
      lore: "Forged in a volcano's heart, cursed to hunger for battle eternally",
      value: 3800,
    },
    {
      name: "Frostwhisper Bow",
      class: "Bow",
      element: "Ice",
      style: "Ranged",
      damage: "45–70 physical + 30 frost",
      special_ability: "Critical hits freeze enemies solid for 1.5 seconds",
      lore: "Carved from the bone of the last Winter Drake, never misses its mark",
      value: 2900,
    },
    {
      name: "Voidpulse Staff",
      class: "Staff",
      element: "Dark",
      style: "Magic",
      damage: "60–90 arcane",
      special_ability: "Each cast drains 5 HP from the caster but deals triple damage",
      lore: "A relic of the Void Scholars, humming with suppressed screams",
      value: 5200,
    },
    {
      name: "Thunderclash Axe",
      class: "Axe",
      element: "Lightning",
      style: "One-handed",
      damage: "70–95 physical + 25 lightning",
      special_ability: "Charged attacks send chain lightning to two nearby enemies",
      lore: "A dwarven masterwork said to have been struck by a real storm bolt",
      value: 3100,
    },
  ],

  enemy: [
    {
      name: "Crimson Stalker",
      type: "Beast",
      difficulty: "Medium",
      hp: 320,
      attack_style: "Ambushes from stealth with rapid claw combos",
      weakness: "Fire",
      drops: "Crimson Pelt, Beast Core",
      description: "A six-legged predator with camouflage skin and razor tendons",
    },
    {
      name: "Veilborn Revenant",
      type: "Undead",
      difficulty: "Hard",
      hp: 580,
      attack_style: "Teleports behind target and unleashes soul-drain burst",
      weakness: "Holy",
      drops: "Ecto Shard, Cursed Coin",
      description: "A former general resurrected by forbidden rites, still wearing its shattered armor",
    },
    {
      name: "Ironjaw Construct",
      type: "Mechanical",
      difficulty: "Hard",
      hp: 750,
      attack_style: "Rotating saw charge followed by missile volley",
      weakness: "Lightning",
      drops: "Gear Core, Steel Plate",
      description: "Ancient war machine reactivated by a rogue enchanter, its pilot long since dead",
    },
    {
      name: "Emberlord Moloch",
      type: "Demon",
      difficulty: "Boss",
      hp: 2400,
      attack_style: "Area eruption, lava pillars, enrage below 30% HP",
      weakness: "Ice",
      drops: "Demon Heart, Ember Crown, Rare Rune Fragment",
      description: "Lord of the Ashen Planes, summoned when mortals meddle with the Flame Seal",
    },
  ],
};
