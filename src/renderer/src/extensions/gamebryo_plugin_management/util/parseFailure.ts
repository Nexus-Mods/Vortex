import { getErrorCode } from "@vortex/shared";

import type { IState } from "../../../types/IState";
import type { IPlugin } from "../types/IPlugins";
import { definedAttributes, SpanAttribute } from "./spanAttributes";

/**
 * What telemetry learns about a plugin that could not be parsed: where its path pointed, and the
 * activities running, since a deployment can move files the plugin list still names.
 */
export function parseFailureAttributes(
  pluginId: string,
  plugin: IPlugin,
  err: unknown,
  state: IState,
): Record<string, string | number | boolean> {
  const activity = state.session.base.activity;
  return definedAttributes({
    [SpanAttribute.PluginName]: pluginId,
    [SpanAttribute.ErrorCode]: getErrorCode(err) ?? "",
    [SpanAttribute.PluginDeployed]: plugin.deployed,
    [SpanAttribute.ActivityMods]: (activity.mods ?? []).join(","),
    [SpanAttribute.ActivityPlugins]: (activity.plugins ?? []).join(","),
  });
}
