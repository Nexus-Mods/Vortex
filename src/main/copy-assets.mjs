#!/usr/bin/env node

import { cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, basename, dirname } from "node:path";

import { glob } from "glob";

const require = createRequire(import.meta.url);

const WORKSPACE = join(import.meta.dirname, "../..");
const BUILD = join(import.meta.dirname, "build");
const ASSETS = join(BUILD, "assets");

async function copy(src, dest) {
  await mkdir(join(dest, ".."), { recursive: true });
  await cp(src, dest, { recursive: true, force: true });
  console.log(`copied ${src} to ${dest}`);
}

// @vortex/stylesheets compiled outputs
for (const file of ["loadingScreen.css", "tailwind-v4.css"]) {
  await copy(join(WORKSPACE, "src/stylesheets/dist", file), join(BUILD, "assets/css", file));
}

// @tools/dotnetprobe compiled outputs
const dotnetprobeFiles = await glob("tools/dotnetprobe/dist/*", { cwd: WORKSPACE });
for (const file of dotnetprobeFiles) {
  const rel = file.slice("tools/dotnetprobe/dist/".length);
  await copy(join(WORKSPACE, file), join(BUILD, "assets", rel));
}

// SCSS sources for runtime stylesheet compiler load paths
const scssFiles = await glob("src/stylesheets/**/*.scss", {
  cwd: WORKSPACE,
  ignore: ["src/stylesheets/node_modules/**"],
});
for (const file of scssFiles) {
  const rel = file.slice("src/stylesheets/".length);
  await copy(join(WORKSPACE, file), join(BUILD, "assets/css", rel));
}

// bootstrap-sass source (resolved from main's deps, not workspace root)
const bootstrapSassDir = dirname(require.resolve("bootstrap-sass/package.json"));
await copy(
  join(bootstrapSassDir, "assets/stylesheets/_bootstrap.scss"),
  join(BUILD, "assets/css/bootstrap.scss"),
);

// node-loot runtime pieces, resolved from the renderer's deps: loot must stay out
// of @vortex/main's tree, or electron-rebuild force-rebuilds it against electron
// headers and the link fails where libloot is absent. The install-time node-gyp
// build targets napi, so electron loads it without a rebuild. The package layout
// is preserved so async.js's relative require of build/Release/node-loot resolves,
// and libloot.dll is placed next to the binding because the Windows loader
// searches the loaded module's directory.
try {
  const rendererRequire = createRequire(join(WORKSPACE, "src/renderer/package.json"));
  const lootDir = dirname(rendererRequire.resolve("loot/package.json"));
  await copy(join(lootDir, "index.js"), join(ASSETS, "loot/index.js"));
  await copy(join(lootDir, "async.js"), join(ASSETS, "loot/async.js"));
  await copy(
    join(lootDir, "build/Release/node-loot.node"),
    join(ASSETS, "loot/build/Release/node-loot.node"),
  );
  await copy(join(lootDir, "loot_api/libloot.dll"), join(ASSETS, "loot/build/Release/libloot.dll"));
} catch {
  console.log("skipped node-loot runtime pieces (loot is not installed on this platform)");
}

// Static files
await copy(join(WORKSPACE, "LICENSE.md"), join(BUILD, "LICENSE.md"));
await copy(join(WORKSPACE, "src/renderer/src/index.html"), join(BUILD, "index.html"));
await copy(join(WORKSPACE, "src/renderer/src/splash.html"), join(BUILD, "splash.html"));
await copy(join(WORKSPACE, "src/queries"), join(BUILD, "queries"));

// Static assets
for (const dir of ["fonts", "icons", "images", "pictograms"]) {
  await copy(join(WORKSPACE, "assets", dir), join(ASSETS, dir));
}

for (const file of await glob("assets/*.json", { cwd: WORKSPACE })) {
  await copy(join(WORKSPACE, file), join(ASSETS, basename(file)));
}

// Locales (dev only)
if (process.env.NODE_ENV !== "production") {
  for (const file of await glob("locales/*/*", { cwd: WORKSPACE })) {
    const parts = file.split("/");
    await copy(join(WORKSPACE, file), join(BUILD, ...parts));
  }
}

console.log("assets copied");
