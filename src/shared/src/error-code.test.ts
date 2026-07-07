import { describe, it, expect } from "vitest";

import { classifyErrorCode, errorNameToToken } from "./error-code";
import {
  ArchiveBrokenError,
  DataInvalid,
  DownloadError,
  HTTPError,
  InsufficientDiskSpace,
  NotFound,
  ProcessCanceled,
  UserCanceled,
} from "./types/errors";

describe("errorNameToToken", () => {
  it("converts PascalCase to snake_case", () => {
    expect(errorNameToToken("UserCanceled")).toBe("user_canceled");
    expect(errorNameToToken("InsufficientDiskSpace")).toBe("insufficient_disk_space");
  });

  it("handles trailing acronyms and acronym runs", () => {
    expect(errorNameToToken("HTTPError")).toBe("http_error");
    expect(errorNameToToken("TypeError")).toBe("type_error");
  });
});

describe("classifyErrorCode", () => {
  it("derives tokens from Vortex typed error class names", () => {
    expect(classifyErrorCode(new UserCanceled())).toBe("user_canceled");
    expect(classifyErrorCode(new ProcessCanceled("x"))).toBe("process_canceled");
    expect(classifyErrorCode(new DataInvalid("x"))).toBe("data_invalid");
    expect(classifyErrorCode(new InsufficientDiskSpace("C:"))).toBe("insufficient_disk_space");
    expect(classifyErrorCode(new NotFound("x"))).toBe("not_found");
    expect(classifyErrorCode(new HTTPError(500, "boom", "http://x"))).toBe("http_error");
    expect(classifyErrorCode(new ArchiveBrokenError("f", "corrupt"))).toBe("archive_broken_error");
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
    // reattached as an own property (Object.assign keeps the inferred type, no narrowing cast).
    const wire = Object.assign(new Error("x"), { payload: { code: "fs-error" } });
    wire.name = "DownloadError";
    expect(classifyErrorCode(wire)).toBe("fs_error");
  });

  it("normalizes known Node codes and passes through the rest", () => {
    const enospc = Object.assign(new Error("full"), { code: "ENOSPC" });
    expect(classifyErrorCode(enospc)).toBe("insufficient_disk_space");
    const reset = Object.assign(new Error("reset"), { code: "ECONNRESET" });
    expect(classifyErrorCode(reset)).toBe("ECONNRESET");
  });

  it("prefers a Node code over the generic Error name", () => {
    const err = Object.assign(new Error("nope"), { code: "ENOENT" });
    expect(classifyErrorCode(err)).toBe("file_not_found");
  });

  it("falls back to unknown_error for a bare Error and non-errors", () => {
    expect(classifyErrorCode(new Error("plain"))).toBe("unknown_error");
    expect(classifyErrorCode("just a string")).toBe("unknown_error");
    expect(classifyErrorCode(undefined)).toBe("unknown_error");
    expect(classifyErrorCode(null)).toBe("unknown_error");
  });
});
