import { parseError } from "@vortex/shared";
import {
  DataInvalid,
  SetupError,
  UserCanceled,
  VortexError,
  deserializeVortexError,
  serializeVortexError,
} from "@vortex/shared/errors";
import { describe, it, expect } from "vitest";

import { classifyErrorCode } from "./error-code";

/** How an error reaches the renderer from main: rebuilt from `data` alone, so
 *  the concrete class, the `name` and any Node `code` are gone. */
const acrossIpc = (err: Error): VortexError =>
  deserializeVortexError(serializeVortexError(parseError(err)));

describe("classifyErrorCode", () => {
  it("derives tokens from Vortex typed error class names", () => {
    expect(classifyErrorCode(new UserCanceled())).toBe("user_canceled");
    expect(classifyErrorCode(new DataInvalid("x"))).toBe("data_invalid");
  });

  it("gives an error the same token whether or not it crossed IPC", () => {
    for (const err of [new UserCanceled(), new DataInvalid("x"), new SetupError("x", "comp")]) {
      expect(classifyErrorCode(acrossIpc(err))).toBe(classifyErrorCode(err));
    }
  });

  it("classifies a rehydrated error by kind, not by its lost class name", () => {
    const wire = acrossIpc(new DataInvalid("x"));
    // The wire form rebuilds a base VortexError, so `name` is no longer a signal.
    expect(wire.name).toBe("VortexError");
    expect(classifyErrorCode(wire)).toBe("data_invalid");
  });

  it("keeps the raw OS code for kinds that carry no cause of their own", () => {
    // os:generic is a catch-all; the errno is the only signal, and after the
    // round trip it survives only on data.originalCode.
    const busy = Object.assign(new Error("resource busy"), {
      code: "EBUSY",
      errno: -4082,
      syscall: "unlink",
    });
    expect(classifyErrorCode(acrossIpc(busy))).toBe("ebusy");
  });

  it("falls back to unknown_error for an unattributable rehydrated error", () => {
    expect(classifyErrorCode(new VortexError("mystery", { kind: "unknown" }))).toBe(
      "unknown_error",
    );
  });

  it("maps VortexError data.kind for download-side kinds", () => {
    expect(classifyErrorCode(new VortexError("x", { kind: "download:resolver-error" }))).toBe(
      "resolver_error",
    );
    expect(classifyErrorCode(new VortexError("x", { kind: "http:timeout", url: "http://x" }))).toBe(
      "timeout",
    );
    expect(classifyErrorCode(new VortexError("x", { kind: "user-canceled", skipped: false }))).toBe(
      "user_canceled",
    );
  });

  it("funnels any fs:* kind to fs_error without enumerating every variant", () => {
    expect(
      classifyErrorCode(
        new VortexError("x", {
          kind: "fs:no-space",
          path: "/disk",
          originalCode: "ENOSPC",
          errno: 28,
          syscall: "write",
        }),
      ),
    ).toBe("fs_error");
  });

  it("passes a raw Node/OS error code through lowercased when there is no typed signal", () => {
    // Stopgap behaviour — see the TODO in error-code.ts. Pins the passthrough so the
    // eventual project-wide node-error classification replaces it deliberately.
    const enospc = Object.assign(new Error("disk full"), { code: "ENOSPC" });
    expect(classifyErrorCode(enospc)).toBe("enospc");
  });

  it("falls back to unknown_error for a bare Error and non-errors", () => {
    expect(classifyErrorCode(new Error("plain"))).toBe("unknown_error");
    expect(classifyErrorCode("just a string")).toBe("unknown_error");
    expect(classifyErrorCode(undefined)).toBe("unknown_error");
    expect(classifyErrorCode(null)).toBe("unknown_error");
  });
});
