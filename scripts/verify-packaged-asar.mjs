/**
 * Verify that the packaged app.asar contains the same dependency versions as
 * the deploy tree electron-builder packaged from.
 *
 * Exists because electron-builder 26's node-module collector shipped an asar
 * where every nested node_modules slot held the top-level version (~50
 * runtime deps wrong; dnd-core 14 replaced by 9.5.1 crashed the renderer on
 * boot). electron-builder was reverted to 24; this guard fails the build
 * loudly if any future builder upgrade regresses the layout again.
 *
 * Usage:
 *   node scripts/verify-packaged-asar.mjs [--deploy src/main/dist/node_modules] [--asar dist/win-unpacked/resources/app.asar]
 *
 * Checks every nested package (node_modules/<pkg>/node_modules/<dep>) in the
 * deploy tree: if the asar contains that slot, its version must match. Slots
 * absent from the asar entirely are allowed — the packager may legitimately
 * exclude dev-only trees — but a slot present with the WRONG version is
 * exactly the corruption this guards against, and fails the run.
 */

import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";

// @electron/asar is a transitive dep (main -> electron-builder ->
// app-builder-lib -> @electron/asar); resolve through that chain since pnpm
// doesn't hoist it anywhere directly requirable.
const mainRequire = createRequire(path.resolve("src/main/package.json"));
const builderRequire = createRequire(mainRequire.resolve("electron-builder/package.json"));
const libRequire = createRequire(builderRequire.resolve("app-builder-lib/package.json"));
const asar = libRequire("@electron/asar");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] != null ? process.argv[index + 1] : fallback;
}

const deployRoot = path.resolve(arg("deploy", "src/main/dist/node_modules"));
const asarPath = path.resolve(arg("asar", "dist/win-unpacked/resources/app.asar"));

if (!fs.existsSync(deployRoot) || !fs.existsSync(asarPath)) {
  console.error(`missing input: ${!fs.existsSync(deployRoot) ? deployRoot : asarPath}`);
  process.exit(2);
}

function packageDirs(root) {
  const out = [];
  for (const top of fs.readdirSync(root)) {
    if (top.startsWith(".")) {
      continue;
    }
    if (top.startsWith("@")) {
      for (const scoped of fs.readdirSync(path.join(root, top))) {
        out.push(`${top}/${scoped}`);
      }
    } else {
      out.push(top);
    }
  }
  return out;
}

function nestedPackages(root) {
  const out = [];
  for (const parent of packageDirs(root)) {
    const nm = path.join(root, parent, "node_modules");
    if (!fs.existsSync(nm)) {
      continue;
    }
    for (const dep of packageDirs(nm)) {
      const pj = path.join(nm, dep, "package.json");
      if (fs.existsSync(pj)) {
        out.push({ parent, dep, version: JSON.parse(fs.readFileSync(pj, "utf8")).version });
      }
    }
  }
  return out;
}

function asarVersion(rel) {
  try {
    return JSON.parse(asar.extractFile(asarPath, rel.split("/").join(path.sep)).toString()).version;
  } catch {
    return null; // not in the asar at all — allowed
  }
}

const nested = nestedPackages(deployRoot);
let mismatches = 0;
for (const entry of nested) {
  const rel = `node_modules/${entry.parent}/node_modules/${entry.dep}/package.json`;
  const packaged = asarVersion(rel);
  if (packaged != null && packaged !== entry.version) {
    mismatches += 1;
    console.error(
      `MISMATCH ${entry.parent} -> ${entry.dep}: deploy=${entry.version} asar=${packaged}`,
    );
  }
}

console.log(`checked ${nested.length} nested packages, ${mismatches} version mismatch(es)`);
if (mismatches > 0) {
  console.error(
    "the packaged asar does not match the deploy tree - the module collector mangled versions",
  );
  process.exit(1);
}
