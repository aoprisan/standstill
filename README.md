# STANDSTILL

*When you move, time freezes. When you stand, bullets fly.*

One-thumb mobile roguelite PWA. Reverse-Superhot: dragging freezes every
projectile on screen; standing still lets time flow and auto-fires at the
nearest enemy. Stillness is the commitment.

## Quick start

    npm install
    just dev        # or: npm run dev
    just test       # headless sim tests (vitest)
    just build      # typecheck + production build

## Install / offline

It's a real PWA: installable from the browser (Android and desktop show an
`ADD TO HOME SCREEN` button on the title screen; on iOS use Share > Add to
Home Screen), fullscreen and portrait-locked, and fully playable with no
network once installed.

A production build emits a service worker that precaches the whole game —
shell, bundle, icons, manifest. Filenames are content-hashed, so the worker
serves cache-first and drops the old cache wholesale when a new build
activates. Updates never interrupt a run: a new build installs in the
background and only takes over before the first run or once the app has been
backgrounded (`src/pwa.ts`). Dev serves no worker at all, and evicts any left
over from a production visit on the same origin.

Icons are generated, not hand-drawn binaries:

    just icons     # or: npm run icons

`scripts/gen-icons.mjs` draws one 32x32 pixel-art scene and scales it to every
size (favicon, apple-touch, 192/512 any + maskable) with a dependency-free PNG
encoder. Edit the scene there and re-run.

## Deploy

Push to `main` — GitHub Actions builds and deploys to Pages
(enable Pages > Source: GitHub Actions in repo settings).
`vite.config.ts` assumes a project site at `/standstill/`; adjust `base`
for a custom domain — manifest scope, service-worker scope and every
precached URL derive from it, so that one knob is the whole story.

## For Claude Code

Read `CLAUDE.md` first. It carries the architecture invariants
(sim purity, determinism, content-as-data) and the roadmap.
