import type { DiffOperation } from "@vortex/shared/ipc";

/**
 * Check if a value is a plain object (not null, not array, not Date or other
 * built-in objects that have no enumerable own properties).
 * Non-plain objects like Date must be treated as leaf values, otherwise
 * collectSetOperations/collectRemoveOperations silently drop them because
 * Object.keys() returns [].
 */
function isObject(state: unknown): state is Record<string, unknown> {
  return (
    state != null &&
    typeof state === "object" &&
    !Array.isArray(state) &&
    Object.getPrototypeOf(state) === Object.prototype
  );
}

/**
 * Compute the diff operations needed to transform oldState into newState.
 * Returns an array of DiffOperation objects that can be sent over IPC
 * for persistence in the main process. Recursively append.
 *
 * @param oldState - The previous state
 * @param newState - The new state
 * @param path - Current path in the state tree (used for recursion)
 * @param operations - Accumulator the recursion appends to
 * @returns Array of diff operations (set/remove)
 */
export function computeStateDiff<T>(
  oldState: T,
  newState: T,
  path: string[] = [],
  operations: DiffOperation[] = [],
): DiffOperation[] {
  // No change - no operations needed
  if (oldState === newState) {
    return operations;
  }

  if (isObject(oldState) && isObject(newState)) {
    // Both are objects - compare keys recursively
    const oldKeys = Object.keys(oldState);
    const newKeys = Object.keys(newState);

    // Process keys that exist in oldState
    for (const key of oldKeys) {
      const currentPath = [...path, key];

      if (newState[key] === undefined) {
        // Key was removed. Emit a remove at the container path first - the
        // persistence layer treats removes as subtree removals (key + any
        // descendants), so this single op handles the case where the value
        // was stored as a JSON blob at the intermediate path (non-plain
        // objects, e.g. Date or Error instances, take that branch in
        // collectSetOperations and end up as one row at currentPath).
        // For object subtrees, also emit leaf removes: exact-match persistors
        // (tests, mocks) need them, and so does persistDiffMiddleware's
        // per-path coalescing - a later set to the container path supersedes
        // this remove in the pending queue, leaving the leaf removes to clear
        // the old rows. For primitives the container-path remove covers it.
        operations.push({ type: "remove", path: currentPath });
        if (isObject(oldState[key])) {
          collectRemoveOperations(currentPath, oldState[key], operations);
        }
      } else if (oldState[key] !== newState[key]) {
        // Key exists in both but value changed - recurse
        computeStateDiff(oldState[key], newState[key], currentPath, operations);
      }
      // If oldState[key] === newState[key], no operation needed
    }

    // Process keys that only exist in newState (additions)
    for (const key of newKeys) {
      if (oldState[key] === undefined && newState[key] !== undefined) {
        const currentPath = [...path, key];
        // Key was added - collect all set operations for this subtree
        collectSetOperations(currentPath, newState[key], operations);
      }
    }
  } else {
    // At least one is not an object (leaf node change)
    if (newState !== undefined) {
      // Value changed or added
      if (isObject(newState)) {
        // New value is an object - add all its leaf values
        collectSetOperations(path, newState, operations);
      } else {
        // New value is a primitive
        operations.push({ type: "set", path, value: newState });
      }
    } else {
      // Value was removed. Always emit a remove at this path (see the
      // object-key removal branch above for why the container-path remove
      // matters under prefix-delete and why the leaf removes are required).
      operations.push({ type: "remove", path });
      if (isObject(oldState)) {
        collectRemoveOperations(path, oldState, operations);
      }
    }
  }

  return operations;
}

/**
 * Collect all set operations needed to persist an entire state subtree.
 * Recursively traverses objects to find all leaf values, appending to `operations`.
 */
function collectSetOperations(
  path: string[],
  state: unknown,
  operations: DiffOperation[] = [],
): DiffOperation[] {
  if (state === undefined) {
    return operations;
  }

  if (isObject(state)) {
    for (const key of Object.keys(state)) {
      collectSetOperations([...path, key], state[key], operations);
    }
    return operations;
  }

  // Leaf value - create set operation
  operations.push({ type: "set", path, value: state });
  return operations;
}

/**
 * Collect all remove operations needed to clear an entire state subtree.
 * Recursively traverses objects to find all leaf values, appending to `operations`.
 */
function collectRemoveOperations(
  path: string[],
  state: unknown,
  operations: DiffOperation[] = [],
): DiffOperation[] {
  if (isObject(state)) {
    for (const key of Object.keys(state)) {
      collectRemoveOperations([...path, key], state[key], operations);
    }
    return operations;
  }

  // Leaf value - create remove operation
  operations.push({ type: "remove", path });
  return operations;
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
