import type { IInstallResult } from "./IInstallResult";

import type { IModReference } from "./IMod";

export type ProgressDelegate = (perc: number) => void;
export interface IInstallationDetails {
  // At time of writing, this is primarily used to avoid using stop patterns
  //  when instructions are being overridden by an instructions override file.
  hasInstructionsOverrideFile?: boolean;
  modReference?: IModReference;
  hasXmlConfigXML?: boolean;
  hasCSScripts?: boolean;
  isTrusted?: boolean;
}

/**
 * Installation function signature for mod installers.
 *
 * ## Arguments
 *
 * @param files - Array of installer-relative paths containing **mixed content** —
 *   both files and directories. Directories are marked by trailing `/` or `\`
 *   separators. **Important:** Normalization strips these trailing separators,
 *   so you cannot distinguish files from directories after normalization.
 * @param destinationPath - Absolute path where mod files should be installed.
 * @param gameId - Identifier for the target game.
 * @param progressDelegate - Callback to report installation progress (0-100).
 * @param choices - Optional user selections from installer prompts.
 * @param unattended - Whether the installation runs without user interaction.
 * @param archivePath - Optional path to the original archive file.
 * @param options - Additional installation context and flags.
 *
 * ## Returns
 *
 * @returns Promise resolving to an {@link IInstallResult} with installation instructions.
 *
 * ## Examples
 *
 * Handling mixed files and directories with `splitPathsByKind()`:
 *
 * ```typescript
 * import { splitPathsByKind } from "@vortex/game-extension-helpers";
 *
 * const install: InstallFunc = async (files, destinationPath, gameId) => {
 *   // Separate files and directories before normalization
 *   const { files: filePaths, directories } = splitPathsByKind(files);
 *
 *   // filePaths: ["Data/ModFile.esp", "Data/Textures/Diffuse.dds"]
 *   // directories: ["Data/Textures", "Data/Meshes"]
 *
 *   return {
 *     instructions: filePaths.map(file => ({
 *       type: "copy",
 *       source: file,
 *       destination: file,
 *     })),
 *   };
 * };
 * ```
 *
 * ## See Also
 *
 * - [splitPathsByKind][] from `@vortex/game-extension-helpers` — separates
 *   mixed installer paths into normalized files and directories.
 */
export type InstallFunc = (
  files: string[],
  destinationPath: string,
  gameId: string,
  progressDelegate: ProgressDelegate,
  choices?: any,
  unattended?: boolean,
  archivePath?: string,
  options?: IInstallationDetails,
) => PromiseLike<IInstallResult>;
