/**
 * Load Order Contract
 *
 * Allows adaptors to declare one or more load orders for their game.
 * Each load order has a unique ID, display name, and a list of entries
 * that can be reordered by the user. The adaptor owns serialization
 * to/from disk.
 */

import type { GamePaths } from "./game-paths.js";

/**
 * Constraint between two load order entries. The framework applies
 * these when validating user-defined orderings.
 */
export interface LoadOrderRule {
  /** The entry this rule applies to. */
  subject: string;
  /** The type of constraint. */
  type: "before" | "after";
  /** The entry the subject is constrained relative to. */
  reference: string;
  /** Optional human-readable reason shown when the rule is violated. */
  reason?: string;
}

/**
 * A single entry in a load order. The `id` is the stable key used
 * for persistence and rule references. The `name` is for UI display.
 */
export interface LoadOrderEntry {
  /** Stable identifier (e.g. file name, mod ID). */
  id: string;
  /** Display name for the UI. */
  name: string;
  /** Whether this entry is currently enabled. */
  enabled: boolean;
  /** Whether this entry is locked in place (user cannot reorder). */
  locked?: boolean;
  /** Adaptor-specific data opaque to the framework. */
  data?: Record<string, unknown>;
}

/**
 * Describes a single load order managed by the adaptor. A game may
 * have multiple (e.g. Cyberpunk has archive order and REDmod order).
 */
export interface LoadOrderDefinition {
  /** Unique ID for this load order within the adaptor. */
  id: string;
  /** Human-readable name shown in the UI tab/header. */
  displayName: string;
  /** Brief description of what this load order controls. */
  description?: string;
}

/**
 * The full state of a single load order: its entries and any
 * sorting rules the adaptor declares.
 */
export interface LoadOrderState {
  /** Ordered list of entries. Position in the array is the order. */
  entries: LoadOrderEntry[];
  /** Sorting constraints the framework enforces. */
  rules: LoadOrderRule[];
}

/**
 * Adaptor-provided service for declaring and managing load orders.
 * Each game adaptor `@provides` this at its own URI. The generic `T`
 * mirrors the extra key space declared by {@link IGamePathService}.
 */
export interface IGameLoadOrderService<T extends string = never> {
  /**
   * Returns the load order definitions this adaptor supports.
   * Called once during adaptor initialization to discover the UI tabs.
   */
  getLoadOrders(paths: GamePaths<"game" | T>): Promise<LoadOrderDefinition[]>;

  /**
   * Returns the current state of a specific load order, including
   * entries in their current order and any sorting rules.
   */
  getLoadOrderState(paths: GamePaths<"game" | T>, loadOrderId: string): Promise<LoadOrderState>;

  /**
   * Persists a new entry order. Called when the user reorders entries
   * in the UI. The adaptor should update its internal state and return
   * the (possibly adjusted) result.
   */
  setEntryOrder(
    paths: GamePaths<"game" | T>,
    loadOrderId: string,
    entries: LoadOrderEntry[],
  ): Promise<LoadOrderState>;

  /**
   * Notification that the load order should be serialized to disk.
   * Called before game launch or on explicit user request. The adaptor
   * writes to whatever format the game expects (INI, JSON, deploy
   * order, etc.) and resolves when done.
   */
  serializeToDisk(paths: GamePaths<"game" | T>, loadOrderId: string): Promise<void>;
}
