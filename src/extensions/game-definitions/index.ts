import { existsSync, readdirSync, readFileSync } from "fs";
import { load as loadYaml } from "js-yaml";
import { join } from "path";

import type { IExtensionContext } from "../../types/IExtensionContext";

import { transformGameDefToGame } from "./transformer";
import type { GameDef, IGameCustomLogic } from "./types";
import { validateGameDef } from "./validator";

/**
 * Loads and registers all YAML game definitions from the games directory.
 *
 * @param context - Vortex extension context
 * @param gamesDir - Path to the directory containing YAML game definitions
 */
function loadGameDefinitions(
  context: IExtensionContext,
  gamesDir: string,
): void {
  if (!existsSync(gamesDir)) {
    // No games directory yet - that's OK, just return
    return;
  }

  // Find all .yaml and .yml files
  const yamlFiles = readdirSync(gamesDir).filter(
    (f) => f.endsWith(".yaml") || f.endsWith(".yml"),
  );

  for (const yamlFile of yamlFiles) {
    const yamlPath = join(gamesDir, yamlFile);

    try {
      const content = readFileSync(yamlPath, "utf8");
      const data = loadYaml(content);

      // Validate against schema
      const validation = validateGameDef(data);
      if (!validation.valid) {
        // eslint-disable-next-line no-console
        console.error(
          `[game-definitions] Invalid game definition in ${yamlFile}:`,
          validation.errors,
        );
        continue;
      }

      const def = data as GameDef;

      // Load companion .js/.ts file if specified
      let customLogic: IGameCustomLogic | undefined;
      if (def.customLogic) {
        // Try .js first (compiled), then .ts (development)
        const jsPath = join(gamesDir, `${def.customLogic}.js`);
        const tsPath = join(gamesDir, `${def.customLogic}.ts`);

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
        } else if (existsSync(tsPath)) {
          // Note: TypeScript files would need to be compiled first
          // This is mainly for development convenience
          // eslint-disable-next-line no-console
          console.warn(
            `[game-definitions] Found TypeScript custom logic ${tsPath}, but only compiled .js is supported at runtime`,
          );
        }
      }

      // Transform and register the game
      const game = transformGameDefToGame(def, customLogic, gamesDir);
      context.registerGame(game);

      // eslint-disable-next-line no-console
      console.log(
        `[game-definitions] Registered game from YAML: ${def.name} (${def.id})`,
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[game-definitions] Failed to process ${yamlFile}:`,
        err instanceof Error ? err.message : err,
      );
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
  // Load game definitions from the embedded games directory
  const gamesDir = join(__dirname, "games");
  loadGameDefinitions(context, gamesDir);

  return true;
}

export default init;
