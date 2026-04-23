import { describe, it, expect } from "vitest";

import { computeErrorFingerprint, sanitizeFramePath } from "./errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal stack string from an array of "at ..." frame strings. */
const stack = (...frames: string[]) =>
  `Error: test\n${frames.map((f) => `  ${f}`).join("\n")}`;

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
      expect(
        sanitizeFramePath(
          `at f (D:\\Dev\\Vortex\\node_modules\\lib\\index.js:5:10)`,
        ),
      ).toBe(`at f (node_modules/lib/index.js:5:10)`);
    });

    it("strips Unix prefix before node_modules/", () => {
      expect(
        sanitizeFramePath(
          `at f (/home/alice/app/node_modules/lib/index.js:5:10)`,
        ),
      ).toBe(`at f (node_modules/lib/index.js:5:10)`);
    });
  });

  describe("app.asar anchor", () => {
    it("strips Windows prefix before app.asar/ and normalizes separators", () => {
      expect(
        sanitizeFramePath(
          `at f (C:\\Program Files\\Vortex\\resources\\app.asar\\renderer.js:1:2)`,
        ),
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
      expect(
        sanitizeFramePath(
          `at f (/usr/lib/vortex/resources/app.asar/renderer.js:1:2)`,
        ),
      ).toBe(`at f (app.asar/renderer.js:1:2)`);
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
      expect(
        sanitizeFramePath(
          `at f (/home/alice/.config/Vortex/plugins/x/index.js:1:2)`,
        ),
      ).toBe(`at f (plugins/x/index.js:1:2)`);
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
      ).toBe(
        `C:/Users/<USER>/AppData/Local/Larian Studios/Baldur's Gate 3/Mods/foo.pak`,
      );
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
      expect(sanitizeFramePath(input)).toBe(
        `C:/Users/<USER>/a.txt and C:/Users/<USER>/b.txt`,
      );
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
      expect(
        computeErrorFingerprint("Error: something went wrong", VERSION),
      ).toBeUndefined();
    });

    it("returns undefined for an empty string", () => {
      expect(computeErrorFingerprint("", VERSION)).toBeUndefined();
    });
  });

  describe("return value shape", () => {
    it("returns an 8-character hex string", () => {
      const result = computeErrorFingerprint(
        stack(`at f (src/foo.ts:1:2)`),
        VERSION,
      );
      expect(result).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  describe("determinism", () => {
    it("returns the same hash for identical inputs", () => {
      const s = stack(`at f (src/foo.ts:1:2)`, `at g (src/bar.ts:3:4)`);
      expect(computeErrorFingerprint(s, VERSION)).toBe(
        computeErrorFingerprint(s, VERSION),
      );
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
      expect(computeErrorFingerprint(a, VERSION)).not.toBe(
        computeErrorFingerprint(b, VERSION),
      );
    });

    it("produces different hashes for different line numbers", () => {
      const a = stack(`at f (src/foo.ts:1:2)`);
      const b = stack(`at f (src/foo.ts:2:2)`);
      expect(computeErrorFingerprint(a, VERSION)).not.toBe(
        computeErrorFingerprint(b, VERSION),
      );
    });

    it("produces different hashes for different app versions", () => {
      const s = stack(`at f (src/foo.ts:1:2)`);
      expect(computeErrorFingerprint(s, "1.0.0")).not.toBe(
        computeErrorFingerprint(s, "2.0.0"),
      );
    });

    it("produces different hashes for different frame order", () => {
      const a = stack(`at f (src/foo.ts:1:2)`, `at g (src/bar.ts:3:4)`);
      const b = stack(`at g (src/bar.ts:3:4)`, `at f (src/foo.ts:1:2)`);
      expect(computeErrorFingerprint(a, VERSION)).not.toBe(
        computeErrorFingerprint(b, VERSION),
      );
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
});
