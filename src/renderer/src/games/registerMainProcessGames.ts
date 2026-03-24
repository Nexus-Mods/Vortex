import type { IExtensionContext } from "../types/IExtensionContext";

import { MainProcessGameBridge } from "./MainProcessGameBridge";
import { MainProcessInstallerBridge } from "./MainProcessInstallerBridge";

/**
 * Fetch all games and installers registered in the main process and register them
 * with the extension context.
 *
 * Call this from within a `context.once("setup", ...)` hook so it runs before
 * game discovery while still having access to `context.registerGame` and
 * `context.registerInstaller`.
 *
 * Usage (inside an extension's main function):
 *
 *   context.once("setup", async () => {
 *     await registerMainProcessGames(context);
 *   });
 */
export async function registerMainProcessGames(
  context: IExtensionContext,
): Promise<void> {
  const [games, installers] = await Promise.all([
    window.api.gameAdaptors.list(),
    window.api.installerAdaptors.list(),
  ]);

  for (const meta of games) {
    context.registerGame(new MainProcessGameBridge(meta));
  }

  for (const meta of installers) {
    const bridge = new MainProcessInstallerBridge(meta);
    context.registerInstaller(
      bridge.id,
      bridge.priority,
      bridge.testSupported,
      bridge.install,
    );
  }
}
