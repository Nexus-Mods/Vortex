import { unknownToError } from "@vortex/shared";
import { VortexError, type VortexErrorData } from "@vortex/shared/errors";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { NAMESPACE } from "../statics";
import type { ICycleEdge, ILootFailure } from "../types/ILoot";
import { invalidPluginsFromError } from "./invalidPlugins";

const MASTER_NOT_LOADED = /^The plugin "([^"]+)" has not been loaded/i;
// node-loot's binding rejects an argument it was handed, so the call was built wrong on this side
const API_MISUSE = /^parameter \d+ expected to be/i;
const MISSING_GROUP = /The group "([^"]*)" does not exist/;
const CONDITION_EXECUTABLE = /Failed to evaluate condition ".*version\("([^"]*\.exe)",.*/;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

/** The raw error a libloot call rejected with, classified into its loot kind. */
export function toLootError(raw: unknown): VortexError {
  const err = unknownToError(raw) as Error & {
    plugin?: unknown;
    cycle?: unknown;
    func?: unknown;
    call?: unknown;
    code?: unknown;
    frameBytes?: unknown;
  };
  const wrap = (data: VortexErrorData) => new VortexError(err.message, data, { cause: raw });

  if (err.message.startsWith("Cyclic interaction")) {
    const cycle = Array.isArray(err.cycle) ? (err.cycle as ICycleEdge[]) : [];
    return wrap({ kind: "loot:cyclic-interaction", cycle });
  }
  // node-loot tags the failing call; only a load phrases it this way, and only about a master
  const master = MASTER_NOT_LOADED.exec(err.message);
  if (master !== null && err.func === "loadPlugins") {
    return wrap({ kind: "loot:master-not-loaded", master: master[1] });
  }
  // sortPlugins is handed the full list, so a plugin the load path dropped comes back as
  // PluginNotLoaded with the name as a structured field; parse failures name it in the message
  if (err.name === "PluginNotLoaded" && typeof err.plugin === "string" && err.plugin.length > 0) {
    return wrap({ kind: "loot:invalid-plugin", plugins: [err.plugin] });
  }
  const invalid = invalidPluginsFromError(err.message);
  if (invalid.length > 0) {
    return wrap({ kind: "loot:invalid-plugin", plugins: invalid });
  }
  const group = MISSING_GROUP.exec(err.message);
  if (group !== null) {
    return wrap({ kind: "loot:missing-group", group: group[1] });
  }
  if (err.message.includes("Failed to evaluate condition")) {
    return wrap({
      kind: "loot:condition-failed",
      executable: CONDITION_EXECUTABLE.exec(err.message)?.[1],
    });
  }
  // a call on an instance this code closed (game switch, restart): our cancel, not a libloot fault
  if (err.message.toLowerCase() === "already closed") {
    return wrap({ kind: "process-canceled" });
  }
  if (err.name === "RemoteDied") {
    return wrap({ kind: "loot:process-died", call: asString(err.call), code: asString(err.code) });
  }
  if (err.name === "InvalidResponse") {
    return wrap({
      kind: "loot:invalid-response",
      call: asString(err.call),
      frameBytes: typeof err.frameBytes === "number" ? err.frameBytes : undefined,
    });
  }
  if (API_MISUSE.test(err.message)) {
    return wrap({ kind: "loot:api-misuse", detail: err.message });
  }
  return wrap({ kind: "loot:failed" });
}

/**
 * What to tell the user about a classified loot failure, in the LOOT application's words where it
 * has them. An unrecognised kind says so and points at the log. A cycle is not here: it has its own
 * dialog, which renders the path and offers a way out.
 */
export function describeLootError(
  translate: IExtensionApi["translate"],
  err: VortexError,
): ILootFailure {
  const options = { ns: NAMESPACE };
  switch (err.data.kind) {
    case "loot:missing-group":
      return {
        severity: "warning",
        message: translate('the group "{{group}}" does not exist', {
          replace: { group: err.data.group },
          ...options,
        }),
      };
    case "loot:invalid-plugin":
      return {
        severity: "warning",
        message: translate("LOOT could not parse {{plugins}}", {
          replace: { plugins: err.data.plugins.join(", ") },
          ...options,
        }),
      };
    case "loot:condition-failed":
      return {
        severity: "error",
        message: translate("a masterlist condition could not be evaluated", options),
      };
    case "loot:process-died":
      return { severity: "error", message: translate("LOOT stopped unexpectedly", options) };
    case "loot:invalid-response":
      return { severity: "error", message: translate("LOOT answered unintelligibly", options) };
    case "loot:api-misuse":
      return {
        severity: "error",
        message: translate("Vortex asked LOOT for something it could not accept", options),
      };
    default:
      return {
        severity: "error",
        message: translate(
          "something went wrong in LOOT; the details are in the Vortex log",
          options,
        ),
      };
  }
}
