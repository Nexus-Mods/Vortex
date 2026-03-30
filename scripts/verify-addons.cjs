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
"use strict";

const addons = [
  { name: "bsatk", load: () => require("bsatk"), required: true },
  { name: "esptk", load: () => require("esptk"), required: true },
  { name: "bsdiff-node", load: () => require("bsdiff-node"), required: true },
  { name: "xxhash-addon", load: () => require("xxhash-addon"), required: true },
  { name: "vortexmt", load: () => require("vortexmt"), required: true },
  { name: "loot", load: () => require("loot"), required: true },
];

let failed = false;
for (const addon of addons) {
  try {
    addon.load();
    console.log(`  OK: ${addon.name}`);
  } catch (err) {
    console.error(`  FAIL: ${addon.name} — ${err.message}`);
    if (addon.required) failed = true;
  }
}

if (failed) {
  console.error("\nNative addon verification FAILED");
  process.exit(1);
} else {
  console.log("\nAll native addons loaded successfully");
}
