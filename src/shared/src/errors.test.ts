import { describe, it, expect } from "vitest";

import {
  computeErrorFingerprint,
  computeIdentityFingerprint,
  getErrorStatusCode,
  isEnvironmentalError,
  sanitizeFramePath,
} from "./errors";
import { CAUSE_SEPARATOR, VortexError } from "./errors/base";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal stack string from an array of "at ..." frame strings. */
const stack = (...frames: string[]) => `Error: test\n${frames.map((f) => `  ${f}`).join("\n")}`;

const VERSION = "1.2.3";

// ---------------------------------------------------------------------------
// sanitizeFramePath
// ---------------------------------------------------------------------------

describe("sanitizeFramePath", () => {
  describe("src/ anchor", () => {
    it("strips Windows absolute prefix before src/ and normalizes separators", () => {
      expect(sanitizeFramePath(`at f (D:\\Dev\\Vortex\\src\\foo.ts:1:2)`)).toBe(
        `at f (src/foo.ts:1:2)`,
      );
    });

    it("strips Unix absolute prefix before src/", () => {
      expect(sanitizeFramePath(`at f (/home/user/Vortex/src/foo.ts:1:2)`)).toBe(
        `at f (src/foo.ts:1:2)`,
      );
    });

    it("strips Windows path with forward slashes before src/", () => {
      expect(sanitizeFramePath(`at f (D:/Dev/Vortex/src/foo.ts:1:2)`)).toBe(
        `at f (src/foo.ts:1:2)`,
      );
    });
  });

  describe("node_modules/ anchor", () => {
    it("strips Windows prefix before node_modules/ and normalizes separators", () => {
      expect(sanitizeFramePath(`at f (D:\\Dev\\Vortex\\node_modules\\lib\\index.js:5:10)`)).toBe(
        `at f (node_modules/lib/index.js:5:10)`,
      );
    });

    it("strips Unix prefix before node_modules/", () => {
      expect(sanitizeFramePath(`at f (/home/alice/app/node_modules/lib/index.js:5:10)`)).toBe(
        `at f (node_modules/lib/index.js:5:10)`,
      );
    });
  });

  describe("app.asar anchor", () => {
    it("strips Windows prefix before app.asar/ and normalizes separators", () => {
      expect(
        sanitizeFramePath(`at f (C:\\Program Files\\Vortex\\resources\\app.asar\\renderer.js:1:2)`),
      ).toBe(`at f (app.asar/renderer.js:1:2)`);
    });

    it("strips Windows prefix before app.asar.unpacked/ and normalizes separators", () => {
      expect(
        sanitizeFramePath(
          `at f (D:\\Program Files\\Vortex\\resources\\app.asar.unpacked\\bundledPlugins\\x\\index.js:1:2)`,
        ),
      ).toBe(`at f (app.asar.unpacked/bundledPlugins/x/index.js:1:2)`);
    });

    it("strips Unix prefix before app.asar/", () => {
      expect(sanitizeFramePath(`at f (/usr/lib/vortex/resources/app.asar/renderer.js:1:2)`)).toBe(
        `at f (app.asar/renderer.js:1:2)`,
      );
    });
  });

  describe("plugins/ anchor", () => {
    it("strips Windows AppData prefix before plugins/ and normalizes separators", () => {
      expect(
        sanitizeFramePath(
          `at f (C:\\Users\\user\\AppData\\Roaming\\Vortex\\plugins\\x\\index.js:1:2)`,
        ),
      ).toBe(`at f (plugins/x/index.js:1:2)`);
    });

    it("strips Unix prefix before plugins/", () => {
      expect(sanitizeFramePath(`at f (/home/alice/.config/Vortex/plugins/x/index.js:1:2)`)).toBe(
        `at f (plugins/x/index.js:1:2)`,
      );
    });
  });

  describe("chrome-extension URLs — left unchanged", () => {
    it("does not strip chrome-extension:// URLs", () => {
      const frame = `at f (chrome-extension://abcdefg/page.js:1:2)`;
      expect(sanitizeFramePath(frame)).toBe(frame);
    });
  });

  describe("paths with no known anchor — separators still normalized", () => {
    it("does not strip a path with no recognised anchor segment", () => {
      const frame = `at f (/some/unknown/path/foo.ts:1:2)`;
      expect(sanitizeFramePath(frame)).toBe(frame);
    });

    it("normalizes backslashes even when no prefix is stripped", () => {
      expect(sanitizeFramePath(`at f (some\\relative\\path.ts:1:2)`)).toBe(
        `at f (some/relative/path.ts:1:2)`,
      );
    });
  });

  describe("already-clean frames — left unchanged", () => {
    it("does not modify a frame already starting at src/ with forward slashes", () => {
      const frame = `at f (src/foo.ts:1:2)`;
      expect(sanitizeFramePath(frame)).toBe(frame);
    });
  });

  // -------------------------------------------------------------------------
  // User-home redaction for paths with no Vortex-install anchor.
  //
  // Paths like C:\Users\user\AppData\Local\Larian Studios\... surface in
  // ENOENT-style error messages where the existing anchor-strip doesn't
  // apply. We redact just the username segment (GDPR Art. 5(1)(c) data
  // minimisation) and preserve the rest so errors stay diagnosable.
  //
  // Cases are taken directly from observed ClickHouse rows.
  // -------------------------------------------------------------------------

  describe("user-home redaction (no Vortex anchor)", () => {
    it("redacts Windows C:\\Users\\<name> in a bare path", () => {
      expect(
        sanitizeFramePath(
          `C:\\Users\\user\\AppData\\Local\\Larian Studios\\Baldur's Gate 3\\Mods\\foo.pak`,
        ),
      ).toBe(`C:/Users/<USER>/AppData/Local/Larian Studios/Baldur's Gate 3/Mods/foo.pak`);
    });

    it("redacts the username inside an ENOENT message body", () => {
      const input = `ENOENT: no such file or directory, stat 'C:\\Users\\user\\AppData\\Local\\Larian Studios\\Baldur's Gate 3\\Mods\\AuriesVanillaTreasures.pak'`;
      const expected = `ENOENT: no such file or directory, stat 'C:/Users/<USER>/AppData/Local/Larian Studios/Baldur's Gate 3/Mods/AuriesVanillaTreasures.pak'`;
      expect(sanitizeFramePath(input)).toBe(expected);
    });

    it("redacts every username line of a multi-line Require stack", () => {
      const input = [
        `Error: Cannot find module 'harmony-patcher'`,
        `Require stack:`,
        `- C:\\Users\\user\\AppData\\Roaming\\Vortex\\plugins\\Vortex Extension Update - UnderMine Support v1.0.1\\index.js`,
        `- C:\\Program Files\\Black Tree Gaming Ltd\\Vortex\\resources\\app.asar\\renderer.js`,
      ].join("\n");
      // The `plugins` and `app.asar` anchors strip the full install prefix, so
      // neither username nor Program Files survives.
      const expected = [
        `Error: Cannot find module 'harmony-patcher'`,
        `Require stack:`,
        `- plugins/Vortex Extension Update - UnderMine Support v1.0.1/index.js`,
        `- app.asar/renderer.js`,
      ].join("\n");
      expect(sanitizeFramePath(input)).toBe(expected);
    });

    it("redacts usernames across every 'at' frame of a stack trace", () => {
      const input = [
        `TypeError: Cannot read properties of undefined (reading 'app')`,
        `    at Object.<anonymous> (C:\\Users\\user\\AppData\\Roaming\\Vortex\\plugins\\Fallout 76 Support v2.2.1\\index.js:15:34)`,
        `    at Object.<anonymous> (C:\\Users\\user\\AppData\\Roaming\\Vortex\\plugins\\Fallout 76 Support v2.2.1\\index.js:304:3)`,
      ].join("\n");
      const expected = [
        `TypeError: Cannot read properties of undefined (reading 'app')`,
        `    at Object.<anonymous> (plugins/Fallout 76 Support v2.2.1/index.js:15:34)`,
        `    at Object.<anonymous> (plugins/Fallout 76 Support v2.2.1/index.js:304:3)`,
      ].join("\n");
      expect(sanitizeFramePath(input)).toBe(expected);
    });

    it("redacts Windows path written with forward slashes", () => {
      expect(sanitizeFramePath(`C:/Users/user/AppData/Local/foo.pak`)).toBe(
        `C:/Users/<USER>/AppData/Local/foo.pak`,
      );
    });

    it("redacts macOS /Users/<name>", () => {
      expect(sanitizeFramePath(`/Users/user/Library/foo.plist`)).toBe(
        `/Users/<USER>/Library/foo.plist`,
      );
    });

    it("redacts Linux /home/<name>", () => {
      expect(sanitizeFramePath(`/home/user/.config/vortex/x`)).toBe(
        `/home/<USER>/.config/vortex/x`,
      );
    });

    it("redacts every occurrence in a single string", () => {
      const input = `C:\\Users\\user\\a.txt and C:\\Users\\user\\b.txt`;
      expect(sanitizeFramePath(input)).toBe(`C:/Users/<USER>/a.txt and C:/Users/<USER>/b.txt`);
    });

    // Username-in-path redaction across OS styles, for both single-word and
    // multi-word (space-containing) Windows account names. Real telemetry showed
    // "C:/Users/<USER> Sparshott/..." leaking the surname when the segment was
    // only redacted up to the first space.
    it.each([
      // [description, input, expected]
      [
        "Windows backslash, no space",
        `C:\\Users\\bob\\AppData\\foo.pak`,
        `C:/Users/<USER>/AppData/foo.pak`,
      ],
      [
        "Windows backslash, with space",
        `C:\\Users\\John S. Junior\\AppData\\foo.pak`,
        `C:/Users/<USER>/AppData/foo.pak`,
      ],
      [
        "Windows forward slash, no space",
        `C:/Users/bob/AppData/foo.pak`,
        `C:/Users/<USER>/AppData/foo.pak`,
      ],
      [
        "Windows forward slash, with space",
        `C:/Users/Jane Doe/AppData/foo.pak`,
        `C:/Users/<USER>/AppData/foo.pak`,
      ],
      ["macOS, no space", `/Users/bob/Library/foo.plist`, `/Users/<USER>/Library/foo.plist`],
      ["macOS, with space", `/Users/Jane Doe/Library/foo.plist`, `/Users/<USER>/Library/foo.plist`],
      ["Linux, no space", `/home/bob/.config/x`, `/home/<USER>/.config/x`],
      ["Linux, with space", `/home/jane doe/.config/x`, `/home/<USER>/.config/x`],
    ])("redacts the username segment (%s)", (_desc, input, expected) => {
      expect(sanitizeFramePath(input)).toBe(expected);
    });

    it("redacts a multi-word username at the end of a quoted path", () => {
      expect(sanitizeFramePath(`open 'C:/Users/Jane Doe'`)).toBe(`open 'C:/Users/<USER>'`);
    });

    it("is idempotent — running twice gives the same result", () => {
      const input = `C:\\Users\\user\\file.txt and /home/user/other.txt`;
      const once = sanitizeFramePath(input);
      expect(sanitizeFramePath(once)).toBe(once);
    });

    it("leaves C:\\Program Files paths unchanged (no user segment)", () => {
      const input = `C:\\Program Files\\Black Tree Gaming Ltd\\Vortex\\readme.txt`;
      expect(sanitizeFramePath(input)).toBe(
        `C:/Program Files/Black Tree Gaming Ltd/Vortex/readme.txt`,
      );
    });

    it("leaves portable-install drive paths unchanged (no user segment)", () => {
      const input = `E:\\Vortex\\resources\\readme.txt`;
      expect(sanitizeFramePath(input)).toBe(`E:/Vortex/resources/readme.txt`);
    });

    it("prefers anchor-strip over user-redact when both apply", () => {
      // An anchored path gets the full install prefix stripped, not just the
      // username redacted — the anchor form loses more info and is preferred.
      expect(
        sanitizeFramePath(
          `at f (C:\\Users\\user\\AppData\\Roaming\\Vortex\\plugins\\x\\index.js:1:2)`,
        ),
      ).toBe(`at f (plugins/x/index.js:1:2)`);
    });
  });
});

// ---------------------------------------------------------------------------
// computeErrorFingerprint
// ---------------------------------------------------------------------------

describe("computeErrorFingerprint", () => {
  describe("undefined / empty input", () => {
    it("returns undefined when stack is undefined", () => {
      expect(computeErrorFingerprint(undefined, VERSION)).toBeUndefined();
    });

    it("returns undefined when stack has no 'at ' frames", () => {
      expect(computeErrorFingerprint("Error: something went wrong", VERSION)).toBeUndefined();
    });

    it("returns undefined for an empty string", () => {
      expect(computeErrorFingerprint("", VERSION)).toBeUndefined();
    });
  });

  describe("return value shape", () => {
    it("returns an 8-character hex string", () => {
      const result = computeErrorFingerprint(stack(`at f (src/foo.ts:1:2)`), VERSION);
      expect(result).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  describe("determinism", () => {
    it("returns the same hash for identical inputs", () => {
      const s = stack(`at f (src/foo.ts:1:2)`, `at g (src/bar.ts:3:4)`);
      expect(computeErrorFingerprint(s, VERSION)).toBe(computeErrorFingerprint(s, VERSION));
    });
  });

  describe("frame filtering", () => {
    it("ignores non-frame lines in the stack", () => {
      const withNoise = `Error: oops\n  some noise\n  at f (src/foo.ts:1:2)\n  more noise`;
      const clean = stack(`at f (src/foo.ts:1:2)`);
      expect(computeErrorFingerprint(withNoise, VERSION)).toBe(
        computeErrorFingerprint(clean, VERSION),
      );
    });

    it("trims leading/trailing whitespace from frame lines", () => {
      const indented = `Error\n    at f (src/foo.ts:1:2)`;
      const tight = `Error\nat f (src/foo.ts:1:2)`;
      expect(computeErrorFingerprint(indented, VERSION)).toBe(
        computeErrorFingerprint(tight, VERSION),
      );
    });
  });

  describe("sensitivity", () => {
    it("produces different hashes for different frame sets", () => {
      const a = stack(`at f (src/foo.ts:1:2)`);
      const b = stack(`at g (src/bar.ts:9:1)`);
      expect(computeErrorFingerprint(a, VERSION)).not.toBe(computeErrorFingerprint(b, VERSION));
    });

    it("produces different hashes for different line numbers", () => {
      const a = stack(`at f (src/foo.ts:1:2)`);
      const b = stack(`at f (src/foo.ts:2:2)`);
      expect(computeErrorFingerprint(a, VERSION)).not.toBe(computeErrorFingerprint(b, VERSION));
    });

    it("produces different hashes for different app versions", () => {
      const s = stack(`at f (src/foo.ts:1:2)`);
      expect(computeErrorFingerprint(s, "1.0.0")).not.toBe(computeErrorFingerprint(s, "2.0.0"));
    });

    it("produces different hashes for different frame order", () => {
      const a = stack(`at f (src/foo.ts:1:2)`, `at g (src/bar.ts:3:4)`);
      const b = stack(`at g (src/bar.ts:3:4)`, `at f (src/foo.ts:1:2)`);
      expect(computeErrorFingerprint(a, VERSION)).not.toBe(computeErrorFingerprint(b, VERSION));
    });
  });

  describe("install-path stripping and normalization feed through correctly", () => {
    it("Windows and Unix paths to the same file produce identical hashes", () => {
      const windows = stack(`at f (D:\\Dev\\Vortex\\src\\foo.ts:1:2)`);
      const unix = stack(`at f (/home/user/Vortex/src/foo.ts:1:2)`);
      expect(computeErrorFingerprint(windows, VERSION)).toBe(
        computeErrorFingerprint(unix, VERSION),
      );
    });

    it("Windows backslash path and clean forward-slash path produce identical hashes", () => {
      const windows = stack(`at f (D:\\Dev\\Vortex\\src\\foo.ts:1:2)`);
      const clean = stack(`at f (src/foo.ts:1:2)`);
      expect(computeErrorFingerprint(windows, VERSION)).toBe(
        computeErrorFingerprint(clean, VERSION),
      );
    });
  });

  describe("grouping normalizations", () => {
    it("ignores column differences within the same line", () => {
      const a = stack(`at f (src/foo.ts:42:10)`);
      const b = stack(`at f (src/foo.ts:42:99)`);
      expect(computeErrorFingerprint(a, VERSION)).toBe(computeErrorFingerprint(b, VERSION));
    });

    it("strips column from frames without parentheses (`at path:line:col`)", () => {
      const a = stack(`at app.asar/renderer.js:2:989340`);
      const b = stack(`at app.asar/renderer.js:2:1054550`);
      expect(computeErrorFingerprint(a, VERSION)).toBe(computeErrorFingerprint(b, VERSION));
    });

    it("hashes only the innermost N frames (calling context above is ignored)", () => {
      // First 5 frames identical, 6th differs → same fingerprint.
      const top5 = [
        `at template (node_modules/string-template/index.js:21:19)`,
        `at pathPattern (plugins/Foo/index.js:265:12)`,
        `at Object.getPath (plugins/Foo/index.js:880:15)`,
        `at app.asar/renderer.js:2:989340`,
        `at Array.reduce (<anonymous>)`,
      ];
      const a = stack(...top5, `at getCurrentActivator (app.asar/renderer.js:2:1661103)`);
      const b = stack(...top5, `at getSupportedActivators (app.asar/renderer.js:2:1660629)`);
      expect(computeErrorFingerprint(a, VERSION)).toBe(computeErrorFingerprint(b, VERSION));
    });

    it("still differentiates when innermost frames differ", () => {
      const a = stack(`at f (src/foo.ts:1:2)`, `at g (src/bar.ts:3:4)`);
      const b = stack(`at h (src/baz.ts:1:2)`, `at g (src/bar.ts:3:4)`);
      expect(computeErrorFingerprint(a, VERSION)).not.toBe(computeErrorFingerprint(b, VERSION));
    });
  });
});

// ---------------------------------------------------------------------------
// isEnvironmentalError
// ---------------------------------------------------------------------------

/** A raw Node system error naming a path, which the classifier can reach an
 *  `fs:*` verdict for. */
const withCode = (code: string): Error =>
  Object.assign(new Error(code), { code, errno: -1, syscall: "open", path: "C:/tmp/x" });

/** The same code with no path — `spawn`, `process.kill`, a socket bind. The
 *  classifier deliberately declines to call these filesystem errors. */
const withCodeNoPath = (code: string): Error =>
  Object.assign(new Error(code), { code, errno: -1, syscall: "kill" });

/** A classified error as it arrives after crossing IPC: rebuilt from `data`
 *  alone, so it carries a kind but no `code` property. */
const classified = (kind: "fs:no-permissions" | "fs:not-found" | "os:generic"): VortexError =>
  kind === "os:generic"
    ? new VortexError("classified", { kind, originalCode: "EPERM", errno: -1, syscall: "kill" })
    : new VortexError("classified", { kind, path: "C:/tmp/x", originalCode: "EPERM" });

describe("isEnvironmentalError", () => {
  it.each(["EPERM", "EACCES", "ENOSPC", "EROFS"])("returns true for %s naming a path", (code) => {
    expect(isEnvironmentalError(withCode(code))).toBe(true);
  });

  it.each(["EPERM", "EACCES"])("returns false for a pathless %s", (code) => {
    // Not a filesystem verdict, so it stays reportable rather than being
    // written off as the user's environment.
    expect(isEnvironmentalError(withCodeNoPath(code))).toBe(false);
  });

  it("returns false for unrelated error codes", () => {
    expect(isEnvironmentalError(withCode("ENOENT"))).toBe(false);
    expect(isEnvironmentalError(withCode("ETIMEDOUT"))).toBe(false);
    expect(isEnvironmentalError(withCode("EBUSY"))).toBe(false);
  });

  it("returns false for plain Error without code", () => {
    expect(isEnvironmentalError(new Error("boom"))).toBe(false);
  });

  it("recognises an already-classified error that crossed IPC", () => {
    expect(isEnvironmentalError(classified("fs:no-permissions"))).toBe(true);
    expect(isEnvironmentalError(classified("fs:not-found"))).toBe(false);
  });

  it("ignores a payload code the classifier did not turn into an fs verdict", () => {
    expect(isEnvironmentalError(classified("os:generic"))).toBe(false);
  });

  it("returns false for a VortexError carrying no code at all", () => {
    expect(
      isEnvironmentalError(new VortexError("nope", { kind: "user-canceled", skipped: false })),
    ).toBe(false);
  });

  it("returns true when allowReport is explicitly false", () => {
    const err = Object.assign(new Error("boom"), { allowReport: false });
    expect(isEnvironmentalError(err)).toBe(true);
  });

  it("ignores allowReport when not strictly false", () => {
    const err = Object.assign(new Error("boom"), { allowReport: true });
    expect(isEnvironmentalError(err)).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isEnvironmentalError("EPERM")).toBe(false);
    expect(isEnvironmentalError(undefined)).toBe(false);
    expect(isEnvironmentalError(null)).toBe(false);
    expect(isEnvironmentalError({ code: "EPERM" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeErrorFingerprint on a chained stack
// ---------------------------------------------------------------------------

/** An error with a deterministic stack: header from name/message, then the given frames. */
const withFrames = <T extends Error>(err: T, ...frames: string[]): T => {
  err.stack = [`${err.name}: ${err.message}`, ...frames.map((f) => `    ${f}`)].join("\n");
  return err;
};

const CAUSE_FRAME = "at open (node:internal/fs/promises:640:25)";

/** A chained stack as VortexError builds one: wrapper frames, then the cause's. */
const chained = (wrapperFrame: string, cause: Error): string =>
  `${withFrames(new Error("wrapper"), wrapperFrame).stack}\n${CAUSE_SEPARATOR}${cause.stack}`;

describe("computeErrorFingerprint on a chained stack", () => {
  it("hashes the last section, i.e. the throw site", () => {
    const cause = withFrames(new Error("EPERM"), CAUSE_FRAME);

    expect(
      computeErrorFingerprint(chained("at classify (src/parser.ts:1:1)", cause), VERSION),
    ).toBe(computeErrorFingerprint(cause.stack, VERSION));
  });

  it("ignores the wrapper's frames, so different classifier paths still group together", () => {
    const cause = withFrames(new Error("EPERM"), CAUSE_FRAME);

    expect(computeErrorFingerprint(chained("at classifyA (src/a.ts:1:1)", cause), VERSION)).toBe(
      computeErrorFingerprint(chained("at classifyB (src/b.ts:1:1)", cause), VERSION),
    );
  });

  it("does not group a wrapped error with a bare error thrown from the wrapper's frame", () => {
    const cause = withFrames(new Error("EPERM"), CAUSE_FRAME);
    const bare = withFrames(new Error("wrapper"), "at classify (src/parser.ts:1:1)");

    expect(
      computeErrorFingerprint(chained("at classify (src/parser.ts:1:1)", cause), VERSION),
    ).not.toBe(computeErrorFingerprint(bare.stack, VERSION));
  });

  it("uses the throw site of a VortexError built from a raw error", () => {
    const raw = withFrames(new Error("EPERM"), CAUSE_FRAME);
    const err = new VortexError("no permissions", { kind: "unknown" }, { cause: raw });

    expect(computeErrorFingerprint(err.stack, VERSION)).toBe(
      computeErrorFingerprint(raw.stack, VERSION),
    );
  });
});

// ---------------------------------------------------------------------------
// getErrorStatusCode
// ---------------------------------------------------------------------------

/** An error carrying its status behind a getter, as nexus-api's NexusError does. */
const withStatus = (statusCode: unknown) =>
  Object.defineProperty(new Error("refused"), "statusCode", { get: () => statusCode });

describe("getErrorStatusCode", () => {
  it("reads the status off an error that has one", () => {
    expect(getErrorStatusCode(withStatus(403))).toBe(403);
  });

  it("answers null for an error without one", () => {
    expect(getErrorStatusCode(new Error("offline"))).toBeNull();
  });

  // a status that arrived as text can't be compared with a number, so it isn't one
  it("answers null for a status that isn't a number", () => {
    expect(getErrorStatusCode(withStatus("403"))).toBeNull();
  });

  it("answers null for anything that isn't an error", () => {
    expect(getErrorStatusCode({ statusCode: 403 })).toBeNull();
    expect(getErrorStatusCode(undefined)).toBeNull();
  });
});

describe("computeIdentityFingerprint", () => {
  it("is an 8-char hex hash, stable for the same parts", () => {
    const first = computeIdentityFingerprint(
      "2.7.0",
      "PreviousSessionCrash",
      "Vortex.exe",
      "0x398fe0",
    );
    expect(first).toMatch(/^[0-9a-f]{8}$/);
    expect(
      computeIdentityFingerprint("2.7.0", "PreviousSessionCrash", "Vortex.exe", "0x398fe0"),
    ).toBe(first);
  });

  it("changes when any part or the version changes", () => {
    const base = computeIdentityFingerprint("2.7.0", "ChildProcessGone", "utility", "133");
    expect(computeIdentityFingerprint("2.7.0", "ChildProcessGone", "gpu", "133")).not.toBe(base);
    expect(computeIdentityFingerprint("2.7.1", "ChildProcessGone", "utility", "133")).not.toBe(
      base,
    );
  });

  it("does not collide when parts are shifted", () => {
    expect(computeIdentityFingerprint("2.7.0", "a", "b")).not.toBe(
      computeIdentityFingerprint("2.7.0", "ab", ""),
    );
  });
});
