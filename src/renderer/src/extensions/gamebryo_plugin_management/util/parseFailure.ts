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

/**
 * Remembers which plugins failed to parse, so a list that is parsed over and over (on every
 * visit to the page, list change and sort) logs and reports each failure once.
 */
export class ParseFailures {
  // error code of the last failure, keyed by the plugin's file path
  private mFailures = new Map<string, string>();

  /** Record that the plugin at filePath failed to parse; true unless it failed the same way last time. */
  public isNew(filePath: string, err: unknown): boolean {
    const code = getErrorCode(err) ?? "";
    if (this.mFailures.get(filePath) === code) {
      return false;
    }
    this.mFailures.set(filePath, code);
    return true;
  }

  /** The plugin at filePath parsed, so a later failure of it is news again. */
  public parsed(filePath: string): void {
    this.mFailures.delete(filePath);
  }

  /** Forget the plugins the list no longer names. */
  public retain(listedPaths: Iterable<string>): void {
    const listed = new Set(listedPaths);
    for (const filePath of this.mFailures.keys()) {
      if (!listed.has(filePath)) {
        this.mFailures.delete(filePath);
      }
    }
  }
}
