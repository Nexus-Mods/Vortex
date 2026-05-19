/**
 * Default copy-all installer for game extensions.
 *
 * Registers a low-priority installer that accepts any archive for the given
 * game IDs and copies every non-directory entry to its relative path. This
 * mirrors Vortex's built-in fallback behavior, making it explicit and
 * testable in the game-extension-test harness.
 */
import * as path from "path";

const DEFAULT_INSTALLER_PRIORITY = 200;

interface InstallerContext {
  registerInstaller: (...args: unknown[]) => void;
}

/**
 * Register a catch-all copy installer at low priority for the given game IDs.
 * This should run after all specific installers (UMM tool, etc.) so it only
 * handles archives that no higher-priority installer claimed.
 */
export function registerDefaultModInstaller(
  context: InstallerContext,
  installerId: string,
  gameIds: ReadonlySet<string>,
): void {
  const registerInstaller = context.registerInstaller as (
    id: string,
    priority: number,
    testSupported: (
      files: string[],
      gameId: string,
    ) => Promise<{ supported: boolean; requiredFiles: string[] }>,
    install: (
      files: string[],
    ) => Promise<{ instructions: Array<{ type: string; source?: string; destination?: string }> }>,
  ) => void;

  registerInstaller(
    installerId,
    DEFAULT_INSTALLER_PRIORITY,
    (files: string[], gameId: string) => {
      const hasDataFiles = files.some(
        (f) => !f.endsWith("/") && !f.endsWith("\\") && !f.endsWith(path.sep),
      );
      return Promise.resolve({
        supported: gameIds.has(gameId) && hasDataFiles,
        requiredFiles: [],
      });
    },
    (files: string[]) => {
      const instructions = files
        .filter((f) => !f.endsWith("/") && !f.endsWith("\\") && !f.endsWith(path.sep))
        .map((f) => ({ type: "copy" as const, source: f, destination: f }));
      return Promise.resolve({ instructions });
    },
  );
}
