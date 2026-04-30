import { describe, it, expect } from "vitest";

import { matches } from "./matcher";

describe("matches", () => {
  describe("exact match", () => {
    it.each([
      ["foo/bar/baz.txt", "foo/bar/baz.txt"],
      ["foo/bar/baz.txt", "foo/bar/BAZ.TXT"],
      ["C:\\foo\\bar\\baz.txt", "C:/foo/bar/baz.txt"],
    ])('"%s" matches "%s"', (input, pattern) => {
      expect(matches(input, pattern)).toBe(true);
    });

    it.each([
      ["foo/bar/baz.txt", "foo/bar/qux.txt"],
      ["foo/bar/baz.txt", "foo/baz.txt"],
    ])('"%s" does not match "%s"', (input, pattern) => {
      expect(matches(input, pattern)).toBe(false);
    });
  });

  describe("extension matching", () => {
    it.each([
      ["foo/bar/baz.txt", "*.txt"],
      ["foo/bar/BAZ.TXT", "*.txt"],
      ["foo/bar/baz.txt", "*.TXT"],
      ["C:\\foo\\bar\\baz.txt", "*.txt"],
    ])('"%s" matches "%s"', (input, pattern) => {
      expect(matches(input, pattern)).toBe(true);
    });

    it.each([
      ["foo/bar/baz.txt", "*.ts"],
      ["foo/bar/baz", "*.txt"],
    ])('"%s" does not match "%s"', (input, pattern) => {
      expect(matches(input, pattern)).toBe(false);
    });
  });

  describe("multiple wildcards", () => {
    it.each([
      ["foo/bar/baz.test.ts", "*.test.*"],
      ["foo/bar/BAZ.TEST.TS", "*.test.*"],
      ["C:\\foo\\bar\\baz.test.ts", "*.test.*"],
      ["foo/bar/baz.txt", "*bar*"],
    ])('"%s" matches "%s"', (input, pattern) => {
      expect(matches(input, pattern)).toBe(true);
    });

    it.each([
      ["foo/bar/baz.ts", "*.test.*"],
      ["foo/qux/baz.txt", "*bar*"],
    ])('"%s" does not match "%s"', (input, pattern) => {
      expect(matches(input, pattern)).toBe(false);
    });
  });

  describe("path segment matching", () => {
    it.each([
      ["foo/bar/baz.txt", "*/bar/*"],
      ["C:\\foo\\bar\\baz.txt", "*/bar/*"],
      ["foo/bar/baz.txt", "foo/*"],
      ["foo/bar/baz.txt", "*/baz.txt"],
      ["foo/BAR/baz.txt", "*/bar/*"],
    ])('"%s" matches "%s"', (input, pattern) => {
      expect(matches(input, pattern)).toBe(true);
    });

    it.each([
      ["foo/qux/baz.txt", "*/bar/*"],
      ["foo/bar/baz.txt", "*/qux/*"],
      ["foo/bar/baz.txt", "qux/*"],
    ])('"%s" does not match "%s"', (input, pattern) => {
      expect(matches(input, pattern)).toBe(false);
    });
  });

  describe("consecutive wildcards", () => {
    it.each([
      ["foo/bar/baz.txt", "**.txt"],
      ["foo/bar/baz.txt", "***.txt"],
    ])(
      '"%s" matches "%s" (consecutive stars treated as one)',
      (input, pattern) => {
        expect(matches(input, pattern)).toBe(true);
      },
    );
  });

  describe("edge cases", () => {
    it.each([
      ["foo/bar/baz.txt", "*"],
      ["foo/bar/baz.txt", "**"],
      ["a", "*"],
    ])('"%s" matches "%s"', (input, pattern) => {
      expect(matches(input, pattern)).toBe(true);
    });

    it.each([
      ["", "*.txt"],
      ["", "foo"],
    ])('empty input "%s" does not match "%s"', (input, pattern) => {
      expect(matches(input, pattern)).toBe(false);
    });
  });
});
