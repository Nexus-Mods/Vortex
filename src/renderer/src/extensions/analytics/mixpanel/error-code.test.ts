import { DataInvalid, UserCanceled, VortexError } from "@vortex/shared/errors";
import { describe, it, expect } from "vitest";

import { classifyErrorCode } from "./error-code";

describe("classifyErrorCode", () => {
  it("derives tokens from Vortex typed error class names", () => {
    expect(classifyErrorCode(new UserCanceled())).toBe("user_canceled");
    expect(classifyErrorCode(new DataInvalid("x"))).toBe("data_invalid");
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
