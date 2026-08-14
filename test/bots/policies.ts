/**
 * Bot policies. Pure functions of GameState — no mutation, no randomness.
 *
 * These exist to make the design goal falsifiable (see CLAUDE.md, north star):
 * standing still must be a *decision*, so a policy that never decides should
 * lose, and a policy that threads the freeze should climb.
 */
import type { GameState } from "../../src/sim/types";
import { KEY_SPEED } from "../../src/input/input";
import type { Intent, Policy } from "./harness";

const STILL: Intent = { mx: 0, my: 0 };

/** Never moves. Time always flows, fire is constant — and so is incoming fire. */
export const alwaysStill: Policy = {
  name: "always-still",
  decide: () => STILL,
};

/**
 * Never stops. The world stays frozen, so this policy never fires a shot and
 * can never clear wave 1 — it can only wander into frozen bullets. The control
 * that proves the economy: you cannot win without spending time still.
 */
export const alwaysMoving: Policy = {
  name: "always-moving",
  decide: (_s, t) => {
    const a = t * 0.03;
    return { mx: Math.cos(a) * KEY_SPEED, my: Math.sin(a) * KEY_SPEED };
  },
};

// -- freeze-threading -------------------------------------------------------
// Tuned against the survival curve, not vibes. See test/bots/bench.test.ts.

/** Tunable knobs — swept against the survival curve, see bench.test.ts. */
export interface ThreaderTuning {
  /** Seconds of bullet travel we look ahead when asking "will this hit me?". */
  horizon: number;
  /** Contact radius (player 11 + bullet 5) plus margin for error. */
  hitR: number;
  /** How far a dodge stroke reaches, in ticks of travel. */
  stepTicks: number;
}

/**
 * Swept against the survival curve over 40 seeds (see git history for the
 * grid). This point maximises waves reached *and* time spent still — configs
 * that scored similarly on waves did so by freezing 80% of the time, which is
 * the bot gaming the harness rather than playing the game.
 */
export const DEFAULT_TUNING: ThreaderTuning = { horizon: 1.0, hitR: 32, stepTicks: 28 };

/** Standing inside a frozen bullet's lap is its own hazard — collision is live. */
const TOUCH_R = 26;
/**
 * i-frames after a hit last 1.1s. While they run, incoming fire is free damage
 * *for us* — keep shooting. Stop exploiting shortly before they lapse.
 */
const IFRAME_SAFE = 0.25;
/** Corners are death traps: bullets converge and there is nowhere to step. */
const WALL_R = 70;
const WALL_W = 1.0;
/** Point-blank spreads are unavoidable; keep some air between us and enemies. */
const ENEMY_R = 80;
const ENEMY_W = 0.6;
/** Candidate steps evaluated per tick. */
const DIRS = 16;
/** Close enough to count as arrived at a dodge target. */
const ARRIVE_R = 8;

/**
 * Will anything actually hit a player standing at (x,y)? Solves each bullet's
 * closest approach exactly rather than penalising mere proximity — the
 * difference between a bot that threads and a bot that hides.
 */
function hazard(s: Readonly<GameState>, x: number, y: number, k: ThreaderTuning): number {
  let h = 0;
  for (const b of s.eBullets) {
    const rx = b.x - x;
    const ry = b.y - y;

    // Already on top of us: while frozen we can walk into it, so it counts.
    if (rx * rx + ry * ry < TOUCH_R * TOUCH_R) h += 2;

    const vv = b.vx * b.vx + b.vy * b.vy;
    if (vv === 0) continue;
    const t = -(rx * b.vx + ry * b.vy) / vv;
    if (t <= 0 || t > k.horizon) continue;
    const cx = rx + b.vx * t;
    const cy = ry + b.vy * t;
    // Imminent threats outrank distant ones.
    if (cx * cx + cy * cy < k.hitR * k.hitR) h += 1 - t / k.horizon;
  }
  return h;
}

/**
 * Soft positional preference. Never triggers a dodge on its own — it only
 * breaks ties between escape routes, so the bot flees toward open floor
 * instead of into a corner.
 */
function comfort(s: Readonly<GameState>, x: number, y: number): number {
  let c = 0;
  for (const e of s.enemies) {
    const d = Math.hypot(x - e.x, y - e.y);
    if (d < ENEMY_R) {
      const k = 1 - d / ENEMY_R;
      c += k * k * ENEMY_W;
    }
  }
  const wall = Math.min(x, y, s.arenaW - x, s.arenaH - y);
  if (wall < WALL_R) {
    const k = 1 - wall / WALL_R;
    c += k * k * WALL_W;
  }
  return c;
}

/**
 * Stand and shoot by default; freeze and step aside only when something is
 * genuinely on course to hit, and only when stepping aside actually helps.
 *
 * Two rules keep it honest, and both were forced by measurement:
 *
 * 1. **Commit to the stroke.** Re-deciding every tick on a frozen (therefore
 *    static) hazard field makes the bot flip 180 degrees each tick and vibrate
 *    in place with the world stopped forever. It picks a destination and walks
 *    there — which is what a thumb does anyway.
 * 2. **Never dodge into an equal-or-worse spot.** Without this the bot finds
 *    the coward equilibrium: freeze permanently, take no damage, kill nothing,
 *    and survive to the tick cap at wave 1. If nothing is safer, stand and
 *    shoot — progress only exists in the still state.
 */
export function makeThreader(k: ThreaderTuning = DEFAULT_TUNING): Policy {
  let tx = 0;
  let ty = 0;
  let committed = false;

  return {
    name: "threader",

    reset() {
      committed = false;
    },

    decide(s) {
      const p = s.player;

      // Invulnerable: bullets pass through us. Free damage — do not waste it.
      if (p.iframes > IFRAME_SAFE) {
        committed = false;
        return STILL;
      }

      const here = hazard(s, p.x, p.y, k);

      // Finish the stroke we started, unless the destination went bad.
      if (committed) {
        const dx = tx - p.x;
        const dy = ty - p.y;
        const d = Math.hypot(dx, dy);
        if (d > ARRIVE_R && hazard(s, tx, ty, k) < here) {
          return { mx: (dx / d) * KEY_SPEED, my: (dy / d) * KEY_SPEED };
        }
        committed = false;
      }

      if (here <= 0) return STILL;

      let bestHazard = Infinity;
      let bestScore = Infinity;
      let bcx = p.x;
      let bcy = p.y;
      const reach = KEY_SPEED * k.stepTicks;

      for (let i = 0; i < DIRS; i++) {
        const a = (i / DIRS) * Math.PI * 2;
        // Clamp the candidate into the arena so wall-ward steps are scored
        // where the player would actually end up, not outside the playfield.
        const cx = Math.max(p.r, Math.min(s.arenaW - p.r, p.x + Math.cos(a) * reach));
        const cy = Math.max(p.r, Math.min(s.arenaH - p.r, p.y + Math.sin(a) * reach));
        const h = hazard(s, cx, cy, k);
        const score = h * 10 + comfort(s, cx, cy);
        if (score < bestScore) {
          bestScore = score;
          bestHazard = h;
          bcx = cx;
          bcy = cy;
        }
      }

      // Nowhere better to be: take the hit and keep firing.
      if (bestHazard >= here) return STILL;

      tx = bcx;
      ty = bcy;
      committed = true;
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.hypot(dx, dy) || 1;
      return { mx: (dx / d) * KEY_SPEED, my: (dy / d) * KEY_SPEED };
    },
  };
}

export const threader: Policy = makeThreader();

export const ALL_POLICIES: Policy[] = [alwaysStill, alwaysMoving, threader];
