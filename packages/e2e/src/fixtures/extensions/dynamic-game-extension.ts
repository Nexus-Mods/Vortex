/**
 * Build and prepare dynamic game extension fixtures for isolated Vortex end-to-end tests.
 *
 * These helpers copy a built game plugin into `userData/plugins`.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Identifier for the dynamic game extension fixture supported here. */
export type DynamicGameExtensionId = "gothic1remake";

/**
 * Build and copy one dynamic game extension into a Vortex user-data directory.
 *
 * @param vortexUserDataDir - Root directory for the isolated Vortex instance.
 * @param gameId - Dynamic game extension id to build and copy.
 * @throws Error When the `external/gdl-games` submodule is missing.
 * @throws Error When `pnpm` fails while installing, initializing, or building the fixture.
 * @throws Error When the built `dist` directory is missing `index.js` or `info.json`.
 * @throws NodeJS.ErrnoException When removing, creating, or copying the fixture directory fails.
 */
export function prepareDynamicGdlGameExtension(
  vortexUserDataDir: string,
  gameId: DynamicGameExtensionId,
): void {
  const source = ensureDynamicGdlGameExtensionBuilt(gameId);
  const destination = path.join(vortexUserDataDir, "userData", "plugins", gameId);

  // Replace any stale fixture copy before writing the fresh build output.
  fs.rmSync(destination, { recursive: true, force: true });
  // Recreate the parent plugin directory so the copy has a stable target.
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  // Copy the built extension into the isolated Vortex user-data tree.
  fs.cpSync(source, destination, { recursive: true });
}

/**
 * Build the requested dynamic game extension if its `dist` directory is missing.
 *
 * @param gameId - Dynamic game extension id to build.
 * @returns Absolute path to the built `dist` directory.
 * @throws Error When the `external/gdl-games` submodule is missing.
 * @throws Error When `pnpm` fails while installing, initializing, or building the fixture.
 * @throws Error When the built `dist` directory is missing `index.js` or `info.json`.
 */
export function ensureDynamicGdlGameExtensionBuilt(gameId: DynamicGameExtensionId): string {
  if (hasBuiltExtension(gameId)) return distDir(gameId);

  if (!fs.existsSync(path.join(GDL_GAMES_ROOT, "package.json"))) {
    throw new Error(
      `Missing gdl-games submodule at ${GDL_GAMES_ROOT}. Run: git submodule update --init --recursive external/gdl-games`,
    );
  }

  runGdlGames("pnpm", ["install"]);
  runGdlGames("pnpm", ["init-gdl"]);
  runGdlGames("pnpm", ["nx", "run", `${gameId}:build`]);

  if (!hasBuiltExtension(gameId)) {
    throw new Error(
      `GDL extension build did not produce dist/index.js and dist/info.json: ${gameId}`,
    );
  }

  return distDir(gameId);
}

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const REPO_ROOT = path.resolve(PACKAGE_ROOT, "..", "..");
const GDL_GAMES_ROOT = path.join(REPO_ROOT, "external", "gdl-games");

function runGdlGames(command: string, args: string[]): void {
  execFileSync(command, args, {
    cwd: GDL_GAMES_ROOT,
    env: process.env,
    stdio: "inherit",
  });
}

function hasBuiltExtension(gameId: DynamicGameExtensionId): boolean {
  return (
    fs.existsSync(path.join(distDir(gameId), "index.js")) &&
    fs.existsSync(path.join(distDir(gameId), "info.json"))
  );
}

function distDir(gameId: DynamicGameExtensionId): string {
  return path.join(gameDir(gameId), "dist");
}

function gameDir(gameId: DynamicGameExtensionId): string {
  return path.join(GDL_GAMES_ROOT, "games", gameId);
}
