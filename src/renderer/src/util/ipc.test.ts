import { afterEach, describe, expect, it, vi } from "vitest";
import * as os from "os";
import * as path from "path";

describe("getIPCPath", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns a Unix socket path on Linux", async () => {
    vi.stubGlobal("process", { ...process, platform: "linux" });
    const { getIPCPath } = await import("./ipc");
    expect(getIPCPath("my-id")).toBe(path.join(os.tmpdir(), "vortex-my-id.sock"));
  });

  it("returns a named pipe path on Windows", async () => {
    vi.stubGlobal("process", { ...process, platform: "win32" });
    const { getIPCPath } = await import("./ipc");
    expect(getIPCPath("my-id")).toBe(path.join("\\\\?\\pipe", "my-id"));
  });

  it("handles ids with slashes gracefully", async () => {
    vi.stubGlobal("process", { ...process, platform: "linux" });
    const { getIPCPath } = await import("./ipc");
    const result = getIPCPath("vortex/elevated-12345");
    // On Linux: should produce a valid path under tmpdir
    expect(result).toContain(os.tmpdir());
    expect(result).toContain(".sock");
  });
});
