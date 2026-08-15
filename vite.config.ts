import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
// @ts-expect-error -- plain-JS build plugin, no types needed at the call site
import { pwa } from "./scripts/pwa-plugin.mjs";

// base is set for GitHub Pages project sites: https://<user>.github.io/standstill/
// If you deploy to a custom domain or user site, change base to "/".
// Everything PWA-side (manifest scope, sw scope, precache URLs) derives from it.
export default defineConfig({
  base: "/standstill/",
  build: { target: "es2022" },
  plugins: [pwa({ swSrc: fileURLToPath(new URL("./src/sw.js", import.meta.url)) })],
});
