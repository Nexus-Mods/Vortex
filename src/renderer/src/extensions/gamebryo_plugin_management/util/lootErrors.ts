import { unknownToError } from "@vortex/shared";
import { VortexError, type VortexErrorData } from "@vortex/shared/errors";

import type { ICycleEdge } from "../types/ILoot";
import { invalidPluginsFromError } from "./invalidPlugins";

const MASTER_NOT_LOADED = /^The plugin "([^"]+)" has not been loaded/i;
const MISSING_GROUP = /The group "([^"]*)" does not exist/;
const CONDITION_EXECUTABLE = /Failed to evaluate condition ".*version\("([^"]*\.exe)",.*/;

/** The raw error a libloot call rejected with, classified into its loot kind. */
export function toLootError(raw: unknown): VortexError {
  const err = unknownToError(raw) as Error & { plugin?: unknown; cycle?: unknown; func?: unknown };
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
    return wrap({ kind: "loot:process-died" });
  }
  return wrap({ kind: "loot:failed" });
}
