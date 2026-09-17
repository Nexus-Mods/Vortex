import type { VortexError } from "@vortex/shared/errors";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { recordErrorSpan } from "../../../util/errorHandling";
import { NAMESPACE } from "../statics";
import type { ILootFailure } from "../types/ILoot";
import { describeLootError } from "./lootErrors";
import { definedAttributes, type SpanAttributes } from "./spanAttributes";

/** What Vortex was asking of the worker when it failed. */
export const LootPhase = {
  Init: "init",
  Lists: "lists",
  Sort: "sort",
  Cycle: "cycle",
  Metadata: "metadata",
  LoadPlugins: "load-plugins",
  Worker: "worker",
} as const;

export type LootPhase = (typeof LootPhase)[keyof typeof LootPhase];

/** The notification a phase shows, replaced by its id the next time that phase fails. */
const NOTIFICATION: Record<
  Exclude<LootPhase, typeof LootPhase.Sort>,
  { title: string; id: string }
> = {
  [LootPhase.Init]: { title: "Failed to initialize LOOT", id: "loot-init-failed" },
  [LootPhase.Lists]: {
    title: "Failed to load master-/userlist",
    id: "gamebryo-plugins-loot-lists-error",
  },
  [LootPhase.Metadata]: {
    title: "There were errors getting plugin information from LOOT",
    id: "gamebryo-plugins-loot-meta-error",
  },
  [LootPhase.Cycle]: { title: "Failed to report plugin cycle", id: "loot-cycle-failed" },
  [LootPhase.LoadPlugins]: { title: "Failed to parse plugins", id: "loot-failed-to-parse" },
  [LootPhase.Worker]: { title: "LOOT process died", id: "loot-process-died" },
};

/** How many failures a phase remembers before forgetting them all, so the set stays bounded. */
const MAX_TRACKED_PER_PHASE = 50;

/** How long a cause may be: enough to tell two failures apart, short enough for a span. */
const MAX_CAUSE_LENGTH = 80;

interface ISpanFacts {
  // what separates this failure from others of its kind
  cause: string;
  attributes: SpanAttributes;
}

/** What a failure tells telemetry, or nothing for one that happened inside libloot. */
function spanFacts(err: VortexError): ISpanFacts | undefined {
  switch (err.data.kind) {
    case "loot:process-died":
      return {
        cause: err.data.call ?? "",
        attributes: { "loot.call": err.data.call, "loot.error_code": err.data.code },
      };
    case "loot:invalid-response":
      return {
        cause: err.data.call ?? "",
        attributes: { "loot.call": err.data.call, "loot.frame_bytes": err.data.frameBytes },
      };
    case "loot:api-misuse":
      return { cause: err.data.detail.slice(0, MAX_CAUSE_LENGTH), attributes: {} };
    case "loot:failed":
      // the kind names no call, so its message is what keeps distinct causes apart
      return { cause: err.message.slice(0, MAX_CAUSE_LENGTH), attributes: {} };
    default:
      return undefined;
  }
}

interface IReportOptions {
  /** Extra span attributes for this failure. */
  context?: SpanAttributes;
  /** What to tell the user, where the kind alone does not explain the failure. */
  failure?: ILootFailure;
  /** Set where Vortex puts the worker back by itself, which leaves the user nothing to do. */
  recovering?: boolean;
}

/**
 * Tells the user a libloot call failed, in LOOT's own words, and forwards a failure of the worker
 * itself to telemetry, naming the call it ended. A phase reports once until it works again; the
 * user is told every time.
 */
export class LootErrorReporter {
  readonly #record: typeof recordErrorSpan;
  // per phase, "<kind>|<cause>" for every failure reported since that phase last worked
  #reported = new Map<LootPhase, Set<string>>();

  constructor(record: typeof recordErrorSpan = recordErrorSpan) {
    this.#record = record;
  }

  public report(
    api: IExtensionApi,
    err: VortexError,
    phase: LootPhase,
    options: IReportOptions = {},
  ): void {
    const recovering = options.recovering === true;
    this.#recordSpan(err, phase, { ...options.context, "loot.recovering": recovering });
    if (recovering) {
      return;
    }
    const failure = options.failure ?? describeLootError(api.translate, err);
    if (phase === LootPhase.Sort) {
      this.#notSorted(api, failure);
      return;
    }
    const { title, id } = NOTIFICATION[phase];
    // the span above already carries this failure
    api.showErrorNotification(title, failure.message, {
      id,
      allowReport: false,
      warning: failure.severity === "warning",
    });
  }

  /** A phase clears what it proved working; no phase clears every one, for a new worker. */
  public succeeded(phase?: LootPhase): void {
    if (phase === undefined) {
      this.#reported.clear();
    } else {
      this.#reported.delete(phase);
    }
  }

  #recordSpan(err: VortexError, phase: LootPhase, context: SpanAttributes): void {
    const facts = spanFacts(err);
    if (facts === undefined) {
      return;
    }
    const reported = this.#reported.get(phase) ?? new Set<string>();
    this.#reported.set(phase, reported);
    if (reported.size >= MAX_TRACKED_PER_PHASE) {
      reported.clear();
    }
    const key = `${err.data.kind}|${facts.cause}`;
    if (reported.has(key)) {
      return;
    }
    reported.add(key);
    this.#record(
      "A LOOT call could not be completed",
      err,
      definedAttributes({
        "loot.kind": err.data.kind,
        "loot.phase": phase,
        ...facts.attributes,
        ...context,
      }),
    );
  }

  /** The load order is untouched, and why. */
  #notSorted(api: IExtensionApi, failure: ILootFailure): void {
    api.sendNotification({
      id: "loot-failed",
      type: failure.severity,
      message: api.translate("Plugins not sorted because: {{msg}}", {
        replace: { msg: failure.message },
        ns: NAMESPACE,
      }),
    });
  }
}

export const lootErrorReporter = new LootErrorReporter();
