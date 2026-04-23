import { describe, expect, it } from "vitest";

import { compileGlob, matchGlob } from "./glob.js";

describe("matchGlob — literal patterns", () => {
  it.each([
    ["foo.archive", "foo.archive", "foo.archive"],
    ["a/b/c.txt", "a/b/c.txt", "a/b/c.txt"],
  ])("pattern=%s file=%s → %s", (pattern, file, expected) => {
    expect(matchGlob(pattern, file)).toBe(expected);
  });

  it("rejects non-matching literals", () => {
    expect(matchGlob("foo.archive", "bar.archive")).toBeNull();
  });
});

describe("matchGlob — * (single segment)", () => {
  it("matches files in a single segment", () => {
    expect(matchGlob("*.archive", "foo.archive")).toBe("foo.archive");
    expect(matchGlob("a/*.txt", "a/b.txt")).toBe("a/b.txt");
  });

  it("does not cross slash boundaries", () => {
    expect(matchGlob("*.archive", "sub/foo.archive")).toBeNull();
    expect(matchGlob("a/*.txt", "a/b/c.txt")).toBeNull();
  });
});

describe("matchGlob — ? (single char)", () => {
  it("matches a single non-slash character", () => {
    expect(matchGlob("?.txt", "a.txt")).toBe("a.txt");
    expect(matchGlob("foo?.txt", "foo1.txt")).toBe("foo1.txt");
  });

  it("does not match zero or multiple characters", () => {
    expect(matchGlob("?.txt", ".txt")).toBeNull();
    expect(matchGlob("?.txt", "ab.txt")).toBeNull();
  });

  it("does not match slash", () => {
    expect(matchGlob("a?b", "a/b")).toBeNull();
  });
});

describe("matchGlob — ** (any segments)", () => {
  it("matches zero or more segments when used as wrapper prefix", () => {
    expect(matchGlob("**/foo.txt", "foo.txt")).toBe("foo.txt");
    expect(matchGlob("**/foo.txt", "a/foo.txt")).toBe("foo.txt");
    expect(matchGlob("**/foo.txt", "a/b/c/foo.txt")).toBe("foo.txt");
  });

  it("matches mid-pattern as any intermediate segments", () => {
    expect(matchGlob("a/**/z", "a/z")).toBe("a/z");
    expect(matchGlob("a/**/z", "a/b/z")).toBe("a/b/z");
    expect(matchGlob("a/**/z", "a/b/c/z")).toBe("a/b/c/z");
  });

  it("trailing ** matches any suffix including empty", () => {
    expect(matchGlob("archive/pc/mod/**", "archive/pc/mod/foo.archive")).toBe(
      "archive/pc/mod/foo.archive",
    );
    expect(
      matchGlob("archive/pc/mod/**", "archive/pc/mod/sub/deep/foo.archive"),
    ).toBe("archive/pc/mod/sub/deep/foo.archive");
  });

  it("captures the stable suffix when wrapper-stripped", () => {
    expect(
      matchGlob(
        "**/archive/pc/mod/*.archive",
        "wrapper/archive/pc/mod/foo.archive",
      ),
    ).toBe("archive/pc/mod/foo.archive");
    expect(
      matchGlob("**/archive/pc/mod/*.archive", "archive/pc/mod/foo.archive"),
    ).toBe("archive/pc/mod/foo.archive");
  });
});

describe("matchGlob — {a,b,c} alternation", () => {
  it("matches any alternative", () => {
    expect(matchGlob("*.{archive,xl}", "foo.archive")).toBe("foo.archive");
    expect(matchGlob("*.{archive,xl}", "foo.xl")).toBe("foo.xl");
    expect(matchGlob("*.{archive,xl}", "foo.txt")).toBeNull();
  });

  it("supports alternation inside larger patterns", () => {
    expect(
      matchGlob("archive/pc/{mod,patch}/*.archive", "archive/pc/mod/x.archive"),
    ).toBe("archive/pc/mod/x.archive");
    expect(
      matchGlob(
        "archive/pc/{mod,patch}/*.archive",
        "archive/pc/patch/x.archive",
      ),
    ).toBe("archive/pc/patch/x.archive");
  });

  it("throws on unterminated alternation", () => {
    expect(() => compileGlob("foo/{a,b")).toThrow(/Unterminated/);
  });
});

describe("matchGlob — case insensitivity and regex-meta literals", () => {
  it("matches case-insensitively", () => {
    expect(matchGlob("foo.archive", "FOO.ARCHIVE")).toBe("FOO.ARCHIVE");
    expect(
      matchGlob("Archive/PC/Mod/*.archive", "archive/pc/mod/a.ARCHIVE"),
    ).toBe("archive/pc/mod/a.ARCHIVE");
  });

  it("treats regex metacharacters as literals", () => {
    expect(matchGlob("foo.bar", "fooxbar")).toBeNull();
    expect(matchGlob("foo+bar", "foo+bar")).toBe("foo+bar");
    expect(matchGlob("a(b)c", "a(b)c")).toBe("a(b)c");
  });
});
