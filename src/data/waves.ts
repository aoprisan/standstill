/** Wave composition and draft cadence. Compositions live per-level in levels.ts. */
import { isLevelEnd, LEVELS, levelWaveDef, TOTAL_WAVES } from "./levels";

export interface WaveDef {
  spawns: { archetype: string; count: number }[];
}

export function waveDef(wave: number): WaveDef {
  return levelWaveDef(wave);
}

/** Seconds between clearing a wave and the next one spawning. */
export const WAVE_CLEAR_DELAY = 1.0;

/**
 * Perk cadence. A draft stops the world dead, so the menu is the cost and the
 * picks are the pay: the design lever is how few times a run has to stop, not
 * how many perks it hands out. In the campaign the drafts ARE the rests
 * between levels — you clear a level, the world holds still, you choose, and
 * you carry every pick into the next terrain. Level lengths (3, 5, 5, 5, 5 —
 * see levels.ts) keep the boundaries on waves 3, 8, 13, 18: the exact cadence
 * the survival curve was tuned around before the campaign existed.
 *
 * Level 1 stays menu-free on purpose: the opening is where the freeze
 * mechanic has to be learned, and it teaches better with nothing else on
 * screen.
 */
export const FIRST_DRAFT_WAVE = LEVELS[0]!.waves.length;

/**
 * Picks granted per draft. Rarer drafts alone flatten the power curve, so a
 * stop has to be worth proportionally more: four picks per level boundary is
 * the same perk income as the old two-per-three, delivered in half as many
 * interruptions. Measured on the reference threader, the survival curve holds
 * (median wave 12 -> 13, p10 10 -> 10) while stops per median run drop 4 -> 2.
 */
export const PICKS_PER_DRAFT = 4;

/**
 * True if clearing `wave` should offer a draft before the next wave spawns:
 * exactly the level boundaries. The final wave of the final level offers no
 * draft — clearing it ends the campaign in victory instead.
 */
export function offersDraft(wave: number): boolean {
  return isLevelEnd(wave) && wave < TOTAL_WAVES;
}
