/**
 * Type guard that checks whether a value is "thenable".
 */
export function isPromiseLike<T = unknown>(value: unknown): value is PromiseLike<T> {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object" && typeof value !== "function") return false;
  return "then" in value && typeof value.then === "function";
}
