/**
 * Survival curve report. Not an assertion — a measurement you read.
 *   just sim-bench
 * Balance content against this table (CLAUDE.md north star), not vibes.
 */
import { describe, it } from "vitest";
import { formatStats, seedSet, survey } from "./harness";
import { ALL_POLICIES } from "./policies";

describe("survival curve", () => {
  it("prints the balance table", () => {
    const seeds = seedSet(60);
    const lines = ALL_POLICIES.map((p) => formatStats(survey(p, seeds)));
    console.log(`\nsurvival curve over ${seeds.length} seeds\n${lines.join("\n")}\n`);
  });
});
