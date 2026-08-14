/** One fixed simulation step, in seconds. */
export const DT = 1 / 60;

/** Input for exactly one tick. Produced by src/input, consumed by the sim. */
export interface InputFrame {
  /** Movement delta for this tick, in world px (already amplified). */
  mx: number;
  my: number;
  /** True while the player is considered moving (freezes the world). */
  moving: boolean;
}

export interface Player {
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  iframes: number;
  fireCd: number;
  fireCooldown: number;
  bulletSpeed: number;
}

export interface Enemy {
  id: number;
  archetype: string;
  x: number;
  y: number;
  r: number;
  hp: number;
  fireCd: number;
  orbitDir: 1 | -1;
  orbitR: number;
  wob: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

/** Render-only juice signals emitted by a tick. Cleared every tick. */
export type SimEvent =
  | { kind: "playerHit"; x: number; y: number }
  | { kind: "enemyHit"; x: number; y: number }
  | { kind: "enemyDied"; x: number; y: number }
  | { kind: "waveStarted"; wave: number }
  | { kind: "gameOver"; wave: number };

export interface GameState {
  /** PRNG state — the only source of randomness in the sim. */
  rng: number;
  tickCount: number;
  arenaW: number;
  arenaH: number;
  phase: "playing" | "dead";
  wave: number;
  waveClearT: number;
  timeScale: number;
  player: Player;
  enemies: Enemy[];
  eBullets: Bullet[];
  pBullets: Bullet[];
  nextEnemyId: number;
  events: SimEvent[];
}
