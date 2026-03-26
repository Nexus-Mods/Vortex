import type { IFilesystem } from "../IFilesystem";
import type { IResolverBase } from "../IResolver";

import { MockUnixFilesystem } from "../test-helpers/MockUnixFilesystem";
import { MockWindowsFilesystem } from "../test-helpers/MockWindowsFilesystem";
import { Anchor, ResolvedPath } from "../types";
import { fromRecord, MappingResolver } from "./MappingResolver";

import { describe, it, expect, beforeEach } from "vitest";

// ============================================================================
// Mock Resolver for Testing
// ============================================================================

class TestResolver extends MappingResolver<"test1" | "test2" | "nested"> {
  constructor(
    filesystem: IFilesystem = new MockUnixFilesystem(),
    parent?: IResolverBase,
  ) {
    super("test", parent, filesystem);
  }

  protected getStrategy() {
    const platform = this.getFilesystem().platform;
    return fromRecord({
      test1: ResolvedPath.make(makeAbsolutePath(platform, "test", "base1")),
      test2: ResolvedPath.make(makeAbsolutePath(platform, "test", "base2")),
      nested: ResolvedPath.make(
        makeAbsolutePath(platform, "test", "base1", "nested"),
      ),
    });
  }

  /** Test paths are already absolute — act as terminal resolver */
  protected toOSPath(intermediatePath: ResolvedPath): ResolvedPath {
    return intermediatePath;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function makeAbsolutePath(
  platform: IFilesystem["platform"],
  ...segments: string[]
): string {
  const joined = segments.join("/");
  return platform === "windows"
    ? `C:\\${joined.replace(/\//g, "\\")}`
    : `/${joined}`;
}

// ============================================================================
// Tests
// ============================================================================

describe("MappingResolver", () => {
  it("fromRecord only resolves declared keys", async () => {
    const strategy = fromRecord(
      {
        empty: "",
      },
      (value) => ResolvedPath.make(value === "" ? "/empty" : `/${value}`),
    );

    expect(strategy.canResolve("empty")).toBe(true);
    expect(strategy.canResolve("toString" as never)).toBe(false);
    await expect(strategy.resolve("empty")).resolves.toBe("/empty");
    await expect(strategy.resolve("toString" as never)).rejects.toThrow(
      /Unknown anchor/,
    );
  });
});

describe("Reverse Resolution", () => {
  describe("BaseResolver.tryReverse", () => {
    let resolver: TestResolver;

    beforeEach(() => {
      resolver = new TestResolver();
    });

    it("should reverse-resolve a path to the correct anchor and relative", async () => {
      // Use the actual resolved path from the resolver to ensure it matches
      const baseFilePath = resolver.PathFor("test1", "mods/SkyUI");
      const osPath = await baseFilePath.resolve();

      const result = await resolver.tryReverse(osPath);

      expect(result).not.toBeNull();
      expect(Anchor.name(result.anchor)).toBe("test1");
      expect(result.relative as string).toBe("mods/SkyUI");
    });

    it("should return null for paths not under any anchor", async () => {
      const osPath = ResolvedPath.make(makeAbsolutePath("unix", "other", "path"));
      const result = await resolver.tryReverse(osPath);

      expect(result).toBeNull();
    });

    it("should prefer longest matching base path", async () => {
      // 'nested' anchor is under 'test1' anchor - should prefer 'nested'
      const nestedFilePath = resolver.PathFor("nested", "subdir");
      const osPath = await nestedFilePath.resolve();

      const result = await resolver.tryReverse(osPath);

      expect(result).not.toBeNull();
      expect(Anchor.name(result.anchor)).toBe("nested");
      expect(result.relative as string).toBe("subdir");
    });

    it("should handle exact anchor path (empty relative)", async () => {
      const anchorFilePath = resolver.PathFor("test1");
      const osPath = await anchorFilePath.resolve();

      const result = await resolver.tryReverse(osPath);

      expect(result).not.toBeNull();
      expect(Anchor.name(result.anchor)).toBe("test1");
      expect(result.relative).toBe("");
    });

    it("should cache base paths for performance", async () => {
      const filePath = resolver.PathFor("test1", "mods");
      const osPath = await filePath.resolve();

      // First call - should populate cache
      const result1 = await resolver.tryReverse(osPath);
      expect(result1).not.toBeNull();

      // Second call - should use cache
      const result2 = await resolver.tryReverse(osPath);
      expect(result2).not.toBeNull();

      // Results should be equivalent
      expect(Anchor.name(result1.anchor)).toBe(Anchor.name(result2.anchor));
      expect(result1.relative).toBe(result2.relative);
    });

    it("should clear cache when requested", async () => {
      const filePath = resolver.PathFor("test1", "mods");
      const osPath = await filePath.resolve();

      // Populate cache
      await resolver.tryReverse(osPath);

      // Clear cache
      resolver.clearBasePathCache();

      // Should still work after cache clear
      const result = await resolver.tryReverse(osPath);
      expect(result).not.toBeNull();
    });
  });

  describe("BaseResolver.getBasePaths", () => {
    let resolver: TestResolver;

    beforeEach(() => {
      resolver = new TestResolver();
    });

    it("should return all base paths", async () => {
      const basePaths = await resolver.getBasePaths();

      expect(basePaths.size).toBeGreaterThanOrEqual(3);
      expect(basePaths.has(Anchor.make("test1"))).toBe(true);
      expect(basePaths.has(Anchor.make("test2"))).toBe(true);
      expect(basePaths.has(Anchor.make("nested"))).toBe(true);
    });

    it("should cache base paths", async () => {
      const basePaths1 = await resolver.getBasePaths();
      const basePaths2 = await resolver.getBasePaths();

      // Should return the same promise/object
      expect(basePaths1).toBe(basePaths2);
    });
  });

  describe("No parent delegation in tryReverse", () => {
    let parentResolver: TestResolver;
    let childResolver: TestResolver;

    beforeEach(() => {
      parentResolver = new TestResolver();
      childResolver = new TestResolver(new MockUnixFilesystem(), parentResolver);

      // Give them different names
      (parentResolver as any).name = "parent";
      (childResolver as any).name = "child";
    });

    it("should resolve paths under its own anchors", async () => {
      const originalPath = childResolver.PathFor("test1", "mods/SkyUI");
      const osPath = await originalPath.resolve();

      const result = await childResolver.tryReverse(osPath);

      expect(result).not.toBeNull();
      expect(Anchor.name(result.anchor)).toBe("test1");
      expect(result.relative as string).toBe("mods/SkyUI");
    });

    it("should return null when path is not under own anchors (no parent delegation)", async () => {
      // Create a path that parent can handle but child shares the same anchors
      // so use a completely unrelated path
      const osPath = ResolvedPath.make(
        makeAbsolutePath("unix", "unmatched", "path"),
      );

      const result = await childResolver.tryReverse(osPath);

      expect(result).toBeNull();
    });

    it("should return null for unresolvable paths", async () => {
      const osPath = ResolvedPath.make(
        makeAbsolutePath("unix", "unmatched", "path"),
      );
      const result = await childResolver.tryReverse(osPath);

      expect(result).toBeNull();
    });
  });

  describe("Multiple resolver matching", () => {
    let resolver: TestResolver;

    beforeEach(() => {
      resolver = new TestResolver();
    });

    it("should find matching anchor for path", async () => {
      // Path that 'nested' anchor should match
      const nestedFilePath = resolver.PathFor("nested", "file.txt");
      const osPath = await nestedFilePath.resolve();

      const result = await resolver.tryReverse(osPath);

      // Should find the nested anchor (most specific)
      expect(result).not.toBeNull();
      expect(Anchor.name(result.anchor)).toBe("nested");
    });

    it("should return null when no match", async () => {
      const osPath = ResolvedPath.make(makeAbsolutePath("unix", "unmatched"));
      const result = await resolver.tryReverse(osPath);

      expect(result).toBeNull();
    });
  });

  describe("FilePath.relativeTo", () => {
    let resolver: TestResolver;

    beforeEach(() => {
      resolver = new TestResolver();
    });

    it("should extract relative path for child", async () => {
      const parent = resolver.PathFor("test1", "mods");
      const child = resolver.PathFor("test1", "mods/SkyUI/interface/skyui.swf");
      const parentPath = await parent.resolve();

      const relative = await child.relativeTo(parentPath);

      expect(relative).not.toBeNull();
      expect(relative as string).toBe("SkyUI/interface/skyui.swf");
    });

    it("should return null for non-child paths", async () => {
      const parent = resolver.PathFor("test1", "mods");
      const nonChild = resolver.PathFor("test2", "other");
      const parentPath = await parent.resolve();

      const relative = await nonChild.relativeTo(parentPath);

      expect(relative).toBeNull();
    });

    it("should handle exact match (empty relative)", async () => {
      const parent = resolver.PathFor("test1", "mods");
      const parentPath = await parent.resolve();

      const relative = await parent.relativeTo(parentPath);

      expect(relative).not.toBeNull();
      expect(relative).toBe("");
    });

    it("should allow reconstructing child FilePath", async () => {
      const parent = resolver.PathFor("test1", "mods");
      const child = resolver.PathFor("test1", "mods/SkyUI/skyui.esp");
      const parentPath = await parent.resolve();

      const relative = await child.relativeTo(parentPath);
      expect(relative).not.toBeNull();

      const reconstructed = parent.join(relative as string);
      const resolvedChild = await reconstructed.resolve();
      const childPath = await child.resolve();

      expect(resolvedChild).toBe(childPath);
    });
  });

  describe("FilePath.withBase", () => {
    let resolver: TestResolver;

    beforeEach(() => {
      resolver = new TestResolver();
    });

    it("should replace base while preserving structure", () => {
      const original = resolver.PathFor("test1", "Data/Meshes/armor.nif");
      const newBase = resolver.PathFor("test2", "backups/skyrim");

      const moved = original.withBase(newBase);

      expect(Anchor.name(moved.anchor)).toBe("test2");
      expect(moved.relative as string).toBe(
        "backups/skyrim/Data/Meshes/armor.nif",
      );
      expect(moved.resolver).toBe(resolver);
    });

    it("should work with empty base relative", () => {
      const original = resolver.PathFor("test1", "mods/skyrim.esp");
      const newBase = resolver.PathFor("test2");

      const moved = original.withBase(newBase);

      expect(moved.relative as string).toBe("mods/skyrim.esp");
    });

    it("should work with empty original relative", () => {
      const original = resolver.PathFor("test1");
      const newBase = resolver.PathFor("test2", "backup");

      const moved = original.withBase(newBase);

      expect(moved.relative as string).toBe("backup");
    });

    it("should preserve resolver from new base", () => {
      const resolver2 = new TestResolver();
      (resolver2 as any).name = "test-different";

      const original = resolver.PathFor("test1", "file.txt");
      const newBase = resolver2.PathFor("test1", "backup");

      const moved = original.withBase(newBase);

      expect(moved.resolver).toBe(resolver2);
    });
  });

  describe("FilePath.isAncestorOf", () => {
    let resolver: TestResolver;

    beforeEach(() => {
      resolver = new TestResolver();
    });

    it("should return true for child paths", async () => {
      const parent = resolver.PathFor("test1", "mods");
      const child = resolver.PathFor("test1", "mods/SkyUI/skyui.esp");
      const childPath = await child.resolve();

      const isAncestor = await parent.isAncestorOf(childPath);

      expect(isAncestor).toBe(true);
    });

    it("should return false for non-child paths", async () => {
      const parent = resolver.PathFor("test1", "mods");
      const nonChild = resolver.PathFor("test2", "other");
      const nonChildPath = await nonChild.resolve();

      const isAncestor = await parent.isAncestorOf(nonChildPath);

      expect(isAncestor).toBe(false);
    });

    it("should return true for exact match", async () => {
      const parent = resolver.PathFor("test1", "mods");
      const exactPath = await parent.resolve();

      const isAncestor = await parent.isAncestorOf(exactPath);

      expect(isAncestor).toBe(true);
    });
  });

  describe("FilePath property access", () => {
    let resolver: TestResolver;

    beforeEach(() => {
      resolver = new TestResolver();
    });

    it("should return correct anchor", () => {
      const filePath = resolver.PathFor("test1", "mods");
      const anchor = filePath.anchor;

      expect(Anchor.name(anchor)).toBe("test1");
    });

    it("should return correct resolver", () => {
      const filePath = resolver.PathFor("test1", "mods");
      const returnedResolver = filePath.resolver;

      expect(returnedResolver).toBe(resolver);
    });

    it("should return correct relative path", () => {
      const filePath = resolver.PathFor("test1", "mods/skyrim");
      const relative = filePath.relative;

      expect(relative as string).toBe("mods/skyrim");
    });
  });

  describe("Round-trip conversion", () => {
    let resolver: TestResolver;

    beforeEach(() => {
      resolver = new TestResolver();
    });

    it("should round-trip: FilePath → resolve → tryReverse → FilePath", async () => {
      const original = resolver.PathFor(
        "test1",
        "mods/SkyUI/interface/skyui.swf",
      );

      // Forward: FilePath → OS path
      const osPath = await original.resolve();

      // Reverse: OS path → FilePath
      const reconstructed = await resolver.tryReverse(osPath);
      expect(reconstructed).not.toBeNull();

      // Should resolve to the same OS path
      const resolvedAgain = await reconstructed.resolve();
      expect(resolvedAgain).toBe(osPath);
    });
  });

  describe("Integration: Complex path manipulations", () => {
    let resolver: TestResolver;

    beforeEach(() => {
      resolver = new TestResolver();
    });

    it("should handle backup scenario", async () => {
      // Original mod file
      const modPath = resolver.PathFor("test1", "Data/Meshes/armor.nif");

      // Create backup path
      const backupBase = resolver.PathFor("test2", "backups/2024-01-15");
      const backedUp = modPath.withBase(backupBase);

      // Verify structure preserved
      const resolved = await backedUp.resolve();

      // Check that the path contains the expected structure
      expect(resolved as string).toContain("backups");
      expect(resolved as string).toContain("2024-01-15");
      expect(resolved as string).toContain("Data");
      expect(resolved as string).toContain("Meshes");
      expect(resolved as string).toContain("armor.nif");
    });

    it("should handle file discovery scenario", async () => {
      // Scan directory and discover files (simulated)
      const baseDir = resolver.PathFor("test1", "mods");
      const _basePath = await baseDir.resolve();

      // Create actual child FilePaths that we know will exist
      const skyuiPath = resolver.PathFor("test1", "mods/SkyUI/skyui.esp");
      const sksePath = resolver.PathFor("test1", "mods/SKSE/skse64_loader.exe");

      // Resolve to get OS paths
      const skyuiResolved = await skyuiPath.resolve();
      const skseResolved = await sksePath.resolve();

      // Simulate discovered files
      const discoveredFiles = [skyuiResolved, skseResolved];

      // Convert back to FilePath objects
      const filePaths = await Promise.all(
        discoveredFiles.map((file) => resolver.tryReverse(file)),
      );

      expect(filePaths).toHaveLength(2);
      expect(filePaths[0]).not.toBeNull();
      expect(filePaths[1]).not.toBeNull();

      // Verify they're all under 'test1' anchor
      filePaths.forEach((fp) => {
        expect(Anchor.name(fp.anchor)).toBe("test1");
      });
    });
  });

  describe("Deterministic platform behavior", () => {
    it("should be case-insensitive for Windows-backed reverse resolution", async () => {
      const resolver = new TestResolver(new MockWindowsFilesystem());
      const filePath = resolver.PathFor("test1", "mods/skyui");
      const osPath = await filePath.resolve();

      const result = await resolver.tryReverse(
        ResolvedPath.make((osPath as string).toLowerCase()),
      );

      expect(result).not.toBeNull();
      expect(Anchor.name(result.anchor)).toBe("test1");
    });

    it("should be case-insensitive for Windows-backed relativeTo", async () => {
      const resolver = new TestResolver(new MockWindowsFilesystem());
      const parent = resolver.PathFor("test1", "mods");
      const child = resolver.PathFor("test1", "mods/skyui/file.txt");
      const parentPath = await parent.resolve();

      const relative = await child.relativeTo((parentPath as string).toLowerCase());

      expect(relative).not.toBeNull();
    });
  });
});
