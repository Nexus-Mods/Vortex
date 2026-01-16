/**
 * Handler for finding games installed via GOG Galaxy
 */

import { existsSync } from "fs";
import { platform } from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { Result, ok, err } from "neverthrow";
import type { StoreHandler, GameFinderError } from "../../common";
import type { GOGGame, GOGGameId, GOGBuildId } from "./types";
import { createGOGGame } from "./types";

const execAsync = promisify(exec);

/**
 * Registry path for GOG games on Windows
 */
const GOG_REGISTRY_PATH =
  "HKEY_LOCAL_MACHINE\\Software\\WOW6432Node\\GOG.com\\Games";

/**
 * Parse a registry output value
 */
function parseRegistryValue(
  output: string,
  valueName: string,
): string | undefined {
  const regex = new RegExp(`^\\s*${valueName}\\s+REG_SZ\\s+(.+)$`, "im");
  const match = regex.exec(output);
  return match?.[1]?.trim();
}

/**
 * Read a single registry value
 */
async function readRegistryValue(
  keyPath: string,
  valueName: string,
): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync(
      `reg query "${keyPath}" /v "${valueName}"`,
      {
        encoding: "utf8",
      },
    );
    return parseRegistryValue(stdout, valueName);
  } catch {
    return undefined;
  }
}

/**
 * Get all subkey names under a registry key
 */
async function getRegistrySubKeys(keyPath: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync(`reg query "${keyPath}"`, {
      encoding: "utf8",
    });

    const lines = stdout.split("\n");
    const subkeys: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Subkey lines start with the full path
      if (trimmed.startsWith(keyPath + "\\")) {
        const subkeyName = trimmed.slice(keyPath.length + 1);
        if (subkeyName && !subkeyName.includes("\\")) {
          subkeys.push(subkeyName);
        }
      }
    }

    return subkeys;
  } catch {
    return [];
  }
}

/**
 * Parse game information from registry values
 */
async function parseGameFromRegistry(
  subkeyName: string,
): Promise<Result<GOGGame, GameFinderError>> {
  const keyPath = `${GOG_REGISTRY_PATH}\\${subkeyName}`;

  // Try to get game ID from subkey name first, then from gameID value
  let gogId: GOGGameId | undefined;

  // Try parsing subkey name as a number
  const subkeyAsId = parseInt(subkeyName, 10);
  if (!isNaN(subkeyAsId)) {
    gogId = BigInt(subkeyAsId);
  }

  // Try gameID registry value as fallback
  if (gogId === undefined) {
    const gameIdStr = await readRegistryValue(keyPath, "gameID");
    if (gameIdStr !== undefined) {
      const parsed = parseInt(gameIdStr, 10);
      if (!isNaN(parsed)) {
        gogId = BigInt(parsed);
      }
    }
  }

  if (gogId === undefined) {
    return err({
      code: "GOG_INVALID_GAME_ID",
      message: `Could not determine game ID for registry key: ${subkeyName}`,
    });
  }

  // Read required values
  const gameName = await readRegistryValue(keyPath, "gameName");
  if (gameName === undefined) {
    return err({
      code: "GOG_MISSING_GAME_NAME",
      message: `Missing gameName for GOG game: ${gogId}`,
    });
  }

  const gamePath = await readRegistryValue(keyPath, "path");
  if (gamePath === undefined) {
    return err({
      code: "GOG_MISSING_PATH",
      message: `Missing path for GOG game: ${gogId}`,
    });
  }

  const buildIdStr = await readRegistryValue(keyPath, "buildId");
  if (buildIdStr === undefined) {
    return err({
      code: "GOG_MISSING_BUILD_ID",
      message: `Missing buildId for GOG game: ${gogId}`,
    });
  }

  const buildIdParsed = parseInt(buildIdStr, 10);
  if (isNaN(buildIdParsed)) {
    return err({
      code: "GOG_INVALID_BUILD_ID",
      message: `Invalid buildId for GOG game: ${gogId}`,
    });
  }
  const buildId: GOGBuildId = BigInt(buildIdParsed);

  // Read optional DLC parent reference
  let parentGameId: GOGGameId | undefined;
  const dependsOn = await readRegistryValue(keyPath, "dependsOn");
  if (dependsOn !== undefined) {
    const parsed = parseInt(dependsOn, 10);
    if (!isNaN(parsed)) {
      parentGameId = BigInt(parsed);
    }
  }

  return ok(createGOGGame(gogId, gameName, gamePath, buildId, parentGameId));
}

/**
 * Handler for finding games installed via GOG Galaxy
 */
export class GOGHandler implements StoreHandler {
  readonly storeName = "GOG";

  /**
   * Find all games installed via GOG Galaxy
   */
  async findAllGames(): Promise<Result<GOGGame[], GameFinderError>> {
    // GOG Galaxy only stores games in Windows Registry
    if (platform() !== "win32") {
      return ok([]);
    }

    // Get all game subkeys
    const subkeys = await getRegistrySubKeys(GOG_REGISTRY_PATH);

    if (subkeys.length === 0) {
      // No games installed or GOG not installed
      return ok([]);
    }

    const games: GOGGame[] = [];

    for (const subkey of subkeys) {
      const result = await parseGameFromRegistry(subkey);
      if (result.isOk()) {
        const game = result.value;
        // Verify installation directory exists
        if (existsSync(game.path)) {
          games.push(game);
        }
      }
      // Skip games that fail to parse
    }

    return ok(games);
  }

  /**
   * Check if GOG Galaxy is available on this system
   */
  async isAvailable(): Promise<boolean> {
    if (platform() !== "win32") {
      return false;
    }

    const subkeys = await getRegistrySubKeys(GOG_REGISTRY_PATH);
    return subkeys.length > 0;
  }
}
