/**
 * Build-time service-worker plugin. Deliberately ~60 lines instead of a
 * workbox dependency: the app is one bundle and a few icons, so the precache
 * list is just "everything vite emitted plus everything in public/".
 *
 * It reads `src/sw.js`, injects that list and a version derived from the built
 * output, and emits `dist/sw.js`. Build-only — dev serves no worker, so a
 * cached shell can never shadow an edit (see src/pwa.ts, which also evicts any
 * worker left over from a previous production visit on the same origin).
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";

/** Relative POSIX paths of every file under `dir`, recursively. */
function walk(dir, root = dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out = out.concat(walk(full, root));
    else out.push(relative(root, full).split(sep).join(posix.sep));
  }
  return out;
}

/**
 * @param {{ swSrc: string }} options path to the service worker source
 * @returns {import("vite").Plugin}
 */
export function pwa({ swSrc }) {
  let base = "/";
  let publicDir = "";

  return {
    name: "standstill-pwa",
    apply: "build",

    configResolved(config) {
      base = config.base;
      publicDir = config.publicDir;
    },

    generateBundle(_options, bundle) {
      // index.html is covered by the shell URL itself; source maps are dev-only.
      const emitted = Object.keys(bundle)
        .filter((f) => f !== "index.html" && !f.endsWith(".map"))
        .sort();
      const statics = publicDir ? walk(publicDir).sort() : [];
      const precache = [base, ...emitted.map((f) => base + f), ...statics.map((f) => base + f)];

      // Version tracks content, so a rebuild that changes nothing keeps the
      // cache warm and any real change invalidates it.
      const hash = createHash("sha256");
      for (const name of ["index.html", ...emitted]) {
        const file = bundle[name];
        if (file) hash.update(file.type === "chunk" ? file.code : file.source);
      }
      for (const name of statics) hash.update(readFileSync(join(publicDir, name)));

      const source = readFileSync(swSrc, "utf8")
        .replace('"__CACHE_VERSION__"', JSON.stringify(hash.digest("hex").slice(0, 12)))
        .replace("__PRECACHE__", JSON.stringify(precache, null, 2));

      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}
