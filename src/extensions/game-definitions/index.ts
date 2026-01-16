import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { load as loadYaml } from "js-yaml";
import { join } from "path";

import type { IExtensionContext } from "../../types/IExtensionContext";

import { transformGameDefToGame } from "./transformer";
import type { GameDef, IGameCustomLogic } from "./types";
import { validateGameDef } from "./validator";

/**
 * Loads a single game definition from a directory.
 *
 * @param context - Vortex extension context
 * @param gameDir - Path to the game's directory containing game.yaml and assets
 */
function loadGameFromDirectory(
  context: IExtensionContext,
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
    // Pass gameDir as extensionPath so logos/assets are found
    const game = transformGameDefToGame(def, customLogic, gameDir);
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
 * @param gamesDir - Path to the directory containing game subdirectories
 */
function loadGameDefinitions(
  context: IExtensionContext,
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
      loadGameFromDirectory(context, entryPath);
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
  loadGameDefinitions(context, gamesDir);

  return true;
}

export default init;
