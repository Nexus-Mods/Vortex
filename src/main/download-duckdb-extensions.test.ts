import { describe, it, expect } from "vitest";

import { parseDuckDBVersion, buildExtensionUrl } from "./download-duckdb-extensions";

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
