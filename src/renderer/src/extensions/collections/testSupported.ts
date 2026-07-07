import type { ISupportedResult } from "../../extensions/mod_management/types/TestSupported";

/**
 * supported test for use in registerInstaller
 */
export async function testSupported(files: string[], gameId: string): Promise<ISupportedResult> {
  return {
    supported: files.indexOf("collection.json") !== -1,
    requiredFiles: ["collection.json"],
  };
}
