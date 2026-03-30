/**
 * postinstall-libloot.cjs
 *
 * NOTE: This script builds libloot 0.29.1 from source on Linux and places the
 * resulting liblibloot.so into the loot npm package's loot_api/ directory.
 *
 * Why this exists: LOOT stopped publishing Linux prebuilts at v0.24.5. The
 * node-loot package pins libloot 0.29.1 and links against -l../loot_api/libloot
 * at build time. This script delivers the .so so that @electron/rebuild can
 * compile loot.node on Linux.
 *
 * On non-Linux platforms: exits 0 immediately with a skip message.
 * On failure: logs a warning and exits 0 (non-fatal — don't block pnpm install).
 */

"use strict";

const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Platform guard — this script is Linux-only
if (process.platform !== "linux") {
  console.log("postinstall-libloot: skipping (not Linux)");
  process.exit(0);
}

const LIBLOOT_VERSION = "0.29.1";

// Locate the loot npm package dynamically using require.resolve so we are
// independent of the pnpm store content-hash path.
let lootApiDir;
try {
  const lootPkgPath = require.resolve("loot/package.json");
  lootApiDir = path.join(path.dirname(lootPkgPath), "loot_api");
} catch (e) {
  // loot is an optional dependency; if it is not installed, skip gracefully.
  console.log(
    "postinstall-libloot: loot package not found, skipping (optional dependency)",
  );
  process.exit(0);
}

// If liblibloot.so already exists (e.g. re-running postinstall), skip the build.
const soDestPath = path.join(lootApiDir, "liblibloot.so");
if (fs.existsSync(soDestPath)) {
  console.log("postinstall-libloot: liblibloot.so already present, skipping build");
  process.exit(0);
}

console.log(
  `postinstall-libloot: building libloot ${LIBLOOT_VERSION} from source...`,
);

const tmpDir = path.join(os.tmpdir(), "libloot-build");

try {
  // Clean any stale build directory
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // Clone libloot at the exact pinned tag
  execSync(
    `git clone --depth=1 --branch ${LIBLOOT_VERSION} https://github.com/loot/libloot.git ${tmpDir}`,
    { stdio: "inherit" },
  );

  const buildDir = path.join(tmpDir, "cpp", "build");

  // Configure the CMake build
  // -DLIBLOOT_BUILD_TESTS=OFF  skips Catch2 fetch and test compilation
  // -DLIBLOOT_INSTALL_DOCS=OFF skips doxygen doc generation
  execSync(
    [
      "cmake",
      "-DCMAKE_BUILD_TYPE=Release",
      "-DLIBLOOT_BUILD_TESTS=OFF",
      "-DLIBLOOT_INSTALL_DOCS=OFF",
      `-B ${buildDir}`,
      `-S ${path.join(tmpDir, "cpp")}`,
    ].join(" "),
    { stdio: "inherit" },
  );

  // Build the shared library (parallel to use all available cores)
  execSync(`cmake --build ${buildDir} --parallel`, { stdio: "inherit" });

  // With Unix Makefiles + Release build type, cmake places the output directly
  // at <buildDir>/liblibloot.so (no Release/ subdirectory on Linux).
  const soSrcPath = path.join(buildDir, "liblibloot.so");

  if (!fs.existsSync(soSrcPath)) {
    throw new Error(
      `Expected liblibloot.so at ${soSrcPath} after build, but file not found. ` +
        `Check cmake output above for errors.`,
    );
  }

  // Copy to the loot_api directory alongside the existing Windows DLL
  fs.copyFileSync(soSrcPath, soDestPath);
  console.log(`postinstall-libloot: liblibloot.so installed to ${soDestPath}`);
} catch (err) {
  console.error("postinstall-libloot: build failed:", err.message || err);
  console.warn(
    "WARNING: libloot.so build failed — loot addon will not be available on Linux",
  );
  process.exit(0);
} finally {
  // Clean up the temporary build directory regardless of success or failure
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_) {
    // best-effort cleanup
  }
}
