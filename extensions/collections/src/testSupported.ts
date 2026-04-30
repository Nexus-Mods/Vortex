import type { types } from "vortex-api";

/**
 * supported test for use in registerInstaller
 */
export async function testSupported(
  files: string[],
  gameId: string,
): Promise<types.ISupportedResult> {
  return {
    supported: files.indexOf("collection.json") !== -1,
    requiredFiles: ["collection.json"],
  };
}
