export interface ISupportedResult {
  supported: boolean;
  requiredFiles: string[];
}

export interface ITestSupportedDetails {
  hasXmlConfigXML?: boolean;
  hasCSScripts?: boolean;
}

/**
 * Tests whether this installer can handle the given archive contents.
 *
 * ## Arguments
 *
 * @param files - Array of installer-relative paths containing 
 *   **both files and directories**. 
 *   
 *   Directories are marked by trailing `/` or `\` separators.
 * 
 *   **Important:** ‼️ Use `splitPathsByKind()` from `@vortex/game-extension-helpers` 
 *   to separate files and directories. A raw conversion/cast will strip separators,
 *   making it impossible to distinguish files from directories. 
 *
 * @param gameId - Identifier for the target game.
 * @param archivePath - Optional path to the archive file being tested.
 * @param details - Additional context about the archive contents.
 *
 * ## Returns
 *
 * @returns Promise resolving to an {@link ISupportedResult} indicating support status
 *   and any required files.
 *
 * ## Examples
 *
 * Testing support with proper path handling:
 *
 * ```typescript
 * import { splitPathsByKind } from "@vortex/game-extension-helpers";
 *
 * const testSupported: TestSupported = async (files, gameId) => {
 *   // Separate files and directories before normalization
 *   const { files: filePaths, directories } = splitPathsByKind(files);
 *
 *   // Check for specific file patterns
 *   const hasModFile = filePaths.some(f => f.endsWith(".esp") || f.endsWith(".esm"));
 *
 *   return {
 *     supported: hasModFile,
 *     requiredFiles: [],
 *   };
 * };
 * ```
 */
export type TestSupported = (
  files: string[],
  gameId: string,
  archivePath?: string,
  details?: ITestSupportedDetails,
) => PromiseLike<ISupportedResult>;
