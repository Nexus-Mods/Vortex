import type { DiffOperation } from "@vortex/shared/ipc";

/**
 * Check if a value is a plain object (not null, not array)
 */
function isObject(state: unknown): state is Record<string, unknown> {
  return state !== null && typeof state === "object" && !Array.isArray(state);
}

/**
 * Compute the diff operations needed to transform oldState into newState.
 * Returns an array of DiffOperation objects that can be sent over IPC
 * for persistence in the main process.
 *
 * @param oldState - The previous state
 * @param newState - The new state
 * @param path - Current path in the state tree (used for recursion)
 * @returns Array of diff operations (set/remove)
 */
export function computeStateDiff<T>(
  oldState: T,
  newState: T,
  path: string[] = [],
): DiffOperation[] {
  // No change - no operations needed
  if (oldState === newState) {
    return [];
  }

  const operations: DiffOperation[] = [];

  if (isObject(oldState) && isObject(newState)) {
    // Both are objects - compare keys recursively
    const oldKeys = Object.keys(oldState);
    const newKeys = Object.keys(newState);

    // Process keys that exist in oldState
    for (const key of oldKeys) {
      const currentPath = [...path, key];

      if (newState[key] === undefined) {
        // Key was removed - collect all remove operations for this subtree
        operations.push(...collectRemoveOperations(currentPath, oldState[key]));
      } else if (oldState[key] !== newState[key]) {
        // Key exists in both but value changed - recurse
        operations.push(
          ...computeStateDiff(oldState[key], newState[key], currentPath),
        );
      }
      // If oldState[key] === newState[key], no operation needed
    }

    // Process keys that only exist in newState (additions)
    for (const key of newKeys) {
      if (oldState[key] === undefined && newState[key] !== undefined) {
        const currentPath = [...path, key];
        // Key was added - collect all set operations for this subtree
        operations.push(...collectSetOperations(currentPath, newState[key]));
      }
    }
  } else {
    // At least one is not an object (leaf node change)
    if (newState !== undefined) {
      // Value changed or added
      if (isObject(newState)) {
        // New value is an object - add all its leaf values
        operations.push(...collectSetOperations(path, newState));
      } else {
        // New value is a primitive
        operations.push({ type: "set", path, value: newState });
      }
    } else {
      // Value was removed
      if (isObject(oldState)) {
        // Old value was an object - remove all its leaf values
        operations.push(...collectRemoveOperations(path, oldState));
      } else {
        // Old value was a primitive
        operations.push({ type: "remove", path });
      }
    }
  }

  return operations;
}

/**
 * Collect all set operations needed to persist an entire state subtree.
 * Recursively traverses objects to find all leaf values.
 */
function collectSetOperations(path: string[], state: unknown): DiffOperation[] {
  if (state === undefined) {
    return [];
  }

  if (isObject(state)) {
    const operations: DiffOperation[] = [];
    for (const key of Object.keys(state)) {
      operations.push(...collectSetOperations([...path, key], state[key]));
    }
    return operations;
  }

  // Leaf value - create set operation
  return [{ type: "set", path, value: state }];
}

/**
 * Collect all remove operations needed to clear an entire state subtree.
 * Recursively traverses objects to find all leaf values.
 */
function collectRemoveOperations(
  path: string[],
  state: unknown,
): DiffOperation[] {
  if (isObject(state)) {
    const operations: DiffOperation[] = [];
    for (const key of Object.keys(state)) {
      operations.push(...collectRemoveOperations([...path, key], state[key]));
    }
    return operations;
  }

  // Leaf value - create remove operation
  return [{ type: "remove", path }];
}

/**
 * Compute diffs for multiple hives, returning a map of hive -> operations.
 * Only includes hives that have changes.
 *
 * @param oldState - The previous full state
 * @param newState - The new full state
 * @param hives - List of hive names to check for changes
 * @returns Map of hive name to diff operations
 */
export function computeStateDiffByHive<T extends Record<string, unknown>>(
  oldState: T,
  newState: T,
  hives: string[],
): Map<string, DiffOperation[]> {
  const result = new Map<string, DiffOperation[]>();

  for (const hive of hives) {
    if (oldState[hive] !== newState[hive]) {
      const operations = computeStateDiff(oldState[hive], newState[hive]);
      if (operations.length > 0) {
        result.set(hive, operations);
      }
    }
  }

  return result;
}
