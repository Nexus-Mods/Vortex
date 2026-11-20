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
 * What to do about a plugin that could not be parsed:
 * - "stale": its file is gone, so the plugin list is out of date and needs a rescan
 * - "report": a failure nobody has heard of yet
 * - "known": the same failure as last time
 */
export type ParseFailureVerdict = "stale" | "report" | "known";

// where a missing file stands: waiting for a rescan, or still listed after one
type FailureState = "awaiting-rescan" | "rescanned" | "reported";

/**
 * Remembers which plugins failed to parse, so a list that is parsed over and over reports each
 * failure once. A missing file is not a failure of the plugin: it only counts once a rescan of
 * the plugin list still names it.
 */
export class ParseFailures {
  // keyed by the plugin's file path
  private mFailures = new Map<string, { code: string; state: FailureState }>();

  /** Record that the plugin at filePath failed to parse, and say what that calls for. */
  public failed(filePath: string, err: unknown): ParseFailureVerdict {
    const code = getErrorCode(err) ?? "";
    const known = this.mFailures.get(filePath);
    const sameFailure = known?.code === code;
    if (code !== "ENOENT") {
      if (sameFailure) {
        return "known";
      }
      this.mFailures.set(filePath, { code, state: "reported" });
      return "report";
    }
    if (sameFailure && known.state === "reported") {
      return "known";
    }
    if (sameFailure && known.state === "rescanned") {
      known.state = "reported";
      return "report";
    }
    this.mFailures.set(filePath, { code, state: "awaiting-rescan" });
    return "stale";
  }

  /** The plugin at filePath parsed, so a later failure of it is news again. */
  public parsed(filePath: string): void {
    this.mFailures.delete(filePath);
  }

  /** The missing files a rescan of the plugin list has not looked for yet. */
  public awaitingRescan(): string[] {
    return [...this.mFailures]
      .filter(([, failure]) => failure.state === "awaiting-rescan")
      .map(([filePath]) => filePath);
  }

  /** The plugin list was rescanned: a file from missing that it still names is a real failure. */
  public rescanned(missing: string[]): void {
    for (const filePath of missing) {
      const failure = this.mFailures.get(filePath);
      if (failure?.state === "awaiting-rescan") {
        failure.state = "rescanned";
      }
    }
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
