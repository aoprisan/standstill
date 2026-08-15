import { describe, it, expect } from "vitest";
import { createState, tick } from "../src/sim/tick";
import { FIRST_DRAFT_WAVE, offersDraft, PICKS_PER_DRAFT } from "../src/data/waves";

const STILL = { mx: 0, my: 0, moving: false };
const MOVING = { mx: 2, my: 0, moving: true };

/** Wipe the field and run past WAVE_CLEAR_DELAY, as if the wave were killed. */
function clearWave(s: ReturnType<typeof createState>): void {
  s.enemies.length = 0;
  for (let t = 0; t < 90; t++) tick(s, STILL);
}

describe("the mechanic", () => {
  it("standing still: time flows and the player auto-fires", () => {
    const s = createState(42, 400, 800);
    for (let t = 0; t < 120; t++) tick(s, STILL);
    expect(s.timeScale).toBe(1);
    expect(s.pBullets.length).toBeGreaterThan(0);
  });

  it("moving: the world freezes — no firing, bullets hold position", () => {
    const s = createState(42, 400, 800);
    // let an enemy shoot first
    for (let t = 0; t < 180; t++) tick(s, STILL);
    // then move until fully frozen
    for (let t = 0; t < 60; t++) tick(s, MOVING);
    expect(s.timeScale).toBe(0);
    const before = s.eBullets.map((b) => [b.x, b.y]);
    const pBefore = s.pBullets.length;
    for (let t = 0; t < 60; t++) tick(s, MOVING);
    const after = s.eBullets.map((b) => [b.x, b.y]);
    expect(after).toEqual(before); // frozen bullets do not travel
    expect(s.pBullets.length).toBe(pBefore); // no new player bullets while moving
  });

  it("player movement itself is never frozen", () => {
    const s = createState(42, 400, 800);
    const x0 = s.player.x;
    for (let t = 0; t < 30; t++) tick(s, MOVING);
    expect(s.player.x).toBeGreaterThan(x0);
  });

  it("a non-draft wave rolls straight into the next one", () => {
    const s = createState(42, 400, 800);
    tick(s, STILL); // bootstraps wave 1
    expect(s.wave).toBe(1);
    expect(offersDraft(1)).toBe(false);
    clearWave(s);

    // No menu, no pause for input: the run keeps going.
    expect(s.phase).toBe("playing");
    expect(s.draft.length).toBe(0);
    expect(s.wave).toBe(2);
    expect(s.enemies.length).toBeGreaterThan(0);
  });

  it("clearing a draft wave opens a draft, and the last pick starts the next wave", () => {
    const s = createState(42, 400, 800);
    tick(s, STILL); // bootstraps wave 1
    // Clear the menu-free opening waves: each rolls straight into the next.
    while (s.wave < FIRST_DRAFT_WAVE) {
      clearWave(s);
      expect(s.phase).toBe("playing");
    }
    expect(offersDraft(s.wave)).toBe(true);
    clearWave(s);

    // The world holds still and offers a choice rather than spawning straight on.
    expect(s.phase).toBe("drafting");
    expect(s.draft.length).toBeGreaterThan(0);
    expect(s.wave).toBe(FIRST_DRAFT_WAVE);

    // No pick, no progress: the draft waits indefinitely.
    for (let t = 0; t < 120; t++) tick(s, STILL);
    expect(s.phase).toBe("drafting");

    // A draft owes PICKS_PER_DRAFT picks: the early ones re-offer, the last one
    // hands the run back.
    for (let pick = PICKS_PER_DRAFT; pick > 1; pick--) {
      tick(s, { ...STILL, select: 0 });
      expect(s.phase).toBe("drafting");
      expect(s.draft.length).toBeGreaterThan(0);
      expect(s.wave).toBe(FIRST_DRAFT_WAVE);
    }

    tick(s, { ...STILL, select: 0 });
    expect(s.phase).toBe("playing");
    expect(s.taken.length).toBe(PICKS_PER_DRAFT);
    expect(s.draft.length).toBe(0);
    expect(s.wave).toBe(FIRST_DRAFT_WAVE + 1);
    expect(s.enemies.length).toBeGreaterThan(0);
  });

  it("player death ends the run", () => {
    const s = createState(42, 400, 800);
    tick(s, STILL);
    s.player.hp = 1;
    s.player.iframes = 0;
    // drop a bullet on the player
    s.eBullets.push({ x: s.player.x, y: s.player.y, vx: 0, vy: 0, r: 5, pierce: 0, hitId: 0 });
    tick(s, STILL);
    expect(s.phase).toBe("dead");
    expect(s.events.some((e) => e.kind === "gameOver")).toBe(true);
  });
});
