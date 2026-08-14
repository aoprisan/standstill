import { describe, it, expect } from "vitest";
import { createState, tick } from "../src/sim/tick";

const STILL = { mx: 0, my: 0, moving: false };
const MOVING = { mx: 2, my: 0, moving: true };

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

  it("clearing a wave opens a draft, and the pick starts the next wave", () => {
    const s = createState(42, 400, 800);
    tick(s, STILL); // bootstraps wave 1
    expect(s.wave).toBe(1);
    s.enemies.length = 0; // simulate a clear
    for (let t = 0; t < 90; t++) tick(s, STILL);

    // The world holds still and offers a choice rather than spawning straight on.
    expect(s.phase).toBe("drafting");
    expect(s.draft.length).toBeGreaterThan(0);
    expect(s.wave).toBe(1);

    // No pick, no progress: the draft waits indefinitely.
    for (let t = 0; t < 120; t++) tick(s, STILL);
    expect(s.phase).toBe("drafting");

    tick(s, { ...STILL, select: 0 });
    expect(s.phase).toBe("playing");
    expect(s.taken.length).toBe(1);
    expect(s.wave).toBe(2);
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
