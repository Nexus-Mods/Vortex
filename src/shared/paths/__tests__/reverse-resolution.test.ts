/**
 * Tests for reverse resolution functionality
 *
 * Tests the ability to convert OS paths back to FilePath objects,
 * extract relative paths, and manipulate path bases.
 */

// eslint-disable-next-line vortex/no-module-imports
import * as path from 'path';

import { FilePath } from '../FilePath';
import { WindowsResolver } from '../resolvers/WindowsResolver';
import { UnixResolver } from '../resolvers/UnixResolver';
import { MockFilesystem } from '../filesystem/MockFilesystem';
import { MockUnixFilesystem } from '../filesystem/MockUnixFilesystem';
import { MockWindowsFilesystem } from '../filesystem/MockWindowsFilesystem';
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
  constructor(parent?: import('../IResolver').IResolver) {
    super('test', parent, new MockFilesystem(
      process.platform === 'win32' ? 'win32' : 'linux',
      process.platform !== 'win32',
    ));
  }

  protected getStrategy() {
    return fromRecord({
      test1: ResolvedPath.make(process.platform === 'win32' ? 'C:\\test\\base1' : '/test/base1'),
      test2: ResolvedPath.make(process.platform === 'win32' ? 'C:\\test\\base2' : '/test/base2'),
      nested: ResolvedPath.make(process.platform === 'win32' ? 'C:\\test\\base1\\nested' : '/test/base1/nested'),
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

  describe('Parent delegation', () => {
    let parentResolver: TestResolver;
    let childResolver: TestResolver;

    beforeEach(() => {
      parentResolver = new TestResolver();
      childResolver = new TestResolver(parentResolver);

      // Give them different names
      (parentResolver as any).name = 'parent';
      (childResolver as any).name = 'child';
    });

    it('should try child resolver first', async () => {
      const originalPath = childResolver.PathFor('test1', 'mods/SkyUI');
      const osPath = await originalPath.resolve();

      const result = await childResolver.tryReverse(osPath);

      expect(result).not.toBeNull();
      expect(Anchor.name(result!.anchor)).toBe('test1');
      expect(result!.relative as string).toBe('mods/SkyUI');
    });

    it('should delegate to parent when child cannot handle path', async () => {
      // Create a path that parent can handle but not child
      const parentPath = parentResolver.PathFor('test2', 'other/file.txt');
      const osPath = await parentPath.resolve();

      // childResolver should delegate to parent
      const result = await childResolver.tryReverse(osPath);

      expect(result).not.toBeNull();
      expect(Anchor.name(result!.anchor)).toBe('test2');
      expect(result!.relative as string).toBe('other/file.txt');
    });

    it('should return null when neither child nor parent can handle path', async () => {
      const osPath = ResolvedPath.make(makeAbsolutePath('unmatched', 'path'));
      const result = await childResolver.tryReverse(osPath);

      expect(result).toBeNull();
    });

    it('should resolve anchors through parent delegation', async () => {
      // Child cannot resolve 'test2', should delegate to parent
      const result = await childResolver.resolve(Anchor.make('test2'), RelativePath.make('file.txt'));

      expect(result).toBeDefined();
      // Should match what parent would resolve
      const parentResult = await parentResolver.resolve(Anchor.make('test2'), RelativePath.make('file.txt'));
      expect(result).toBe(parentResult);
    });
  });

  describe('Multiple resolver matching', () => {
    let resolver: TestResolver;

    beforeEach(() => {
      resolver = new TestResolver();
    });

    it('should find matching anchor for path', async () => {
      // Path that 'nested' anchor should match
      const nestedFilePath = resolver.PathFor('nested', 'file.txt');
      const osPath = await nestedFilePath.resolve();

      const result = await resolver.tryReverse(osPath);

      // Should find the nested anchor (most specific)
      expect(result).not.toBeNull();
      expect(Anchor.name(result!.anchor)).toBe('nested');
    });

    it('should return null when no match', async () => {
      const osPath = ResolvedPath.make(makeAbsolutePath('unmatched'));
      const result = await resolver.tryReverse(osPath);

      expect(result).toBeNull();
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

      expect(Anchor.name(moved.anchor)).toBe('test2');
      expect(moved.relative as string).toBe('backups/skyrim/Data/Meshes/armor.nif');
      expect(moved.resolver).toBe(resolver);
    });

    it('should work with empty base relative', () => {
      const original = resolver.PathFor('test1', 'mods/skyrim.esp');
      const newBase = resolver.PathFor('test2');

      const moved = original.withBase(newBase);

      expect(moved.relative as string).toBe('mods/skyrim.esp');
    });

    it('should work with empty original relative', () => {
      const original = resolver.PathFor('test1');
      const newBase = resolver.PathFor('test2', 'backup');

      const moved = original.withBase(newBase);

      expect(moved.relative as string).toBe('backup');
    });

    it('should preserve resolver from new base', () => {
      const resolver2 = new TestResolver();
      (resolver2 as any).name = 'test-different';

      const original = resolver.PathFor('test1', 'file.txt');
      const newBase = resolver2.PathFor('test1', 'backup');

      const moved = original.withBase(newBase);

      expect(moved.resolver).toBe(resolver2);
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

  describe('FilePath property access', () => {
    let resolver: TestResolver;

    beforeEach(() => {
      resolver = new TestResolver();
    });

    it('should return correct anchor', () => {
      const filePath = resolver.PathFor('test1', 'mods');
      const anchor = filePath.anchor;

      expect(Anchor.name(anchor)).toBe('test1');
    });

    it('should return correct resolver', () => {
      const filePath = resolver.PathFor('test1', 'mods');
      const returnedResolver = filePath.resolver;

      expect(returnedResolver).toBe(resolver);
    });

    it('should return correct relative path', () => {
      const filePath = resolver.PathFor('test1', 'mods/skyrim');
      const relative = filePath.relative;

      expect(relative as string).toBe('mods/skyrim');
    });
  });

  describe('Round-trip conversion', () => {
    let resolver: TestResolver;

    beforeEach(() => {
      resolver = new TestResolver();
    });

    it('should round-trip: FilePath → resolve → tryReverse → FilePath', async () => {
      const original = resolver.PathFor('test1', 'mods/SkyUI/interface/skyui.swf');

      // Forward: FilePath → OS path
      const osPath = await original.resolve();

      // Reverse: OS path → FilePath
      const reconstructed = await resolver.tryReverse(osPath);
      expect(reconstructed).not.toBeNull();

      // Should resolve to the same OS path
      const resolvedAgain = await reconstructed!.resolve();
      expect(path.normalize(resolvedAgain as string))
        .toBe(path.normalize(osPath as string));
    });
  });

  describe('Integration: Complex path manipulations', () => {
    let resolver: TestResolver;

    beforeEach(() => {
      resolver = new TestResolver();
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
        discoveredFiles.map(file => resolver.tryReverse(file))
      );

      expect(filePaths).toHaveLength(2);
      expect(filePaths[0]).not.toBeNull();
      expect(filePaths[1]).not.toBeNull();

      // Verify they're all under 'test1' anchor
      filePaths.forEach(fp => {
        expect(Anchor.name(fp!.anchor)).toBe('test1');
      });
    });
  });

  describe('Cross-platform compatibility', () => {
    it('should handle platform-specific paths correctly', async () => {
      if (isWindows) {
        const resolver = new WindowsResolver(undefined, new MockWindowsFilesystem());
        const testPath = resolver.PathFor('c', 'test/file.txt');
        const osPath = await testPath.resolve();

        const result = await resolver.tryReverse(osPath);
        // Windows resolver should handle C: drive
        expect(result).not.toBeNull();
        expect(result ? Anchor.name(result.anchor) : null).toBe('c');
      } else {
        const resolver = new UnixResolver(undefined, new MockUnixFilesystem());
        const testPath = resolver.PathFor('root', 'test/file.txt');
        const osPath = await testPath.resolve();

        const result = await resolver.tryReverse(osPath);
        // Unix resolver should handle root
        expect(result).not.toBeNull();
        expect(result ? Anchor.name(result.anchor) : null).toBe('root');
      }
    });
  });
});
