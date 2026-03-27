/**
 * WorldMap3D — Professional procedural 3D terrain with Three.js + simplex-noise.
 *
 * Features:
 *  - Domain-warped fBm terrain (8 octaves) + ridged noise for dramatic peaks
 *  - Biome-specific landmarks: volcanoes with craters, lava rivers, temples,
 *    pyramids, ice spikes, crystals, obelisks, altars, giant trees, pillars
 *  - Animated lava (emissive) with glow
 *  - Vertex-colored height zones with biome-aware palettes
 *  - Animated water surface
 *  - Instanced trees (biome-aware)
 *  - Procedural settlements (houses / towers / ruins)
 *  - Biome particles (embers, snow, fireflies, ash, spores, magic)
 *  - First-person POV camera with terrain following + pointer lock
 *  - Orbit camera mode with smooth damping
 *  - Fullscreen toggle + Screenshot download (PNG)
 *  - Atmosphere: directional sun, ambient, hemisphere, exponential fog
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE          from "three";
import { OrbitControls }   from "three/examples/jsm/controls/OrbitControls.js";
import { createNoise2D }   from "simplex-noise";

// ── Public types ──────────────────────────────────────────────────────────────

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
  settlement_style?: string;
  tree_density?:     number;
  landmarks?:        string[];
  terrain_style?:    string;
  has_lava?:         boolean;
  ambient_particles?: string;
  lava_color?:       string;
  accent_color?:     string;
  use_assets?:       boolean;   // use glTF models from public/glTF/ when true
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAP_SIZE        = 300;
const SEGMENTS        = 200;
const MOVE_SPEED      = 0.7;
const PLAYER_HEIGHT   = 3.5;
const SPRINT_MULT     = 2.2;
const MOUSE_SENS      = 0.002;

// ── Seeded RNG ────────────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function hexToRgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  const s = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
}

// ── Placement grid — prevents overlapping objects ─────────────────────────────
// Uses a spatial hash to efficiently track occupied areas.

class PlacementGrid {
  private used = new Set<string>();
  private cs: number;
  constructor(cellSize = 5) { this.cs = cellSize; }

  private cells(x: number, z: number, r: number): string[] {
    const out: string[] = [];
    const n  = Math.ceil(r / this.cs) + 1;
    const bx = Math.round(x / this.cs);
    const bz = Math.round(z / this.cs);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
      if (Math.hypot(i, j) * this.cs <= r + this.cs) out.push(`${bx + i},${bz + j}`);
    }
    return out;
  }

  /** Returns true if space is free and marks it occupied. */
  tryPlace(x: number, z: number, r: number): boolean {
    const cs = this.cells(x, z, r);
    if (cs.some(k => this.used.has(k))) return false;
    cs.forEach(k => this.used.add(k));
    return true;
  }

  /** Mark area as forbidden without checking (terrain features, buildings). */
  forbid(x: number, z: number, r: number): void {
    this.cells(x, z, r).forEach(k => this.used.add(k));
  }
}

// ── GLTF asset configuration per biome ────────────────────────────────────────

const GLTF_TREE_SCALE  = 3.8;
const GLTF_COVER_SCALE = 1.6;
const GLTF_ROCK_SCALE  = 2.2;
const GLTF_FLOWER_SCALE = 1.2;

const BIOME_ASSET_CONFIG: Record<string, { mainTrees: string[]; groundCovers: string[]; rocks: string[]; flowers: string[] }> = {
  forest:    {
    mainTrees:    ["CommonTree_1","CommonTree_2","CommonTree_3","CommonTree_4","CommonTree_5"],
    groundCovers: ["Bush_Common","Fern_1","Mushroom_Common","Clover_1","Clover_2","Plant_1","Grass_Common_Short","Grass_Common_Tall","Grass_Wispy_Short"],
    rocks:        ["Rock_Medium_1","Pebble_Round_1","Pebble_Round_2","Pebble_Round_3","RockPath_Round_Small_1"],
    flowers:      ["Flower_3_Group","Flower_3_Single","Flower_4_Group","Flower_4_Single","Bush_Common_Flowers","Petal_1","Petal_2"],
  },
  tundra:    {
    mainTrees:    ["Pine_1","Pine_2","Pine_3","DeadTree_1","DeadTree_2"],
    groundCovers: ["Grass_Wispy_Short","Grass_Wispy_Tall","Plant_7"],
    rocks:        ["Rock_Medium_1","Rock_Medium_2","Pebble_Square_1","Pebble_Square_2","Pebble_Round_1","RockPath_Square_Small_1"],
    flowers:      [],
  },
  plains:    {
    mainTrees:    ["CommonTree_1","CommonTree_2","CommonTree_3"],
    groundCovers: ["Grass_Common_Short","Grass_Common_Tall","Grass_Wispy_Short","Grass_Wispy_Tall","Bush_Common","Clover_1","Clover_2","Plant_1"],
    rocks:        ["Pebble_Round_1","Pebble_Round_2","Pebble_Square_1","RockPath_Round_Small_1"],
    flowers:      ["Flower_3_Group","Flower_4_Group","Bush_Common_Flowers","Flower_3_Single","Flower_4_Single","Petal_3","Petal_4"],
  },
  swamp:     {
    mainTrees:    ["TwistedTree_1","TwistedTree_2","TwistedTree_3","TwistedTree_4"],
    groundCovers: ["Mushroom_Laetiporus","Mushroom_Common","Plant_1","Plant_1_Big","Plant_7","Plant_7_Big","Grass_Wispy_Tall","Fern_1"],
    rocks:        ["Pebble_Round_3","Pebble_Round_4","RockPath_Round_Thin"],
    flowers:      ["Petal_5"],
  },
  volcanic:  {
    mainTrees:    ["DeadTree_1","DeadTree_2","DeadTree_3","DeadTree_4","DeadTree_5"],
    groundCovers: [],
    rocks:        ["Rock_Medium_1","Rock_Medium_2","Rock_Medium_3","RockPath_Square_Small_1","RockPath_Square_Small_2","Pebble_Square_3","Pebble_Square_4"],
    flowers:      [],
  },
  desert:    {
    mainTrees:    ["DeadTree_4","DeadTree_5","DeadTree_1"],
    groundCovers: ["Plant_7","Grass_Wispy_Short"],
    rocks:        ["Rock_Medium_1","Rock_Medium_2","Rock_Medium_3","Pebble_Square_1","Pebble_Square_2","Pebble_Square_5","RockPath_Square_Wide"],
    flowers:      [],
  },
  mountains: {
    mainTrees:    ["Pine_1","Pine_2","Pine_3","Pine_4","Pine_5"],
    groundCovers: ["Grass_Wispy_Short","Plant_7"],
    rocks:        ["Rock_Medium_1","Rock_Medium_2","Rock_Medium_3","Pebble_Square_1","Pebble_Square_2","RockPath_Square_Thin","RockPath_Round_Wide"],
    flowers:      [],
  },
  mystic:    {
    mainTrees:    ["TwistedTree_1","TwistedTree_2","TwistedTree_4","TwistedTree_5"],
    groundCovers: ["Mushroom_Common","Mushroom_Laetiporus","Plant_1_Big","Plant_7_Big","Fern_1"],
    rocks:        ["Rock_Medium_1","Pebble_Round_5","Pebble_Square_6"],
    flowers:      ["Flower_4_Group","Flower_4_Single","Petal_1","Petal_2","Petal_3"],
  },
  dungeon:   {
    mainTrees:    ["DeadTree_3","DeadTree_4","DeadTree_5"],
    groundCovers: ["Mushroom_Laetiporus","Plant_7"],
    rocks:        ["Rock_Medium_1","Rock_Medium_2","Rock_Medium_3","RockPath_Square_Small_1","RockPath_Square_Small_2","RockPath_Square_Small_3","Pebble_Square_4","Pebble_Square_5"],
    flowers:      [],
  },
  ocean:     {
    mainTrees:    ["CommonTree_1","CommonTree_3","Pine_1","Pine_2"],
    groundCovers: ["Bush_Common_Flowers","Plant_1","Grass_Common_Short","Clover_1"],
    rocks:        ["Pebble_Round_4","Pebble_Round_5","RockPath_Round_Small_2","RockPath_Round_Small_3"],
    flowers:      ["Flower_3_Group","Flower_4_Group","Petal_4","Petal_5"],
  },
  jungle: {
    mainTrees:    ["CommonTree_1","CommonTree_2","CommonTree_3","CommonTree_4","CommonTree_5"],
    groundCovers: ["Fern_1","Plant_1","Plant_1_Big","Grass_Common_Tall","Bush_Common"],
    rocks:        ["Pebble_Round_1","Rock_Medium_1"],
    flowers:      ["Flower_4_Group","Petal_3"],
  },
  savanna: {
    mainTrees:    ["DeadTree_1","DeadTree_2","CommonTree_2"],
    groundCovers: ["Grass_Wispy_Short","Grass_Wispy_Tall"],
    rocks:        ["Rock_Medium_1","Rock_Medium_2","Pebble_Square_1"],
    flowers:      [],
  },
  glacier: {
    mainTrees:    ["Pine_1","Pine_2"],
    groundCovers: [],
    rocks:        ["Rock_Medium_1","Rock_Medium_2","Rock_Medium_3","Pebble_Square_1","Pebble_Square_2","Pebble_Square_3"],
    flowers:      [],
  },
  canyon: {
    mainTrees:    ["DeadTree_1","DeadTree_2"],
    groundCovers: ["Plant_7"],
    rocks:        ["Rock_Medium_1","Rock_Medium_2","Rock_Medium_3","RockPath_Square_Small_1","RockPath_Square_Wide"],
    flowers:      [],
  },
  mushroom: {
    mainTrees:    ["TwistedTree_1","TwistedTree_2"],
    groundCovers: ["Mushroom_Common","Mushroom_Laetiporus","Fern_1"],
    rocks:        ["Pebble_Round_1"],
    flowers:      ["Flower_4_Group","Flower_4_Single","Petal_1","Petal_2","Petal_3","Petal_4","Petal_5"],
  },
  wasteland: {
    mainTrees:    ["DeadTree_3","DeadTree_4","DeadTree_5"],
    groundCovers: [],
    rocks:        ["Rock_Medium_1","Rock_Medium_2","Rock_Medium_3","RockPath_Round_Wide","Pebble_Square_6"],
    flowers:      [],
  },
  sky: {
    mainTrees:    ["CommonTree_1","CommonTree_2","Pine_1"],
    groundCovers: ["Bush_Common_Flowers","Grass_Common_Short","Clover_1"],
    rocks:        ["Pebble_Round_1","Pebble_Round_2"],
    flowers:      ["Flower_3_Group","Flower_4_Group","Petal_1","Petal_5"],
  },
  infernal: {
    mainTrees:    ["DeadTree_1","DeadTree_2","DeadTree_3","DeadTree_4","DeadTree_5"],
    groundCovers: [],
    rocks:        ["Rock_Medium_1","Rock_Medium_2","Rock_Medium_3","RockPath_Square_Small_1","RockPath_Square_Small_2","Pebble_Square_4","Pebble_Square_5"],
    flowers:      [],
  },
  city: {
    mainTrees:    ["CommonTree_1","CommonTree_2","CommonTree_3"],
    groundCovers: ["Grass_Common_Short","Bush_Common","Clover_1"],
    rocks:        ["Rock_Medium_1","Pebble_Round_1","Pebble_Round_2","RockPath_Round_Small_1"],
    flowers:      ["Flower_3_Single","Flower_4_Single","Bush_Common_Flowers"],
  },
  town: {
    mainTrees:    ["CommonTree_1","CommonTree_2","CommonTree_3","Pine_1"],
    groundCovers: ["Grass_Common_Short","Bush_Common","Clover_1","Clover_2"],
    rocks:        ["Pebble_Round_1","Pebble_Round_2","RockPath_Round_Small_1"],
    flowers:      ["Flower_3_Group","Flower_4_Single","Bush_Common_Flowers","Petal_3"],
  },
  village_biome: {
    mainTrees:    ["CommonTree_1","CommonTree_2","CommonTree_3","CommonTree_4"],
    groundCovers: ["Grass_Common_Short","Grass_Common_Tall","Bush_Common","Clover_1","Clover_2","Plant_1"],
    rocks:        ["Pebble_Round_1","Pebble_Round_2","Pebble_Round_3"],
    flowers:      ["Flower_3_Group","Flower_4_Group","Flower_3_Single","Bush_Common_Flowers","Petal_4"],
  },
  farmland: {
    mainTrees:    ["CommonTree_1","CommonTree_2"],
    groundCovers: ["Grass_Common_Short","Grass_Common_Tall","Grass_Wispy_Short","Plant_1"],
    rocks:        ["Pebble_Round_1","Pebble_Square_1"],
    flowers:      ["Flower_3_Group","Flower_4_Group","Bush_Common_Flowers"],
  },
  coast: {
    mainTrees:    ["CommonTree_1","CommonTree_2","CommonTree_3","Pine_1","Pine_2"],
    groundCovers: ["Grass_Common_Short","Bush_Common_Flowers","Plant_1","Clover_1"],
    rocks:        ["Pebble_Round_4","Pebble_Round_5","Rock_Medium_1","RockPath_Round_Small_2"],
    flowers:      ["Flower_3_Group","Flower_4_Group","Petal_4","Petal_5"],
  },
  arctic: {
    mainTrees:    ["Pine_1","Pine_2","DeadTree_1"],
    groundCovers: [],
    rocks:        ["Rock_Medium_1","Rock_Medium_2","Pebble_Square_1","Pebble_Square_2","Pebble_Square_3","RockPath_Square_Small_1"],
    flowers:      [],
  },
  badlands: {
    mainTrees:    ["DeadTree_1","DeadTree_2","DeadTree_3"],
    groundCovers: ["Plant_7","Grass_Wispy_Short"],
    rocks:        ["Rock_Medium_1","Rock_Medium_2","Rock_Medium_3","Pebble_Square_1","Pebble_Square_2","RockPath_Square_Wide","RockPath_Square_Thin"],
    flowers:      [],
  },
  rainforest: {
    mainTrees:    ["CommonTree_1","CommonTree_2","CommonTree_3","CommonTree_4","CommonTree_5"],
    groundCovers: ["Fern_1","Plant_1","Plant_1_Big","Grass_Common_Tall","Bush_Common","Plant_7","Plant_7_Big"],
    rocks:        ["Pebble_Round_1","Pebble_Round_2","Rock_Medium_1"],
    flowers:      ["Flower_4_Group","Petal_2","Petal_3"],
  },
  steppe: {
    mainTrees:    ["CommonTree_2","DeadTree_1","DeadTree_2"],
    groundCovers: ["Grass_Wispy_Short","Grass_Wispy_Tall","Grass_Common_Short"],
    rocks:        ["Rock_Medium_1","Pebble_Round_1","Pebble_Square_1","Pebble_Square_2"],
    flowers:      [],
  },
  underground: {
    mainTrees:    ["DeadTree_3","DeadTree_4","DeadTree_5"],
    groundCovers: ["Mushroom_Laetiporus","Mushroom_Common","Plant_7"],
    rocks:        ["Rock_Medium_1","Rock_Medium_2","Rock_Medium_3","RockPath_Square_Small_1","RockPath_Square_Small_2","RockPath_Square_Small_3","Pebble_Square_5","Pebble_Square_6"],
    flowers:      [],
  },
};

function terrainColor(
  nh: number,
  p: WorldMapParams,
  waterLine: number,
  isLava: boolean,
): [number, number, number] {
  if (isLava && nh < waterLine + 0.02) {
    const lc = hexToRgb01(p.lava_color ?? "ff4500");
    const bright: [number, number, number] = [1.0, 0.6, 0.1];
    const t = Math.sin(nh * 40) * 0.5 + 0.5;
    return lerpRgb(lc, bright, t * 0.4);
  }

  const beachLine = waterLine + 0.055;
  const snowLine  = p.biome === "tundra" ? 0.35 : p.biome === "volcanic" ? 99 : 0.88;

  const deepW  = hexToRgb01("081220");
  const shallW = hexToRgb01(p.water_color);
  const beach  = p.biome === "volcanic" ? hexToRgb01("2a1a0a") : p.biome === "tundra" ? hexToRgb01("b0c4d8") : hexToRgb01("c9a76c");
  const c1     = hexToRgb01(p.terrain_color_1);
  const c2     = hexToRgb01(p.terrain_color_2);
  const c3     = hexToRgb01(p.terrain_color_3);
  const rock   = p.biome === "volcanic" ? hexToRgb01("1a0a0a") : hexToRgb01("6b5d4d");
  const snow   = p.biome === "volcanic" ? hexToRgb01("3a1a0a") : hexToRgb01("dde8f2");

  if (nh < waterLine * 0.45) return deepW;
  if (nh < waterLine)        return lerpRgb(deepW, shallW, (nh - waterLine * 0.45) / (waterLine * 0.55));
  if (nh < beachLine)        return lerpRgb(shallW, beach, (nh - waterLine) / (beachLine - waterLine));
  if (nh < 0.40)             return lerpRgb(beach, c1, (nh - beachLine) / Math.max(0.001, 0.40 - beachLine));
  if (nh < 0.58)             return lerpRgb(c1, c2, (nh - 0.40) / 0.18);
  if (nh < 0.76)             return lerpRgb(c2, c3, (nh - 0.58) / 0.18);
  if (nh < snowLine)         return lerpRgb(c3, rock, (nh - 0.76) / Math.max(0.001, snowLine - 0.76));
  return lerpRgb(rock, snow, Math.min(1, (nh - snowLine) / 0.08));
}

// ── Noise functions ───────────────────────────────────────────────────────────

function fbm(
  x: number, y: number,
  noise: (x: number, y: number) => number,
  octaves = 8, persistence = 0.48, lacunarity = 2.1,
): number {
  let val = 0, amp = 1, freq = 1, maxVal = 0;
  for (let i = 0; i < octaves; i++) {
    val    += amp * noise(x * freq, y * freq);
    maxVal += amp;
    amp    *= persistence;
    freq   *= lacunarity;
  }
  return val / maxVal;
}

function ridgedFbm(
  x: number, y: number,
  noise: (x: number, y: number) => number,
  octaves = 6, persistence = 0.5, lacunarity = 2.0,
): number {
  let val = 0, amp = 1, freq = 1, maxVal = 0;
  for (let i = 0; i < octaves; i++) {
    let n = noise(x * freq, y * freq);
    n = 1.0 - Math.abs(n);
    n = n * n;
    val    += amp * n;
    maxVal += amp;
    amp    *= persistence;
    freq   *= lacunarity;
  }
  return val / maxVal;
}

// ── Terrain features ─────────────────────────────────────────────────────────

interface VolcanoFeature {
  cx: number; cz: number;
  radius: number; height: number;
  craterRadius: number;
}

interface LavaRiverSegment {
  x: number; z: number;
}

interface TerrainFeatures {
  volcanoes:   VolcanoFeature[];
  lavaRivers:  LavaRiverSegment[][];
}

function generateFeatures(p: WorldMapParams, rng: () => number): TerrainFeatures {
  const landmarks = p.landmarks ?? [];
  const features: TerrainFeatures = { volcanoes: [], lavaRivers: [] };

  if (landmarks.includes("volcano") || p.biome === "volcanic") {
    const count = p.biome === "volcanic" ? 2 + Math.floor(rng() * 2) : 1;
    for (let i = 0; i < count; i++) {
      features.volcanoes.push({
        cx: (rng() - 0.5) * MAP_SIZE * 0.55,
        cz: (rng() - 0.5) * MAP_SIZE * 0.55,
        radius: 28 + rng() * 22,
        height: 24 + rng() * 16,
        craterRadius: 6 + rng() * 5,
      });
    }
  }

  if (landmarks.includes("lava_river") || (p.has_lava && p.biome === "volcanic")) {
    const riverCount = 1 + Math.floor(rng() * 2);
    for (let r = 0; r < riverCount; r++) {
      const river: LavaRiverSegment[] = [];
      let sx: number, sz: number;
      if (features.volcanoes.length > 0) {
        const v = features.volcanoes[Math.floor(rng() * features.volcanoes.length)];
        const angle = rng() * Math.PI * 2;
        sx = v.cx + Math.cos(angle) * v.craterRadius * 1.5;
        sz = v.cz + Math.sin(angle) * v.craterRadius * 1.5;
      } else {
        sx = (rng() - 0.5) * MAP_SIZE * 0.3;
        sz = (rng() - 0.5) * MAP_SIZE * 0.3;
      }
      let cx = sx, cz = sz;
      const angle = rng() * Math.PI * 2;
      let dx = Math.cos(angle), dz = Math.sin(angle);
      for (let seg = 0; seg < 40; seg++) {
        river.push({ x: cx, z: cz });
        dx += (rng() - 0.5) * 0.6;
        dz += (rng() - 0.5) * 0.6;
        const len = Math.sqrt(dx * dx + dz * dz);
        dx /= len; dz /= len;
        cx += dx * 4; cz += dz * 4;
        if (Math.abs(cx) > MAP_SIZE * 0.48 || Math.abs(cz) > MAP_SIZE * 0.48) break;
      }
      features.lavaRivers.push(river);
    }
  }

  return features;
}

// ── Height at world-space (x, z) ─────────────────────────────────────────────

function computeH(
  wx: number, wz: number,
  noise2D: (x: number, y: number) => number,
  warpNoise: (x: number, y: number) => number,
  p: WorldMapParams,
  maxH: number,
  waterH: number,
  features: TerrainFeatures,
): number {
  const noiseScale = 0.55 + p.terrain_roughness * 1.5;
  const [s0, s1, s2] = p.seeds;
  // Large offsets so different seeds sample completely different regions of the noise field
  // (s * 0.17 → seeds 1-99999 create offsets 0.17–16999, guaranteed unique terrain every time)
  const baseNx = wx / MAP_SIZE * noiseScale + s0 * 0.17 + s2 * 0.031;
  const baseNz = wz / MAP_SIZE * noiseScale + s1 * 0.13 + s0 * 0.027;

  // Domain warping
  const warpStr = 0.35 + p.terrain_roughness * 0.3;
  const warpX = warpNoise(baseNx * 1.3, baseNz * 1.3) * warpStr;
  const warpZ = warpNoise(baseNx * 1.3 + 50, baseNz * 1.3 + 50) * warpStr;
  const nx = baseNx + warpX;
  const nz = baseNz + warpZ;

  const style = p.terrain_style ?? "rolling";
  let h: number;
  if (style === "jagged" || p.biome === "mountains") {
    h = ridgedFbm(nx, nz, noise2D, 7, 0.5, 2.1) * 0.7 + fbm(nx, nz, noise2D, 6, 0.45, 2.0) * 0.3;
  } else if (style === "canyon") {
    const base = fbm(nx, nz, noise2D, 6, 0.45, 2.0);
    h = Math.abs(base);
  } else if (style === "crater") {
    h = fbm(nx, nz, noise2D, 7, 0.5, 2.0);
    const cNoise = noise2D(nx * 2.5, nz * 2.5);
    if (cNoise > 0.3) h *= 0.6;
  } else {
    h = fbm(nx, nz, noise2D, 8, 0.48, 2.1);
  }

  h = (h + 1) * 0.5;
  const ex = 1.4 - p.mountain_height * 0.5;
  h = Math.pow(h, ex) * maxH;

  if (style === "archipelago") {
    const islandNoise = (noise2D(wx * 0.012, wz * 0.012) + 1) * 0.5;
    if (islandNoise < 0.5) h *= islandNoise * 1.5;
  }

  // Volcano cones
  for (const v of features.volcanoes) {
    const dist = Math.sqrt((wx - v.cx) ** 2 + (wz - v.cz) ** 2);
    if (dist < v.radius) {
      const t = 1 - dist / v.radius;
      let cone = Math.pow(t, 1.3) * v.height;
      if (dist < v.craterRadius) {
        const ct = dist / v.craterRadius;
        cone *= (0.2 + 0.8 * Math.pow(ct, 0.4));
      }
      h += cone;
    }
  }

  // Lava river carving
  for (const river of features.lavaRivers) {
    for (const seg of river) {
      const dist = Math.sqrt((wx - seg.x) ** 2 + (wz - seg.z) ** 2);
      const riverWidth = 3.5;
      if (dist < riverWidth) {
        const t = dist / riverWidth;
        const carve = (1 - t * t) * 3.5;
        h -= carve;
        if (h < waterH * 0.3) h = waterH * 0.3;
      }
    }
  }

  if (h < waterH * 0.35) h = waterH * 0.35 + (h / (waterH * 0.35 + 0.001)) * waterH * 0.15;
  return h;
}

function isInLavaZone(wx: number, wz: number, features: TerrainFeatures, p: WorldMapParams): boolean {
  if (!p.has_lava) return false;
  for (const v of features.volcanoes) {
    const dist = Math.sqrt((wx - v.cx) ** 2 + (wz - v.cz) ** 2);
    if (dist < v.craterRadius * 1.3) return true;
  }
  for (const river of features.lavaRivers) {
    for (const seg of river) {
      const dist = Math.sqrt((wx - seg.x) ** 2 + (wz - seg.z) ** 2);
      if (dist < 3.5) return true;
    }
  }
  return false;
}

// ── Terrain mesh ─────────────────────────────────────────────────────────────

function buildTerrain(
  scene: THREE.Scene,
  p: WorldMapParams,
  noise2D: (x: number, y: number) => number,
  warpNoise: (x: number, y: number) => number,
  features: TerrainFeatures,
): { maxH: number; waterH: number } {
  const maxH   = Math.max(3, p.mountain_height * 42);
  const waterH = p.water_level * maxH * 0.5;

  const geo   = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);

  const pos      = geo.attributes.position as THREE.BufferAttribute;
  const count    = pos.count;
  const colorArr = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const wx = pos.getX(i);
    const wz = pos.getZ(i);
    const h  = computeH(wx, wz, noise2D, warpNoise, p, maxH, waterH, features);
    pos.setY(i, h);

    const nh    = h / (maxH + 40);
    const lava  = isInLavaZone(wx, wz, features, p);
    const col   = terrainColor(nh, p, waterH / (maxH + 40), lava);
    colorArr[i * 3]     = col[0];
    colorArr[i * 3 + 1] = col[1];
    colorArr[i * 3 + 2] = col[2];
  }

  geo.computeVertexNormals();
  geo.setAttribute("color", new THREE.BufferAttribute(colorArr, 3));

  const mat  = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.76, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow    = true;
  scene.add(mesh);

  return { maxH, waterH };
}

// ── Lava mesh (emissive) ─────────────────────────────────────────────────────

function buildLava(
  scene: THREE.Scene,
  p: WorldMapParams,
  features: TerrainFeatures,
  noise2D: (x: number, y: number) => number,
  warpNoise: (x: number, y: number) => number,
  maxH: number,
  waterH: number,
): THREE.Mesh[] {
  if (!p.has_lava) return [];
  const meshes: THREE.Mesh[] = [];
  const lavaMat = new THREE.MeshStandardMaterial({
    color:       new THREE.Color(parseInt(p.lava_color ?? "ff4500", 16)),
    emissive:    new THREE.Color(parseInt(p.lava_color ?? "ff4500", 16)),
    emissiveIntensity: 1.8,
    roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.92,
  });

  for (const v of features.volcanoes) {
    const lavaGeo = new THREE.CircleGeometry(v.craterRadius * 1.1, 24);
    lavaGeo.rotateX(-Math.PI / 2);
    const lavaMesh = new THREE.Mesh(lavaGeo, lavaMat);
    const craterH = computeH(v.cx, v.cz, noise2D, warpNoise, p, maxH, waterH, features);
    lavaMesh.position.set(v.cx, craterH + 0.3, v.cz);
    scene.add(lavaMesh);
    meshes.push(lavaMesh);
  }

  for (const river of features.lavaRivers) {
    if (river.length < 2) continue;
    for (let i = 0; i < river.length - 1; i++) {
      const s = river[i];
      const e = river[i + 1];
      const dx = e.x - s.x, dz = e.z - s.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.1) continue;
      const lavaGeo = new THREE.PlaneGeometry(len + 1.5, 4.0);
      lavaGeo.rotateX(-Math.PI / 2);
      const lavaMesh = new THREE.Mesh(lavaGeo, lavaMat);
      const midX = (s.x + e.x) / 2, midZ = (s.z + e.z) / 2;
      const h = computeH(midX, midZ, noise2D, warpNoise, p, maxH, waterH, features);
      lavaMesh.position.set(midX, h + 0.15, midZ);
      lavaMesh.rotation.y = -Math.atan2(dz, dx);
      scene.add(lavaMesh);
      meshes.push(lavaMesh);
    }
  }

  return meshes;
}

// ── Animated water ────────────────────────────────────────────────────────────

function buildWater(scene: THREE.Scene, p: WorldMapParams, waterH: number): THREE.Mesh | null {
  if (p.water_level < 0.04) return null;

  const geo  = new THREE.PlaneGeometry(MAP_SIZE * 2, MAP_SIZE * 2, 80, 80);
  geo.rotateX(-Math.PI / 2);

  const mat  = new THREE.MeshStandardMaterial({
    color:       new THREE.Color(parseInt(p.water_color, 16)),
    transparent: true,
    opacity:     0.86,
    roughness:   0.0,
    metalness:   0.70,
  });

  const mesh       = new THREE.Mesh(geo, mat);
  mesh.position.y  = waterH;
  scene.add(mesh);
  return mesh;
}

// ── Trees ─────────────────────────────────────────────────────────────────────

const TREE_BIOME_CONFIG: Record<string, { density: number; trunkColor: string; leafColor: string; tallFactor: number }> = {
  forest:    { density: 0.9,  trunkColor: "4a2f0a", leafColor: "1e5e1a", tallFactor: 1.2 },
  plains:    { density: 0.25, trunkColor: "5a3510", leafColor: "3a7d36", tallFactor: 0.9 },
  swamp:     { density: 0.45, trunkColor: "2e2b1a", leafColor: "2d4a1a", tallFactor: 0.7 },
  mystic:    { density: 0.65, trunkColor: "2d1f4a", leafColor: "7c3aed", tallFactor: 1.1 },
  mountains: { density: 0.18, trunkColor: "52340c", leafColor: "2d5022", tallFactor: 0.8 },
};

function buildTrees(
  scene: THREE.Scene,
  p: WorldMapParams,
  noise2D: (x: number, y: number) => number,
  warpNoise: (x: number, y: number) => number,
  maxH: number,
  waterH: number,
  features: TerrainFeatures,
  rng: () => number,
  grid: PlacementGrid,
): void {
  const cfg = TREE_BIOME_CONFIG[p.biome];
  if (!cfg) return;

  const density   = cfg.density * (p.tree_density ?? 0.5);
  const treeCount = Math.floor(density * 500);
  if (treeCount < 1) return;

  const trunkGeo  = new THREE.CylinderGeometry(0.15, 0.28, 2.0 * cfg.tallFactor, 5);
  const canopyGeo = new THREE.ConeGeometry(1.3, 2.8 * cfg.tallFactor, 6);

  const trunkMat  = new THREE.MeshStandardMaterial({ color: parseInt(cfg.trunkColor, 16), roughness: 0.9 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: parseInt(cfg.leafColor,  16), roughness: 0.82 });

  const trunkInst  = new THREE.InstancedMesh(trunkGeo,  trunkMat,  treeCount);
  const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount);
  trunkInst.castShadow  = true;
  canopyInst.castShadow = true;

  const mat4    = new THREE.Matrix4();
  const scatter = createNoise2D();
  let   placed  = 0;
  const half    = MAP_SIZE * 0.47;
  const cols    = Math.ceil(Math.sqrt(treeCount * 1.5));
  const step    = (MAP_SIZE * 0.94) / cols;

  outer:
  for (let row = 0; row < cols; row++) {
    for (let col = 0; col < cols; col++) {
      if (placed >= treeCount) break outer;

      const jx = (rng() - 0.5) * step * 0.9;
      const jz = (rng() - 0.5) * step * 0.9;
      const wx = -half + col * step + jx;
      const wz = -half + row * step + jz;

      const h  = computeH(wx, wz, noise2D, warpNoise, p, maxH, waterH, features);
      const nh = h / maxH;

      if (nh <= (waterH / maxH) + 0.06) continue;
      if (nh > 0.75) continue;

      // Skip volcano zones
      let nearVolcano = false;
      for (const v of features.volcanoes) {
        const dist = Math.sqrt((wx - v.cx) ** 2 + (wz - v.cz) ** 2);
        if (dist < v.radius * 1.3) { nearVolcano = true; break; }
      }
      if (nearVolcano) continue;

      const cn = (scatter(wx * 0.04, wz * 0.04) + 1) * 0.5;
      if (cn < (1 - density) * 0.6) continue;

      // Collision check — skip if another object already occupies this cell
      if (!grid.tryPlace(wx, wz, 2.5)) continue;

      const scale   = 0.7 + rng() * 0.8;
      const trunkH  = h + 1.0 * scale * cfg.tallFactor;
      const canopyH = h + 2.0 * scale * cfg.tallFactor + 1.4 * scale;

      mat4.makeScale(scale, scale, scale);
      mat4.setPosition(wx, trunkH, wz);
      trunkInst.setMatrixAt(placed, mat4);

      mat4.makeScale(scale, scale, scale);
      mat4.setPosition(wx, canopyH, wz);
      canopyInst.setMatrixAt(placed, mat4);

      placed++;
    }
  }

  trunkInst.count  = placed;
  canopyInst.count = placed;
  trunkInst.instanceMatrix.needsUpdate  = true;
  canopyInst.instanceMatrix.needsUpdate = true;

  scene.add(trunkInst);
  scene.add(canopyInst);
}

// ── Buildings ────────────────────────────────────────────────────────────────

type BuildingStyle = "village" | "fortress" | "ruins" | "towers" | "none";

interface BuildingConfig {
  count:      number;
  wallColor:  string;
  roofColor:  string;
  style:      BuildingStyle;
}

const BUILDING_CONFIGS: Partial<Record<string, BuildingConfig>> = {
  village:  { count: 14, wallColor: "c8a878", roofColor: "8b3a3a", style: "village"  },
  fortress: { count: 7,  wallColor: "787878", roofColor: "505050", style: "fortress" },
  ruins:    { count: 10, wallColor: "6b5d4d", roofColor: "4a3d30", style: "ruins"    },
  towers:   { count: 8,  wallColor: "2a2a3a", roofColor: "1a1a28", style: "towers"   },
};

function buildSettlements(
  scene: THREE.Scene,
  p: WorldMapParams,
  noise2D: (x: number, y: number) => number,
  warpNoise: (x: number, y: number) => number,
  maxH: number,
  waterH: number,
  features: TerrainFeatures,
  rng: () => number,
  grid: PlacementGrid,
): void {
  const style  = (p.settlement_style ?? "none") as BuildingStyle;
  const config = BUILDING_CONFIGS[style];
  if (!config || style === "none") return;

  const wallMat = new THREE.MeshStandardMaterial({ color: parseInt(config.wallColor, 16), roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: parseInt(config.roofColor, 16), roughness: 0.8 });

  const anchors: [number, number][] = [];
  const attempts = 100;
  const half     = MAP_SIZE * 0.35;

  for (let i = 0; i < attempts && anchors.length < 2; i++) {
    const ax = (rng() - 0.5) * half * 2;
    const az = (rng() - 0.5) * half * 2;
    const ah = computeH(ax, az, noise2D, warpNoise, p, maxH, waterH, features);
    const nh = ah / maxH;
    if (nh > (waterH / maxH) + 0.08 && nh < 0.60) {
      let skip = false;
      for (const v of features.volcanoes) {
        if (Math.sqrt((ax - v.cx) ** 2 + (az - v.cz) ** 2) < v.radius * 1.2) { skip = true; break; }
      }
      if (!skip) anchors.push([ax, az]);
    }
  }
  if (anchors.length === 0) return;

  const perAnchor = Math.ceil(config.count / anchors.length);

  for (const [ancX, ancZ] of anchors) {
    for (let b = 0; b < perAnchor; b++) {
      const spread = style === "village" ? 24 : style === "towers" ? 45 : 20;
      const bx = ancX + (rng() - 0.5) * spread;
      const bz = ancZ + (rng() - 0.5) * spread;
      const bh = computeH(bx, bz, noise2D, warpNoise, p, maxH, waterH, features);
      const nh = bh / maxH;

      if (nh <= (waterH / maxH) + 0.07 || nh > 0.68) continue;

      let w: number, d: number, h: number;
      if (style === "towers" || style === "fortress") {
        w = 1.5 + rng() * 1.4; d = 1.5 + rng() * 1.4; h = 5 + rng() * 10;
      } else if (style === "ruins") {
        w = 3 + rng() * 4; d = 3 + rng() * 4; h = 1 + rng() * 2.5;
      } else {
        w = 3.5 + rng() * 3; d = 3.5 + rng() * 3; h = 2.5 + rng() * 2;
      }

      // Reserve footprint so trees/landmarks don't overlap with this building
      if (!grid.tryPlace(bx, bz, Math.max(w, d) / 2 + 2.5)) continue;

      const bodyGeo  = new THREE.BoxGeometry(w, h, d);
      const bodyMesh = new THREE.Mesh(bodyGeo, wallMat);
      bodyMesh.position.set(bx, bh + h / 2, bz);
      bodyMesh.rotation.y = rng() * Math.PI * 2;
      bodyMesh.castShadow = true; bodyMesh.receiveShadow = true;
      scene.add(bodyMesh);

      if (style === "village") {
        const roofGeo  = new THREE.ConeGeometry(Math.max(w, d) * 0.72, h * 0.55, 4);
        const roofMesh = new THREE.Mesh(roofGeo, roofMat);
        roofMesh.position.set(bx, bh + h + (h * 0.55) / 2, bz);
        roofMesh.rotation.y = bodyMesh.rotation.y + Math.PI / 4;
        roofMesh.castShadow = true;
        scene.add(roofMesh);
      }

      if ((style === "fortress" || style === "towers") && rng() > 0.35) {
        for (let m = 0; m < 4; m++) {
          const angle  = (m / 4) * Math.PI * 2 + bodyMesh.rotation.y;
          const mr     = Math.max(w, d) * 0.42;
          const mGeo   = new THREE.BoxGeometry(0.5, 1.0, 0.5);
          const mMesh  = new THREE.Mesh(mGeo, wallMat);
          mMesh.position.set(bx + Math.cos(angle) * mr, bh + h + 0.5, bz + Math.sin(angle) * mr);
          mMesh.castShadow = true;
          scene.add(mMesh);
        }
      }
    }
  }
}

// ── Landmark objects ────────────────────────────────────────────────────────

function buildLandmarks(
  scene: THREE.Scene,
  p: WorldMapParams,
  noise2D: (x: number, y: number) => number,
  warpNoise: (x: number, y: number) => number,
  maxH: number,
  waterH: number,
  features: TerrainFeatures,
  rng: () => number,
  grid: PlacementGrid,
): void {
  const landmarks = p.landmarks ?? [];
  const accentColor = parseInt(p.accent_color ?? "ffaa00", 16);
  const lavaColorHex = parseInt(p.lava_color ?? "ff4500", 16);

  // --- Temples ---
  if (landmarks.includes("temple")) {
    const count = 1 + Math.floor(rng() * 2);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9 });
    const glowMat  = new THREE.MeshStandardMaterial({
      color: accentColor, emissive: accentColor, emissiveIntensity: 0.6, roughness: 0.4,
    });
    for (let i = 0; i < count; i++) {
      let tx = 0, tz = 0, th = 0, found = false;
      for (let a = 0; a < 50; a++) {
        tx = (rng() - 0.5) * MAP_SIZE * 0.5;
        tz = (rng() - 0.5) * MAP_SIZE * 0.5;
        th = computeH(tx, tz, noise2D, warpNoise, p, maxH, waterH, features);
        if (th / maxH > (waterH / maxH) + 0.1 && th / maxH < 0.65) { found = true; break; }
      }
      if (!found) continue;
      grid.forbid(tx, tz, 9);  // temple footprint
      for (let tier = 0; tier < 3; tier++) {
        const size = 12 - tier * 3, height = 2.5;
        const tierGeo = new THREE.BoxGeometry(size, height, size);
        const tierMsh = new THREE.Mesh(tierGeo, stoneMat);
        tierMsh.position.set(tx, th + tier * height + height / 2, tz);
        tierMsh.castShadow = true; tierMsh.receiveShadow = true;
        scene.add(tierMsh);
      }
      const topY = th + 3 * 2.5;
      for (let c = 0; c < 8; c++) {
        const angle = (c / 8) * Math.PI * 2;
        const colGeo = new THREE.CylinderGeometry(0.25, 0.3, 4.0, 6);
        const colMsh = new THREE.Mesh(colGeo, stoneMat);
        colMsh.position.set(tx + Math.cos(angle) * 2.5, topY + 2.0, tz + Math.sin(angle) * 2.5);
        colMsh.castShadow = true;
        scene.add(colMsh);
      }
      const orbGeo = new THREE.SphereGeometry(0.6, 12, 12);
      const orbMsh = new THREE.Mesh(orbGeo, glowMat);
      orbMsh.position.set(tx, topY + 5.0, tz);
      scene.add(orbMsh);
      scene.add(new THREE.PointLight(accentColor, 2.0, 30).translateX(tx).translateY(topY + 5.5).translateZ(tz));
    }
  }

  // --- Pyramids ---
  if (landmarks.includes("pyramid")) {
    const count = 1 + Math.floor(rng() * 2);
    const sandStoneMat = new THREE.MeshStandardMaterial({ color: 0xc9a76c, roughness: 0.85 });
    for (let i = 0; i < count; i++) {
      const px = (rng() - 0.5) * MAP_SIZE * 0.5;
      const pz = (rng() - 0.5) * MAP_SIZE * 0.5;
      const ph = computeH(px, pz, noise2D, warpNoise, p, maxH, waterH, features);
      const pyrSize = 14 + rng() * 10, pyrHeight = 12 + rng() * 8;
      grid.forbid(px, pz, pyrSize / 2 + 3);  // pyramid footprint
      const pyrGeo = new THREE.ConeGeometry(pyrSize / 2, pyrHeight, 4);
      const pyrMesh = new THREE.Mesh(pyrGeo, sandStoneMat);
      pyrMesh.position.set(px, ph + pyrHeight / 2, pz);
      pyrMesh.rotation.y = Math.PI / 4;
      pyrMesh.castShadow = true;
      scene.add(pyrMesh);
    }
  }

  // --- Ice spikes ---
  if (landmarks.includes("ice_spikes")) {
    const count = 15 + Math.floor(rng() * 20);
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0xa8d8ea, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.85,
    });
    for (let i = 0; i < count; i++) {
      const sx = (rng() - 0.5) * MAP_SIZE * 0.7;
      const sz = (rng() - 0.5) * MAP_SIZE * 0.7;
      const sh = computeH(sx, sz, noise2D, warpNoise, p, maxH, waterH, features);
      if (sh / maxH < (waterH / maxH) + 0.05) continue;
      const height = 3 + rng() * 10, radius = 0.5 + rng() * 1.5;
      const spikeGeo = new THREE.ConeGeometry(radius, height, 5);
      const spikeMsh = new THREE.Mesh(spikeGeo, iceMat);
      spikeMsh.position.set(sx, sh + height / 2, sz);
      spikeMsh.rotation.z = (rng() - 0.5) * 0.2;
      spikeMsh.rotation.x = (rng() - 0.5) * 0.2;
      spikeMsh.castShadow = true;
      scene.add(spikeMsh);
    }
  }

  // --- Crystals ---
  if (landmarks.includes("crystal")) {
    const count = 10 + Math.floor(rng() * 15);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: accentColor, emissive: accentColor, emissiveIntensity: 0.5,
      roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.8,
    });
    for (let i = 0; i < count; i++) {
      const cx = (rng() - 0.5) * MAP_SIZE * 0.6;
      const cz = (rng() - 0.5) * MAP_SIZE * 0.6;
      const ch = computeH(cx, cz, noise2D, warpNoise, p, maxH, waterH, features);
      if (ch / maxH < (waterH / maxH) + 0.05) continue;
      const height = 2 + rng() * 7, radius = 0.3 + rng() * 0.8;
      const crGeo = new THREE.CylinderGeometry(0.05, radius, height, 6);
      const crMsh = new THREE.Mesh(crGeo, crystalMat);
      crMsh.position.set(cx, ch + height / 2, cz);
      crMsh.rotation.z = (rng() - 0.5) * 0.4;
      crMsh.rotation.x = (rng() - 0.5) * 0.4;
      crMsh.castShadow = true;
      scene.add(crMsh);
      if (rng() > 0.6) {
        const cl = new THREE.PointLight(accentColor, 0.8, 15);
        cl.position.set(cx, ch + height, cz);
        scene.add(cl);
      }
    }
  }

  // --- Floating rocks ---
  if (landmarks.includes("floating_rocks")) {
    const count = 8 + Math.floor(rng() * 12);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b5d4d, roughness: 0.9 });
    for (let i = 0; i < count; i++) {
      const rx = (rng() - 0.5) * MAP_SIZE * 0.6;
      const rz = (rng() - 0.5) * MAP_SIZE * 0.6;
      const baseH = computeH(rx, rz, noise2D, warpNoise, p, maxH, waterH, features);
      const floatH = baseH + 10 + rng() * 25;
      const size = 2 + rng() * 4;
      const rockGeo = new THREE.DodecahedronGeometry(size, 1);
      const rockMsh = new THREE.Mesh(rockGeo, rockMat);
      rockMsh.position.set(rx, floatH, rz);
      rockMsh.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
      rockMsh.castShadow = true;
      scene.add(rockMsh);
    }
  }

  // --- Pillars ---
  if (landmarks.includes("pillars")) {
    const count = 8 + Math.floor(rng() * 10);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x787068, roughness: 0.85 });
    for (let i = 0; i < count; i++) {
      const px = (rng() - 0.5) * MAP_SIZE * 0.5;
      const pz = (rng() - 0.5) * MAP_SIZE * 0.5;
      const ph = computeH(px, pz, noise2D, warpNoise, p, maxH, waterH, features);
      if (ph / maxH < (waterH / maxH) + 0.05) continue;
      const height = 6 + rng() * 12, radius = 0.5 + rng() * 0.5;
      const pilGeo = new THREE.CylinderGeometry(radius * 0.8, radius, height, 8);
      const pilMsh = new THREE.Mesh(pilGeo, pillarMat);
      pilMsh.position.set(px, ph + height / 2, pz);
      if (rng() > 0.6) pilMsh.rotation.z = (rng() - 0.5) * 0.3;
      pilMsh.castShadow = true;
      scene.add(pilMsh);
      const capGeo = new THREE.BoxGeometry(radius * 2.5, 0.5, radius * 2.5);
      const capMsh = new THREE.Mesh(capGeo, pillarMat);
      capMsh.position.set(px, ph + height + 0.25, pz);
      scene.add(capMsh);
    }
  }

  // --- Obelisks ---
  if (landmarks.includes("obelisk")) {
    const count = 2 + Math.floor(rng() * 3);
    const obMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.3, metalness: 0.4 });
    const obGlowMat = new THREE.MeshStandardMaterial({
      color: accentColor, emissive: accentColor, emissiveIntensity: 1.0, roughness: 0.1,
    });
    for (let i = 0; i < count; i++) {
      const ox = (rng() - 0.5) * MAP_SIZE * 0.5;
      const oz = (rng() - 0.5) * MAP_SIZE * 0.5;
      const oh = computeH(ox, oz, noise2D, warpNoise, p, maxH, waterH, features);
      if (oh / maxH < (waterH / maxH) + 0.05) continue;
      const height = 10 + rng() * 8;
      const obGeo = new THREE.BoxGeometry(1.5, height, 1.5);
      const obMsh = new THREE.Mesh(obGeo, obMat);
      obMsh.position.set(ox, oh + height / 2, oz);
      obMsh.castShadow = true;
      scene.add(obMsh);
      const topGeo = new THREE.ConeGeometry(1.2, 3, 4);
      const topMsh = new THREE.Mesh(topGeo, obMat);
      topMsh.position.set(ox, oh + height + 1.5, oz);
      topMsh.rotation.y = Math.PI / 4;
      scene.add(topMsh);
      const runeGeo = new THREE.PlaneGeometry(0.4, height * 0.6);
      const runeMsh = new THREE.Mesh(runeGeo, obGlowMat);
      runeMsh.position.set(ox + 0.76, oh + height * 0.4, oz);
      scene.add(runeMsh);
      const pLight = new THREE.PointLight(accentColor, 1.5, 25);
      pLight.position.set(ox, oh + height + 2, oz);
      scene.add(pLight);
    }
  }

  // --- Altars ---
  if (landmarks.includes("altar")) {
    const count = 1 + Math.floor(rng() * 2);
    const altarMat = new THREE.MeshStandardMaterial({ color: 0x3a3a4a, roughness: 0.7 });
    const altGlowMat = new THREE.MeshStandardMaterial({
      color: accentColor, emissive: accentColor, emissiveIntensity: 1.2, roughness: 0.2,
    });
    for (let i = 0; i < count; i++) {
      const ax = (rng() - 0.5) * MAP_SIZE * 0.4;
      const az = (rng() - 0.5) * MAP_SIZE * 0.4;
      const ah = computeH(ax, az, noise2D, warpNoise, p, maxH, waterH, features);
      if (ah / maxH < (waterH / maxH) + 0.06) continue;
      grid.forbid(ax, az, 7);  // altar footprint
      const baseGeo = new THREE.CylinderGeometry(4, 4.5, 1.5, 8);
      const baseMsh = new THREE.Mesh(baseGeo, altarMat);
      baseMsh.position.set(ax, ah + 0.75, az);
      baseMsh.castShadow = true;
      scene.add(baseMsh);
      const pilGeo = new THREE.CylinderGeometry(0.5, 0.6, 3, 8);
      const pilMsh = new THREE.Mesh(pilGeo, altarMat);
      pilMsh.position.set(ax, ah + 3.0, az);
      scene.add(pilMsh);
      const orbGeo = new THREE.SphereGeometry(0.8, 16, 16);
      const orbMsh = new THREE.Mesh(orbGeo, altGlowMat);
      orbMsh.position.set(ax, ah + 5.5, az);
      scene.add(orbMsh);
      const pLight = new THREE.PointLight(accentColor, 3.0, 40);
      pLight.position.set(ax, ah + 6.0, az);
      scene.add(pLight);
      for (let sp = 0; sp < 6; sp++) {
        const angle = (sp / 6) * Math.PI * 2;
        const spGeo = new THREE.CylinderGeometry(0.2, 0.25, 2.5, 6);
        const spMsh = new THREE.Mesh(spGeo, altarMat);
        spMsh.position.set(ax + Math.cos(angle) * 3.5, ah + 1.25 + 0.75, az + Math.sin(angle) * 3.5);
        spMsh.castShadow = true;
        scene.add(spMsh);
      }
    }
  }

  // --- Ancient ruins ---
  if (landmarks.includes("ancient_ruins")) {
    const count = 15 + Math.floor(rng() * 15);
    const ruinMat = new THREE.MeshStandardMaterial({ color: 0x6b5d4d, roughness: 0.9 });
    const ancX = (rng() - 0.5) * MAP_SIZE * 0.4;
    const ancZ = (rng() - 0.5) * MAP_SIZE * 0.4;
    grid.forbid(ancX, ancZ, 26);  // ruin complex footprint
    for (let i = 0; i < count; i++) {
      const rx = ancX + (rng() - 0.5) * 40;
      const rz = ancZ + (rng() - 0.5) * 40;
      const rh = computeH(rx, rz, noise2D, warpNoise, p, maxH, waterH, features);
      if (rh / maxH < (waterH / maxH) + 0.05) continue;
      if (rng() > 0.5) {
        const w = 3 + rng() * 5, h = 1.5 + rng() * 3, d = 0.6 + rng() * 0.4;
        const wallGeo = new THREE.BoxGeometry(w, h, d);
        const wallMsh = new THREE.Mesh(wallGeo, ruinMat);
        wallMsh.position.set(rx, rh + h / 2, rz);
        wallMsh.rotation.y = rng() * Math.PI;
        wallMsh.castShadow = true;
        scene.add(wallMsh);
      } else {
        const h = 1 + rng() * 4, r = 0.3 + rng() * 0.3;
        const colGeo = new THREE.CylinderGeometry(r * 0.7, r, h, 6);
        const colMsh = new THREE.Mesh(colGeo, ruinMat);
        colMsh.position.set(rx, rh + h / 2, rz);
        colMsh.rotation.z = (rng() - 0.5) * 0.5;
        colMsh.castShadow = true;
        scene.add(colMsh);
      }
    }
  }

  // --- Watchtowers ---
  if (landmarks.includes("watchtower")) {
    const count = 2 + Math.floor(rng() * 3);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.85 });
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xffcc44, emissive: 0xffcc44, emissiveIntensity: 0.8,
    });
    for (let i = 0; i < count; i++) {
      const tx = (rng() - 0.5) * MAP_SIZE * 0.5;
      const tz = (rng() - 0.5) * MAP_SIZE * 0.5;
      const th = computeH(tx, tz, noise2D, warpNoise, p, maxH, waterH, features);
      if (th / maxH < (waterH / maxH) + 0.08) continue;
      grid.forbid(tx, tz, 4);  // watchtower footprint
      const height = 12 + rng() * 8;
      const bodyGeo = new THREE.CylinderGeometry(1.5, 2.0, height, 8);
      const bodyMsh = new THREE.Mesh(bodyGeo, towerMat);
      bodyMsh.position.set(tx, th + height / 2, tz);
      bodyMsh.castShadow = true;
      scene.add(bodyMsh);
      const platGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.8, 8);
      const platMsh = new THREE.Mesh(platGeo, towerMat);
      platMsh.position.set(tx, th + height + 0.4, tz);
      scene.add(platMsh);
      const beaconGeo = new THREE.SphereGeometry(0.5, 8, 8);
      const beaconMsh = new THREE.Mesh(beaconGeo, lightMat);
      beaconMsh.position.set(tx, th + height + 1.5, tz);
      scene.add(beaconMsh);
      const pLight = new THREE.PointLight(0xffcc44, 2.0, 50);
      pLight.position.set(tx, th + height + 2, tz);
      scene.add(pLight);
    }
  }

  // --- Giant trees ---
  if (landmarks.includes("giant_tree")) {
    const count = 1 + Math.floor(rng() * 2);
    const trunkMat  = new THREE.MeshStandardMaterial({ color: 0x3a2510, roughness: 0.9 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x1a5a1a, roughness: 0.85 });
    for (let i = 0; i < count; i++) {
      const gx = (rng() - 0.5) * MAP_SIZE * 0.4;
      const gz = (rng() - 0.5) * MAP_SIZE * 0.4;
      const gh = computeH(gx, gz, noise2D, warpNoise, p, maxH, waterH, features);
      if (gh / maxH < (waterH / maxH) + 0.06) continue;
      grid.forbid(gx, gz, 12);  // giant tree footprint
      const trunkH = 18 + rng() * 12, trunkR = 2 + rng() * 2;
      const tGeo = new THREE.CylinderGeometry(trunkR * 0.6, trunkR, trunkH, 10);
      const tMsh = new THREE.Mesh(tGeo, trunkMat);
      tMsh.position.set(gx, gh + trunkH / 2, gz);
      tMsh.castShadow = true;
      scene.add(tMsh);
      for (let c = 0; c < 5; c++) {
        const cr = 6 + rng() * 4;
        const cx = gx + (rng() - 0.5) * 6;
        const cz = gz + (rng() - 0.5) * 6;
        const cy = gh + trunkH + rng() * 5;
        const cGeo = new THREE.SphereGeometry(cr, 10, 10);
        const cMsh = new THREE.Mesh(cGeo, canopyMat);
        cMsh.position.set(cx, cy, cz);
        cMsh.castShadow = true;
        scene.add(cMsh);
      }
    }
  }

  // --- Volcano details ---
  for (const v of features.volcanoes) {
    const ringGeo = new THREE.TorusGeometry(v.craterRadius * 1.2, 0.8, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x1a0a0a, roughness: 0.95 });
    ringGeo.rotateX(Math.PI / 2);
    const ringMsh = new THREE.Mesh(ringGeo, ringMat);
    const volcH = computeH(v.cx, v.cz, noise2D, warpNoise, p, maxH, waterH, features);
    ringMsh.position.set(v.cx, volcH + 0.5, v.cz);
    scene.add(ringMsh);
    const craterLight = new THREE.PointLight(lavaColorHex, 3.0, 60);
    craterLight.position.set(v.cx, volcH + 2, v.cz);
    scene.add(craterLight);
  }
}

// ── Particles ────────────────────────────────────────────────────────────────

interface ParticleConfig {
  count: number; color: string; size: number; speed: number;
  direction: "up" | "down" | "drift"; maxY: number; minY: number;
}

const PARTICLE_CONFIGS: Record<string, ParticleConfig> = {
  embers:    { count: 600, color: "ff6600", size: 0.4,  speed: 0.06,  direction: "up",    maxY: 60, minY: 2 },
  snow:      { count: 800, color: "e8f0ff", size: 0.35, speed: 0.04,  direction: "down",  maxY: 60, minY: 0 },
  fireflies: { count: 300, color: "ccff44", size: 0.3,  speed: 0.015, direction: "drift", maxY: 25, minY: 3 },
  ash:       { count: 500, color: "888888", size: 0.3,  speed: 0.03,  direction: "down",  maxY: 55, minY: 1 },
  spores:    { count: 400, color: "66cc66", size: 0.35, speed: 0.02,  direction: "up",    maxY: 35, minY: 2 },
  magic:     { count: 700, color: "c084fc", size: 0.45, speed: 0.025, direction: "drift", maxY: 50, minY: 4 },
};

function buildParticles(scene: THREE.Scene, p: WorldMapParams): THREE.Points | null {
  const particleType = p.ambient_particles ?? "none";
  if (particleType === "none" && p.mysticism < 0.22) return null;

  const cfg = PARTICLE_CONFIGS[particleType] ??
    (p.mysticism >= 0.22
      ? { count: Math.floor(p.mysticism * 600), color: p.mysticism > 0.6 ? "c084fc" : "818cf8", size: 0.5, speed: 0.035, direction: "up" as const, maxY: 55, minY: 4 }
      : null);
  if (!cfg) return null;

  const count     = cfg.count;
  const positions = new Float32Array(count * 3);
  const colors    = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * MAP_SIZE;
    positions[i * 3 + 1] = cfg.minY + Math.random() * (cfg.maxY - cfg.minY);
    positions[i * 3 + 2] = (Math.random() - 0.5) * MAP_SIZE;
    const c = hexToRgb01(cfg.color);
    colors[i * 3]     = Math.min(1, c[0] + (Math.random() - 0.5) * 0.15);
    colors[i * 3 + 1] = Math.min(1, c[1] + (Math.random() - 0.5) * 0.15);
    colors[i * 3 + 2] = Math.min(1, c[2] + (Math.random() - 0.5) * 0.15);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color",    new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    vertexColors: true, size: cfg.size, transparent: true, opacity: 0.75, sizeAttenuation: true,
    blending: particleType === "embers" || particleType === "magic" ? THREE.AdditiveBlending : THREE.NormalBlending,
  });

  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  (pts as any).__particleCfg = cfg;
  return pts;
}

// ── Sky dome with gradient ────────────────────────────────────────────────────

function buildSky(scene: THREE.Scene, p: WorldMapParams): void {
  const skyRGB = hexToRgb01(p.sky_color);
  const skyGeo = new THREE.SphereGeometry(550, 32, 20);
  const pos    = skyGeo.attributes.position as THREE.BufferAttribute;
  const cols   = new Float32Array(pos.count * 3);

  // Horizon color: brightened version of sky
  const hR = Math.min(1, skyRGB[0] * 1.55 + 0.07);
  const hG = Math.min(1, skyRGB[1] * 1.35 + 0.05);
  const hB = Math.min(1, skyRGB[2] * 1.20 + 0.05);

  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(-1, Math.min(1, pos.getY(i) / 550)); // -1 bottom → +1 top
    let r, g, b;
    if (t >= 0) {
      // Horizon → zenith
      r = hR + (skyRGB[0] - hR) * t;
      g = hG + (skyRGB[1] - hG) * t;
      b = hB + (skyRGB[2] - hB) * t;
    } else {
      // Below horizon → dark ground color
      const s = 1 + t;
      r = hR * s * 0.35;
      g = hG * s * 0.35;
      b = hB * s * 0.35;
    }
    cols[i * 3]     = Math.max(0, Math.min(1, r));
    cols[i * 3 + 1] = Math.max(0, Math.min(1, g));
    cols[i * 3 + 2] = Math.max(0, Math.min(1, b));
  }

  skyGeo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  const skyMesh = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false,
  }));
  skyMesh.renderOrder = -2;
  scene.add(skyMesh);
}

// ── Stars (shown for dark/mystic/night biomes) ────────────────────────────────

function buildStars(scene: THREE.Scene, p: WorldMapParams): THREE.Points | null {
  const showStars = ["dungeon", "volcanic", "mystic", "tundra"].includes(p.biome)
    || p.danger_level > 0.65 || p.mysticism > 0.55;
  if (!showStars) return null;

  const count = 1400;
  const pos   = new Float32Array(count * 3);
  const cols  = new Float32Array(count * 3);
  const R     = 500;

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(1 - Math.random() * 0.88); // upper sphere
    pos[i * 3]     = R * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = Math.abs(R * Math.cos(phi)) + 15;
    pos[i * 3 + 2] = R * Math.sin(phi) * Math.sin(theta);

    const b    = 0.65 + Math.random() * 0.35;
    const tint = Math.random();
    cols[i * 3]     = b;
    cols[i * 3 + 1] = b * (tint > 0.75 ? 0.90 : 1.0);
    cols[i * 3 + 2] = b * (tint > 0.75 ? 1.0  : tint > 0.35 ? 0.94 : 0.82);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos,  3));
  geo.setAttribute("color",    new THREE.BufferAttribute(cols, 3));

  const stars = new THREE.Points(geo, new THREE.PointsMaterial({
    vertexColors: true, size: 1.4, sizeAttenuation: false,
    transparent: true, opacity: 0.88, fog: false,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  stars.renderOrder = -1;
  scene.add(stars);
  return stars;
}

// ── Celestial body (sun or moon) ──────────────────────────────────────────────

function buildCelestialBody(scene: THREE.Scene, p: WorldMapParams): void {
  const isNight = ["dungeon", "mystic", "volcanic"].includes(p.biome) || p.danger_level > 0.72;
  const dist = 440;
  const elev = (isNight ? 0.62 : 0.52) * Math.PI * 0.5;
  const az   = Math.PI * 0.28;
  const cx   = Math.cos(az) * Math.cos(elev) * dist;
  const cy   = Math.sin(elev) * dist;
  const cz   = Math.sin(az)  * Math.cos(elev) * dist;

  let bodyHex: number, glowHex: number, radius: number;
  if (isNight) {
    bodyHex = p.biome === "mystic" ? 0xd4aaff : 0xd0dcff;
    glowHex = p.biome === "mystic" ? 0x9333ea : 0x7777bb;
    radius  = 7;
  } else {
    bodyHex = p.biome === "desert" ? 0xfffbd8 : p.biome === "tundra" ? 0xddeeff : 0xfffce8;
    glowHex = p.biome === "desert" ? 0xffcc44 : 0xffeeaa;
    radius  = 10;
  }

  const bodyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 16),
    new THREE.MeshBasicMaterial({ color: bodyHex, fog: false }),
  );
  bodyMesh.position.set(cx, cy, cz);
  bodyMesh.renderOrder = -1;
  scene.add(bodyMesh);

  const haloMesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 2.6, 16, 16),
    new THREE.MeshBasicMaterial({
      color: glowHex, transparent: true, opacity: 0.13,
      fog: false, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  haloMesh.position.set(cx, cy, cz);
  haloMesh.renderOrder = -1;
  scene.add(haloMesh);
}

// ── Animated clouds ───────────────────────────────────────────────────────────

function buildClouds(scene: THREE.Scene, p: WorldMapParams, rng: () => number): THREE.Group | null {
  if (p.biome === "dungeon") return null;

  const cloudY = 50 + p.mountain_height * 22;
  const count  = 10 + Math.floor(rng() * 8);

  const cloudMat = new THREE.MeshStandardMaterial({
    color:       p.biome === "volcanic" ? 0x2a1a1a : p.biome === "tundra" ? 0xe8f0ff : 0xf0f0f0,
    transparent: true,
    opacity:     p.biome === "volcanic" ? 0.45 : 0.68,
    roughness:   1.0,
    fog:         false,
    depthWrite:  false,
  });

  const group  = new THREE.Group();
  const puffs  = [7, 5, 6, 4.5, 3.5];

  for (let i = 0; i < count; i++) {
    const cx = (rng() - 0.5) * MAP_SIZE * 1.3;
    const cz = (rng() - 0.5) * MAP_SIZE * 1.3;
    const cy = cloudY + rng() * 20 - 8;
    const sc = 0.9 + rng() * 1.3;

    for (let j = 0; j < puffs.length; j++) {
      const angle  = (j / puffs.length) * Math.PI * 2;
      const spread = puffs[0] * sc * 0.65;
      const ox     = j === 0 ? 0 : Math.cos(angle) * spread;
      const oz     = j === 0 ? 0 : Math.sin(angle) * spread * 0.5;
      const oy     = (rng() - 0.5) * 2 * sc;
      const pMsh   = new THREE.Mesh(new THREE.SphereGeometry(puffs[j] * sc, 7, 6), cloudMat);
      pMsh.position.set(cx + ox, cy + oy, cz + oz);
      group.add(pMsh);
    }
  }

  scene.add(group);
  return group;
}

// ── GLTF vegetation builder ───────────────────────────────────────────────────
// Used when params.use_assets=true. Loads real .gltf tree/rock/cover models
// from public/glTF/ and places them coherently using the PlacementGrid.

function buildGltfVegetation(
  scene: THREE.Scene,
  p: WorldMapParams,
  noise2D: (x: number, y: number) => number,
  warpNoise: (x: number, y: number) => number,
  maxH: number,
  waterH: number,
  features: TerrainFeatures,
  rng: () => number,
  grid: PlacementGrid,
  assetCache: Map<string, THREE.Group>,
): void {
  const cfg = BIOME_ASSET_CONFIG[p.biome];
  if (!cfg) return;

  const waterRatio  = waterH / maxH;
  const half        = MAP_SIZE * 0.47;
  const treeDensity = p.tree_density ?? 0.5;

  const placeModel = (name: string, wx: number, wz: number, scale: number) => {
    const template = assetCache.get(name);
    if (!template) return;
    const clone = template.clone(true);
    const h     = computeH(wx, wz, noise2D, warpNoise, p, maxH, waterH, features);
    clone.position.set(wx, h, wz);
    clone.scale.setScalar(scale);
    clone.rotation.y = rng() * Math.PI * 2;
    clone.traverse(obj => {
      const m = obj as THREE.Mesh;
      m.userData.isGltf = true;
      if ((m as THREE.Mesh).isMesh) { m.castShadow = true; m.receiveShadow = true; }
    });
    scene.add(clone);
  };

  // ── Trees ──────────────────────────────────────────────────────────────────
  const treeNames = cfg.mainTrees.filter(n => assetCache.has(n));
  if (treeNames.length > 0 && treeDensity > 0.01) {
    const treeCount = Math.floor(treeDensity * 460);
    const cols      = Math.ceil(Math.sqrt(treeCount * 1.5));
    const step      = (MAP_SIZE * 0.94) / cols;
    const scatter   = createNoise2D(() => rng());
    let placed = 0;

    outer:
    for (let row = 0; row < cols; row++) {
      for (let col = 0; col < cols; col++) {
        if (placed >= treeCount) break outer;
        const wx = -half + col * step + (rng() - 0.5) * step * 0.9;
        const wz = -half + row * step + (rng() - 0.5) * step * 0.9;
        const h  = computeH(wx, wz, noise2D, warpNoise, p, maxH, waterH, features);
        const nh = h / maxH;
        if (nh <= waterRatio + 0.06 || nh > 0.75) continue;
        let nearVolcano = false;
        for (const v of features.volcanoes) {
          if (Math.sqrt((wx - v.cx) ** 2 + (wz - v.cz) ** 2) < v.radius * 1.3) { nearVolcano = true; break; }
        }
        if (nearVolcano) continue;
        const cn = (scatter(wx * 0.04, wz * 0.04) + 1) * 0.5;
        if (cn < (1 - treeDensity) * 0.5) continue;
        if (!grid.tryPlace(wx, wz, 3.0)) continue;
        const name  = treeNames[Math.floor(rng() * treeNames.length)];
        placeModel(name, wx, wz, GLTF_TREE_SCALE * (0.72 + rng() * 0.58));
        placed++;
      }
    }
  }

  // ── Ground covers (bushes, grass, mushrooms) ───────────────────────────────
  const coverNames = cfg.groundCovers.filter(n => assetCache.has(n));
  if (coverNames.length > 0) {
    const coverCount = Math.floor(treeDensity * 320);
    for (let i = 0; i < coverCount; i++) {
      const wx = (rng() - 0.5) * MAP_SIZE * 0.9;
      const wz = (rng() - 0.5) * MAP_SIZE * 0.9;
      const h  = computeH(wx, wz, noise2D, warpNoise, p, maxH, waterH, features);
      const nh = h / maxH;
      if (nh <= waterRatio + 0.04 || nh > 0.72) continue;
      if (!grid.tryPlace(wx, wz, 1.2)) continue;
      const name = coverNames[Math.floor(rng() * coverNames.length)];
      placeModel(name, wx, wz, GLTF_COVER_SCALE * (0.8 + rng() * 0.5));
    }
  }

  // ── Rocks ─────────────────────────────────────────────────────────────────
  const rockNames = cfg.rocks.filter(n => assetCache.has(n));
  if (rockNames.length > 0) {
    const rockCount = Math.floor(55 + p.terrain_roughness * 90);
    for (let i = 0; i < rockCount; i++) {
      const wx = (rng() - 0.5) * MAP_SIZE * 0.85;
      const wz = (rng() - 0.5) * MAP_SIZE * 0.85;
      const h  = computeH(wx, wz, noise2D, warpNoise, p, maxH, waterH, features);
      if (h / maxH <= waterRatio + 0.03) continue;
      if (!grid.tryPlace(wx, wz, 1.8)) continue;
      const name = rockNames[Math.floor(rng() * rockNames.length)];
      placeModel(name, wx, wz, GLTF_ROCK_SCALE * (0.55 + rng() * 0.9));
    }
  }

  // ── Flowers / decoratives ─────────────────────────────────────────────────
  const flowerNames = (cfg.flowers ?? []).filter(n => assetCache.has(n));
  if (flowerNames.length > 0 && treeDensity > 0.1) {
    const flowerCount = Math.floor(treeDensity * 220);
    for (let i = 0; i < flowerCount; i++) {
      const wx = (rng() - 0.5) * MAP_SIZE * 0.88;
      const wz = (rng() - 0.5) * MAP_SIZE * 0.88;
      const h  = computeH(wx, wz, noise2D, warpNoise, p, maxH, waterH, features);
      const nh = h / maxH;
      if (nh <= waterRatio + 0.035 || nh > 0.68) continue;
      if (!grid.tryPlace(wx, wz, 0.8)) continue;
      const name = flowerNames[Math.floor(rng() * flowerNames.length)];
      placeModel(name, wx, wz, GLTF_FLOWER_SCALE * (0.7 + rng() * 0.6));
    }
  }
}

// ── Label helpers ─────────────────────────────────────────────────────────────

const BIOME_LABELS: Record<string, string> = {
  forest: "Bosque", desert: "Desierto", tundra: "Tundra", swamp: "Pantano",
  volcanic: "Volcánico", ocean: "Océano", plains: "Llanuras",
  mountains: "Montañas", dungeon: "Mazmorra", mystic: "Místico",
  jungle: "Jungla", savanna: "Sabana", glacier: "Glaciar", canyon: "Cañón",
  mushroom: "Bosque de Hongos", wasteland: "Páramo", sky: "Islas del Cielo", infernal: "Infernal",
  city: "Ciudad", town: "Pueblo", village_biome: "Aldea", farmland: "Tierras de Cultivo",
  coast: "Costa", arctic: "Ártico", badlands: "Badlands", rainforest: "Selva Tropical",
  steppe: "Estepa", underground: "Mundo Subterráneo",
};

function dangerLabel(d: number) {
  if (d < 0.25) return "Seguro";
  if (d < 0.55) return "Moderado";
  if (d < 0.80) return "Peligroso";
  return "Letal";
}
function dangerColor(d: number) {
  if (d < 0.25) return "#10b981";
  if (d < 0.55) return "#f59e0b";
  if (d < 0.80) return "#ef4444";
  return "#9f1239";
}

// ── WorldMapPanel ─────────────────────────────────────────────────────────────

interface WorldMapPanelProps {
  params: WorldMapParams;
}

export function WorldMapPanel({ params }: WorldMapPanelProps) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const rendererRef     = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef       = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef     = useRef<OrbitControls | null>(null);
  const explorerRef     = useRef(false);
  const fpvRef          = useRef(false);
  const keysRef         = useRef({ w: false, a: false, s: false, d: false, shift: false });
  const eulerRef        = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const [explorer, setExplorer]     = useState(false);
  const [fpvMode,  setFpvMode]      = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const terrainDataRef = useRef<{
    noise2D: (x: number, y: number) => number;
    warpNoise: (x: number, y: number) => number;
    maxH: number; waterH: number; features: TerrainFeatures;
  } | null>(null);

  const toggleExplorer = useCallback(() => {
    const next = !explorerRef.current;
    explorerRef.current = next;
    fpvRef.current = false;
    setExplorer(next);
    setFpvMode(false);
    if (controlsRef.current) controlsRef.current.enabled = !next;
    if (document.pointerLockElement) document.exitPointerLock();
  }, []);

  const toggleFPV = useCallback(() => {
    const next = !fpvRef.current;
    fpvRef.current = next;
    explorerRef.current = next;
    setFpvMode(next);
    setExplorer(next);
    if (controlsRef.current) controlsRef.current.enabled = !next;
    if (next) {
      containerRef.current?.requestPointerLock();
    } else {
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current?.closest(".wc-map-canvas-wrap") as HTMLElement | null;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  }, []);

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId    = 0;
    let disposed = false;
    // Will be populated inside init(); cleanup() runs them all.
    const onCleanup: Array<() => void> = [];

    async function init() {
      if (!container) return;           // narrow for TypeScript inside async closure
      // ── Optional GLTF asset preload ─────────────────────────────────
      const assetCache = new Map<string, THREE.Group>();
      if (params.use_assets) {
        try {
          const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
          const loader = new GLTFLoader();
          const cfg    = BIOME_ASSET_CONFIG[params.biome] ?? { mainTrees: [], groundCovers: [], rocks: [], flowers: [] };
          const names  = [...new Set([...cfg.mainTrees, ...cfg.groundCovers, ...cfg.rocks, ...cfg.flowers])];
          const results = await Promise.allSettled(
            names.map(n => loader.loadAsync(`/glTF/${n}.gltf`).then(g => [n, g.scene] as const))
          );
          for (const r of results) if (r.status === "fulfilled") assetCache.set(r.value[0], r.value[1]);
        } catch { /* GLTF load failed — fall back to procedural trees */ }
      }
      if (disposed) return;

      // ── Renderer ──────────────────────────────────────────────────────
      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.shadowMap.enabled   = true;
      renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
      renderer.toneMapping         = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.95;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // ── Scene ─────────────────────────────────────────────────────────
      const scene    = new THREE.Scene();
      const skyColor = new THREE.Color(parseInt(params.sky_color, 16));
      scene.background = skyColor;
      scene.fog        = new THREE.FogExp2(skyColor, params.fog_density * 0.014 + 0.002);

      // ── Camera ────────────────────────────────────────────────────────
      const camera = new THREE.PerspectiveCamera(
        62, container.clientWidth / container.clientHeight, 0.2, 1200,
      );
      camera.position.set(0, 55, 110);
      camera.lookAt(0, 8, 0);
      cameraRef.current = camera;

      // ── Controls ──────────────────────────────────────────────────────
      const controls         = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 8, 0);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.maxPolarAngle = Math.PI * 0.48;
      controls.minPolarAngle = 0.05;
      controls.minDistance   = 8;
      controls.maxDistance   = 280;
      controls.update();
      controlsRef.current = controls;

      // ── Lighting ──────────────────────────────────────────────────────
      const ambLum = params.danger_level > 0.7 ? 0.18 : 0.38;
      scene.add(new THREE.AmbientLight(0xffffff, ambLum));

      const sunR = Math.min(1.0, 1.0 + params.danger_level * 0.35);
      const sunG = Math.max(0.35, 0.95 - params.danger_level * 0.45);
      const sunB = Math.max(0.08, 0.85 - params.danger_level * 0.72);
      const sun  = new THREE.DirectionalLight(new THREE.Color(sunR, sunG, sunB), 1.6);
      sun.position.set(90, 130, 70);
      sun.castShadow            = true;
      sun.shadow.mapSize.width  = 4096;
      sun.shadow.mapSize.height = 4096;
      sun.shadow.camera.near    = 1;
      sun.shadow.camera.far     = 700;
      const shadowExtent = 180;
      sun.shadow.camera.left    = -shadowExtent;
      sun.shadow.camera.right   = shadowExtent;
      sun.shadow.camera.top     = shadowExtent;
      sun.shadow.camera.bottom  = -shadowExtent;
      sun.shadow.bias           = -0.0003;
      scene.add(sun);
      scene.add(new THREE.HemisphereLight(skyColor, new THREE.Color(0x1a120a), 0.3));

      if (params.biome === "volcanic" || params.has_lava) {
        scene.add(new THREE.AmbientLight(parseInt(params.lava_color ?? "ff4500", 16), 0.15));
      }

      // ── Terrain ───────────────────────────────────────────────────────
      const rng       = mulberry32(
        ((params.seeds[0] ?? 42) * 73856093) ^
        ((params.seeds[1] ?? 137) * 19349663) ^
        ((params.seeds[2] ?? 555) * 83492791)
      );
      const noise2D   = createNoise2D(() => rng());
      const warpNoise = createNoise2D(() => rng());
      const features  = generateFeatures(params, rng);

      const { maxH, waterH } = buildTerrain(scene, params, noise2D, warpNoise, features);
      const waterMesh        = buildWater(scene, params, waterH);
      const lavaMeshes       = buildLava(scene, params, features, noise2D, warpNoise, maxH, waterH);

      terrainDataRef.current = { noise2D, warpNoise, maxH, waterH, features };

      // ── Collision grid: prevents overlapping objects ───────────────────
      const grid = new PlacementGrid(4);
      // Pre-forbid volcano zones (highest priority exclusion)
      for (const v of features.volcanoes) grid.forbid(v.cx, v.cz, v.radius * 1.5);

      // ── Vegetation + Settlements + Landmarks ───────────────────────────
      // Settlements and landmarks register their footprints first so trees
      // never spawn on top of buildings or special structures.
      buildSettlements(scene, params, noise2D, warpNoise, maxH, waterH, features, rng, grid);
      buildLandmarks(scene, params, noise2D, warpNoise, maxH, waterH, features, rng, grid);

      if (params.use_assets && assetCache.size > 0) {
        buildGltfVegetation(scene, params, noise2D, warpNoise, maxH, waterH, features, rng, grid, assetCache);
      } else {
        buildTrees(scene, params, noise2D, warpNoise, maxH, waterH, features, rng, grid);
      }

      // ── Particles ─────────────────────────────────────────────────────
      const particles = buildParticles(scene, params);

      // ── Sky, stars, celestial body, clouds ────────────────────────────
      buildSky(scene, params);
      buildCelestialBody(scene, params);
      const stars      = buildStars(scene, params);
      const cloudGroup = buildClouds(scene, params, rng);

      // ── Keyboard ──────────────────────────────────────────────────────
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "w" || e.key === "W" || e.key === "ArrowUp")    keysRef.current.w = true;
        if (e.key === "s" || e.key === "S" || e.key === "ArrowDown")  keysRef.current.s = true;
        if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft")  keysRef.current.a = true;
        if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") keysRef.current.d = true;
        if (e.key === "Shift") keysRef.current.shift = true;
      };
      const onKeyUp = (e: KeyboardEvent) => {
        if (e.key === "w" || e.key === "W" || e.key === "ArrowUp")    keysRef.current.w = false;
        if (e.key === "s" || e.key === "S" || e.key === "ArrowDown")  keysRef.current.s = false;
        if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft")  keysRef.current.a = false;
        if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") keysRef.current.d = false;
        if (e.key === "Shift") keysRef.current.shift = false;
      };
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup",   onKeyUp);
      onCleanup.push(() => window.removeEventListener("keydown", onKeyDown));
      onCleanup.push(() => window.removeEventListener("keyup",   onKeyUp));

      // ── Mouse look (FPV) ──────────────────────────────────────────────
      const onMouseMove = (e: MouseEvent) => {
        if (!fpvRef.current || !document.pointerLockElement) return;
        eulerRef.current.y -= e.movementX * MOUSE_SENS;
        eulerRef.current.x -= e.movementY * MOUSE_SENS;
        eulerRef.current.x  = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, eulerRef.current.x));
        camera.quaternion.setFromEuler(eulerRef.current);
      };
      document.addEventListener("mousemove", onMouseMove);
      onCleanup.push(() => document.removeEventListener("mousemove", onMouseMove));

      const onPointerLockChange = () => {
        if (!document.pointerLockElement && fpvRef.current) {
          fpvRef.current = false;
          setFpvMode(false);
          explorerRef.current = false;
          setExplorer(false);
          controls.enabled = true;
        }
      };
      document.addEventListener("pointerlockchange", onPointerLockChange);
      onCleanup.push(() => document.removeEventListener("pointerlockchange", onPointerLockChange));

      // ── Resize ────────────────────────────────────────────────────────
      const onResize = () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
      };
      window.addEventListener("resize", onResize);
      onCleanup.push(() => window.removeEventListener("resize", onResize));

      // ── Animate ───────────────────────────────────────────────────────
      const clock  = new THREE.Clock();
      const fwdDir = new THREE.Vector3();
      const rgtDir = new THREE.Vector3();

      const animate = () => {
        if (disposed) return;
        rafId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        // Movement
        const isWalking = explorerRef.current || fpvRef.current;
        if (isWalking) {
          const speed = MOVE_SPEED * (keysRef.current.shift ? SPRINT_MULT : 1.0);
          camera.getWorldDirection(fwdDir);
          fwdDir.y = 0; fwdDir.normalize();
          rgtDir.crossVectors(fwdDir, camera.up).normalize();

          const move = new THREE.Vector3(0, 0, 0);
          if (keysRef.current.w) move.addScaledVector(fwdDir,  speed);
          if (keysRef.current.s) move.addScaledVector(fwdDir, -speed);
          if (keysRef.current.a) move.addScaledVector(rgtDir, -speed);
          if (keysRef.current.d) move.addScaledVector(rgtDir,  speed);

          camera.position.add(move);

          // FPV: snap to terrain height
          if (fpvRef.current && terrainDataRef.current) {
            const td = terrainDataRef.current;
            const terrH = computeH(
              camera.position.x, camera.position.z,
              td.noise2D, td.warpNoise, params, td.maxH, td.waterH, td.features,
            );
            const targetY = Math.max(terrH, td.waterH) + PLAYER_HEIGHT;
            camera.position.y += (targetY - camera.position.y) * 0.15;
          }

          if (explorerRef.current && !fpvRef.current) {
            controls.target.add(move);
          }
        }

        // Animate water
        if (waterMesh) {
          const wPos = waterMesh.geometry.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < wPos.count; i++) {
            const wx = wPos.getX(i);
            const wz = wPos.getZ(i);
            wPos.setY(i, Math.sin(t * 0.5 + wx * 0.065) * 0.35 + Math.cos(t * 0.35 + wz * 0.055) * 0.25);
          }
          wPos.needsUpdate = true;
        }

        // Animate lava
        for (const lm of lavaMeshes) {
          const mat = lm.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = 1.4 + Math.sin(t * 2.0) * 0.6;
        }

        // Animate particles
        if (particles) {
          const cfg  = (particles as any).__particleCfg as ParticleConfig;
          const pPos = particles.geometry.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < pPos.count; i++) {
            let y = pPos.getY(i), x = pPos.getX(i), z = pPos.getZ(i);
            if (cfg.direction === "up") {
              y += cfg.speed;
              if (y > cfg.maxY) y = cfg.minY;
            } else if (cfg.direction === "down") {
              y -= cfg.speed;
              if (y < cfg.minY) y = cfg.maxY;
              x += Math.sin(t + i) * 0.01;
              z += Math.cos(t * 0.7 + i) * 0.01;
            } else {
              y += Math.sin(t * 0.5 + i * 0.1) * cfg.speed * 0.5;
              x += Math.cos(t * 0.3 + i * 0.05) * cfg.speed;
              z += Math.sin(t * 0.4 + i * 0.07) * cfg.speed;
              if (y > cfg.maxY) y = cfg.minY;
              if (y < cfg.minY) y = cfg.maxY;
            }
            pPos.setX(i, x); pPos.setY(i, y); pPos.setZ(i, z);
          }
          pPos.needsUpdate    = true;
          particles.rotation.y += 0.0002;
        }

        // Drift clouds slowly across the map
        if (cloudGroup) {
          cloudGroup.position.x += 0.014;
          if (cloudGroup.position.x > MAP_SIZE * 0.6) cloudGroup.position.x -= MAP_SIZE * 1.2;
        }

        // Subtle star twinkle
        if (stars) {
          (stars.material as THREE.PointsMaterial).opacity = 0.76 + Math.sin(t * 0.8) * 0.12;
        }

        if (!fpvRef.current) controls.update();
        renderer.render(scene, camera);
      };
      animate();

      // ── Register Three.js cleanup ─────────────────────────────────────
      onCleanup.push(() => {
        if (document.pointerLockElement) document.exitPointerLock();
        controls.dispose();
        renderer.dispose();
        scene.traverse((obj) => {
          const m = obj as THREE.Mesh;
          // Skip GLTF-originated meshes (shared geometry/material refs)
          if (m.userData.isGltf) return;
          if (m.geometry) m.geometry.dispose();
          if (m.material) {
            Array.isArray(m.material)
              ? m.material.forEach((mt) => mt.dispose())
              : m.material.dispose();
          }
        });
        renderer.domElement.remove();
        rendererRef.current = null;
        cameraRef.current   = null;
        controlsRef.current = null;
      });
    }

    init();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      for (const fn of onCleanup) fn();
      // Safety fallback: cleanup renderer if init() didn't fully complete
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.domElement.remove();
        rendererRef.current = null;
      }
      cameraRef.current   = null;
      controlsRef.current = null;
    };
  }, [params]);

  const downloadScreenshot = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const dataUrl = renderer.domElement.toDataURL("image/png");
    const link    = document.createElement("a");
    link.download = `${params.region_name || "world"}-map.png`;
    link.href     = dataUrl;
    link.click();
  }, [params.region_name]);

  const biome   = BIOME_LABELS[params.biome] ?? params.biome;
  const dLabel  = dangerLabel(params.danger_level);
  const dColor  = dangerColor(params.danger_level);
  const mystic  = Math.round(params.mysticism * 100);
  const landmarkList = (params.landmarks ?? []).join(", ");

  return (
    <div className="wc-map-canvas-wrap">
      <div className="wc-map-canvas" ref={containerRef} />

      {/* HUD top-left */}
      <div className="wc-map-hud">
        <div className="wc-map-region">
          <span className="wc-map-region__icon">🗺️</span>
          <span className="wc-map-region__name">{params.region_name}</span>
        </div>
        <div className="wc-map-badges">
          <span className="wc-map-badge wc-map-badge--biome">{biome}</span>
          <span className="wc-map-badge" style={{ color: dColor, borderColor: dColor }}>
            ⚔ {dLabel}
          </span>
          {params.mysticism >= 0.22 && (
            <span className="wc-map-badge wc-map-badge--mystic">✨ {mystic}% místico</span>
          )}
          {params.settlement_style && params.settlement_style !== "none" && (
            <span className="wc-map-badge wc-map-badge--settlement">🏰 {params.settlement_style}</span>
          )}
          {landmarkList && (
            <span className="wc-map-badge wc-map-badge--landmarks" title={landmarkList}>
              🏛️ {(params.landmarks ?? []).length} landmarks
            </span>
          )}
        </div>
      </div>

      {/* Controls bar bottom */}
      <div className="wc-map-controls">
        <button
          className={`wc-map-btn${explorer && !fpvMode ? " wc-map-btn--active" : ""}`}
          onClick={toggleExplorer}
          title={explorer ? "Modo órbita" : "Modo explorar (WASD)"}
        >
          {explorer && !fpvMode ? "🔄 Orbitar" : "🚶 Explorar (WASD)"}
        </button>
        <button
          className={`wc-map-btn${fpvMode ? " wc-map-btn--active" : ""}`}
          onClick={toggleFPV}
          title={fpvMode ? "Salir primera persona" : "Primera persona (POV)"}
        >
          {fpvMode ? "👁️ Salir POV" : "👁️ Primera Persona"}
        </button>
        {(explorer || fpvMode) && (
          <span className="wc-map-wasd-hint">
            W A S D{fpvMode ? " + Ratón · Shift=Sprint" : " · ↑ ↓ ← →"}
          </span>
        )}
        <button
          className="wc-map-btn"
          onClick={downloadScreenshot}
          title="Descargar captura del mapa (PNG)"
        >
          📷 Descargar
        </button>
        <button
          className="wc-map-btn wc-map-btn--right"
          onClick={toggleFullscreen}
          title={fullscreen ? "Salir pantalla completa" : "Pantalla completa"}
        >
          {fullscreen ? "⊡" : "⛶"}
        </button>
      </div>
    </div>
  );
}
