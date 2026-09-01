import type { VortexErrorKind } from "@vortex/shared";
import { VortexError } from "@vortex/shared";
import { assert, expect } from "vitest";

/**
 * Asserts that `err` is a {@link VortexError}, narrowing it for the rest of
 * the scope. Throws otherwise via vitest's `assert`.
 *
 * With a `kind` argument, additionally asserts `err.data.kind === kind` and
 * narrows to `VortexError<kind>` so the typed payload is accessible.
 */
export function assertVortexError(err: unknown): asserts err is VortexError;
export function assertVortexError<K extends VortexErrorKind = VortexErrorKind>(
  err: unknown,
  kind: K,
): asserts err is VortexError<K>;
export function assertVortexError(err: unknown, kind?: VortexErrorKind): void {
  assert(err instanceof VortexError);
  if (kind !== undefined) {
    expect(err.data).toMatchObject({
      kind: kind,
    });
  }
}
