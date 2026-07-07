import type { FileSystemErrorCode } from "@nexusmods/contracts";
import { describe, expect, it } from "vitest";

import { downloadErrorToWire, wireToDownloadError } from "./download-errors";
import { DownloadError } from "./types/errors";

const fsErrorReason = (err: unknown): FileSystemErrorCode | undefined =>
  err instanceof DownloadError && err.payload.code === "fs-error" ? err.payload.reason : undefined;

describe("download-errors wire codec", () => {
  it("preserves the fs-error reason across the wire", () => {
    const wire = downloadErrorToWire(
      new DownloadError(
        {
          code: "fs-error",
          path: "C:/tmp/__vortex_tmp_0001",
          reason: "no space",
          isTransient: false,
        },
        "Failed to write to C:/tmp/__vortex_tmp_0001: no space",
      ),
    );
    const wireReason = wire.payload.code === "fs-error" ? wire.payload.reason : undefined;
    expect(wireReason).toBe("no space");

    const rebuilt = wireToDownloadError(wire);
    expect(rebuilt).toBeInstanceOf(DownloadError);
    expect(fsErrorReason(rebuilt)).toBe("no space");
    expect(rebuilt.message).toContain("no space");
  });

  it("preserves the transient flag across the wire", () => {
    const wire = downloadErrorToWire(
      new DownloadError(
        { code: "fs-error", path: "C:/tmp/x", reason: "generic", isTransient: true },
        "Failed to write to C:/tmp/x",
      ),
    );
    const isTransient = wire.payload.code === "fs-error" ? wire.payload.isTransient : undefined;
    expect(isTransient).toBe(true);
  });

  it("tolerates an fs-error with no reason", () => {
    const rebuilt = wireToDownloadError(
      downloadErrorToWire(
        new DownloadError({ code: "fs-error", path: "C:/tmp/x" }, "Failed to write to C:/tmp/x"),
      ),
    );
    expect(rebuilt).toBeInstanceOf(DownloadError);
    expect(fsErrorReason(rebuilt)).toBeUndefined();
  });
});
