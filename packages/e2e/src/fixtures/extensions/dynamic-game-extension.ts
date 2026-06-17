import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type DynamicGameExtensionId = "gothic1remake";

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const REPO_ROOT = path.resolve(PACKAGE_ROOT, "..", "..");
const GDL_GAMES_ROOT = path.join(REPO_ROOT, "external", "gdl-games");

function gameDir(gameId: DynamicGameExtensionId): string {
  return path.join(GDL_GAMES_ROOT, "games", gameId);
}

function distDir(gameId: DynamicGameExtensionId): string {
  return path.join(gameDir(gameId), "dist");
}

function hasBuiltExtension(gameId: DynamicGameExtensionId): boolean {
  return (
    fs.existsSync(path.join(distDir(gameId), "index.js")) &&
    fs.existsSync(path.join(distDir(gameId), "info.json"))
  );
}

function runGdlGames(command: string, args: string[]): void {
  execFileSync(command, args, {
    cwd: GDL_GAMES_ROOT,
    env: process.env,
    stdio: "inherit",
  });
}

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

export function prepareDynamicGdlGameExtension(
  vortexUserDataDir: string,
  gameId: DynamicGameExtensionId,
): void {
  const source = ensureDynamicGdlGameExtensionBuilt(gameId);
  const destination = path.join(vortexUserDataDir, "userData", "plugins", gameId);

  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}
