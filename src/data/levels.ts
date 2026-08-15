/**
 * The campaign — roadmap step "campaign mode". Still the single mode: there is
 * no mode select, the game *is* this march through five levels.
 *
 * Each level owns a span of the global wave counter and its own enemy roster;
 * the drafts sit exactly on the level boundaries, so a rest between levels is
 * where perks are earned — and since GameState simply persists across the
 * boundary, every perk carries over for the whole campaign. Clearing the last
 * wave of the last level is victory.
 *
 * The wave counter stays GLOBAL (level 2 opens on wave 4, not wave 1). That
 * keeps enemy hp scaling, the survival-curve bench, and "you survived to wave
 * N" comparable with the pre-campaign game.
 *
 * Level lengths are 3, 5, 5, 5, 5 on purpose: boundaries land on waves
 * 3, 8, 13, 18 — the exact draft cadence the perk pacing was tuned around
 * (see waves.ts). Changing a length moves every draft after it.
 */
import type { WaveDef } from "./waves";

export interface LevelDef {
  id: string;
  name: string;
  /** Terrain theme key. Render-only hint — the sim never reads it. */
  theme: string;
  /** Wave compositions, local to this level. Length = waves in the level. */
  waves: WaveDef[];
}

const w = (...spawns: { archetype: string; count: number }[]): WaveDef => ({ spawns });
const s = (archetype: string, count: number) => ({ archetype, count });

export const LEVELS: LevelDef[] = [
  {
    // The tutorial ground, menu-free (see waves.ts): only grunts, so the
    // freeze mechanic is learned with nothing else on screen.
    id: "greenwood",
    name: "The Greenwood",
    theme: "greenwood",
    waves: [
      w(s("orbiter", 2)),
      w(s("orbiter", 3)),
      w(s("orbiter", 4)),
    ],
  },
  {
    // Chargers close to point-blank range: the first enemy that punishes
    // standing wherever you happen to be when time flows.
    id: "ash",
    name: "The Ashen Wastes",
    theme: "ash",
    waves: [
      w(s("orbiter", 4), s("charger", 1)),
      w(s("orbiter", 4), s("charger", 2)),
      w(s("orbiter", 5), s("charger", 2)),
      w(s("orbiter", 5), s("charger", 3)),
      w(s("orbiter", 6), s("charger", 3)),
    ],
  },
  {
    // Snipers hang far out and fire fast bolts: the freeze becomes a reading
    // tool — their shots are only dodgeable if you stop time and look.
    id: "frost",
    name: "The Frozen Marches",
    theme: "frost",
    waves: [
      w(s("orbiter", 5), s("sniper", 2)),
      w(s("orbiter", 5), s("charger", 2), s("sniper", 2)),
      w(s("orbiter", 6), s("charger", 2), s("sniper", 2)),
      w(s("orbiter", 6), s("charger", 2), s("sniper", 3)),
      w(s("orbiter", 7), s("charger", 3), s("sniper", 3)),
    ],
  },
  {
    // Wardens cast slow wide walls of shot; the arena fills with geometry to
    // thread rather than single bullets to sidestep.
    id: "fen",
    name: "The Blighted Fen",
    theme: "fen",
    waves: [
      w(s("orbiter", 5), s("warden", 2), s("charger", 2)),
      w(s("orbiter", 5), s("warden", 2), s("sniper", 2), s("charger", 2)),
      w(s("orbiter", 6), s("warden", 3), s("charger", 2)),
      w(s("orbiter", 6), s("warden", 3), s("sniper", 2), s("charger", 2)),
      w(s("orbiter", 6), s("warden", 3), s("sniper", 3), s("charger", 3)),
    ],
  },
  {
    // Everything at once, capped by brutes ringing the field with shot.
    id: "citadel",
    name: "The Obsidian Citadel",
    theme: "citadel",
    waves: [
      w(s("orbiter", 6), s("warden", 2), s("sniper", 2), s("charger", 3)),
      w(s("orbiter", 6), s("warden", 3), s("sniper", 3), s("charger", 3)),
      w(s("brute", 1), s("orbiter", 6), s("warden", 3), s("sniper", 3)),
      w(s("brute", 1), s("orbiter", 7), s("warden", 3), s("sniper", 3), s("charger", 3)),
      w(s("brute", 2), s("orbiter", 7), s("warden", 4), s("sniper", 4), s("charger", 4)),
    ],
  },
];

/** Waves in the whole campaign. Clearing the last one is victory. */
export const TOTAL_WAVES = LEVELS.reduce((n, l) => n + l.waves.length, 0);

/** 1-based level containing a global wave. Clamps past the end. */
export function levelForWave(wave: number): number {
  let end = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    end += LEVELS[i]!.waves.length;
    if (wave <= end) return i + 1;
  }
  return LEVELS.length;
}

/** Composition for a global wave. */
export function levelWaveDef(wave: number): WaveDef {
  let start = 0;
  for (const l of LEVELS) {
    if (wave <= start + l.waves.length) return l.waves[wave - start - 1]!;
    start += l.waves.length;
  }
  // Past the campaign — unreachable while victory ends the run, but never
  // return undefined from data.
  return LEVELS[LEVELS.length - 1]!.waves.at(-1)!;
}

/** True if `wave` is the last wave of its level. */
export function isLevelEnd(wave: number): boolean {
  let end = 0;
  for (const l of LEVELS) {
    end += l.waves.length;
    if (wave === end) return true;
    if (wave < end) return false;
  }
  return false;
}
