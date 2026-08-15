# Standstill

One-thumb mobile roguelite PWA. Reverse-Superhot rule:
**dragging (moving) freezes all projectiles; standing still lets time flow and auto-fires.**
Stillness is the commitment.

## Architecture invariants (do not erode these)

1. **Sim purity.** Nothing in `src/sim/` may import from `src/render/` or `src/input/`,
   or use `Date`, `performance`, `Math.random`, `setTimeout`, or any browser API.
   The sim is pure deterministic functions over `GameState`:
   `tick(state, input)` advances exactly one fixed step (`DT = 1/60`).
2. **Determinism is load-bearing.** All randomness flows through the seeded PRNG in
   `GameState.rng` (`src/sim/rng.ts`). Entity iteration order must be stable.
   Same seed + same input script = identical state, always. This enables replays,
   ghosts, daily-seed leaderboards, and (later) lockstep netcode.
3. **Never modify determinism tests to make them pass.** If
   `test/determinism.test.ts` fails, the sim has a purity leak — find it.
   Updating a golden hash is allowed ONLY when a gameplay change is intentional;
   say so explicitly in the commit message.
4. **Content is data.** Enemies, waves, upgrades live in `src/data/` as typed
   declarative objects. Add content by extending data, not by branching in engine code.
5. **Render reads, never writes.** `src/render/` consumes `GameState` + the per-tick
   `events` array (for juice: particles, shake, flash). Visual effects may use real
   time and unseeded randomness — they are outside the deterministic boundary.
6. **Hot path discipline.** No per-tick allocation in the sim once entity pools land.
   Bullets are the hot path; hundreds may be frozen on screen.

## Layout

- `src/sim/` — types, rng, tick (pure)
- `src/render/` — canvas2d renderer, pixel-sprite atlas, seeded terrain, particles
- `src/input/` — pointer/keyboard -> one `InputFrame` per tick
- `src/data/` — enemies, waves, upgrades (declarative)
- `src/main.ts` — fixed-timestep loop wiring the three together
- `src/pwa.ts` — service-worker lifecycle + install prompt (render-side rules apply)
- `src/sw.js` — service worker source; `scripts/pwa-plugin.mjs` injects the
  precache list at build time and emits `dist/sw.js`. Not bundled by vite.
- `scripts/gen-icons.mjs` — draws `public/icons/` from one pixel-art scene
- `test/` — headless sim tests (vitest). The sim runs fine in Node.

An update must never reload a live run: a waiting worker takes over only before
the first run or once the app is backgrounded. Keep that property if you touch
`src/pwa.ts`.

## Feel constants (tuned on device — change deliberately)

- Drag amplification: `1.15`
- Freeze snap: exponential lerp `1 - 0.0001^dt` toward target timescale
- Move-heat release: `7/s` decay (prevents freeze flicker on thumb jitter)
- Player fire cooldown `0.22s`, bullet speed `520`, enemy bullet speed `190`
- Perk cadence: drafts after waves 2, 5, 8, ... (`FIRST_DRAFT_WAVE` /
  `DRAFT_INTERVAL`), `PICKS_PER_DRAFT = 2`. A draft stops the world, so it is
  paced as an interruption, not a reward. Changing either end moves the survival
  curve — re-read `just sim-bench` before and after.

## Design goal as a test (north star)

"Standing still must be a decision." Once bots exist (`test/bots/`):
an always-still policy should die by wave 3; a freeze-threading policy should
reach wave 10+. Balance content against that curve, not vibes.

## Roadmap

1. ~~Scaffold~~ (this)
2. Upgrade draft between waves (`src/data/upgrades.ts` — modifiers, incl. bullet-steal)
3. Fire-pattern DSL + 4 archetypes (orbiter, sniper, spawner, wall-caster)
4. PWA polish: ~~service worker + icons + offline~~; still to do: haptics,
   reduced-motion pass, entity pooling
5. Headless balance bots + survival-curve tuning
6. lockstep integration: replays + daily-seed ghosts
