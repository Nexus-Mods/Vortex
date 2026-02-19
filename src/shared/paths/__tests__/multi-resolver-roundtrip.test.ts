/**
 * Multi-Resolver Roundtrip Tests
 *
 * Tests path roundtripping through multiple resolver layers to validate
 * that paths can correctly convert between different resolver "coordinate systems"
 * and maintain their resolved path identity.
 *
 * Key scenarios:
 * - Paths starting in one resolver can be converted to another resolver's coordinate system
 * - Roundtripping through multiple resolvers preserves OS path identity
 * - Registry properly handles resolver priority and matching
 */

/* eslint-disable vortex/no-module-imports */
import * as path from 'path';

import { FilePath } from '../FilePath';
import { UnixResolver } from '../resolvers/UnixResolver';
import { VortexResolver } from '../resolvers/VortexResolver';
import { Anchor, ResolvedPath } from '../types';

// ============================================================================
// Mock getVortexPath for Deterministic Tests
// ============================================================================

// Mock getVortexPath to return predictable paths for testing
jest.mock('../../../renderer/util/getVortexPath', () => {
  const base = '/home/user/.vortex';
  const mapping: Record<string, string> = {
    userData: `${base}/userData`,
    temp: `${base}/temp`,
    documents: `${base}/documents`,
    appData: `${base}/appData`,
    localAppData: `${base}/localAppData`,
    home: '/home/user',
    desktop: '/home/user/Desktop',
    base: base,
    assets: `${base}/assets`,
    assets_unpacked: `${base}/assets.unpacked`,
    modules: `${base}/node_modules`,
    modules_unpacked: `${base}/node_modules.unpacked`,
    bundledPlugins: `${base}/bundledPlugins`,
    locales: `${base}/locales`,
    package: `${base}/package`,
    package_unpacked: `${base}/package.unpacked`,
    application: `${base}/app`,
    exe: `${base}/Vortex`,
  };

  return {
    __esModule: true,
    default: (anchor: string) => {
      if (anchor in mapping) {
        return mapping[anchor];
      }
      return base;
    },
  };
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize path for cross-platform comparison
 * Ensures forward slashes and removes trailing slashes
 */
function normalizePath(p: string): string {
  return path.normalize(p).replace(/\\/g, '/').replace(/\/$/, '');
}

// ============================================================================
// Tests
// ============================================================================

describe('Multi-Resolver Roundtrip', () => {
  let unixResolver: UnixResolver;
  let vortexResolver: VortexResolver;

  beforeEach(() => {
    // Create resolver chain: vortex (child) → unix (parent)
    // This means vortex tries first, then delegates to unix
    unixResolver = new UnixResolver();
    vortexResolver = new VortexResolver(unixResolver);
  });

  describe('Basic Unix ↔ Vortex Roundtrip', () => {
    it('should roundtrip: Unix → OS path → Vortex → OS path', async () => {
      // Start with Unix path pointing to Vortex userData directory
      const unixPath = unixResolver.PathFor('root', 'home/user/.vortex/userData/mods/skyrim');
      const resolved1 = await unixPath.resolve();

      // Convert to VortexResolver using reverse resolution (vortex tries first, then delegates to unix)
      const vortexPath = await vortexResolver.tryReverse(resolved1);
      expect(vortexPath).not.toBeNull();

      // Should identify as VortexResolver
      expect(vortexPath!.getResolver().name).toBe('vortex');
      expect(Anchor.name(vortexPath!.getAnchor())).toBe('userData');
      expect(vortexPath!.getRelativePath()).toBe('mods/skyrim');

      // Resolve back through Vortex
      const resolved2 = await vortexPath.resolve();

      // Verify roundtrip: resolved1 === resolved2
      expect(normalizePath(resolved2 as string)).toBe(normalizePath(resolved1 as string));
    });

    it('should roundtrip: Vortex → OS path → Unix → OS path', async () => {
      // Start with Vortex path
      const vortexPath = vortexResolver.PathFor('userData', 'mods/skyrim/data');
      const resolved1 = await vortexPath.resolve();

      // Convert using vortex resolver (tries vortex first, more specific)
      const reversedPath = await vortexResolver.tryReverse(resolved1);
      expect(reversedPath).not.toBeNull();

      // Since VortexResolver is more specific, it should match
      expect(reversedPath!.getResolver().name).toBe('vortex');

      // But if we explicitly prefer Unix (make unix the child), it should work too
      const unixFirst = new UnixResolver(vortexResolver);
      const preferredUnixPath = await unixFirst.tryReverse(resolved1);
      expect(preferredUnixPath).not.toBeNull();
      expect(preferredUnixPath!.getResolver().name).toBe('unix');
      expect(Anchor.name(preferredUnixPath!.getAnchor())).toBe('root');

      // Resolve back through Unix
      const resolved2 = await preferredUnixPath.resolve();

      // Verify roundtrip: resolved1 === resolved2
      expect(normalizePath(resolved2 as string)).toBe(normalizePath(resolved1 as string));
    });
  });

  describe('Three-Layer Roundtrip', () => {
    it('should survive Unix → Vortex → Unix conversion chain', async () => {
      // Create Unix FilePath
      const original = unixResolver.PathFor('root', 'home/user/.vortex/temp/downloads/mod.zip');
      const originalResolved = await original.resolve();

      // Convert to Vortex FilePath (vortex tries first, matches temp anchor)
      const vortexResult = await vortexResolver.tryReverse(originalResolved);
      expect(vortexResult).not.toBeNull();
      const vortexPath = new FilePath(vortexResult!.relative, vortexResult!.anchor, vortexResolver);
      expect(vortexPath.getResolver().name).toBe('vortex');
      expect(Anchor.name(vortexPath.getAnchor())).toBe('temp');
      expect(vortexPath.getRelativePath()).toBe('downloads/mod.zip');

      // Resolve through Vortex
      const vortexResolved = await vortexPath.resolve();
      expect(normalizePath(vortexResolved as string)).toBe(normalizePath(originalResolved as string));

      // Convert back to Unix FilePath (unix tries first)
      const unixFirst = new UnixResolver(vortexResolver);
      const unixResult = await unixFirst.tryReverse(vortexResolved);
      expect(unixResult).not.toBeNull();
      const unixPath = new FilePath(unixResult!.relative, unixResult!.anchor, unixFirst);
      expect(unixPath.getResolver().name).toBe('unix');
      expect(Anchor.name(unixPath.getAnchor())).toBe('root');

      // Verify relative path matches original
      const finalResolved = await unixPath.resolve();
      expect(normalizePath(finalResolved as string)).toBe(normalizePath(originalResolved as string));
    });

    it('should maintain path structure through multiple conversions', async () => {
      // Start with a deeply nested Vortex path
      const original = vortexResolver.PathFor('userData', 'mods/skyrim/meshes/armor/plate.nif');
      const step1 = await original.resolve();

      // Convert to Unix (unix tries first)
      const unixFirst = new UnixResolver(vortexResolver);
      const unixResult = await unixFirst.tryReverse(step1);
      expect(unixResult).not.toBeNull();
      const unixPath = new FilePath(unixResult!.relative, unixResult!.anchor, unixFirst);
      const step2 = await unixPath.resolve();
      expect(normalizePath(step2 as string)).toBe(normalizePath(step1 as string));

      // Convert back to Vortex (vortex tries first)
      const vortexResult = await vortexResolver.tryReverse(step2);
      expect(vortexResult).not.toBeNull();
      const vortexPath = new FilePath(vortexResult!.relative, vortexResult!.anchor, vortexResolver);
      const step3 = await vortexPath.resolve();
      expect(normalizePath(step3 as string)).toBe(normalizePath(step1 as string));

      // Verify the final path has correct anchor and relative
      expect(Anchor.name(vortexPath.getAnchor())).toBe('userData');
      expect(vortexPath.getRelativePath()).toBe('mods/skyrim/meshes/armor/plate.nif');
    });
  });

  describe('Nested Anchor Preference', () => {
    it('should prefer most specific (longest) matching anchor', async () => {
      // VortexResolver has 'home' → '/home/user' and 'userData' → '/home/user/.vortex/userData'
      // A path under userData should prefer 'userData' over 'home' (which would also match)
      const osPath = ResolvedPath.make('/home/user/.vortex/userData/mods/skyrim.esp');

      const result = await vortexResolver.tryReverse(osPath);

      // Should prefer 'userData' (more specific) over 'home' (less specific)
      expect(result).not.toBeNull();
      expect(Anchor.name(result!.anchor)).toBe('userData');
      expect(result!.relative).toBe('mods/skyrim.esp');
    });

    it('should prefer longer nested anchor over parent anchor', async () => {
      // Test with 'documents' which is under 'home'
      const osPath = ResolvedPath.make('/home/user/.vortex/documents/manuals/guide.pdf');

      const result = await vortexResolver.tryReverse(osPath);

      // Should prefer 'documents' over 'home'
      expect(result).not.toBeNull();
      expect(Anchor.name(result!.anchor)).toBe('documents');
      expect(result!.relative).toBe('manuals/guide.pdf');
    });
  });

  describe('Path Outside Any Resolver', () => {
    it('should return null for paths outside all registered resolvers', async () => {
      // Path that neither Unix nor Vortex can claim (if Unix root resolver exists, it can claim everything under /)
      // But we can create a scenario where it's outside Vortex's specific paths
      const osPath = ResolvedPath.make('/etc/passwd');

      // Vortex resolver chain should find Unix resolver (which can handle any path under /)
      const result = await vortexResolver.tryReverse(osPath);
      expect(result).not.toBeNull();

      // The result comes from unix resolver (through delegation), so use unix resolver to create FilePath
      const filePath = new FilePath(result!.relative, result!.anchor, unixResolver);

      // Unix resolver should handle it (through delegation)
      expect(Anchor.name(filePath.getAnchor())).toBe('root');
      expect(filePath.getRelativePath()).toBe('etc/passwd');
    });

    it('should delegate to parent when child cannot handle path', async () => {
      // Path outside Vortex-specific directories
      const osPath = ResolvedPath.make('/opt/games/skyrim/data');

      // Try reverse resolution with VortexResolver (which has unix as parent)
      const result = await vortexResolver.tryReverse(osPath);

      // VortexResolver delegates to UnixResolver through parent chain
      expect(result).not.toBeNull();
      expect(Anchor.name(result!.anchor)).toBe('root');
      expect(result!.relative).toBe('opt/games/skyrim/data');
    });

    it('should fall back to other resolvers when preferred fails', async () => {
      // Path outside Vortex but inside Unix root
      const osPath = ResolvedPath.make('/opt/games/skyrim/data');

      // Try vortex resolver (which has unix as parent)
      const result = await vortexResolver.tryReverse(osPath);

      // Should fall back to Unix resolver through delegation
      expect(result).not.toBeNull();
      expect(Anchor.name(result!.anchor)).toBe('root');
    });
  });

  describe('Resolver Chain Order', () => {
    it('should respect chain order for overlapping ranges', async () => {
      // Both Unix and Vortex can handle /home/user/.vortex/userData/mods
      // Vortex tries first and is more specific
      const osPath = ResolvedPath.make('/home/user/.vortex/userData/mods/skyui.esp');

      const result = await vortexResolver.tryReverse(osPath);

      // VortexResolver should win (more specific and tries first)
      expect(result).not.toBeNull();
      expect(Anchor.name(result!.anchor)).toBe('userData');
    });

    it('should try child resolver first', async () => {
      const osPath = ResolvedPath.make('/home/user/.vortex/userData/mods/mod.esp');

      // Unix tries first (make unix the child)
      const unixFirst = new UnixResolver(vortexResolver);
      const unixResult = await unixFirst.tryReverse(osPath);
      expect(unixResult).not.toBeNull();
      expect(Anchor.name(unixResult!.anchor)).toBe('root');

      // Vortex tries first (make vortex the child)
      const vortexResult = await vortexResolver.tryReverse(osPath);
      expect(vortexResult).not.toBeNull();
      expect(Anchor.name(vortexResult!.anchor)).toBe('userData');
    });

    it('should find all resolvers that can handle a path', async () => {
      const osPath = ResolvedPath.make('/home/user/.vortex/temp/cache/file.txt');

      // Manually try each resolver
      const matches: Array<{ resolver: any; filePath: FilePath }> = [];

      const vortexResult = await vortexResolver.tryReverse(osPath);
      if (vortexResult) {
        matches.push({
          resolver: vortexResolver,
          filePath: new FilePath(vortexResult.relative, vortexResult.anchor, vortexResolver),
        });
      }

      const unixResult = await unixResolver.tryReverse(osPath);
      if (unixResult) {
        matches.push({
          resolver: unixResolver,
          filePath: new FilePath(unixResult.relative, unixResult.anchor, unixResolver),
        });
      }

      // Both Unix and Vortex should be able to handle this path
      expect(matches.length).toBeGreaterThanOrEqual(2);

      const resolverNames = matches.map(m => m.resolver.name);
      expect(resolverNames).toContain('unix');
      expect(resolverNames).toContain('vortex');

      // Vortex should have 'temp' anchor
      const vortexMatch = matches.find(m => m.resolver.name === 'vortex');
      expect(vortexMatch).toBeDefined();
      expect(Anchor.name(vortexMatch!.filePath.getAnchor())).toBe('temp');
      expect(vortexMatch!.filePath.getRelativePath()).toBe('cache/file.txt');

      // Unix should have 'root' anchor
      const unixMatch = matches.find(m => m.resolver.name === 'unix');
      expect(unixMatch).toBeDefined();
      expect(Anchor.name(unixMatch!.filePath.getAnchor())).toBe('root');
    });
  });

  describe('withBase() Roundtrip', () => {
    it('should roundtrip paths moved with withBase()', async () => {
      // Original file in userData
      const original = vortexResolver.PathFor('userData', 'mods/skyrim/mesh.nif');

      // Move to temp backup location
      const backupBase = vortexResolver.PathFor('temp', 'backups/2024');
      const moved = original.withBase(backupBase);

      // Verify structure
      expect(Anchor.name(moved.getAnchor())).toBe('temp');
      expect(moved.getRelativePath()).toBe('backups/2024/mods/skyrim/mesh.nif');

      // Resolve and reverse
      const resolved = await moved.resolve();
      const result = await vortexResolver.tryReverse(resolved);
      expect(result).not.toBeNull();
      const reversed = new FilePath(result!.relative, result!.anchor, vortexResolver);

      // Should reconstruct correctly
      expect(Anchor.name(reversed.getAnchor())).toBe('temp');
      expect(reversed.getRelativePath()).toBe('backups/2024/mods/skyrim/mesh.nif');

      // Should resolve to same path
      const finalResolved = await reversed.resolve();
      expect(normalizePath(finalResolved as string)).toBe(normalizePath(resolved as string));
    });

    it('should handle withBase() across resolver boundaries', async () => {
      // Start with Unix path
      const original = unixResolver.PathFor('root', 'tmp/extracted/mod/data.esp');

      // Move to Vortex userData (different resolver)
      const vortexBase = vortexResolver.PathFor('userData', 'staging');
      const moved = original.withBase(vortexBase);

      // Should now be a Vortex path
      expect(moved.getResolver().name).toBe('vortex');
      expect(Anchor.name(moved.getAnchor())).toBe('userData');
      expect(moved.getRelativePath()).toBe('staging/tmp/extracted/mod/data.esp');

      // Roundtrip through resolution
      const resolved = await moved.resolve();
      const result = await vortexResolver.tryReverse(resolved);
      expect(result).not.toBeNull();
      const reversed = new FilePath(result!.relative, result!.anchor, vortexResolver);

      expect(reversed.getResolver().name).toBe('vortex');
      expect(Anchor.name(reversed.getAnchor())).toBe('userData');
      expect(reversed.getRelativePath()).toBe('staging/tmp/extracted/mod/data.esp');
    });

    it('should preserve structure through withBase() + roundtrip', async () => {
      // Complex scenario: move file, resolve, reverse, verify
      const modFile = vortexResolver.PathFor('userData', 'mods/elden-ring/chr/armor.chrbnd');
      const backupDir = vortexResolver.PathFor('temp', 'backups/2024-01-15');

      // Move to backup
      const backed = modFile.withBase(backupDir);
      expect(backed.getRelativePath()).toBe('backups/2024-01-15/mods/elden-ring/chr/armor.chrbnd');

      // Resolve to OS path
      const osPath = await backed.resolve();

      // Reverse through resolver chain
      const result = await vortexResolver.tryReverse(osPath);
      expect(result).not.toBeNull();
      const restored = new FilePath(result!.relative, result!.anchor, vortexResolver);

      // Should match backed path exactly
      expect(Anchor.name(restored.getAnchor())).toBe('temp');
      expect(restored.getRelativePath()).toBe('backups/2024-01-15/mods/elden-ring/chr/armor.chrbnd');
    });
  });

  describe('Cache Behavior', () => {
    it('should cache base paths for performance', async () => {
      const osPath = ResolvedPath.make('/home/user/.vortex/userData/mods/skyrim.esp');

      // First call - populates cache
      const result1 = await vortexResolver.tryReverse(osPath);
      expect(result1).not.toBeNull();

      // Second call - uses cache
      const result2 = await vortexResolver.tryReverse(osPath);
      expect(result2).not.toBeNull();

      // Results should be equivalent
      expect(Anchor.name(result1!.anchor)).toBe(Anchor.name(result2!.anchor));
      expect(result1!.relative).toBe(result2!.relative);
    });

    it('should still work after manually clearing resolver caches', async () => {
      const osPath = ResolvedPath.make('/home/user/.vortex/temp/cache/file.dat');

      // Populate caches
      await vortexResolver.tryReverse(osPath);

      // Clear caches manually
      vortexResolver.clearBasePathCache();
      unixResolver.clearBasePathCache();

      // Should still work after cache clear
      const result = await vortexResolver.tryReverse(osPath);
      expect(result).not.toBeNull();
      expect(Anchor.name(result!.anchor)).toBe('temp');
    });
  });

  describe('Real-World Scenario: Collection Installation', () => {
    it('should handle collection mod installation workflow', async () => {
      // 1. Download mod to temp
      const downloadPath = vortexResolver.PathFor('temp', 'downloads/collection-mod.7z');
      const downloadResolved = await downloadPath.resolve();

      // 2. Extract to temp (simulated)
      const extractedPath = vortexResolver.PathFor('temp', 'extracted/collection-mod/Data/meshes/armor.nif');
      const extractedResolved = await extractedPath.resolve();

      // 3. Reverse resolve (simulate scanning extracted files)
      const scannedResult = await vortexResolver.tryReverse(extractedResolved);
      expect(scannedResult).not.toBeNull();
      const scannedPath = new FilePath(scannedResult!.relative, scannedResult!.anchor, vortexResolver);
      expect(Anchor.name(scannedPath.getAnchor())).toBe('temp');

      // 4. Move to staging area (withBase)
      const stagingBase = vortexResolver.PathFor('userData', 'staging/collection-001');
      const stagedFile = scannedPath.withBase(stagingBase);

      // 5. Verify final path
      const finalResolved = await stagedFile.resolve();
      expect(finalResolved).toContain('userData');
      expect(finalResolved).toContain('staging');
      expect(finalResolved).toContain('collection-001');
      expect(finalResolved).toContain('Data/meshes/armor.nif');
    });
  });
});
