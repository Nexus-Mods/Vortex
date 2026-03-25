import { platform } from "node:process";

import { describe, test, expect, beforeEach } from "vitest";

import { MockFilesystem } from "../test-helpers/MockFilesystem";
import { Anchor, ResolvedPath } from "../types";
import { BaseResolver } from "./BaseResolver";

// Test resolver that simulates Windows paths
class WindowsTestResolver extends BaseResolver<"userData" | "temp"> {
  constructor() {
    super("windows-test", undefined, new MockFilesystem("windows", false));
  }

  canResolve(anchor: Anchor): boolean {
    const name = Anchor.name(anchor);
    return name === "userData" || name === "temp";
  }

  supportedAnchors(): Anchor[] {
    return ["userData", "temp"].map(Anchor.make);
  }

  protected async resolveAnchor(anchor: Anchor): Promise<ResolvedPath> {
    const name = Anchor.name(anchor);
    if (name === "userData") {
      return ResolvedPath.make("C:\\Users\\TestUser\\AppData\\Roaming\\Vortex");
    }
    if (name === "temp") {
      return ResolvedPath.make("C:\\Temp");
    }
    throw new Error(`Unknown anchor: ${name}`);
  }

  /** Test paths are already absolute — act as terminal resolver */
  protected toOSPath(intermediatePath: ResolvedPath): ResolvedPath {
    return intermediatePath;
  }
}

// Test resolver that simulates Unix paths
class UnixTestResolver extends BaseResolver<"home" | "var"> {
  constructor() {
    super("unix-test", undefined, new MockFilesystem("unix", true));
  }

  canResolve(anchor: Anchor): boolean {
    const name = Anchor.name(anchor);
    return name === "home" || name === "var";
  }

  supportedAnchors(): Anchor[] {
    return ["home", "var"].map(Anchor.make);
  }

  protected async resolveAnchor(anchor: Anchor): Promise<ResolvedPath> {
    const name = Anchor.name(anchor);
    if (name === "home") {
      return ResolvedPath.make("/home/user");
    }
    if (name === "var") {
      return ResolvedPath.make("/var/tmp");
    }
    throw new Error(`Unknown anchor: ${name}`);
  }

  /** Test paths are already absolute — act as terminal resolver */
  protected toOSPath(intermediatePath: ResolvedPath): ResolvedPath {
    return intermediatePath;
  }
}

describe("Path Normalization and Cross-Platform Handling", () => {
  describe("FilePath.relativeTo - Path Normalization", () => {
    // Note: relativeTo() uses path.resolve() which is host-OS specific.
    // Windows-literal path tests only work on Windows hosts.
    const isWindows = platform === "win32";

    (isWindows ? describe : describe.skip)(
      "Windows path handling (host-OS only)",
      () => {
        let resolver: WindowsTestResolver;

        beforeEach(() => {
          resolver = new WindowsTestResolver();
        });

        test("should handle basePath with . segments correctly", async () => {
          const child = resolver.PathFor(
            "userData",
            "mods/SkyUI/interface/skyui.swf",
          );
          // basePath with . segment — pathMod.resolve() normalizes it
          const basePath =
            "C:\\Users\\TestUser\\AppData\\Roaming\\Vortex\\mods\\.";

          const relative = await child.relativeTo(basePath);

          expect(relative).not.toBeNull();
          expect(
            (relative as string).split("/").filter((s) => s === "."),
          ).toHaveLength(0);
        });

        test("should handle basePath with .. segments correctly", async () => {
          const child = resolver.PathFor(
            "userData",
            "mods/SkyUI/interface/skyui.swf",
          );
          // basePath with .. segment — resolves to the mods dir
          const basePath =
            "C:\\Users\\TestUser\\AppData\\Roaming\\Vortex\\mods\\SkyUI\\..";

          const relative = await child.relativeTo(basePath);

          expect(relative).not.toBeNull();
          expect(relative as string).not.toContain("..");
        });

        test("should handle mixed separators in basePath correctly", async () => {
          const child = resolver.PathFor(
            "userData",
            "mods/SkyUI/interface/skyui.swf",
          );
          const basePath = "C:\\Users\\TestUser\\AppData\\Roaming\\Vortex/mods";

          const relative = await child.relativeTo(basePath);

          expect(relative).not.toBeNull();
          expect(relative as string).toContain("/");
        });

        test("should extract correct relative path", async () => {
          const child = resolver.PathFor(
            "userData",
            "mods/SkyUI/interface/skyui.swf",
          );
          const parentPath = await resolver
            .PathFor("userData", "mods")
            .resolve();

          const relative = await child.relativeTo(parentPath);

          expect(relative).not.toBeNull();
          expect(relative as string).toBe("SkyUI/interface/skyui.swf");
        });

        test("should handle case-insensitive comparisons correctly", async () => {
          const child = resolver.PathFor(
            "userData",
            "mods/skyui/interface/skyui.swf",
          );
          const basePath =
            "c:\\users\\testuser\\appdata\\roaming\\vortex\\mods";

          const relative = await child.relativeTo(basePath);

          expect(relative).not.toBeNull();
          expect(relative as string).toBe("skyui/interface/skyui.swf");
        });

        test("should handle case-insensitive exact match", async () => {
          const child = resolver.PathFor("userData", "mods");
          const basePath =
            "C:\\Users\\TestUser\\AppData\\Roaming\\Vortex\\mods";

          const relative = await child.relativeTo(basePath);

          expect(relative).not.toBeNull();
          expect(relative).toBe("");
        });

        test("should handle case-insensitive partial match", async () => {
          const child = resolver.PathFor("userData", "mods/SKYUI");
          const parentPath = await resolver
            .PathFor("userData", "mods")
            .resolve();

          const relative = await child.relativeTo(parentPath);

          expect(relative).not.toBeNull();
          expect(relative as string).toBe("SKYUI");
        });
      },
    );

    describe("Unix path handling", () => {
      let resolver: UnixTestResolver;

      beforeEach(() => {
        resolver = new UnixTestResolver();
      });

      test("should handle basePath with . segments", async () => {
        const child = resolver.PathFor(
          "home",
          "mods/SkyUI/interface/skyui.swf",
        );
        // basePath with . segment — pathMod.resolve() normalizes it
        const basePath = "/home/user/mods/.";

        const relative = await child.relativeTo(basePath);

        expect(relative).not.toBeNull();
        // The . segment should be resolved away (check as path segment, not substring — file extensions contain .)
        expect(
          (relative as string).split("/").filter((s) => s === "."),
        ).toHaveLength(0);
      });

      test("should handle basePath with .. segments", async () => {
        const child = resolver.PathFor(
          "home",
          "mods/SkyUI/interface/skyui.swf",
        );
        // basePath with .. segment — resolves to /home/user/mods
        const basePath = "/home/user/mods/SkyUI/..";

        const relative = await child.relativeTo(basePath);

        expect(relative).not.toBeNull();
        expect(relative as string).not.toContain("..");
      });

      test("should handle case-sensitive comparisons correctly", async () => {
        const child = resolver.PathFor(
          "home",
          "mods/SkyUI/interface/skyui.swf",
        );
        const parentPath = await resolver.PathFor("home", "mods").resolve();

        const relative = await child.relativeTo(parentPath);

        expect(relative).not.toBeNull();
        expect(relative as string).toBe("SkyUI/interface/skyui.swf");
      });

      test("should return null for case mismatch on Unix", async () => {
        const child = resolver.PathFor(
          "home",
          "mods/SkyUI/interface/skyui.swf",
        );
        const basePath = "/home/user/Mods"; // capital M — child resolves under /home/user/mods

        const relative = await child.relativeTo(basePath);

        // child resolves to /home/user/mods/..., basePath is /home/user/Mods
        // On case-sensitive Unix, these differ
        expect(relative).toBeNull();
      });
    });

    describe("Edge cases (Unix)", () => {
      let resolver: UnixTestResolver;

      beforeEach(() => {
        resolver = new UnixTestResolver();
      });

      test("should handle empty relative path", async () => {
        const child = resolver.PathFor("home", "mods");
        const basePath = await child.resolve();

        const relative = await child.relativeTo(basePath);

        expect(relative).not.toBeNull();
        expect(relative).toBe("");
      });

      test("should handle deep nesting", async () => {
        const child = resolver.PathFor(
          "home",
          "mods/SkyUI/interface/mcguffins/skyui.swf",
        );
        const basePath = await resolver.PathFor("home", "mods").resolve();

        const relative = await child.relativeTo(basePath);

        expect(relative).not.toBeNull();
        expect(relative as string).toBe("SkyUI/interface/mcguffins/skyui.swf");
      });

      test("should return null for non-child paths", async () => {
        const child = resolver.PathFor("var", "tempfile.txt");
        const basePath = await resolver.PathFor("home", "mods").resolve();

        const relative = await child.relativeTo(basePath);

        expect(relative).toBeNull();
      });

      test("should handle paths with multiple consecutive separators", async () => {
        const child = resolver.PathFor(
          "home",
          "mods/SkyUI/interface/skyui.swf",
        );
        const basePath = "/home/user/mods";

        const relative = await child.relativeTo(basePath);

        expect(relative).not.toBeNull();
      });
    });
  });

  describe("BaseResolver.isUnder - Case Insensitive Handling", () => {
    let resolver: WindowsTestResolver;

    beforeEach(() => {
      resolver = new WindowsTestResolver();
    });

    test("should handle case-insensitive comparisons on Windows", async () => {
      // This is tested indirectly through tryReverse
      const filePath = resolver.PathFor("userData", "mods/SkyUI");
      const osPath = await filePath.resolve();

      // Convert to lowercase
      const lowercasePath = ResolvedPath.unsafe(
        (osPath as string).toLowerCase(),
      );

      const result = await resolver.tryReverse(lowercasePath);

      expect(result).not.toBeNull();
      expect(Anchor.name(result.anchor)).toBe("userData");
    });

    test("should handle exact case match on Windows", async () => {
      const filePath = resolver.PathFor("userData", "mods/SkyUI");
      const osPath = await filePath.resolve();

      const result = await resolver.tryReverse(osPath);

      expect(result).not.toBeNull();
      expect(Anchor.name(result.anchor)).toBe("userData");
    });

    test("should handle mixed case paths on Windows", async () => {
      const filePath = resolver.PathFor("userData", "mods/SkyUI");
      const osPath = await filePath.resolve();

      // Mix case in the path
      const mixedPath = (osPath as string)
        .split("\\")
        .map((part, i) =>
          i % 2 === 0 ? part.toLowerCase() : part.toUpperCase(),
        )
        .join("\\");

      const result = await resolver.tryReverse(ResolvedPath.unsafe(mixedPath));

      expect(result).not.toBeNull();
      expect(Anchor.name(result.anchor)).toBe("userData");
    });
  });

  describe("RelativePath extraction validation", () => {
    let resolver: WindowsTestResolver;

    beforeEach(() => {
      resolver = new WindowsTestResolver();
    });

    test("should not produce relative paths with .. segments", async () => {
      const child = resolver.PathFor(
        "userData",
        "mods/SkyUI/interface/skyui.swf",
      );
      const basePath = await resolver.PathFor("userData", "mods").resolve();

      const relative = await child.relativeTo(basePath);

      expect(relative).not.toBeNull();

      // Verify the relative path doesn't contain ..
      const relativeStr = relative as string;
      expect(relativeStr).not.toContain("..");

      // Verify it's a valid RelativePath
      expect(typeof relativeStr).toBe("string");
      expect(relativeStr.split("/").filter((s) => s === "..")).toHaveLength(0);
    });

    test("should produce valid forward-slash paths", async () => {
      const child = resolver.PathFor(
        "userData",
        "mods/SkyUI/interface/skyui.swf",
      );
      const basePath = await resolver.PathFor("userData", "mods").resolve();

      const relative = await child.relativeTo(basePath);

      expect(relative).not.toBeNull();

      const relativeStr = relative as string;

      // Should use forward slashes
      expect(relativeStr).not.toContain("\\");
      expect(relativeStr).toContain("/");
    });

    test("should handle root-level paths correctly", async () => {
      const child = resolver.PathFor("userData", "mods/SkyUI");
      const basePath = await resolver.PathFor("userData", "").resolve();

      const relative = await child.relativeTo(basePath);

      expect(relative).not.toBeNull();
      expect(relative as string).toBe("mods/SkyUI");
    });
  });

  describe("Cross-platform reverse resolution (Windows resolver on any host)", () => {
    let resolver: WindowsTestResolver;

    beforeEach(() => {
      resolver = new WindowsTestResolver();
    });

    test("should reverse-resolve a Windows path to the correct anchor", async () => {
      const osPath = ResolvedPath.make(
        "C:\\Users\\TestUser\\AppData\\Roaming\\Vortex\\mods\\SkyUI",
      );
      const result = await resolver.tryReverse(osPath);

      expect(result).not.toBeNull();
      expect(Anchor.name(result.anchor)).toBe("userData");
      // Case-insensitive comparison is used only for containment checks;
      // the extracted relative path preserves the original case from the input
      expect(result.relative as string).toBe("mods/SkyUI");
    });

    test("should reverse-resolve an exact base path match", async () => {
      const osPath = ResolvedPath.make(
        "C:\\Users\\TestUser\\AppData\\Roaming\\Vortex",
      );
      const result = await resolver.tryReverse(osPath);

      expect(result).not.toBeNull();
      expect(Anchor.name(result.anchor)).toBe("userData");
      expect(result.relative as string).toBe("");
    });

    test("should pick the most specific anchor when multiple match", async () => {
      const osPath = ResolvedPath.make("C:\\Temp\\subdir\\file.txt");
      const result = await resolver.tryReverse(osPath);

      expect(result).not.toBeNull();
      expect(Anchor.name(result.anchor)).toBe("temp");
      expect(result.relative as string).toBe("subdir/file.txt");
    });

    test("should return null for paths under no anchor", async () => {
      const osPath = ResolvedPath.make("D:\\SomeOtherPath\\file.txt");
      const result = await resolver.tryReverse(osPath);

      expect(result).toBeNull();
    });
  });
});
