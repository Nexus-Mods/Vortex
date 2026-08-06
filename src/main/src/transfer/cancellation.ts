/**
 * Cancellation detection shared by the download and upload transfer paths.
 * Both drive `got` with an `AbortSignal`, so both see the same two shapes.
 */
import { AbortError } from "got";

export function isCancellation(err: unknown): boolean {
  // NOTE(erri120): The `got` package throws a custom `AbortError` class on cancellation
  if (err instanceof AbortError) return true;

  // NOTE(erri120): The `p-queue` package and anything else using `AbortController`
  // throw a `DOMException` with `name = "AbortError` instead.
  return err instanceof DOMException && err.name === "AbortError";
}
