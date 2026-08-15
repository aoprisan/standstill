/** Wave composition. Explicit early waves, formula afterwards. */
export interface WaveDef {
  spawns: { archetype: string; count: number }[];
}

const EXPLICIT: WaveDef[] = [
  { spawns: [{ archetype: "orbiter", count: 2 }] },
  { spawns: [{ archetype: "orbiter", count: 3 }] },
  { spawns: [{ archetype: "orbiter", count: 4 }] },
];

export function waveDef(wave: number): WaveDef {
  const explicit = EXPLICIT[wave - 1];
  if (explicit) return explicit;
  return { spawns: [{ archetype: "orbiter", count: 1 + wave }] };
}

/** Seconds between clearing a wave and the next one spawning. */
export const WAVE_CLEAR_DELAY = 1.0;

/**
 * Perk cadence. A draft stops the world dead, so one after every wave turned a
 * run into a series of menus — the interruption cost more than the choice was
 * worth. Drafts now land after waves 2, 5, 8, ...: late enough that a wave
 * clear reads as a beat rather than a checkpoint, frequent enough that picks
 * still compound before the wave-scaling curve outruns the player.
 */
export const FIRST_DRAFT_WAVE = 2;
export const DRAFT_INTERVAL = 3;

/**
 * Picks granted per draft. Rarer drafts alone flattened the power curve —
 * measured, the reference bot fell from wave 15 to wave 10 — so a stop is worth
 * more than it used to be. Two picks at one stop still interrupts a third as
 * often as one pick after every wave.
 */
export const PICKS_PER_DRAFT = 2;

/** True if clearing `wave` should offer a draft before the next wave spawns. */
export function offersDraft(wave: number): boolean {
  return wave >= FIRST_DRAFT_WAVE && (wave - FIRST_DRAFT_WAVE) % DRAFT_INTERVAL === 0;
}
