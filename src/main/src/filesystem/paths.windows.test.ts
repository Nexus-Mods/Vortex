import {
  PathProviderError,
  PathResolverError,
  QualifiedPath,
} from "@vortex/fs";
import { homedir, tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import { WindowsPathProviderImpl } from "./paths.windows";

describe("WindowsPathProviderImpl.resolve", () => {
  const provider = new WindowsPathProviderImpl();

  it("converts forward slashes to native backslashes", async () => {
    const qp = QualifiedPath.parse("windows://C:/Users/alice/file.txt");
    expect(await provider.resolve(qp)).toBe("C:\\Users\\alice\\file.txt");
  });

  it("leaves drive-only paths intact", async () => {
    const qp = QualifiedPath.parse("windows://C:");
    expect(await provider.resolve(qp)).toBe("C:");
  });

  it("rejects unsupported schemes", async () => {
    const qp = QualifiedPath.parse("linux:///home/alice");
    await expect(provider.resolve(qp)).rejects.toBeInstanceOf(
      PathResolverError,
    );
  });
});

describe("WindowsPathProviderImpl.fromBase", () => {
  const provider = new WindowsPathProviderImpl();

  it("returns USERPROFILE (or homedir fallback) for 'home'", async () => {
    const qp = await provider.fromBase("home");
    expect(qp.scheme).toBe("windows");
    // Whatever USERPROFILE / homedir() returned must round-trip through the
    // scheme with forward slashes.
    const expected = (process.env["USERPROFILE"] ?? homedir()).replace(
      /\\/g,
      "/",
    );
    expect(qp.path).toBe(expected);
  });

  it("returns tmpdir() for 'temp'", async () => {
    const qp = await provider.fromBase("temp");
    expect(qp.scheme).toBe("windows");
    expect(qp.path).toBe(tmpdir().replace(/\\/g, "/"));
  });

  it("rejects unknown bases", async () => {
    await expect(
      provider.fromBase("nope" as unknown as "home"),
    ).rejects.toBeInstanceOf(PathProviderError);
  });
});

describe("WindowsPathProviderImpl.enumerateDrives", () => {
  it.runIf(process.platform === "win32")(
    "returns at least one drive on Windows",
    async () => {
      const provider = new WindowsPathProviderImpl();
      const drives = await provider.enumerateDrives();
      expect(drives.length).toBeGreaterThan(0);
      for (const d of drives) {
        expect(d.scheme).toBe("windows");
        // Drive root path shape is like "C:/"
        expect(d.path).toMatch(/^[A-Z]:\/?$/);
      }
    },
  );

  it.runIf(process.platform !== "win32")(
    "returns an empty array on non-Windows",
    async () => {
      const provider = new WindowsPathProviderImpl();
      const drives = await provider.enumerateDrives();
      expect(drives).toEqual([]);
    },
  );
});
