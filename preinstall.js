// Preinstall script for Vortex
// Handles git submodule initialization and building FOMOD installer dependencies

const { spawn } = require("child_process");
const path = require("path");

const packageManager = "yarn";

// Detect if we're running in an offline build environment (e.g., Flatpak)
const isOfflineBuild = () => {
  return (
    process.env.YARN_OFFLINE_MIRROR || process.env.npm_config_offline === "true"
  );
};

// Get yarn install arguments based on environment
const getInstallArgs = () => {
  const args = ["install"];
  if (isOfflineBuild()) {
    args.push("--offline");
  }
  return args;
};

/**
 * Runs a command and returns a promise that resolves when the command completes
 * @param {string} command - The command to run
 * @param {string[]} args - Command arguments
 * @param {object} options - Spawn options
 * @returns {Promise<void>}
 */
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(" ")}`);
    const proc = spawn(command, args, {
      shell: true,
      stdio: "inherit",
      ...options,
    });

    proc.on("exit", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Command failed with exit code ${code}: ${command} ${args.join(" ")}`,
          ),
        );
      } else {
        resolve();
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Build FOMOD IPC TypeScript project
 * @returns {Promise<void>}
 */
async function buildFomodIPC() {
  const buildConfig = process.env.VORTEX_BUILD_CONFIG || "Release";
  console.log(`Building FOMOD IPC TypeScript (${buildConfig})...`);
  const fomodIPCPath = path.join(
    __dirname,
    "extensions",
    "fomod-installer",
    "src",
    "ModInstaller.IPC.TypeScript",
  );

  try {
    const pkgcli =
      process.platform === "win32" ? `${packageManager}.cmd` : packageManager;

    // Install dependencies
    await runCommand(pkgcli, getInstallArgs(), { cwd: fomodIPCPath });

    // Build project
    await runCommand(pkgcli, ["build", buildConfig], { cwd: fomodIPCPath });

    console.log("FOMOD IPC built successfully");
  } catch (err) {
    console.error("Failed to build FOMOD IPC:", err.message);
    throw err;
  }
}

/**
 * Build FOMOD Native TypeScript project
 * @returns {Promise<void>}
 */
async function buildFomodNative() {
  const buildConfig = process.env.VORTEX_BUILD_CONFIG || "Release";
  console.log(`Building FOMOD Native TypeScript (${buildConfig})...`);
  const fomodNativePath = path.join(
    __dirname,
    "extensions",
    "fomod-installer",
    "src",
    "ModInstaller.Native.TypeScript",
  );

  try {
    const pkgcli =
      process.platform === "win32" ? `${packageManager}.cmd` : packageManager;

    // Build native components with configuration
    await runCommand(pkgcli, ["build-native", buildConfig], {
      cwd: fomodNativePath,
    });

    // Install dependencies
    await runCommand(pkgcli, getInstallArgs(), { cwd: fomodNativePath });

    // Build project with configuration
    await runCommand(pkgcli, ["build", buildConfig], { cwd: fomodNativePath });

    console.log(`FOMOD Native built successfully (${buildConfig})`);
  } catch (err) {
    console.error("Failed to build FOMOD Native:", err.message);
    throw err;
  }
}

/**
 * Main preinstall routine
 */
async function main() {
  console.log("Starting preinstall script...");

  try {
    // Build FOMOD IPC
    await buildFomodIPC();

    // Build FOMOD Native
    await buildFomodNative();

    console.log("Preinstall completed successfully");
  } catch (err) {
    console.error("Preinstall failed:", err.message);
    process.exit(1);
  }
}

main();
