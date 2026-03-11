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
