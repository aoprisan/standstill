/**
 * mulberry32 — small, fast, deterministic PRNG.
 * State lives in GameState.rng as a uint32. All sim randomness goes through here.
 */

/** Advance the PRNG: returns a float in [0,1) and the next state. */
export function next(state: number): [number, number] {
  let t = (state + 0x6d2b79f5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return [value, t >>> 0];
}

/** Random float in [a,b). Mutates state via return. */
export function range(state: number, a: number, b: number): [number, number] {
  const [v, s] = next(state);
  return [a + v * (b - a), s];
}
