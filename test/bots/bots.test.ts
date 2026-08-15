/**
 * THE DESIGN GOAL AS A TEST — see CLAUDE.md north star.
 *
 * "Standing still must be a decision." These assertions are what make that
 * claim falsifiable: if a policy that never decides can go as far as one that
 * threads the freeze, the mechanic is decoration and the game is broken.
 *
 * Bounds are deliberately loose. They exist to catch a collapsed design, not
 * to pin exact numbers — read bench.test.ts for the actual curve.
 */
import { describe, expect, it } from "vitest";
import { runGame, seedSet, survey } from "./harness";
import { alwaysMoving, alwaysStill, threader, makeThreader, DEFAULT_TUNING } from "./policies";
import { offersDraft, PICKS_PER_DRAFT } from "../../src/data/waves";

const SEEDS = seedSet(40);

describe("north star", () => {
  it("an always-still policy dies by wave 3", () => {
    const st = survey(alwaysStill, SEEDS);
    expect(st.deathRate).toBe(1);
    // Asserted on the typical run, not the luckiest seed: a favourable spawn
    // plus the wave-2 draft occasionally carries it one wave further, and
    // pinning the maximum would make this fail on noise rather than on design.
    expect(st.medianWave).toBeLessThanOrEqual(3);
    expect(st.p90Wave).toBeLessThanOrEqual(3);
  });

  it("never standing still cannot progress past wave 1 — stillness is the only offence", () => {
    const st = survey(alwaysMoving, SEEDS);
    // The world stays frozen, so no shot is ever fired and no wave is cleared.
    expect(st.maxWave).toBe(1);
    expect(st.stallRate).toBe(1);
  });

  it("a freeze-threading policy reaches wave 10+", () => {
    const st = survey(threader, SEEDS);
    expect(st.medianWave).toBeGreaterThanOrEqual(10);
    expect(st.medianWave).toBeGreaterThan(survey(alwaysStill, SEEDS).medianWave);
  });

  it("the threader plays rather than hides — it commits to stillness and its runs end", () => {
    const st = survey(threader, SEEDS);
    // Freezing forever is survivable but scoreless. A policy that games the
    // harness shows up here as a low still-fraction and runs that never finish.
    expect(st.meanStillFraction).toBeGreaterThan(0.4);
    expect(st.stallRate).toBeLessThan(0.2);
  });

  /**
   * The sharpest form of the goal. Stillness is only a *decision* if both
   * answers can be wrong: a policy that never accepts danger stalls out of
   * firing time, and one that ignores danger is shot to pieces. The balanced
   * policy must beat both, or the mechanic carries no tension.
   */
  it("both cowardice and recklessness lose to judgement", () => {
    const coward = makeThreader({ ...DEFAULT_TUNING, risk: 0 });
    const reckless = makeThreader({ ...DEFAULT_TUNING, risk: 1.5 });

    const balanced = survey(threader, SEEDS);
    const c = survey(coward, SEEDS);
    const r = survey(reckless, SEEDS);

    expect(balanced.meanWave).toBeGreaterThan(c.meanWave);
    expect(balanced.meanWave).toBeGreaterThan(r.meanWave * 1.5);
    // The coward buys its survival by refusing to fire.
    expect(c.meanStillFraction).toBeLessThan(balanced.meanStillFraction);
  });
});

describe("the draft", () => {
  it("every run drafts, and picks accumulate as stacks", () => {
    const r = runGame(threader, SEEDS[0]!);
    expect(r.taken.length).toBeGreaterThan(0);
    // Not one per cleared wave: PICKS_PER_DRAFT picks per cleared *draft* wave.
    const drafts = Array.from({ length: r.wave - 1 }, (_, i) => i + 1).filter(offersDraft).length;
    expect(r.taken.length).toBe(drafts * PICKS_PER_DRAFT);
  });

  it("no upgrade is offered beyond its stack limit", async () => {
    const { UPGRADE_BY_ID } = await import("../../src/data/upgrades");
    for (const seed of seedSet(10)) {
      const counts = new Map<string, number>();
      for (const id of runGame(threader, seed).taken) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      for (const [id, n] of counts) {
        expect(n).toBeLessThanOrEqual(UPGRADE_BY_ID[id]!.maxStacks);
      }
    }
  });
});

describe("bot runs are deterministic", () => {
  it("same policy + same seed => identical outcome", () => {
    for (const seed of seedSet(5)) {
      const a = runGame(threader, seed);
      const b = runGame(threader, seed);
      expect(a).toEqual(b);
    }
  });
});
