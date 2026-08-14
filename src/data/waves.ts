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
