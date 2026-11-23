import type { IState } from "../../../../types/IState";
import toPluginId from "../../../gamebryo_plugin_management/util/toPluginId";
import type { PluginState } from "../../../installer_fomod_shared/types/snapshot";
import { hasLoadOrder, hasSessionPlugins } from "../../../installer_fomod_shared/utils/guards";

/**
 * How a FOMOD condition's plugin path reads against the live plugin list.
 *
 * This mirrors what the installer itself asks Vortex while it runs: `IsPresent` is "the
 * plugin list knows this name at all", and `IsActive` is "it is enabled or native", which
 * is the same pair `SharedDelegates` answers with. Keeping the two in step matters - if
 * this disagreed with the installer, the check would report drift that has not happened.
 *
 * Returns undefined when nothing in the game manages plugins, which the evaluator reads as
 * "no plugin can be present" rather than as an unknown.
 */
export const pluginStateLookup = (
  state: IState,
): ((pluginPath: string) => PluginState | undefined) => {
  if (!hasSessionPlugins(state.session)) {
    return () => undefined;
  }

  const pluginList = state.session.plugins?.pluginList ?? {};
  const hasLoadOrderSlice = hasLoadOrder(state);

  return (pluginPath: string): PluginState => {
    const id = toPluginId(pluginPath);
    const plugin = pluginList[id];
    if (plugin === undefined) {
      return "Missing";
    }
    if (plugin.isNative) {
      // A native plugin's load order is the engine's, so it is always loaded.
      return "Active";
    }
    if (!hasLoadOrderSlice) {
      return "Inactive";
    }
    const enabled = state.loadOrder[id]?.enabled;
    return enabled === true || enabled === "ghost" ? "Active" : "Inactive";
  };
};

/**
 * The plugins a mod ships, from its recorded install file list.
 *
 * An option gated on the mod's own plugin is not a user-actionable gap: the plugin arrives
 * with the mod, so it is absent only while the mod is not deployed.
 */
export const pluginsShippedBy = (files: string[] | undefined): Set<string> => {
  const shipped = new Set<string>();
  for (const file of files ?? []) {
    const lower = file.toLowerCase();
    if (lower.endsWith(".esp") || lower.endsWith(".esm") || lower.endsWith(".esl")) {
      shipped.add(toPluginId(file));
    }
  }
  return shipped;
};
