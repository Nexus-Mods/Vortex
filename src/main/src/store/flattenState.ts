export interface StateLeaf {
  key: string[];
  value: unknown;
}

/**
 * Flatten a nested state object into one leaf entry per primitive/array value,
 * keyed by its path. Used to write a state backup into the leaf-per-row
 * persistor (see Application.importBackup).
 *
 * Recurses into plain objects only; null, undefined, primitives and arrays are
 * leaf values (arrays are stored whole). Appends to a shared `result`
 * accumulator rather than `result.push(...flattenState(...))` - spreading a
 * large array into push throws "Maximum call stack size exceeded" once it
 * passes a few hundred thousand elements, which a large profile's persistent
 * hive easily reaches. See GH#23355.
 */
export function flattenState(
  obj: unknown,
  prefix: string[] = [],
  result: StateLeaf[] = [],
): StateLeaf[] {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    result.push({ key: prefix, value: obj });
    return result;
  }

  if (Array.isArray(obj)) {
    result.push({ key: prefix, value: obj });
    return result;
  }

  for (const [key, value] of Object.entries(obj)) {
    flattenState(value, [...prefix, key], result);
  }
  return result;
}
