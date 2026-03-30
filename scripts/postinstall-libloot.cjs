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

// Ensure cargo is in PATH — rustup installs to ~/.cargo/bin which isn't
// automatically on PATH in non-interactive shells (CI uses an explicit
// install step; local dev uses rustup's shell init which isn't sourced here).
const cargoBin = path.join(os.homedir(), ".cargo", "bin");
if (fs.existsSync(cargoBin) && !(process.env.PATH || "").includes(cargoBin)) {
  process.env.PATH = `${cargoBin}:${process.env.PATH || ""}`;
}

const LIBLOOT_VERSION = "0.29.1";

// Locate the loot npm package dynamically using require.resolve so we are
// independent of the pnpm store content-hash path.
//
// NOTE: pnpm uses strict isolation — loot is only in the node_modules of the
// workspace package that declares it (gamebryo-plugin-management), not in the
// root node_modules. We must search workspace subdirectories explicitly.
let lootApiDir;
try {
  const projectRoot = path.resolve(__dirname, "..");
  const searchPaths = [
    // Primary: gamebryo-plugin-management is the workspace package that depends on loot
    path.join(projectRoot, "extensions", "gamebryo-plugin-management", "node_modules"),
    // Fallback: root node_modules (in case hoisting is enabled in future)
    path.join(projectRoot, "node_modules"),
  ];
  const lootPkgPath = require.resolve("loot/package.json", { paths: searchPaths });
  lootApiDir = path.join(path.dirname(lootPkgPath), "loot_api");
} catch (e) {
  // loot is an optional dependency; if it is not installed, skip gracefully.
  console.log(
    "postinstall-libloot: loot package not found, skipping (optional dependency)",
  );
  process.exit(0);
}

// If libloot.so.0 already exists (e.g. re-running postinstall), skip the build.
// libloot.so.0 is the versioned shared library; liblibloot.so is a symlink to it.
const soDestVersioned = path.join(lootApiDir, "libloot.so.0");
const soDestPath = path.join(lootApiDir, "liblibloot.so");
if (fs.existsSync(soDestVersioned)) {
  console.log("postinstall-libloot: libloot.so.0 already present, skipping build");
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
  // at <buildDir>/libloot.so (no Release/ subdirectory on Linux).
  //
  // cmake naming: The cmake target sets PREFIX="" to suppress the auto "lib"
  // prefix (the name "libloot" already starts with "lib"). cmake produces:
  //   libloot.so           → symlink to libloot.so.0 (unversioned)
  //   libloot.so.0         → actual shared library (versioned, SONAME)
  //   libloot.so.0.29.1    → the real binary
  //
  // The SONAME embedded in libloot.so.0 is "libloot.so.0".
  //
  // We need two files in loot_api/:
  //   libloot.so.0   — the actual .so; the dynamic linker searches for this
  //                    SONAME at runtime via RUNPATH=$ORIGIN/../loot_api
  //   liblibloot.so  — symlink to libloot.so.0; the linker uses this at
  //                    build time when binding.gyp specifies -llibloot
  //                    (on Linux, -l<name> searches for lib<name>.so)
  const soVersionedSrc = path.join(buildDir, "libloot.so.0");
  const soUnversionedSrc = path.join(buildDir, "libloot.so");

  // Prefer the versioned .so (actual binary); fall back to the unversioned one
  const soSrcPath = fs.existsSync(soVersionedSrc)
    ? soVersionedSrc
    : soUnversionedSrc;

  if (!fs.existsSync(soSrcPath)) {
    throw new Error(
      `Expected libloot.so.0 or libloot.so at ${buildDir} after build, but neither found. ` +
        `Check cmake output above for errors.`,
    );
  }

  // Copy the versioned .so (libloot.so.0) — this is what the dynamic linker
  // searches for at runtime when it resolves the SONAME.
  const soVersionedDest = path.join(lootApiDir, "libloot.so.0");
  fs.copyFileSync(soSrcPath, soVersionedDest);
  console.log(`postinstall-libloot: libloot.so.0 installed to ${soVersionedDest}`);

  // Create liblibloot.so as a symlink → libloot.so.0. The linker looks for
  // liblibloot.so when given -llibloot (prepends "lib", appends ".so").
  if (fs.existsSync(soDestPath)) {
    fs.unlinkSync(soDestPath);
  }
  fs.symlinkSync("libloot.so.0", soDestPath);
  console.log(`postinstall-libloot: liblibloot.so symlink created → libloot.so.0`);
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
