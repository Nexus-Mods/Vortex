import { afterEach, describe, expect, it, vi } from "vitest";
import * as os from "os";
import * as path from "path";

import { getIPCPath } from "./ipc.js";

describe("getIPCPath", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a Unix socket path on Linux", () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("linux" as NodeJS.Platform);
    expect(getIPCPath("my-id")).toBe(path.join(os.tmpdir(), "vortex-my-id.sock"));
  });

  it("returns a named pipe path on Windows", () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("win32" as NodeJS.Platform);
    expect(getIPCPath("my-id")).toBe(path.join("\\\\?\\pipe", "my-id"));
  });

  it("handles ids with slashes gracefully", () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("linux" as NodeJS.Platform);
    const result = getIPCPath("vortex/elevated-12345");
    // On Linux: should produce a valid path under tmpdir
    expect(result).toContain(os.tmpdir());
    expect(result).toContain(".sock");
  });
});
