import type { Dimensions, SaveGameData } from "./GamebryoSaveGame";
import { parseSaveGame } from "./GamebryoSaveGame";

export type { Dimensions, SaveGameData };

/**
 * Async factory function matching the existing native module's API:
 * create(filePath, quick, callback)
 */
export function create(
  filePath: string,
  quick: boolean,
  callback: (err: Error | null, save?: SaveGameData) => void,
): void {
  // Use setImmediate to keep the async contract
  setImmediate(() => {
    try {
      const save = parseSaveGame(filePath, quick);
      callback(null, save);
    } catch (err) {
      callback(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
