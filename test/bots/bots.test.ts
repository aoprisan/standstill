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
import { alwaysMoving, alwaysStill, threader } from "./policies";

const SEEDS = seedSet(40);

describe("north star", () => {
  it("an always-still policy dies by wave 3", () => {
    const st = survey(alwaysStill, SEEDS);
    expect(st.deathRate).toBe(1);
    expect(st.maxWave).toBeLessThanOrEqual(3);
  });

  it("never standing still cannot progress past wave 1 — stillness is the only offence", () => {
    const st = survey(alwaysMoving, SEEDS);
    // The world stays frozen, so no shot is ever fired and no wave is cleared.
    expect(st.maxWave).toBe(1);
    expect(st.stallRate).toBe(1);
  });

  it("threading the freeze clearly beats both — the decision is worth making", () => {
    const still = survey(alwaysStill, SEEDS);
    const thread = survey(threader, SEEDS);
    expect(thread.medianWave).toBeGreaterThan(still.medianWave);
    expect(thread.meanWave).toBeGreaterThan(still.meanWave * 1.5);
  });

  it("the threader still commits to stillness — it plays, it does not hide", () => {
    const st = survey(threader, SEEDS);
    // Freezing forever is survivable but scoreless; a real policy must spend
    // meaningful time in the vulnerable, firing state.
    expect(st.meanStillFraction).toBeGreaterThan(0.3);
    expect(st.stallRate).toBeLessThan(0.5);
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
