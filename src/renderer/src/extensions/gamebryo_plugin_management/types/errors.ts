import type { ICycleEdge } from "./ILoot";

// a kind without payload
type NoPayload = Record<never, never>;

/** Every error kind plugin management raises, merged into the shared catalog. */
declare module "@vortex/shared/errors" {
  interface VortexErrorKindMap {
    /** The plugin rules form a cycle; the edges walk it. */
    "loot:cyclic-interaction": { cycle: ICycleEdge[] };
    /** libloot rejected plugins it could not load or parse. */
    "loot:invalid-plugin": { plugins: string[] };
    /** A load failed because a plugin's master is not loaded; libloot names the master. */
    "loot:master-not-loaded": { master: string };
    /** A plugin is assigned to a group neither the masterlist nor the userlist defines. */
    "loot:missing-group": { group: string };
    /** A masterlist condition could not be evaluated; a version check names the executable. */
    "loot:condition-failed": { executable?: string };
    /** The libloot worker process died, on this call and with this socket error code. */
    "loot:process-died": { call?: string; code?: string };
    /** The worker answered with something that is not a message. */
    "loot:invalid-response": { call?: string; frameBytes?: number };
    /** Another process opened the worker's pipe, this many times, and the worker still started. */
    "loot:stray-connection": { count: number };
    /** The worker rejected the arguments a call gave it, which is this side's mistake. */
    "loot:api-misuse": { detail: string };
    /** LOOT's native library could not be loaded; blocked when Application Control refused it. */
    "loot:library-failed": { reason: string; blocked: boolean };
    /** A libloot call that failed for no recognised reason or did not answer. */
    "loot:failed": NoPayload;
  }
}
