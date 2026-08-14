/**
 * INVARIANT TESTS — see CLAUDE.md rule 3.
 * Never modify these to make them pass. A failure means a purity leak.
 */
import { describe, it, expect } from "vitest";
import { createState, tick } from "../src/sim/tick";
import type { InputFrame } from "../src/sim/types";

/** Deterministic scripted input: alternating move/still phases. */
function scriptedInput(t: number): InputFrame {
  const phase = Math.floor(t / 90) % 2; // switch every 1.5s
  if (phase === 0) return { mx: 0, my: 0, moving: false };
  const a = (t % 360) * 0.05;
  return { mx: Math.cos(a) * 3, my: Math.sin(a) * 3, moving: true };
}

function run(seed: number, ticks: number) {
  const s = createState(seed, 400, 800);
  for (let t = 0; t < ticks; t++) tick(s, scriptedInput(t));
  return s;
}

describe("determinism", () => {
  it("same seed + same inputs => identical final state", () => {
    const a = run(0xdeadbeef, 3600);
    const b = run(0xdeadbeef, 3600);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("different seeds diverge", () => {
    const a = run(1, 1200);
    const b = run(2, 1200);
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });
});
