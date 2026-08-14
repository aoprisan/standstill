/**
 * Headless balance harness — roadmap step 5.
 *
 * A Policy sees GameState and commands a direction. The harness — not the
 * policy — converts that intent into an InputFrame, applying the SAME speed
 * cap and move-heat hysteresis as src/input. That is deliberate: a bot that
 * could stop moving instantly, or slide faster than a thumb, would report a
 * survival curve no human could reproduce, and we would balance against a
 * fantasy.
 *
 * Policies must be pure functions of state. They may read GameState; they must
 * never mutate it. Bot runs are therefore as deterministic as the sim itself,
 * which is what makes a survival curve a regression test rather than an anecdote.
 */
import { DT, type GameState, type InputFrame } from "../../src/sim/types";
import { createState, tick } from "../../src/sim/tick";
import { KEY_SPEED, MOVE_HEAT_ACTIVE, stepMoveHeat } from "../../src/input/input";

/** Desired movement for one tick, in world px, before the harness clamps it. */
export interface Intent {
  mx: number;
  my: number;
}

export interface Policy {
  readonly name: string;
  /**
   * Called once before each run. Policies may carry intent between ticks (a
   * real thumb commits to a stroke rather than re-deciding 60 times a second),
   * and resetting here is what keeps a run a pure function of its seed.
   */
  reset?(): void;
  decide(s: Readonly<GameState>, t: number): Intent;
}

export interface RunOptions {
  arenaW?: number;
  arenaH?: number;
  /** Safety cap so a passive policy can't run forever. Default: 10 sim-minutes. */
  maxTicks?: number;
}

export interface RunResult {
  seed: number;
  /** Highest wave reached. This is the score. */
  wave: number;
  ticks: number;
  /** False means the policy hit maxTicks alive — a stall, not a win. */
  died: boolean;
  hpLeft: number;
  /** Fraction of ticks spent not-moving, i.e. actually committed to stillness. */
  stillFraction: number;
}

const DEFAULTS = { arenaW: 400, arenaH: 800, maxTicks: 60 * 60 * 10 };

/** Play one full game with `policy` from `seed`. Deterministic. */
export function runGame(policy: Policy, seed: number, opts: RunOptions = {}): RunResult {
  const { arenaW, arenaH, maxTicks } = { ...DEFAULTS, ...opts };
  const s = createState(seed, arenaW, arenaH);
  policy.reset?.();

  let heat = 0;
  let stillTicks = 0;
  let t = 0;
  let maxWave = 0;

  for (; t < maxTicks && s.phase === "playing"; t++) {
    const intent = policy.decide(s, t);

    // Clamp to thumb speed, then run it through the real move-heat curve.
    let { mx, my } = intent;
    const raw = Math.hypot(mx, my);
    if (raw > KEY_SPEED) {
      mx = (mx / raw) * KEY_SPEED;
      my = (my / raw) * KEY_SPEED;
    }
    heat = stepMoveHeat(heat, Math.min(raw, KEY_SPEED), DT);
    const frame: InputFrame = { mx, my, moving: heat > MOVE_HEAT_ACTIVE };
    if (!frame.moving) stillTicks++;

    tick(s, frame);
    if (s.wave > maxWave) maxWave = s.wave;
  }

  return {
    seed,
    wave: maxWave,
    ticks: t,
    died: s.phase === "dead",
    hpLeft: s.player.hp,
    stillFraction: t > 0 ? stillTicks / t : 0,
  };
}

export interface Stats {
  policy: string;
  runs: number;
  meanWave: number;
  medianWave: number;
  p10Wave: number;
  p90Wave: number;
  minWave: number;
  maxWave: number;
  deathRate: number;
  /**
   * Fraction of runs that hit the tick cap alive. A high stall rate is the
   * tell-tale of the coward equilibrium: freeze forever, kill nothing, never
   * die. Survival without progress is not a score.
   */
  stallRate: number;
  meanStillFraction: number;
}

/** Percentile over a pre-sorted array, nearest-rank. */
function pct(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[i]!;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Run `policy` across many seeds and summarise the survival curve. */
export function survey(policy: Policy, seeds: number[], opts: RunOptions = {}): Stats {
  const results = seeds.map((seed) => runGame(policy, seed, opts));
  const waves = results.map((r) => r.wave).sort((a, b) => a - b);
  return {
    policy: policy.name,
    runs: results.length,
    meanWave: mean(waves),
    medianWave: pct(waves, 0.5),
    p10Wave: pct(waves, 0.1),
    p90Wave: pct(waves, 0.9),
    minWave: waves[0] ?? 0,
    maxWave: waves[waves.length - 1] ?? 0,
    deathRate: results.filter((r) => r.died).length / (results.length || 1),
    stallRate: results.filter((r) => !r.died).length / (results.length || 1),
    meanStillFraction: mean(results.map((r) => r.stillFraction)),
  };
}

/** A fixed seed set, so runs are comparable across commits. */
export function seedSet(n: number, base = 0x5715): number[] {
  return Array.from({ length: n }, (_, i) => (base + i * 0x9e3779b1) >>> 0);
}

export function formatStats(st: Stats): string {
  const f = (n: number) => n.toFixed(2).padStart(6);
  return (
    `${st.policy.padEnd(14)} runs=${String(st.runs).padStart(3)}  ` +
    `median=${f(st.medianWave)}  mean=${f(st.meanWave)}  ` +
    `p10=${f(st.p10Wave)}  p90=${f(st.p90Wave)}  ` +
    `range=[${st.minWave}..${st.maxWave}]  ` +
    `stall=${(st.stallRate * 100).toFixed(0).padStart(3)}%  ` +
    `still=${(st.meanStillFraction * 100).toFixed(0).padStart(3)}%`
  );
}
