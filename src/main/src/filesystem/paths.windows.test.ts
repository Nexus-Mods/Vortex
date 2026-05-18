import { homedir, tmpdir } from "node:os";

import { PathProviderError, PathResolverError, QualifiedPath } from "@nexusmods/adaptor-api/fs";
import { describe, expect, it } from "vitest";

import { WindowsPathProviderImpl } from "./paths.windows";

describe("WindowsPathProviderImpl.resolve", () => {
  const provider = new WindowsPathProviderImpl();

  it("maps rooted drive-letter paths to native Windows paths", async () => {
    const qp = QualifiedPath.parse("windows:///C/Users/alice/file.txt");
    expect(await provider.resolve(qp)).toBe("C:\\Users\\alice\\file.txt");
  });

  it("maps drive-only paths to the drive root", async () => {
    const qp = QualifiedPath.parse("windows:///C");
    expect(await provider.resolve(qp)).toBe("C:\\");
  });

  it("uppercases lowercase drive letters on resolve", async () => {
    const qp = QualifiedPath.parse("windows:///c/Users/alice");
    expect(await provider.resolve(qp)).toBe("C:\\Users\\alice");
  });

  it("rejects unsupported schemes", async () => {
    const qp = QualifiedPath.parse("linux:///home/alice");
    await expect(provider.resolve(qp)).rejects.toBeInstanceOf(PathResolverError);
  });

  it("rejects non-rooted paths", async () => {
    // No leading '/' — the parse grammar would tolerate `windows://C/...`
    // (the `//` before `C` is treated as the data separator), so we guard
    // at resolve time.
    const qp = QualifiedPath.parse("windows://C//Users/alice");
    await expect(provider.resolve(qp)).rejects.toBeInstanceOf(PathResolverError);
  });

  it("rejects paths whose first component is not a single drive letter", async () => {
    const qp = QualifiedPath.parse("windows:///CD/Users");
    await expect(provider.resolve(qp)).rejects.toBeInstanceOf(PathResolverError);
  });
});

describe("WindowsPathProviderImpl.fromBase", () => {
  const provider = new WindowsPathProviderImpl();

  it.runIf(process.platform === "win32")(
    "returns USERPROFILE (or homedir fallback) for 'home'",
    async () => {
      const qp = await provider.fromBase("home");
      expect(qp.scheme).toBe("windows");
      // Round-trip: resolve back to native matches the source value (modulo
      // drive-letter casing).
      const native = await provider.resolve(qp);
      const expected = (process.env["USERPROFILE"] ?? homedir()).replace(
        /^([a-z]):/,
        (_, c: string) => `${c.toUpperCase()}:`,
      );
      expect(native).toBe(expected);
    },
  );

  it.runIf(process.platform === "win32")("returns tmpdir() for 'temp'", async () => {
    const qp = await provider.fromBase("temp");
    expect(qp.scheme).toBe("windows");
    const native = await provider.resolve(qp);
    const expected = tmpdir().replace(/^([a-z]):/, (_, c: string) => `${c.toUpperCase()}:`);
    expect(native).toBe(expected);
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
    const drives = await provider.enumerateDrives();
    expect(drives.length).toBeGreaterThan(0);
    for (const d of drives) {
      expect(d.scheme).toBe("windows");
      // Drive-only paths look like "/C" in the new encoding.
      expect(d.path).toMatch(/^\/[A-Z]$/);
    }
  });

  it.runIf(process.platform !== "win32")("returns an empty array on non-Windows", async () => {
    const provider = new WindowsPathProviderImpl();
    const drives = await provider.enumerateDrives();
    expect(drives).toEqual([]);
  });
});
