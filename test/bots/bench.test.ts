/**
 * Survival curve report. Not an assertion — a measurement you read.
 *   just sim-bench
 * Balance content against this table (CLAUDE.md north star), not vibes.
 */
import { describe, it } from "vitest";
import { formatStats, seedSet, survey } from "./harness";
import { ALL_POLICIES, DEFAULT_TUNING, makeThreader } from "./policies";

describe("survival curve", () => {
  it("prints the balance table", () => {
    const seeds = seedSet(60);
    const lines = ALL_POLICIES.map((p) => formatStats(survey(p, seeds)));

    // Risk tolerance sweep: the shape of this column is the design goal.
    // Both ends should be worse than the middle.
    const risks = [0, 0.35, 0.8, 1.5].map((risk) => {
      const st = survey(makeThreader({ ...DEFAULT_TUNING, risk }), seeds);
      return `  risk=${risk.toFixed(2)}  ${formatStats(st)}`;
    });

    console.log(
      `\nsurvival curve over ${seeds.length} seeds\n${lines.join("\n")}\n\n` +
        `threader risk tolerance (0 = never accept danger)\n${risks.join("\n")}\n`,
    );
  });
});
