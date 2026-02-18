/**
 * Tests for reverse resolution functionality
 *
 * Tests the ability to convert OS paths back to FilePath objects,
 * extract relative paths, and manipulate path bases.
 */

// eslint-disable-next-line vortex/no-module-imports
import * as path from 'path';

import { FilePath } from '../FilePath';
import { ResolverRegistry } from '../ResolverRegistry';
import { VortexResolver } from '../resolvers/VortexResolver';
import { WindowsResolver } from '../resolvers/WindowsResolver';
import { UnixResolver } from '../resolvers/UnixResolver';
import {
  Anchor,
  RelativePath,
  ResolvedPath,
} from '../types';
import { fromRecord, MappingResolver } from '../resolvers/MappingResolver';

// ============================================================================
// Mock Resolver for Testing
// ============================================================================

class TestResolver extends MappingResolver<'test1' | 'test2' | 'nested'> {
  constructor() {
    super('test');
  }

  protected getStrategy() {
    return fromRecord({
      test1: ResolvedPath.make(process.platform === 'win32' ? 'C:\\test\\base1' : '/test/base1'),
      test2: ResolvedPath.make(process.platform === 'win32' ? 'C:\\test\\base2' : '/test/base2'),
      nested: ResolvedPath.make(process.platform === 'win32' ? 'C:\\test\\base1\\nested' : '/test/base1/nested'),
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

const isWindows = process.platform === 'win32';
const isUnix = !isWindows;

function makePath(...segments: string[]): string {
  return path.join(...segments);
}

function makeAbsolutePath(...segments: string[]): string {
  if (isWindows) {
    return path.join('C:\\', ...segments);
  } else {
    return path.join('/', ...segments);
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Reverse Resolution', () => {
  describe('BaseResolver.tryReverse', () => {
    let resolver: TestResolver;

    beforeEach(() => {
      resolver = new TestResolver();
    });

    it('should reverse-resolve a path to the correct anchor and relative', async () => {
      // Use the actual resolved path from the resolver to ensure it matches
      const baseFilePath = resolver.PathFor('test1', 'mods/SkyUI');
      const osPath = await baseFilePath.resolve();

      const result = await resolver.tryReverse(osPath);

      expect(result).not.toBeNull();
      expect(Anchor.name(result!.anchor)).toBe('test1');
      expect(result!.relative as string).toBe('mods/SkyUI');
    });

    it('should return null for paths not under any anchor', async () => {
      const osPath = ResolvedPath.make(makeAbsolutePath('other', 'path'));
      const result = await resolver.tryReverse(osPath);

      expect(result).toBeNull();
    });

    it('should prefer longest matching base path', async () => {
      // 'nested' anchor is under 'test1' anchor - should prefer 'nested'
      const nestedFilePath = resolver.PathFor('nested', 'subdir');
      const osPath = await nestedFilePath.resolve();

      const result = await resolver.tryReverse(osPath);

      expect(result).not.toBeNull();
      expect(Anchor.name(result!.anchor)).toBe('nested');
      expect(result!.relative as string).toBe('subdir');
    });

    it('should handle exact anchor path (empty relative)', async () => {
      const anchorFilePath = resolver.PathFor('test1');
      const osPath = await anchorFilePath.resolve();

      const result = await resolver.tryReverse(osPath);

      expect(result).not.toBeNull();
      expect(Anchor.name(result!.anchor)).toBe('test1');
      expect(result!.relative).toBe('');
    });

    if (isWindows) {
      it('should be case-insensitive on Windows', async () => {
        const filePath = resolver.PathFor('test1', 'mods/skyui');
        const osPath = await filePath.resolve();
        // Convert to lowercase to test case-insensitivity
        const lowercasePath = ResolvedPath.make((osPath as string).toLowerCase());

        const result = await resolver.tryReverse(lowercasePath);

        expect(result).not.toBeNull();
        expect(Anchor.name(result!.anchor)).toBe('test1');
      });
    }

    it('should cache base paths for performance', async () => {
      const filePath = resolver.PathFor('test1', 'mods');
      const osPath = await filePath.resolve();

      // First call - should populate cache
      const result1 = await resolver.tryReverse(osPath);
      expect(result1).not.toBeNull();

      // Second call - should use cache
      const result2 = await resolver.tryReverse(osPath);
      expect(result2).not.toBeNull();

      // Results should be equivalent
      expect(Anchor.name(result1!.anchor)).toBe(Anchor.name(result2!.anchor));
      expect(result1!.relative).toBe(result2!.relative);
    });

    it('should clear cache when requested', async () => {
      const filePath = resolver.PathFor('test1', 'mods');
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

  describe('BaseResolver.getBasePaths', () => {
    let resolver: TestResolver;

    beforeEach(() => {
      resolver = new TestResolver();
    });

    it('should return all base paths', async () => {
      const basePaths = await resolver.getBasePaths();

      expect(basePaths.size).toBeGreaterThanOrEqual(3);
      expect(basePaths.has(Anchor.make('test1'))).toBe(true);
      expect(basePaths.has(Anchor.make('test2'))).toBe(true);
      expect(basePaths.has(Anchor.make('nested'))).toBe(true);
    });

    it('should cache base paths', async () => {
      const basePaths1 = await resolver.getBasePaths();
      const basePaths2 = await resolver.getBasePaths();

      // Should return the same promise/object
      expect(basePaths1).toBe(basePaths2);
    });
  });

  describe('ResolverRegistry.fromResolved', () => {
    let registry: ResolverRegistry;
    let resolver1: TestResolver;
    let resolver2: TestResolver;

    beforeEach(() => {
      registry = new ResolverRegistry();
      resolver1 = new TestResolver();
      resolver2 = new TestResolver();

      // Give them different names
      (resolver1 as any).name = 'test1';
      (resolver2 as any).name = 'test2';

      registry.register(resolver1);
      registry.register(resolver2);
      registry.setDefault(resolver1);
    });

    it('should find correct resolver for path', async () => {
      const originalPath = resolver1.PathFor('test1', 'mods/SkyUI');
      const osPath = await originalPath.resolve();

      const filePath = await registry.fromResolved(osPath);

      expect(filePath).not.toBeNull();
      expect(filePath!.getResolver()).toBe(resolver1);
      expect(Anchor.name(filePath!.getAnchor())).toBe('test1');
      expect(filePath!.getRelativePath() as string).toBe('mods/SkyUI');
    });

    it('should return null when no resolver matches', async () => {
      const osPath = ResolvedPath.make(makeAbsolutePath('unmatched', 'path'));
      const filePath = await registry.fromResolved(osPath);

      expect(filePath).toBeNull();
    });

    it('should prefer specified resolver', async () => {
      const originalPath = resolver1.PathFor('test1', 'mods');
      const osPath = await originalPath.resolve();

      // Try with preferred resolver
      const filePath = await registry.fromResolved(osPath, 'test2');

      // Should still use test1 since test2 can't handle it, but it tried test2 first
      expect(filePath).not.toBeNull();
    });

    it('should respect registration order for priority', async () => {
      const originalPath = resolver1.PathFor('test1', 'mods');
      const osPath = await originalPath.resolve();

      // First resolver registered should win
      const filePath = await registry.fromResolved(osPath);

      expect(filePath).not.toBeNull();
      expect(filePath!.getResolver().name).toBe('test1');
    });
  });

  describe('ResolverRegistry.findAllMatches', () => {
    let registry: ResolverRegistry;
    let resolver: TestResolver;

    beforeEach(() => {
      registry = new ResolverRegistry();
      resolver = new TestResolver();
      registry.register(resolver);
    });

    it('should find all matching resolvers', async () => {
      // Path that 'nested' and 'test1' both could claim
      const nestedFilePath = resolver.PathFor('nested', 'file.txt');
      const osPath = await nestedFilePath.resolve();

      const matches = await registry.findAllMatches(osPath);

      // Should find at least the nested anchor
      expect(matches.length).toBeGreaterThanOrEqual(1);

      // Verify we found 'nested'
      const nestedMatch = matches.find(m => Anchor.name(m.anchor) === 'nested');
      expect(nestedMatch).toBeDefined();
    });

    it('should return empty array when no matches', async () => {
      const osPath = ResolvedPath.make(makeAbsolutePath('unmatched'));
      const matches = await registry.findAllMatches(osPath);

      expect(matches).toEqual([]);
    });
  });

  describe('ResolverRegistry.clearReverseResolutionCache', () => {
    let registry: ResolverRegistry;
    let resolver: TestResolver;

    beforeEach(() => {
      registry = new ResolverRegistry();
      resolver = new TestResolver();
      registry.register(resolver);
    });

    it('should clear caches for all resolvers', async () => {
      const originalPath = resolver.PathFor('test1', 'mods');
      const osPath = await originalPath.resolve();

      // Populate cache
      await registry.fromResolved(osPath);

      // Clear caches
      registry.clearReverseResolutionCache();

      // Should still work after cache clear
      const filePath = await registry.fromResolved(osPath);
      expect(filePath).not.toBeNull();
    });
  });

  describe('FilePath.relativeTo', () => {
    let resolver: TestResolver;

    beforeEach(() => {
      resolver = new TestResolver();
    });

    it('should extract relative path for child', async () => {
      const parent = resolver.PathFor('test1', 'mods');
      const child = resolver.PathFor('test1', 'mods/SkyUI/interface/skyui.swf');
      const childPath = await child.resolve();

      const relative = await parent.relativeTo(childPath);

      expect(relative).not.toBeNull();
      expect(relative as string).toBe('SkyUI/interface/skyui.swf');
    });

    it('should return null for non-child paths', async () => {
      const parent = resolver.PathFor('test1', 'mods');
      const nonChild = resolver.PathFor('test2', 'other');
      const nonChildPath = await nonChild.resolve();

      const relative = await parent.relativeTo(nonChildPath);

      expect(relative).toBeNull();
    });

    it('should handle exact match (empty relative)', async () => {
      const parent = resolver.PathFor('test1', 'mods');
      const childPath = await parent.resolve();

      const relative = await parent.relativeTo(childPath);

      expect(relative).not.toBeNull();
      expect(relative).toBe('');
    });

    if (isWindows) {
      it('should be case-insensitive on Windows', async () => {
        const parent = resolver.PathFor('test1', 'mods');
        const child = resolver.PathFor('test1', 'mods/skyui/file.txt');
        const childPath = await child.resolve();
        // Convert to lowercase
        const lowercasePath = (childPath as string).toLowerCase();

        const relative = await parent.relativeTo(lowercasePath);

        expect(relative).not.toBeNull();
      });
    }

    it('should allow reconstructing child FilePath', async () => {
      const parent = resolver.PathFor('test1', 'mods');
      const child = resolver.PathFor('test1', 'mods/SkyUI/skyui.esp');
      const childPath = await child.resolve();

      const relative = await parent.relativeTo(childPath);
      expect(relative).not.toBeNull();

      const reconstructed = parent.join(relative as string);
      const resolvedChild = await reconstructed.resolve();

      expect(path.normalize(resolvedChild as string))
        .toBe(path.normalize(childPath as string));
    });
  });

  describe('FilePath.withBase', () => {
    let resolver: TestResolver;

    beforeEach(() => {
      resolver = new TestResolver();
    });

    it('should replace base while preserving structure', () => {
      const original = resolver.PathFor('test1', 'Data/Meshes/armor.nif');
      const newBase = resolver.PathFor('test2', 'backups/skyrim');

      const moved = original.withBase(newBase);

      expect(Anchor.name(moved.getAnchor())).toBe('test2');
      expect(moved.getRelativePath() as string).toBe('backups/skyrim/Data/Meshes/armor.nif');
      expect(moved.getResolver()).toBe(resolver);
    });

    it('should work with empty base relative', () => {
      const original = resolver.PathFor('test1', 'mods/skyrim.esp');
      const newBase = resolver.PathFor('test2');

      const moved = original.withBase(newBase);

      expect(moved.getRelativePath() as string).toBe('mods/skyrim.esp');
    });

    it('should work with empty original relative', () => {
      const original = resolver.PathFor('test1');
      const newBase = resolver.PathFor('test2', 'backup');

      const moved = original.withBase(newBase);

      expect(moved.getRelativePath() as string).toBe('backup');
    });

    it('should preserve resolver from new base', () => {
      const resolver2 = new TestResolver();
      (resolver2 as any).name = 'test-different';

      const original = resolver.PathFor('test1', 'file.txt');
      const newBase = resolver2.PathFor('test1', 'backup');

      const moved = original.withBase(newBase);

      expect(moved.getResolver()).toBe(resolver2);
    });
  });

  describe('FilePath.isAncestorOf', () => {
    let resolver: TestResolver;

    beforeEach(() => {
      resolver = new TestResolver();
    });

    it('should return true for child paths', async () => {
      const parent = resolver.PathFor('test1', 'mods');
      const child = resolver.PathFor('test1', 'mods/SkyUI/skyui.esp');
      const childPath = await child.resolve();

      const isAncestor = await parent.isAncestorOf(childPath);

      expect(isAncestor).toBe(true);
    });

    it('should return false for non-child paths', async () => {
      const parent = resolver.PathFor('test1', 'mods');
      const nonChild = resolver.PathFor('test2', 'other');
      const nonChildPath = await nonChild.resolve();

      const isAncestor = await parent.isAncestorOf(nonChildPath);

      expect(isAncestor).toBe(false);
    });

    it('should return true for exact match', async () => {
      const parent = resolver.PathFor('test1', 'mods');
      const exactPath = await parent.resolve();

      const isAncestor = await parent.isAncestorOf(exactPath);

      expect(isAncestor).toBe(true);
    });
  });

  describe('FilePath getter methods', () => {
    let resolver: TestResolver;

    beforeEach(() => {
      resolver = new TestResolver();
    });

    it('should return correct anchor', () => {
      const filePath = resolver.PathFor('test1', 'mods');
      const anchor = filePath.getAnchor();

      expect(Anchor.name(anchor)).toBe('test1');
    });

    it('should return correct resolver', () => {
      const filePath = resolver.PathFor('test1', 'mods');
      const returnedResolver = filePath.getResolver();

      expect(returnedResolver).toBe(resolver);
    });

    it('should return correct relative path', () => {
      const filePath = resolver.PathFor('test1', 'mods/skyrim');
      const relative = filePath.getRelativePath();

      expect(relative as string).toBe('mods/skyrim');
    });
  });

  describe('Round-trip conversion', () => {
    let resolver: TestResolver;

    beforeEach(() => {
      resolver = new TestResolver();
    });

    it('should round-trip: FilePath → resolve → fromResolved → FilePath', async () => {
      const registry = new ResolverRegistry();
      registry.register(resolver);

      const original = resolver.PathFor('test1', 'mods/SkyUI/interface/skyui.swf');

      // Forward: FilePath → OS path
      const osPath = await original.resolve();

      // Reverse: OS path → FilePath
      const reconstructed = await registry.fromResolved(osPath);

      expect(reconstructed).not.toBeNull();

      // Should resolve to the same OS path
      const resolvedAgain = await reconstructed!.resolve();
      expect(path.normalize(resolvedAgain as string))
        .toBe(path.normalize(osPath as string));
    });
  });

  describe('Integration: Complex path manipulations', () => {
    let resolver: TestResolver;
    let registry: ResolverRegistry;

    beforeEach(() => {
      resolver = new TestResolver();
      registry = new ResolverRegistry();
      registry.register(resolver);
    });

    it('should handle backup scenario', async () => {
      // Original mod file
      const modPath = resolver.PathFor('test1', 'Data/Meshes/armor.nif');

      // Create backup path
      const backupBase = resolver.PathFor('test2', 'backups/2024-01-15');
      const backedUp = modPath.withBase(backupBase);

      // Verify structure preserved
      const resolved = await backedUp.resolve();

      // Check that the path contains the expected structure
      expect((resolved as string)).toContain('backups');
      expect((resolved as string)).toContain('2024-01-15');
      expect((resolved as string)).toContain('Data');
      expect((resolved as string)).toContain('Meshes');
      expect((resolved as string)).toContain('armor.nif');
    });

    it('should handle file discovery scenario', async () => {
      // Scan directory and discover files (simulated)
      const baseDir = resolver.PathFor('test1', 'mods');
      const basePath = await baseDir.resolve();

      // Create actual child FilePaths that we know will exist
      const skyuiPath = resolver.PathFor('test1', 'mods/SkyUI/skyui.esp');
      const sksePath = resolver.PathFor('test1', 'mods/SKSE/skse64_loader.exe');

      // Resolve to get OS paths
      const skyuiResolved = await skyuiPath.resolve();
      const skseResolved = await sksePath.resolve();

      // Simulate discovered files
      const discoveredFiles = [skyuiResolved, skseResolved];

      // Convert back to FilePath objects
      const filePaths = await Promise.all(
        discoveredFiles.map(file => registry.fromResolved(file))
      );

      expect(filePaths).toHaveLength(2);
      expect(filePaths[0]).not.toBeNull();
      expect(filePaths[1]).not.toBeNull();

      // Verify they're all under 'test1' anchor
      filePaths.forEach(fp => {
        expect(Anchor.name(fp!.getAnchor())).toBe('test1');
      });
    });
  });

  describe('Cross-platform compatibility', () => {
    it('should handle platform-specific paths correctly', async () => {
      if (isWindows) {
        const resolver = new WindowsResolver();
        const testPath = resolver.PathFor('drive_c', 'test/file.txt');
        const osPath = await testPath.resolve();

        const result = await resolver.tryReverse(osPath);
        // Windows resolver should handle C: drive
        expect(result).not.toBeNull();
        expect(result?.anchor ? Anchor.name(result.anchor) : null).toBe('drive_c');
      } else {
        const resolver = new UnixResolver();
        const testPath = resolver.PathFor('root', 'test/file.txt');
        const osPath = await testPath.resolve();

        const result = await resolver.tryReverse(osPath);
        // Unix resolver should handle root
        expect(result).not.toBeNull();
        expect(result?.anchor ? Anchor.name(result.anchor) : null).toBe('root');
      }
    });
  });
});
