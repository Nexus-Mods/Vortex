// scripts/verify-addons.cjs
// Smoke test: require each native addon and report pass/fail
//
// Run after @electron/rebuild to confirm all native addons load correctly:
//   node scripts/verify-addons.cjs
//
// NADD-06 Audit Results (Phase 3):
// - vortexmt: CLEAN — proper #ifdef WIN32 guards in common.h, portable C++ in main.cpp.
//   Compiled successfully on Linux. Added to CI rebuild.
// - gamebryo-savegame: DISABLED ON LINUX — two compile errors:
//   1. MoreInfoException uses MSVC-only std::exception(std::runtime_error(msg)) constructor
//   2. binding.gyp links lz4/zlib only on OS=="win" but .cpp includes unconditionally
//   Save game preview is not core functionality for Phase 1 boot goal.
//   Fix deferred — would require patch-package for both issues.
//   NADD-06 "clear error" satisfied: gamebryo-savegame is only imported in the bundled
//   extension gamebryo-savegame-management (lazy-loaded by ExtensionManager). When the
//   addon fails to load on Linux, ExtensionManager catches the error and reports it as a
//   non-fatal warning. No explicit platform guard is needed.
//
// pnpm isolation note:
//   pnpm uses strict module isolation — native addons are NOT in root node_modules.
//   Each addon lives in the workspace package that depends on it. We must resolve
//   them using searchPaths pointing to the correct workspace package directories.
"use strict";

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

// Map each addon to the workspace package that declares it as a dependency.
// pnpm symlinks the addon into that package's node_modules, which then resolves
// into the shared pnpm store. We pass these paths to require.resolve().
const addonWorkspaces = {
  bsatk: path.join(projectRoot, "extensions", "gamebryo-bsa-support", "node_modules"),
  esptk: path.join(projectRoot, "extensions", "gamebryo-plugin-management", "node_modules"),
  "bsdiff-node": path.join(projectRoot, "extensions", "collections", "node_modules"),
  "xxhash-addon": path.join(projectRoot, "src", "main", "node_modules"),
  vortexmt: path.join(projectRoot, "src", "main", "node_modules"),
  loot: path.join(projectRoot, "extensions", "gamebryo-plugin-management", "node_modules"),
};

// Resolve the actual filesystem path for a given addon using workspace-relative lookup.
function resolveAddon(addonName) {
  const searchPaths = [
    addonWorkspaces[addonName],
    path.join(projectRoot, "node_modules"),
  ].filter(Boolean);
  return require.resolve(addonName + "/package.json", { paths: searchPaths });
}

// Verify loot using ldd instead of require() because:
// @electron/rebuild compiles loot.node against Electron's V8 headers (not ABI-stable),
// so it cannot be dlopen'd by plain Node.js after rebuild. We instead verify:
//   1. node-loot.node exists at the expected build path
//   2. ldd confirms liblibloot.so (via libloot.so.0 SONAME) resolves via RUNPATH
function verifyLootViaDependencyCheck(lootPkgPath) {
  const lootDir = path.dirname(lootPkgPath);
  const lootNode = path.join(lootDir, "build", "Release", "node-loot.node");

  if (!fs.existsSync(lootNode)) {
    return { ok: false, reason: `node-loot.node not found at ${lootNode} — run @electron/rebuild first` };
  }

  // Check RPATH/RUNPATH resolves liblibloot.so at runtime using ldd
  let lddOutput = "";
  try {
    lddOutput = execSync(`ldd "${lootNode}"`, { encoding: "utf8" });
  } catch (e) {
    return { ok: false, reason: `ldd failed: ${e.message}` };
  }

  // libloot.so.0 is the SONAME embedded by cmake; it must appear as "found" (path, not "not found")
  const lootSoLine = lddOutput.split("\n").find((l) => l.includes("libloot.so"));
  if (!lootSoLine) {
    return { ok: false, reason: "ldd output does not mention libloot.so — binary may not link against it" };
  }
  if (lootSoLine.includes("not found")) {
    return {
      ok: false,
      reason: `libloot.so.0 not found at runtime — RUNPATH: ${
        (lddOutput.match(/runpath:\s*\[(.+?)\]/i) || [])[1] || "missing"
      }`,
    };
  }

  const resolvedPath = (lootSoLine.match(/=>\s*(\S+)/) || [])[1] || "(resolved)";
  return { ok: true, detail: `libloot.so.0 => ${resolvedPath}` };
}

const addonResults = {};

// Verify non-loot addons via require()
for (const addonName of ["bsatk", "esptk", "bsdiff-node", "xxhash-addon", "vortexmt"]) {
  try {
    const pkgPath = resolveAddon(addonName);
    const addonDir = path.dirname(pkgPath);
    // Require from the resolved package directory so relative paths inside work
    require(addonDir);
    addonResults[addonName] = { ok: true };
  } catch (err) {
    addonResults[addonName] = { ok: false, reason: err.message.split("\n")[0] };
  }
}

// Verify loot via ldd (not require) because it uses Electron V8 headers
try {
  const lootPkgPath = resolveAddon("loot");
  addonResults["loot"] = verifyLootViaDependencyCheck(lootPkgPath);
} catch (err) {
  addonResults["loot"] = { ok: false, reason: err.message.split("\n")[0] };
}

// Print results
let failed = false;
for (const [name, result] of Object.entries(addonResults)) {
  if (result.ok) {
    const detail = result.detail ? ` (${result.detail})` : "";
    console.log(`  OK: ${name}${detail}`);
  } else {
    console.error(`  FAIL: ${name} — ${result.reason}`);
    failed = true;
  }
}

if (failed) {
  console.error("\nNative addon verification FAILED");
  process.exit(1);
} else {
  console.log("\nAll native addons verified successfully");
}
