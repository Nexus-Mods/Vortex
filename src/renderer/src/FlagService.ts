import type { FeatureFlag, KnownFlagName } from "@vortex/shared/flags";
import type { FlagMetricsBucket } from "@vortex/shared/ipc";

const METRICS_INTERVAL_MS = 60_000;

type EvalEntry = { yes: number; no: number; variants: Record<string, number> };
type EvalCounts = Record<string, EvalEntry>;
type FlagByName<N extends KnownFlagName> = Extract<FeatureFlag, { name: N }>;

export type SubscribeCallback = (flags: ReadonlyMap<KnownFlagName, FeatureFlag>) => void;

/**
 * Renderer-side singleton that owns the feature flag lifecycle:
 * - Subscribes to flag pushes from main via window.api.featureFlags.onSynchronize
 * - Tracks evaluation metrics for every getFlag call
 * - Periodically flushes metrics to main via window.api.featureFlags.reportMetrics
 *
 * Initialize once near app startup with FlagService.init(), destroy on quit
 * with FlagService.instance.destroy(). destroy() resets the instance so
 * re-initialization is possible (useful in tests).
 */
export class FlagService {
  #flags: ReadonlyMap<KnownFlagName, FeatureFlag> = new Map();
  #evalCounts: EvalCounts = {};
  #bucketStart: number;
  #subscribers: Set<SubscribeCallback> = new Set();
  #flagSubscribers: Map<
    KnownFlagName,
    Set<(prev: FeatureFlag | undefined, next: FeatureFlag | undefined) => void>
  > = new Map();
  #unsubscribeIpc: () => void;
  #intervalId: ReturnType<typeof setInterval>;

  static #instance: FlagService | undefined = undefined;

  private constructor() {
    this.#bucketStart = Date.now();

    this.#unsubscribeIpc = window.api.featureFlags.onSynchronize((updated) => {
      const prev = this.#flags;
      this.#flags = new Map(updated.map((f) => [f.name, f]));

      for (const cb of this.#subscribers) {
        cb(this.#flags);
      }

      for (const [name, subs] of this.#flagSubscribers) {
        const prevFlag = prev.get(name);
        const nextFlag = this.#flags.get(name);
        if (prevFlag === nextFlag) continue;
        for (const cb of subs) {
          cb(prevFlag, nextFlag);
        }
      }
    });

    this.#intervalId = setInterval(() => this.#flush(), METRICS_INTERVAL_MS);
  }

  /** Initialize the singleton. Throws if already initialized without a prior destroy(). */
  static init(): FlagService {
    if (this.#instance !== undefined) {
      throw new Error("FlagService is already initialized!");
    }

    this.#instance = new FlagService();
    return this.#instance;
  }

  /** Returns the initialized instance or undefined if not initialized. */
  static get instance(): FlagService | undefined {
    return this.#instance;
  }

  /** Destroys the instance if one exists. No-op if not yet initialized. Safe to call from beforeunload. */
  static destroyIfInitialized(): void {
    this.#instance?.destroy();
  }

  /**
   * Unsubscribes from IPC, clears the flush interval, and flushes any
   * remaining metrics. Resets the singleton so init() can be called again.
   */
  destroy(): void {
    this.#unsubscribeIpc();
    clearInterval(this.#intervalId);
    this.#flush();
    FlagService.#instance = undefined;
  }

  /**
   * Returns the current flag map. Primarily for React context providers that
   * need to expose the full map to consumers.
   */
  get flags(): ReadonlyMap<KnownFlagName, FeatureFlag> {
    return this.#flags;
  }

  /**
   * Returns the flag for the given name if it is enabled, or undefined if it
   * is absent. Records a yes/no evaluation count (and variant count) for
   * metrics reporting regardless of where the call originates.
   */
  getFlag<N extends KnownFlagName>(name: N): FlagByName<N> | undefined {
    const flag = this.#flags.get(name) as FlagByName<N> | undefined;
    const entry = (this.#evalCounts[name] ??= { yes: 0, no: 0, variants: {} });
    if (flag !== undefined) {
      entry.yes++;
      if (flag.variant) {
        entry.variants[flag.variant.name] = (entry.variants[flag.variant.name] ?? 0) + 1;
      }
    } else {
      entry.no++;
    }
    return flag;
  }

  /**
   * Subscribes to flag map changes. The callback is invoked synchronously
   * inside the onSynchronize handler each time main pushes updated flags.
   * Returns an unsubscribe function.
   *
   * Does not count towards metrics.
   */
  subscribe(callback: SubscribeCallback): () => void {
    this.#subscribers.add(callback);
    return () => {
      this.#subscribers.delete(callback);
    };
  }

  /**
   * Subscribes to value changes for a single named flag. The callback receives
   * the previous and next flag values (either may be undefined if the flag was
   * absent before or after the update). Only called when the value actually
   * changes between synchronizations. Returns an unsubscribe function.
   *
   * Does not count towards metrics.
   */
  subscribeToFlag<N extends KnownFlagName>(
    name: N,
    callback: (prev: FlagByName<N> | undefined, next: FlagByName<N> | undefined) => void,
  ): () => void {
    let subs = this.#flagSubscribers.get(name);
    if (subs === undefined) {
      subs = new Set();
      this.#flagSubscribers.set(name, subs);
    }

    subs.add(callback);
    return () => {
      subs.delete(callback);
      if (subs.size === 0) {
        this.#flagSubscribers.delete(name);
      }
    };
  }

  #flush(): void {
    const counts = this.#evalCounts;
    const start = this.#bucketStart;
    const stop = Date.now();

    this.#evalCounts = {};
    this.#bucketStart = stop;

    if (Object.keys(counts).length === 0) return;

    const toggles: FlagMetricsBucket["toggles"] = {};
    for (const [name, entry] of Object.entries(counts)) {
      toggles[name] = {
        yes: entry.yes,
        no: entry.no,
        ...(Object.keys(entry.variants).length > 0 && { variants: entry.variants }),
      };
    }
    window.api.featureFlags.reportMetrics({ start, stop, toggles });
  }
}
