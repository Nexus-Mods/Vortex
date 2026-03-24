/**
 * Provides a small shared helper for Bluebird wrapping.
 */
import Bluebird from "bluebird";

/** Wraps an async function and returns a Bluebird-compatible function. */
export function toBlue<T>(
  func: (...args: any[]) => Promise<T>,
): (...args: any[]) => Bluebird<T> {
  return (...args: any[]) => Bluebird.resolve(func(...args));
}
