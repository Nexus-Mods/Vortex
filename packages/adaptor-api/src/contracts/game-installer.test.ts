import type { RelativePath } from "@vortex/fs";

import { relativePath } from "@vortex/fs";
import { describe, expect, expectTypeOf, it } from "vitest";

import type { StorePathSnapshot } from "../stores/providers.js";
import type {
  IGameInstallerService,
  InstallMapping,
  StopPattern,
} from "./game-installer.js";
import type { GamePaths } from "./game-paths.js";

import { Base } from "../stores/providers.js";
import { resolveStopPatterns } from "./game-installer.js";

/** Helper to build a RelativePath[] from raw strings in tests. */
const rel = (...parts: string[]): readonly RelativePath[] =>
  parts.map((p) => relativePath(p));

describe("InstallMapping<T>", () => {
  it("accepts any Base as the anchor when T is empty", () => {
    const entry = {} as InstallMapping;
    expectTypeOf(entry.anchor).toEqualTypeOf<Base>();
  });

  it("admits adaptor-declared anchor keys via T", () => {
    const entry = {} as InstallMapping<"saves" | "preferences">;
    expectTypeOf(entry.anchor).toEqualTypeOf<"saves" | "preferences" | Base>();
  });

  it("types source and destination as RelativePath", () => {
    const entry = {} as InstallMapping;
    expectTypeOf(entry.source).toEqualTypeOf<RelativePath>();
    expectTypeOf(entry.destination).toEqualTypeOf<RelativePath>();
  });
});

describe("IGameInstallerService", () => {
  it("exposes an install method taking context, paths, files", () => {
    expectTypeOf<IGameInstallerService["install"]>().parameters.toEqualTypeOf<
      [StorePathSnapshot, GamePaths, readonly RelativePath[]]
    >();
  });

  it("returns Promise<readonly InstallMapping[]>", () => {
    expectTypeOf<
      IGameInstallerService["install"]
    >().returns.resolves.toEqualTypeOf<readonly InstallMapping[]>();
  });

  it("threads T through to both paths and mappings", () => {
    type Svc = IGameInstallerService<"saves">;
    expectTypeOf<Svc["install"]>().parameters.toEqualTypeOf<
      [StorePathSnapshot, GamePaths<"saves">, readonly RelativePath[]]
    >();
    expectTypeOf<Svc["install"]>().returns.resolves.toEqualTypeOf<
      readonly InstallMapping<"saves">[]
    >();
  });
});

describe("resolveStopPatterns — implicit destination", () => {
  it("preserves the whole file path when no wrapper", () => {
    const patterns: StopPattern[] = [
      { match: "archive/pc/mod/*.archive", anchor: Base.Game },
    ];
    const files = rel("archive/pc/mod/foo.archive");
    expect(resolveStopPatterns(patterns, files)).toEqual([
      {
        source: "archive/pc/mod/foo.archive",
        anchor: Base.Game,
        destination: "archive/pc/mod/foo.archive",
      },
    ]);
  });

  it("strips wrapper dirs with **/ prefix", () => {
    const patterns: StopPattern[] = [
      { match: "**/archive/pc/mod/*.archive", anchor: Base.Game },
    ];
    const files = rel(
      "wrapper/archive/pc/mod/foo.archive",
      "a/b/c/archive/pc/mod/bar.archive",
    );
    expect(resolveStopPatterns(patterns, files)).toEqual([
      {
        source: "wrapper/archive/pc/mod/foo.archive",
        anchor: Base.Game,
        destination: "archive/pc/mod/foo.archive",
      },
      {
        source: "a/b/c/archive/pc/mod/bar.archive",
        anchor: Base.Game,
        destination: "archive/pc/mod/bar.archive",
      },
    ]);
  });

  it("matches a single file without wrapper", () => {
    const patterns: StopPattern[] = [
      { match: "**/archive/pc/mod/*.archive", anchor: Base.Game },
    ];
    const files = rel("archive/pc/mod/foo.archive");
    expect(resolveStopPatterns(patterns, files)[0]?.destination).toBe(
      "archive/pc/mod/foo.archive",
    );
  });
});

describe("resolveStopPatterns — first match wins", () => {
  it("picks the earliest matching pattern even when a later one also matches", () => {
    // Both patterns match readme.md; "docs" comes first so it wins.
    const patterns: StopPattern<"docs">[] = [
      { match: "*.md", anchor: "docs" },
      { match: "readme.*", anchor: Base.Game },
    ];
    const out = resolveStopPatterns(patterns, rel("readme.md"));
    expect(out).toEqual([
      { source: "readme.md", anchor: "docs", destination: "readme.md" },
    ]);
  });

  it("routes independent files by their respective first match", () => {
    const patterns: StopPattern<"docs">[] = [
      { match: "*.md", anchor: "docs" },
      { match: "bin/*.exe", anchor: Base.Game },
    ];
    const out = resolveStopPatterns(patterns, rel("readme.md", "bin/foo.exe"));
    expect(out).toEqual([
      { source: "readme.md", anchor: "docs", destination: "readme.md" },
      {
        source: "bin/foo.exe",
        anchor: Base.Game,
        destination: "bin/foo.exe",
      },
    ]);
  });
});

describe("resolveStopPatterns — unmatched files dropped", () => {
  it("silently omits files that match no pattern", () => {
    const patterns: StopPattern[] = [
      { match: "**/archive/pc/mod/*.archive", anchor: Base.Game },
    ];
    const files = rel("foo.archive", "readme.txt");
    expect(resolveStopPatterns(patterns, files)).toEqual([]);
  });
});

describe("resolveStopPatterns — explicit destination", () => {
  it("interpolates template placeholders", () => {
    const patterns: StopPattern[] = [
      {
        match: "*.archive",
        anchor: Base.Game,
        destination: "archive/pc/mod/{basename}",
      },
    ];
    const files = rel("foo.archive");
    expect(resolveStopPatterns(patterns, files)).toEqual([
      {
        source: "foo.archive",
        anchor: Base.Game,
        destination: "archive/pc/mod/foo.archive",
      },
    ]);
  });

  it("supports stem and ext placeholders", () => {
    const patterns: StopPattern[] = [
      {
        match: "*.xl",
        anchor: Base.Game,
        destination: "archive/pc/mod/{stem}.{ext}",
      },
    ];
    const out = resolveStopPatterns(patterns, rel("mod.xl"));
    expect(out[0]?.destination).toBe("archive/pc/mod/mod.xl");
  });

  it("accepts a function destination", () => {
    const patterns: StopPattern[] = [
      {
        match: "*.archive",
        anchor: Base.Game,
        destination: (ctx) => `archive/pc/mod/${ctx.basename}`,
      },
    ];
    const out = resolveStopPatterns(patterns, rel("foo.archive"));
    expect(out[0]?.destination).toBe("archive/pc/mod/foo.archive");
  });

  it("throws on unknown placeholder", () => {
    const patterns: StopPattern[] = [
      {
        match: "*.archive",
        anchor: Base.Game,
        destination: "archive/{nope}",
      },
    ];
    expect(() => resolveStopPatterns(patterns, rel("x.archive"))).toThrow(
      /Unknown destination template placeholder/,
    );
  });
});

describe("resolveStopPatterns — brace alternation", () => {
  it("matches either extension", () => {
    const patterns: StopPattern[] = [
      { match: "**/archive/pc/mod/*.{archive,xl}", anchor: Base.Game },
    ];
    const out = resolveStopPatterns(
      patterns,
      rel("archive/pc/mod/a.archive", "archive/pc/mod/b.xl"),
    );
    expect(out).toHaveLength(2);
    expect(out[0]?.destination).toBe("archive/pc/mod/a.archive");
    expect(out[1]?.destination).toBe("archive/pc/mod/b.xl");
  });
});
