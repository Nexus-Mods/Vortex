import { describe, test, expect, beforeEach } from "vitest";

import { WindowsResolver, type WindowsDrive } from "./WindowsResolver";
import { Anchor } from "../types";
import { MockWindowsFilesystem } from "../test-helpers/MockWindowsFilesystem";

describe("WindowsResolver", () => {
  let resolver: WindowsResolver;

  beforeEach(() => {
    resolver = new WindowsResolver(undefined, new MockWindowsFilesystem());
  });

  describe("basic properties", () => {
    test('identifies as "windows" resolver', () => {
      expect(resolver.name).toBe("windows");
    });

    test("returns 26 supported anchors", () => {
      const anchors = resolver.supportedAnchors();
      expect(anchors).toHaveLength(26);

      // Verify all lowercase letters are present
      const anchorNames = anchors.map((a) => Anchor.name(a));
      expect(anchorNames).toContain("a");
      expect(anchorNames).toContain("c");
      expect(anchorNames).toContain("z");
    });
  });

  describe("canResolve", () => {
    const driveLetters = ["a", "c", "d", "e", "z"];

    test.each(driveLetters)("can resolve drive letter: %s", (letter) => {
      const anchor = Anchor.make(letter);
      expect(resolver.canResolve(anchor)).toBe(true);
    });

    test.each([
      ["root", "Unix anchor"],
      ["userData", "Vortex anchor"],
      ["game", "Game anchor"],
      ["drive_c", "Proton anchor"],
      ["A", "Uppercase drive"],
      ["C", "Uppercase drive"],
      ["aa", "Invalid drive"],
      ["1", "Numeric"],
    ])("cannot resolve invalid anchor: %s (%s)", (anchorName) => {
      const anchor = Anchor.make(anchorName);
      expect(resolver.canResolve(anchor)).toBe(false);
    });
  });

  describe("resolveAnchor", () => {
    test.each([
      ["a", "A:\\"],
      ["b", "B:\\"],
      ["c", "C:\\"],
      ["d", "D:\\"],
      ["e", "E:\\"],
      ["z", "Z:\\"],
    ])("resolves %s anchor to %s", async (anchorName, expected) => {
      const filePath = resolver.PathFor(anchorName as unknown as WindowsDrive);
      const resolved = await filePath.resolve();
      expect(resolved).toBe(expected);
    });

    test("resolves with relative paths", async () => {
      const cGames = resolver.PathFor("c", "Games");
      const resolved = await cGames.resolve();
      expect(resolved).toMatch(/^C:\\Games$/);
    });

    test("resolves with nested relative paths", async () => {
      const dSteam = resolver.PathFor("d", "Program Files/Steam/steamapps");
      const resolved = await dSteam.resolve();
      expect(resolved).toMatch(/^D:\\Program Files\\Steam\\steamapps$/);
    });

    test("throws for invalid drive letter", async () => {
      // Directly test the resolveAnchor method with an invalid anchor
      const invalidAnchor = Anchor.make("invalidDrive");

      await expect(
        (
          resolver as unknown as {
            resolveAnchor: (anchor: typeof invalidAnchor) => Promise<unknown>;
          }
        ).resolveAnchor(invalidAnchor),
      ).rejects.toThrow(/Unknown anchor/);
    });
  });

  describe("PathFor type safety", () => {
    test("creates FilePath with valid drive letters", () => {
      const cDrive = resolver.PathFor("c");
      expect(Anchor.name(cDrive.anchor)).toBe("c");
      expect(cDrive.relative).toBe("");
    });

    test("creates FilePath with relative path", () => {
      const dGames = resolver.PathFor("d", "Games/Skyrim");
      expect(Anchor.name(dGames.anchor)).toBe("d");
      expect(dGames.relative).toBe("Games/Skyrim");
    });

    // TypeScript compile-time checks (these would be errors):
    // resolver.PathFor('root');      // ✗ Error
    // resolver.PathFor('userData');  // ✗ Error
    // resolver.PathFor('C');         // ✗ Error (uppercase)
  });

  describe("path operations", () => {
    test("join creates nested paths", async () => {
      const cDrive = resolver.PathFor("c");
      const users = cDrive.join("Users", "John", "Documents");

      expect(users.relative).toBe("Users/John/Documents");
      const resolved = await users.resolve();
      expect(resolved).toMatch(/^C:\\Users\\John\\Documents$/);
    });

    test("withAnchor switches drive", async () => {
      const cPath = resolver.PathFor("c", "Games");
      const dPath = cPath.withAnchor(Anchor.make("d"));

      const cResolved = await cPath.resolve();
      const dResolved = await dPath.resolve();

      expect(cResolved).toMatch(/^C:\\Games$/);
      expect(dResolved).toMatch(/^D:\\Games$/);
    });

    test("relativeTo accepts C:\\ as basePath", async () => {
      const file = resolver.PathFor("c", "Games/Skyrim/skyrim.exe");

      await expect(file.relativeTo("C:\\")).resolves.toBe(
        "Games/Skyrim/skyrim.exe",
      );
    });

    test("relativeTo with trailing \\ on a non-root base path", async () => {
      const file = resolver.PathFor("c", "Games/Skyrim/skyrim.exe");

      await expect(file.relativeTo("C:\\Games\\")).resolves.toBe(
        "Skyrim/skyrim.exe",
      );
    });
  });

  describe("edge cases", () => {
    test("handles empty relative path", async () => {
      const cDrive = resolver.PathFor("c", "");
      const resolved = await cDrive.resolve();
      expect(resolved).toBe("C:\\");
    });

    test("all 26 drive letters are supported", () => {
      const letters = "abcdefghijklmnopqrstuvwxyz".split("");

      letters.forEach((letter) => {
        const anchor = Anchor.make(letter);
        expect(resolver.canResolve(anchor)).toBe(true);
      });
    });
  });
});
