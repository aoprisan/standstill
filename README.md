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

## Deploy

Push to `main` — GitHub Actions builds and deploys to Pages
(enable Pages > Source: GitHub Actions in repo settings).
`vite.config.ts` assumes a project site at `/standstill/`; adjust `base`
for a custom domain.

## For Claude Code

Read `CLAUDE.md` first. It carries the architecture invariants
(sim purity, determinism, content-as-data) and the roadmap.
