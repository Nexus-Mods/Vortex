import type { ITestSupportedDetails } from "../../mod_management/types/TestSupported";

/**
 * Which registration is asking. `scripted` is the priority-20 installer,
 * `basic` the priority-100 one that only exists to stand in for the native
 * installer's own basic handler.
 */
export type TesterMode = "scripted" | "basic";

// Games whose fomods routinely carry C# scripts. Those go out of process even
// when the native addon is healthy, because it doesn't run C# scripts.
const CSHARP_GAMES = ["oblivion", "fallout3", "falloutnv"];

/**
 * Decide which fomod script types the out-of-process installer claims for an
 * archive.
 *
 * Normally that is C# only. When the native addon can't be loaded, this
 * extension also claims the types the native installer would have handled -
 * otherwise every mod walks down the priority list to mod_management's
 * `fallback` installer, which copies archives verbatim and therefore applies
 * neither the game's stop patterns nor its pluginPath. `ModInstallerIPC.exe` is
 * a separate signed executable, so it typically still runs in the environments
 * that reject the unsigned `.node` addon.
 *
 * Kept free of the IPC plumbing so it stays unit-testable: importing the
 * transport pulls in `@nexusmods/fomod-installer-ipc`, which resolves
 * `vortex-api` only inside a running Vortex.
 */
export const allowedTypesFor = (
  gameId: string,
  details: ITestSupportedDetails | undefined,
  mode: TesterMode,
  nativeAvailable: boolean,
): string[] => {
  if (mode === "basic") {
    // Never compete with the native basic installer, only replace it.
    return nativeAvailable ? [] : ["Basic"];
  }

  const types: string[] = [];
  if (CSHARP_GAMES.includes(gameId) && details?.hasCSScripts !== false) {
    types.push("CSharpScript");
  }
  if (!nativeAvailable && details?.hasXmlConfigXML !== false) {
    types.push("XmlScript");
  }
  return types;
};
