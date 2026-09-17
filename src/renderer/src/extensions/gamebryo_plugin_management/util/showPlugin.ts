import { setAttributeFilter } from "../../../actions/tables";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { activeGameId } from "../../profile_management/selectors";
import { gameSupported } from "./gameSupport";

/** A bbcode link that opens the Plugins page filtered to the named plugin. */
export const pluginLink = (name: string) => `[link="cb://showplugin/${name}"]${name}[/link]`;

/** The health-check callbacks behind pluginLink. */
export function showPluginCallbacks(api: IExtensionApi) {
  return {
    showplugin: (pluginName: string) => {
      // the game may have changed since the message was generated
      if (gameSupported(activeGameId(api.getState()))) {
        api.events.emit("show-main-page", "gamebryo-plugins");
        api.store.dispatch(setAttributeFilter("gamebryo-plugins", "name", pluginName));
      }
    },
  };
}
