/** One fixed simulation step, in seconds. */
export const DT = 1 / 60;

/** Input for exactly one tick. Produced by src/input, consumed by the sim. */
export interface InputFrame {
  /** Movement delta for this tick, in world px (already amplified). */
  mx: number;
  my: number;
  /** True while the player is considered moving (freezes the world). */
  moving: boolean;
  /**
   * Draft pick for this tick: an index into GameState.draft. Omitted or out of
   * range means "no choice yet", which is the normal case on almost every tick.
   */
  select?: number;
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
  /** Extra bullets per shot, fanned around the aim line. */
  spread: number;
  spreadGap: number;
  /** Extra enemies each bullet passes through before dying. */
  pierce: number;
  /** Bullet-steal reach in px. Inert unless stealMax > 0. */
  stealR: number;
  /** Bullets stealable per freeze. Recharges only while time flows. */
  stealMax: number;
  stealCharge: number;
  stealRechargeT: number;
}

export interface Enemy {
  id: number;
  archetype: string;
  x: number;
  y: number;
  /** Steering velocity in px/s, independent of timeScale. Used for intercept aim. */
  vx: number;
  vy: number;
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
  /** Hits remaining after the first. Enemy bullets leave this at 0. */
  pierce: number;
  /** Last enemy id struck, so a piercing bullet can't re-hit the same body. */
  hitId: number;
}

/** Render-only juice signals emitted by a tick. Cleared every tick. */
export type SimEvent =
  | { kind: "playerHit"; x: number; y: number }
  | { kind: "enemyHit"; x: number; y: number }
  | { kind: "enemyDied"; x: number; y: number }
  | { kind: "waveStarted"; wave: number }
  | { kind: "draftOffered"; options: readonly string[] }
  | { kind: "upgradeTaken"; id: string }
  | { kind: "bulletStolen"; x: number; y: number }
  | { kind: "gameOver"; wave: number };

export interface GameState {
  /** PRNG state — the only source of randomness in the sim. */
  rng: number;
  tickCount: number;
  arenaW: number;
  arenaH: number;
  phase: "playing" | "drafting" | "dead";
  wave: number;
  waveClearT: number;
  timeScale: number;
  player: Player;
  enemies: Enemy[];
  eBullets: Bullet[];
  pBullets: Bullet[];
  nextEnemyId: number;
  /** Upgrade ids on offer while phase === "drafting". Empty otherwise. */
  draft: string[];
  /** Upgrade ids taken this run, in order. Repeats mean stacks. */
  taken: string[];
  events: SimEvent[];
}
