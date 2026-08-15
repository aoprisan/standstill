# Standstill — one-thumb reverse-Superhot roguelite

dev:
    npm run dev

test:
    npm run test

build:
    npm run build

# Redraw the PWA icons from scripts/gen-icons.mjs into public/icons/
icons:
    npm run icons

preview: build
    npm run preview

# Print the headless survival curve (bot policies x seeds). Read before/after balance changes.
sim-bench:
    npx vitest run test/bots/bench.test.ts

deploy: build
    @echo "Pushed to main -> GitHub Actions deploys to Pages (see .github/workflows/deploy.yml)"
