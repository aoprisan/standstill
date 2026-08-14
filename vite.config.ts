import { defineConfig } from "vite";

// base is set for GitHub Pages project sites: https://<user>.github.io/standstill/
// If you deploy to a custom domain or user site, change base to "/".
export default defineConfig({
  base: "/standstill/",
  build: { target: "es2022" },
});
