import { describe, it, expect } from "vitest";

import {
  parseDuckDBVersion,
  buildExtensionUrl,
  validateExtensionLock,
  getLockedExtensionArtifact,
  assertSha256Matches,
  getLocalExtensionArtifactPath,
  type IExtensionConfig,
  type IExtensionLockFile,
} from "./download-duckdb-extensions";

describe("parseDuckDBVersion", () => {
  it("strips the -r.X suffix and prepends v", () => {
    expect(parseDuckDBVersion("1.5.1-r.1")).toBe("v1.5.1");
  });

  it("works with higher revision numbers", () => {
    expect(parseDuckDBVersion("1.10.0-r.42")).toBe("v1.10.0");
  });

  it("throws on unexpected version format", () => {
    expect(() => parseDuckDBVersion("1.5.1")).toThrow(/unexpected/i);
    expect(() => parseDuckDBVersion("1.5.1-rc.1")).toThrow(/unexpected/i);
    expect(() => parseDuckDBVersion("not-a-version")).toThrow(/unexpected/i);
  });
});

describe("buildExtensionUrl", () => {
  it("builds a correct http extension URL", () => {
    const url = buildExtensionUrl({
      type: "http",
      name: "level_pivot",
      repository: "https://halgari.github.io/duckdb-level-pivot/current_release",
      version: "v1.5.1",
      platform: "windows_amd64",
    });
    expect(url).toBe(
      "https://halgari.github.io/duckdb-level-pivot/current_release/v1.5.1/windows_amd64/level_pivot.duckdb_extension.gz",
    );
  });

  it("builds a correct community extension URL", () => {
    const url = buildExtensionUrl({
      type: "community",
      name: "delta",
      version: "v1.5.1",
      platform: "linux_amd64",
    });
    expect(url).toBe(
      "https://community-extensions.duckdb.org/v1/v1.5.1/linux_amd64/delta.duckdb_extension.gz",
    );
  });

  it("throws when http extension is missing repository", () => {
    expect(() =>
      buildExtensionUrl({
        type: "http",
        name: "my_ext",
        version: "v1.5.1",
        platform: "windows_amd64",
      }),
    ).toThrow(/repository/i);
  });
});

describe("validateExtensionLock", () => {
  const config: IExtensionConfig = {
    platforms: ["windows_amd64", "linux_amd64"],
    outputDir: "build/duckdb-extensions",
    extensions: [
      {
        name: "level_pivot",
        type: "http",
        repository: "https://nexus-mods.github.io/duckdb-level-pivot/current_release",
      },
    ],
  };

  const lock: IExtensionLockFile = {
    version: 1,
    duckdbVersion: "v1.5.1",
    extensions: [
      {
        name: "level_pivot",
        platforms: {
          windows_amd64: {
            url: "https://example.invalid/windows.gz",
            sha256: "windows-hash",
          },
          linux_amd64: {
            url: "https://example.invalid/linux.gz",
            sha256: "linux-hash",
          },
        },
      },
    ],
  };

  it("accepts a lockfile that covers the config and DuckDB version", () => {
    expect(() => validateExtensionLock(config, lock, "v1.5.1")).not.toThrow();
  });

  it("throws when the lockfile DuckDB version is stale", () => {
    expect(() => validateExtensionLock(config, lock, "v1.5.2")).toThrow(/v1\.5\.1.*v1\.5\.2/);
  });

  it("throws when an extension is missing from the lockfile", () => {
    expect(() =>
      validateExtensionLock(
        {
          ...config,
          extensions: [...config.extensions, { name: "delta", type: "community" }],
        },
        lock,
        "v1.5.1",
      ),
    ).toThrow(/delta/);
  });

  it("throws when a platform is missing from the lockfile", () => {
    expect(() =>
      validateExtensionLock(
        {
          ...config,
          platforms: [...config.platforms, "osx_amd64"],
        },
        lock,
        "v1.5.1",
      ),
    ).toThrow(/osx_amd64/);
  });

  it("returns a locked artifact URL for an extension and platform", () => {
    expect(getLockedExtensionArtifact(lock, "level_pivot", "linux_amd64").url).toBe(
      "https://example.invalid/linux.gz",
    );
  });
});

describe("assertSha256Matches", () => {
  it("accepts matching hashes", () => {
    expect(() => assertSha256Matches("ABC123", "abc123", "artifact.gz")).not.toThrow();
  });

  it("throws with both hashes when they differ", () => {
    expect(() => assertSha256Matches("expected", "actual", "artifact.gz")).toThrow(
      /expected expected, got actual/,
    );
  });
});

describe("getLocalExtensionArtifactPath", () => {
  it("matches the Flatpak prefetched source layout", () => {
    expect(
      getLocalExtensionArtifactPath(
        "/run/build/vortex/flatpak-duckdb-extensions",
        "v1.5.1",
        "linux_amd64",
        "level_pivot",
      ),
    ).toBe(
      "/run/build/vortex/flatpak-duckdb-extensions/v1.5.1/linux_amd64/level_pivot.duckdb_extension.gz",
    );
  });
});
