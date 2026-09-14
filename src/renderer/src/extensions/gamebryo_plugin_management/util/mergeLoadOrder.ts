import type { IPluginLoadOrderEntry } from "../types/IPluginLoadOrderEntry";
import type { IPluginCombined } from "../types/IPlugins";

export function mergeLoadOrder(
  plugins: IPluginCombined[],
  // keyed by plugin id
  loadOrder: Record<string, IPluginLoadOrderEntry>,
): IPluginCombined[] {
  return plugins.map((plugin) => {
    const entry = loadOrder[plugin.id];
    const enabled = entry?.enabled ?? false;
    const position = entry?.loadOrder;
    return plugin.enabled === enabled && plugin.loadOrder === position
      ? plugin
      : { ...plugin, enabled, loadOrder: position };
  });
}
