import type { IExtensionContext } from "../../types/IExtensionContext";
import local from "../../util/local";
import { resolveGameVersion } from "./util/getGameVersion";

// oh boy
const $ = local<{
  getGameVersion: typeof resolveGameVersion | undefined;
}>("gameversion-manager", {
  getGameVersion: undefined,
});

function init(context: IExtensionContext): boolean {
  // set synchronously at init time so that gamemode_management's once()
  // -> setupGameMode -> getInstalledVersion always finds it (ExtensionManager
  // loads this extension before gamemode_management)
  $.getGameVersion = resolveGameVersion;

  return true;
}

export default init;
