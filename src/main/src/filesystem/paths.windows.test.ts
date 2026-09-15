import { homedir, tmpdir } from "node:os";

import { NativePathResolver, PathProviderError, QualifiedPath } from "@vortex/shared/filesystem";
import { describe, expect, it } from "vitest";

import { WindowsPathProviderImpl } from "./paths.windows";

describe("WindowsPathProviderImpl.fromBase", () => {
  const provider = new WindowsPathProviderImpl();
  const resolver = new NativePathResolver();

  it.runIf(process.platform === "win32")(
    "returns USERPROFILE (or homedir fallback) for 'home'",
    async () => {
      const qp = await provider.fromBase("home");
      expect(qp.scheme).toBe("native");
      // Round-trip: resolve back to the OS-canonical native path.
      const native = await resolver.resolve(qp);
      const expected = process.env["USERPROFILE"] ?? homedir();
      expect(native).toBe(expected);
    },
  );

  it.runIf(process.platform === "win32")("returns tmpdir() for 'temp'", async () => {
    const qp = await provider.fromBase("temp");
    expect(qp.scheme).toBe("native");
    const native = await resolver.resolve(qp);
    expect(native).toBe(tmpdir());
  });

  it("rejects unknown bases", async () => {
    await expect(provider.fromBase("nope" as unknown as "home")).rejects.toBeInstanceOf(
      PathProviderError,
    );
  });
});

describe("WindowsPathProviderImpl.enumerateDrives", () => {
  it.runIf(process.platform === "win32")("returns at least one drive on Windows", async () => {
    const provider = new WindowsPathProviderImpl();
    const resolver = new NativePathResolver();
    const drives = await provider.enumerateDrives();
    expect(drives.length).toBeGreaterThan(0);
    for (const drive of drives) {
      expect(drive.scheme).toBe("native");
      // Drive roots are rooted paths that keep their trailing separator
      expect(drive.root).toMatch(/^[A-Za-z]:\/$/);
      expect(await resolver.resolve(drive)).toMatch(/^[A-Za-z]:\\$/);
    }
  });

  it("returns an empty list on non-Windows platforms", async () => {
    if (process.platform === "win32") return;
    const provider = new WindowsPathProviderImpl();
    const drives = await provider.enumerateDrives();
    expect(drives).toEqual([]);
  });
});

describe("QualifiedPath.fromNative for Windows paths", () => {
  it.runIf(process.platform === "win32")("maps home to a rooted native path", async () => {
    const provider = new WindowsPathProviderImpl();
    const qp = await provider.fromBase("home");
    expect(qp.root).toMatch(/^[A-Za-z]:\/$/);
    expect(qp.path).toBe(qp.root);
  });
});

describe("QualifiedPath", () => {
  it("keeps the drive letter casing of the raw input", () => {
    expect(QualifiedPath.fromNative("c:\\Users\\alice").value).toBe("native://c:/Users/alice");
    expect(QualifiedPath.fromNative("C:\\Users\\alice").value).toBe("native://C:/Users/alice");
  });
});
