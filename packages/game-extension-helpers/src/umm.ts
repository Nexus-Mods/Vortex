/**
 * Shared Unity Mod Manager (UMM) support for Vortex game extensions.
 *
 * Call `registerUmmSupport` during extension init to register:
 *   - the UMM tool installer (detects `UnityModManager.exe` archives)
 *   - the "umm" mod type (deploys to `<gamePath>/UnityModManager/`)
 *
 * This replaces the runtime `requireExtension("modtype-umm")` dependency
 * with a compile-time import, making each game extension self-contained.
 */
import * as path from "path";

import type { types } from "vortex-api";

export const UMM_EXE = "UnityModManager.exe";
export const UMM_MOD_TYPE = "umm";
const UMM_INSTALLER_ID = "umm-installer";
const UMM_INSTALLER_PRIORITY = 15;

function isUmmExe(filePath: string): boolean {
  return path.basename(filePath).toLowerCase() === UMM_EXE.toLowerCase();
}

function testUmmTool(
  files: string[],
  gameId: string,
  supportedGameIds: ReadonlySet<string>,
): Promise<types.ISupportedResult> {
  const supported = supportedGameIds.has(gameId) && files.some(isUmmExe);
  return Promise.resolve({ supported, requiredFiles: [] });
}

function installUmmTool(files: string[]): Promise<types.IInstallResult> {
  const execFile = files.find(isUmmExe);
  if (!execFile) {
    return Promise.reject(new Error("UMM executable not found in archive"));
  }
  const idx = execFile.lastIndexOf(UMM_EXE);
  const instructions: types.IInstruction[] = files
    .filter((f) => !f.endsWith(path.sep) && !f.endsWith("/"))
    .map((file) => ({
      type: "copy" as const,
      source: file,
      destination: file.substring(idx),
    }));
  instructions.push({ type: "setmodtype", value: UMM_MOD_TYPE });
  instructions.push({
    type: "attribute",
    key: "customFileName",
    value: "Unity Mod Manager",
  });
  return Promise.resolve({ instructions });
}

/**
 * Minimal context surface needed by `registerUmmSupport`. Typed as a
 * structural subset so callers can pass a real `IExtensionContext` or a
 * test-harness stub without hitting Bluebird type mismatches.
 */
interface UmmContext {
  registerInstaller: (
    id: string,
    priority: number,
    testSupported: (
      files: string[],
      gameId: string,
    ) => Promise<{ supported: boolean; requiredFiles: string[] }>,
    install: (files: string[]) => Promise<{ instructions: unknown[] }>,
  ) => void;
  registerModType: (
    id: string,
    priority: number,
    isSupported: (gameId: string) => boolean,
    getPath: (game: { id: string }) => string | undefined,
    test: () => Promise<boolean>,
    options?: Record<string, unknown>,
  ) => void;
}

interface UmmOptions {
  /** Callback that returns the discovered game path, or undefined if not discovered. */
  getDiscoveryPath: (gameId: string) => string | undefined;
}

/**
 * Register UMM tool installer and mod type for the given game IDs.
 *
 * @param context  Extension context (or any object with registerInstaller / registerModType)
 * @param gameIds  Set of Vortex game IDs this extension supports
 * @param options  Callbacks for resolving game state
 */
export function registerUmmSupport(
  context: UmmContext,
  gameIds: ReadonlySet<string>,
  options: UmmOptions,
): void {
  context.registerInstaller(
    UMM_INSTALLER_ID,
    UMM_INSTALLER_PRIORITY,
    (files: string[], gameId: string) => testUmmTool(files, gameId, gameIds),
    installUmmTool,
  );

  context.registerModType(
    UMM_MOD_TYPE,
    15,
    (gameId: string) => gameIds.has(gameId),
    (game: { id: string }) => {
      const gamePath = options.getDiscoveryPath(game.id);
      if (!gamePath) return undefined;
      return path.join(gamePath, "UnityModManager");
    },
    () => Promise.resolve(false),
    { mergeMods: true, name: "Unity Mod Manager", deploymentEssential: false },
  );
}
