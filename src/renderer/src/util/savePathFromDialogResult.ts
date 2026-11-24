import type { SaveDialogReturnValue } from "electron";

/**
 * The path the user chose in a save dialog, or undefined if they cancelled.
 *
 * Electron reports a cancelled dialog as `filePath: ''` rather than undefined,
 * so an empty path has to be treated as a cancel too.
 */
export function savePathFromDialogResult(result: SaveDialogReturnValue): string | undefined {
  return result.canceled || !result.filePath ? undefined : result.filePath;
}
