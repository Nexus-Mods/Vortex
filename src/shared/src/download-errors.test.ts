import { describe, expect, it } from "vitest";

import { downloadErrorToWire, wireToDownloadError } from "./download-errors";
import { DownloadError } from "./types/errors";

const fsErrorErrno = (err: unknown): string | undefined =>
  err instanceof DownloadError && err.payload.code === "fs-error" ? err.payload.errno : undefined;

describe("download-errors wire codec", () => {
  it("preserves the fs-error errno across the wire", () => {
    const wire = downloadErrorToWire(
      new DownloadError(
        { code: "fs-error", path: "C:/tmp/__vortex_tmp_0001", errno: "ENOSPC" },
        "Failed to write to C:/tmp/__vortex_tmp_0001 (ENOSPC)",
      ),
    );
    const wireErrno = wire.payload.code === "fs-error" ? wire.payload.errno : undefined;
    expect(wireErrno).toBe("ENOSPC");

    const rebuilt = wireToDownloadError(wire);
    expect(rebuilt).toBeInstanceOf(DownloadError);
    expect(fsErrorErrno(rebuilt)).toBe("ENOSPC");
    expect(rebuilt.message).toContain("ENOSPC");
  });

  it("tolerates an fs-error with no errno", () => {
    const rebuilt = wireToDownloadError(
      downloadErrorToWire(
        new DownloadError({ code: "fs-error", path: "C:/tmp/x" }, "Failed to write to C:/tmp/x"),
      ),
    );
    expect(rebuilt).toBeInstanceOf(DownloadError);
    expect(fsErrorErrno(rebuilt)).toBeUndefined();
  });
});
