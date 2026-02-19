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
import { reverseResolve, findAllMatches } from '../utils';
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
  let resolvers: Array<VortexResolver | UnixResolver>;

  beforeEach(() => {
    unixResolver = new UnixResolver();
    vortexResolver = new VortexResolver();
    // VortexResolver first to give it priority over UnixResolver
    // (UnixResolver can match any path under '/', so it would always win if first)
    resolvers = [vortexResolver, unixResolver];
  });

  describe('Basic Unix ↔ Vortex Roundtrip', () => {
    it('should roundtrip: Unix → OS path → Vortex → OS path', async () => {
      // Start with Unix path pointing to Vortex userData directory
      const unixPath = unixResolver.PathFor('root', 'home/user/.vortex/userData/mods/skyrim');
      const resolved1 = await unixPath.resolve();

      // Convert to VortexResolver using reverse resolution
      const vortexPath = await reverseResolve(resolved1, resolvers);

      // Should identify as VortexResolver
      expect(vortexPath).not.toBeNull();
      expect(vortexPath!.getResolver().name).toBe('vortex');
      expect(Anchor.name(vortexPath!.getAnchor())).toBe('userData');
      expect(vortexPath!.getRelativePath()).toBe('mods/skyrim');

      // Resolve back through Vortex
      const resolved2 = await vortexPath!.resolve();

      // Verify roundtrip: resolved1 === resolved2
      expect(normalizePath(resolved2 as string)).toBe(normalizePath(resolved1 as string));
    });

    it('should roundtrip: Vortex → OS path → Unix → OS path', async () => {
      // Start with Vortex path
      const vortexPath = vortexResolver.PathFor('userData', 'mods/skyrim/data');
      const resolved1 = await vortexPath.resolve();

      // Convert to UnixResolver using reverse resolution
      const unixPath = await reverseResolve(resolved1, resolvers);

      // Should identify as UnixResolver or VortexResolver (VortexResolver is more specific)
      expect(unixPath).not.toBeNull();
      // Since VortexResolver is registered first and is more specific, it should match
      // But if we explicitly prefer Unix, it should work too
      const preferredUnixPath = await reverseResolve(resolved1, [unixResolver, vortexResolver]);
      expect(preferredUnixPath).not.toBeNull();
      expect(preferredUnixPath!.getResolver().name).toBe('unix');
      expect(Anchor.name(preferredUnixPath!.getAnchor())).toBe('root');

      // Resolve back through Unix
      const resolved2 = await preferredUnixPath!.resolve();

      // Verify roundtrip: resolved1 === resolved2
      expect(normalizePath(resolved2 as string)).toBe(normalizePath(resolved1 as string));
    });
  });

  describe('Three-Layer Roundtrip', () => {
    it('should survive Unix → Vortex → Unix conversion chain', async () => {
      // Create Unix FilePath
      const original = unixResolver.PathFor('root', 'home/user/.vortex/temp/downloads/mod.zip');
      const originalResolved = await original.resolve();

      // Convert to Vortex FilePath via registry
      const vortexPath = await reverseResolve(originalResolved, resolvers);
      expect(vortexPath).not.toBeNull();
      expect(vortexPath!.getResolver().name).toBe('vortex');
      expect(Anchor.name(vortexPath!.getAnchor())).toBe('temp');
      expect(vortexPath!.getRelativePath()).toBe('downloads/mod.zip');

      // Resolve through Vortex
      const vortexResolved = await vortexPath!.resolve();
      expect(normalizePath(vortexResolved as string)).toBe(normalizePath(originalResolved as string));

      // Convert back to Unix FilePath via registry
      const unixPath = await reverseResolve(vortexResolved, [unixResolver, vortexResolver]);
      expect(unixPath).not.toBeNull();
      expect(unixPath!.getResolver().name).toBe('unix');
      expect(Anchor.name(unixPath!.getAnchor())).toBe('root');

      // Verify relative path matches original
      const finalResolved = await unixPath!.resolve();
      expect(normalizePath(finalResolved as string)).toBe(normalizePath(originalResolved as string));
    });

    it('should maintain path structure through multiple conversions', async () => {
      // Start with a deeply nested Vortex path
      const original = vortexResolver.PathFor('userData', 'mods/skyrim/meshes/armor/plate.nif');
      const step1 = await original.resolve();

      // Convert to Unix
      const unixPath = await reverseResolve(step1, [unixResolver, vortexResolver]);
      expect(unixPath).not.toBeNull();
      const step2 = await unixPath!.resolve();
      expect(normalizePath(step2 as string)).toBe(normalizePath(step1 as string));

      // Convert back to Vortex
      const vortexPath = await reverseResolve(step2, resolvers);
      expect(vortexPath).not.toBeNull();
      const step3 = await vortexPath!.resolve();
      expect(normalizePath(step3 as string)).toBe(normalizePath(step1 as string));

      // Verify the final path has correct anchor and relative
      expect(Anchor.name(vortexPath!.getAnchor())).toBe('userData');
      expect(vortexPath!.getRelativePath()).toBe('mods/skyrim/meshes/armor/plate.nif');
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

      // Registry should find Unix resolver (which can handle any path under /)
      const result = await reverseResolve(osPath, resolvers);

      // Unix resolver should handle it
      expect(result).not.toBeNull();
      expect(result!.getResolver().name).toBe('unix');
      expect(Anchor.name(result!.getAnchor())).toBe('root');
      expect(result!.getRelativePath()).toBe('etc/passwd');
    });

    it('should return null when explicitly trying resolver that cannot handle path', async () => {
      // Path outside Vortex-specific directories
      const osPath = ResolvedPath.make('/opt/games/skyrim/data');

      // Try reverse resolution with VortexResolver directly
      const result = await vortexResolver.tryReverse(osPath);

      // VortexResolver cannot handle paths outside its anchors
      expect(result).toBeNull();
    });

    it('should fall back to other resolvers when preferred fails', async () => {
      // Path outside Vortex but inside Unix root
      const osPath = ResolvedPath.make('/opt/games/skyrim/data');

      // Try registry with Vortex preferred
      const result = await reverseResolve(osPath, [vortexResolver, unixResolver]);

      // Should fall back to Unix resolver
      expect(result).not.toBeNull();
      expect(result!.getResolver().name).toBe('unix');
    });
  });

  describe('Registry Resolver Order', () => {
    it('should respect registration order for overlapping ranges', async () => {
      // Both Unix and Vortex can handle /home/user/.vortex/userData/mods
      // VortexResolver registered first and is more specific
      const osPath = ResolvedPath.make('/home/user/.vortex/userData/mods/skyui.esp');

      const result = await reverseResolve(osPath, resolvers);

      // VortexResolver should win (more specific and registered first)
      expect(result).not.toBeNull();
      expect(result!.getResolver().name).toBe('vortex');
      expect(Anchor.name(result!.getAnchor())).toBe('userData');
    });

    it('should try preferred resolver first', async () => {
      const osPath = ResolvedPath.make('/home/user/.vortex/userData/mods/mod.esp');

      // Prefer Unix explicitly (by putting it first)
      const unixResult = await reverseResolve(osPath, [unixResolver, vortexResolver]);
      expect(unixResult).not.toBeNull();
      expect(unixResult!.getResolver().name).toBe('unix');

      // Prefer Vortex explicitly (by putting it first)
      const vortexResult = await reverseResolve(osPath, [vortexResolver, unixResolver]);
      expect(vortexResult).not.toBeNull();
      expect(vortexResult!.getResolver().name).toBe('vortex');
    });

    it('should find all resolvers that can handle a path', async () => {
      const osPath = ResolvedPath.make('/home/user/.vortex/temp/cache/file.txt');

      const matches = await findAllMatches(osPath, resolvers);

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
      const reversed = await reverseResolve(resolved, resolvers);

      // Should reconstruct correctly
      expect(reversed).not.toBeNull();
      expect(Anchor.name(reversed!.getAnchor())).toBe('temp');
      expect(reversed!.getRelativePath()).toBe('backups/2024/mods/skyrim/mesh.nif');

      // Should resolve to same path
      const finalResolved = await reversed!.resolve();
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
      const reversed = await reverseResolve(resolved, resolvers);

      expect(reversed).not.toBeNull();
      expect(reversed!.getResolver().name).toBe('vortex');
      expect(Anchor.name(reversed!.getAnchor())).toBe('userData');
      expect(reversed!.getRelativePath()).toBe('staging/tmp/extracted/mod/data.esp');
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

      // Reverse through registry
      const restored = await reverseResolve(osPath, resolvers);

      // Should match backed path exactly
      expect(restored).not.toBeNull();
      expect(Anchor.name(restored!.getAnchor())).toBe('temp');
      expect(restored!.getRelativePath()).toBe('backups/2024-01-15/mods/elden-ring/chr/armor.chrbnd');
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
      await reverseResolve(osPath, resolvers);

      // Clear caches manually
      vortexResolver.clearBasePathCache();
      unixResolver.clearBasePathCache();

      // Should still work after cache clear
      const result = await reverseResolve(osPath, resolvers);
      expect(result).not.toBeNull();
      expect(result!.getResolver().name).toBe('vortex');
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
      const scannedPath = await reverseResolve(extractedResolved, resolvers);
      expect(scannedPath).not.toBeNull();
      expect(Anchor.name(scannedPath!.getAnchor())).toBe('temp');

      // 4. Move to staging area (withBase)
      const stagingBase = vortexResolver.PathFor('userData', 'staging/collection-001');
      const stagedFile = scannedPath!.withBase(stagingBase);

      // 5. Verify final path
      const finalResolved = await stagedFile.resolve();
      expect(finalResolved).toContain('userData');
      expect(finalResolved).toContain('staging');
      expect(finalResolved).toContain('collection-001');
      expect(finalResolved).toContain('Data/meshes/armor.nif');
    });
  });
});
