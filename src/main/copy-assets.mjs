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

for (const file of await glob("assets/licenses/*", { cwd: WORKSPACE })) {
  await copy(join(WORKSPACE, file), join(ASSETS, "licenses", basename(file)));
}

// Platform binaries (may not exist on current platform)
for (const bin of ["dotnetprobe", "dotnetprobe.exe", "dotnetprobe.pdb"]) {
  try {
    await copy(join(WORKSPACE, "assets", bin), join(ASSETS, bin));
  } catch {
    // ignored
  }
}

// Locales (dev only)
if (process.env.NODE_ENV !== "production") {
  for (const file of await glob("locales/*/*", { cwd: WORKSPACE })) {
    const parts = file.split("/");
    await copy(join(WORKSPACE, file), join(BUILD, ...parts));
  }
}

console.log("assets copied");
