import { unknownToError } from "@vortex/shared";
import { VortexError, type VortexErrorData } from "@vortex/shared/errors";

import type { ICycleEdge } from "../types/ILoot";
import { invalidPluginsFromError } from "./invalidPlugins";

// a kind without payload
type NoPayload = Record<never, never>;

// libloot kinds belong to plugin management, declared next to the classifier that produces them
declare module "@vortex/shared/errors" {
  interface VortexErrorKindMap {
    /** The plugin rules form a cycle; the edges walk it. */
    "loot:cyclic-interaction": { cycle: ICycleEdge[] };
    /** libloot rejected plugins it could not load or parse. */
    "loot:invalid-plugin": { plugins: string[] };
    /** A plugin is assigned to a group neither the masterlist nor the userlist defines. */
    "loot:missing-group": { group: string };
    /** A masterlist condition could not be evaluated; a version check names the executable. */
    "loot:condition-failed": { executable?: string };
    /** The libloot worker process died. */
    "loot:process-died": NoPayload;
    /** A libloot call that failed for no recognised reason or did not answer. */
    "loot:failed": NoPayload;
  }
}

const MISSING_GROUP = /The group "([^"]*)" does not exist/;
const CONDITION_EXECUTABLE = /Failed to evaluate condition ".*version\("([^"]*\.exe)",.*/;

/** The raw error a libloot call rejected with, classified into its loot kind. */
export function toLootError(raw: unknown): VortexError {
  const err = unknownToError(raw) as Error & { plugin?: unknown; cycle?: unknown };
  const wrap = (data: VortexErrorData) => new VortexError(err.message, data, { cause: raw });

  if (err.message.startsWith("Cyclic interaction")) {
    const cycle = Array.isArray(err.cycle) ? (err.cycle as ICycleEdge[]) : [];
    return wrap({ kind: "loot:cyclic-interaction", cycle });
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
