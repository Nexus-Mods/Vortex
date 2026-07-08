import { DataInvalid, DownloadError, UserCanceled } from "@vortex/shared/errors";
import { describe, it, expect } from "vitest";

import { classifyErrorCode } from "./error-code";

describe("classifyErrorCode", () => {
  it("derives tokens from Vortex typed error class names", () => {
    expect(classifyErrorCode(new UserCanceled())).toBe("user_canceled");
    expect(classifyErrorCode(new DataInvalid("x"))).toBe("data_invalid");
  });

  it("maps DownloadError payload codes", () => {
    expect(classifyErrorCode(new DownloadError({ code: "resolver-error" }, "x"))).toBe(
      "resolver_error",
    );
    expect(
      classifyErrorCode(
        new DownloadError({ code: "network-timeout", url: new URL("http://x") }, "x"),
      ),
    ).toBe("timeout");
    expect(classifyErrorCode(new DownloadError({ code: "cancellation" }, "x"))).toBe(
      "user_canceled",
    );
  });

  it("classifies a DownloadError rehydrated across IPC (name only, prototype lost)", () => {
    // A rehydrated DownloadError: plain Error with the name preserved and the payload
    // reattached as an own property.
    const wire = Object.assign(new Error("x"), { payload: { code: "fs-error" } });
    wire.name = "DownloadError";
    expect(classifyErrorCode(wire)).toBe("fs_error");
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
