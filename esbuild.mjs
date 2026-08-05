// Build the Electron app (main + preload + renderer) and stage its assets into build/.
// main.cjs statically bundles the pure core (parse/engine/logtail/detect/core), so there is
// no runtime module-resolution or dynamic-import juggling in the packaged app.
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";

rmSync("build", { recursive: true, force: true });
mkdirSync("build/renderer", { recursive: true });

const node = { bundle: true, platform: "node", target: "node20", logLevel: "info" };

await build({
  ...node,
  entryPoints: ["src/advisor/electron/main.ts"],
  outfile: "build/main.cjs",
  format: "cjs",
  external: ["electron", "electron-updater"],
});

await build({
  ...node,
  entryPoints: ["src/advisor/electron/preload.ts"],
  outfile: "build/preload.cjs",
  format: "cjs",
  external: ["electron"],
});

await build({
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "es2022",
  entryPoints: ["src/advisor/renderer/overlay.ts"],
  outfile: "build/renderer/overlay.js",
  logLevel: "info",
});

cpSync("src/advisor/renderer/overlay.html", "build/renderer/overlay.html");
cpSync("assets", "build/assets", { recursive: true });
cpSync("data", "build/data", { recursive: true });

console.log("esbuild: build complete -> build/");
