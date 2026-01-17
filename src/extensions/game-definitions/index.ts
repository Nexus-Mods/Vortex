import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { load as loadYaml } from "js-yaml";
import { join, relative } from "path";

import type { IExtensionContext } from "../../types/IExtensionContext";

import { transformGameDefToGame } from "./transformer";
import type { GameDef, IGameCustomLogic } from "./types";
import { validateGameDef } from "./validator";

/**
 * Loads a single game definition from a directory.
 *
 * @param context - Vortex extension context
 * @param extensionDir - Path to the extension's root directory
 * @param gameDir - Path to the game's directory containing game.yaml and assets
 */
function loadGameFromDirectory(
  context: IExtensionContext,
  extensionDir: string,
  gameDir: string,
): void {
  // Look for game.yaml or game.yml
  const yamlPath = existsSync(join(gameDir, "game.yaml"))
    ? join(gameDir, "game.yaml")
    : existsSync(join(gameDir, "game.yml"))
      ? join(gameDir, "game.yml")
      : null;

  if (!yamlPath) {
    return;
  }

  try {
    const content = readFileSync(yamlPath, "utf8");
    const data = loadYaml(content);

    // Validate against schema
    const validation = validateGameDef(data);
    if (!validation.valid) {
      // eslint-disable-next-line no-console
      console.error(
        `[game-definitions] Invalid game definition in ${yamlPath}:`,
        validation.errors,
      );
      return;
    }

    const def = data as GameDef;

    // Load companion .js file if specified
    let customLogic: IGameCustomLogic | undefined;
    if (def.customLogic) {
      const jsPath = join(gameDir, `${def.customLogic}.js`);

      if (existsSync(jsPath)) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          customLogic = require(jsPath);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(
            `[game-definitions] Failed to load custom logic from ${jsPath}:`,
            err,
          );
        }
      }
    }

    // Transform and register the game
    // Pass the relative path from extension root to game directory for asset paths
    const relativeGameDir = relative(extensionDir, gameDir);
    const game = transformGameDefToGame(def, customLogic, relativeGameDir);

    // eslint-disable-next-line no-console
    console.log(
      `[game-definitions] Game object:`,
      JSON.stringify(
        game,
        (key, value) => {
          // Don't stringify functions, just indicate they exist
          if (typeof value === "function") {
            return "[Function]";
          }
          return value;
        },
        2,
      ),
    );

    context.registerGame(game);

    // eslint-disable-next-line no-console
    console.log(
      `[game-definitions] Registered game from YAML: ${def.name} (${def.id})`,
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[game-definitions] Failed to process ${yamlPath}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Loads and registers all YAML game definitions from the games directory.
 * Each game should be in its own subdirectory with a game.yaml file and assets.
 *
 * Structure:
 *   games/
 *     skyrimse/
 *       game.yaml
 *       gameart.jpg
 *       tes5edit.png
 *       ...
 *     fallout4/
 *       game.yaml
 *       ...
 *
 * @param context - Vortex extension context
 * @param extensionDir - Path to the extension's root directory
 * @param gamesDir - Path to the directory containing game subdirectories
 */
function loadGameDefinitions(
  context: IExtensionContext,
  extensionDir: string,
  gamesDir: string,
): void {
  if (!existsSync(gamesDir)) {
    return;
  }

  // Scan for subdirectories
  const entries = readdirSync(gamesDir);

  for (const entry of entries) {
    const entryPath = join(gamesDir, entry);

    // Only process directories
    if (statSync(entryPath).isDirectory()) {
      loadGameFromDirectory(context, extensionDir, entryPath);
    }
  }
}

/**
 * Extension entry point.
 *
 * This extension allows game definitions to be expressed in YAML format,
 * reducing boilerplate and code duplication for simple game extensions.
 *
 * @param context - Vortex extension context
 * @returns true to indicate successful initialization
 */
function init(context: IExtensionContext): boolean {
  const gamesDir = join(__dirname, "games");

  // eslint-disable-next-line no-console
  console.log(`[game-definitions] Extension loading, __dirname=${__dirname}`);
  // eslint-disable-next-line no-console
  console.log(`[game-definitions] Looking for games in: ${gamesDir}`);
  // eslint-disable-next-line no-console
  console.log(`[game-definitions] Directory exists: ${existsSync(gamesDir)}`);

  if (existsSync(gamesDir)) {
    const entries = readdirSync(gamesDir);
    // eslint-disable-next-line no-console
    console.log(`[game-definitions] Found entries: ${JSON.stringify(entries)}`);
  }

  loadGameDefinitions(context, __dirname, gamesDir);

  return true;
}

export default init;
