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
 * Perk cadence. A draft stops the world dead, so the menu is the cost and the
 * picks are the pay: the design lever is how few times a run has to stop, not
 * how many perks it hands out. Every-wave drafts made a run a series of menus;
 * every third wave still read as a checkpoint rhythm. Drafts now land after
 * waves 3, 8, 13, ... — a median run stops twice.
 *
 * Waves 1-3 stay menu-free on purpose: the opening is where the freeze mechanic
 * has to be learned, and it teaches better with nothing else on screen.
 */
export const FIRST_DRAFT_WAVE = 3;
export const DRAFT_INTERVAL = 5;

/**
 * Picks granted per draft. Rarer drafts alone flatten the power curve, so a
 * stop has to be worth proportionally more: four picks over five waves is the
 * same perk income as the old two-per-three, delivered in half as many
 * interruptions. Measured on the reference threader, the survival curve holds
 * (median wave 12 -> 13, p10 10 -> 10) while stops per median run drop 4 -> 2.
 *
 * Four is also the ceiling for front-loading: moving the first draft back to
 * wave 2 at this size carries the do-nothing policy to wave 4 and breaks the
 * north-star bound in test/bots/bots.test.ts.
 */
export const PICKS_PER_DRAFT = 4;

/** True if clearing `wave` should offer a draft before the next wave spawns. */
export function offersDraft(wave: number): boolean {
  return wave >= FIRST_DRAFT_WAVE && (wave - FIRST_DRAFT_WAVE) % DRAFT_INTERVAL === 0;
}
