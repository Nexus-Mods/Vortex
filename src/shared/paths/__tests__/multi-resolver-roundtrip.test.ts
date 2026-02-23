/**
 * Multi-Resolver Roundtrip Tests
 *
 * Tests path roundtripping through multiple resolver layers to validate
 * that paths can correctly convert between different resolver "coordinate systems"
 * and maintain their resolved path identity.
 *
 * Uses test-only resolvers (no dependency on renderer/) to exercise:
 * - Forward resolution through chain (child → parent terminal resolver)
 * - Reverse resolution: OS path → tryReverse → FilePath
 * - Two-layer roundtrip: resolve → tryReverse → resolve → same OS path
 * - Nested anchor preference (most specific match wins)
 * - Delegation: child can't resolve → parent handles it
 * - withBase() roundtrip
 * - toOSPath throws when no terminal resolver in chain
 */

/* eslint-disable vortex/no-module-imports */
import * as path from 'path';

import { describe, it, expect, beforeEach } from '@jest/globals';

import { FilePath } from '../FilePath';
import { BaseResolver } from '../resolvers/BaseResolver';
import { UnixResolver } from '../resolvers/UnixResolver';
import { MappingResolver, fromRecord } from '../resolvers/MappingResolver';
import { MockUnixFilesystem } from './mocks/MockUnixFilesystem';
import type { IResolver } from '../IResolver';
import { Anchor, RelativePath, ResolvedPath } from '../types';

// ============================================================================
// Test-only resolvers
// ============================================================================

type TestAppAnchor = 'userData' | 'temp' | 'home';

/**
 * In-test resolver that maps application anchors to hardcoded Unix paths.
 * Chained to a UnixResolver parent so toOSPath flows through the terminal.
 */
class TestAppResolver extends MappingResolver<TestAppAnchor> {
  constructor(parent: IResolver) {
    super('testApp', parent);
  }

  protected getStrategy() {
    return fromRecord({
      userData: ResolvedPath.make('/home/user/.vortex/userData'),
      temp: ResolvedPath.make('/home/user/.vortex/temp'),
      home: ResolvedPath.make('/home/user'),
    });
  }
}

// ============================================================================
// Helpers
// ============================================================================

function normalizePath(p: string): string {
  return path.normalize(p).replace(/\\/g, '/').replace(/\/$/, '');
}

// ============================================================================
// Tests
// ============================================================================

describe('Multi-Resolver Roundtrip', () => {
  let unixResolver: UnixResolver;
  let appResolver: TestAppResolver;

  beforeEach(() => {
    unixResolver = new UnixResolver(undefined, new MockUnixFilesystem());
    appResolver = new TestAppResolver(unixResolver);
  });

  describe('Forward resolution through chain', () => {
    it('should resolve app anchor through Unix terminal', async () => {
      const filePath = appResolver.PathFor('userData', 'mods/skyrim');
      const resolved = await filePath.resolve();

      expect(normalizePath(resolved as string)).toBe('/home/user/.vortex/userData/mods/skyrim');
    });

    it('should throw for unknown anchors instead of delegating to parent', async () => {
      // 'root' is handled by UnixResolver parent, not TestAppResolver
      // Forward resolve() does NOT delegate — unknown anchors throw immediately
      await expect(
        appResolver.resolve(Anchor.make('root'), RelativePath.make('etc/hosts'))
      ).rejects.toThrow(/cannot resolve anchor/i);
    });
  });

  describe('Basic roundtrip: resolve → tryReverse → resolve', () => {
    it('should roundtrip app anchor paths', async () => {
      const original = appResolver.PathFor('userData', 'mods/skyrim/data.esp');
      const resolved1 = await original.resolve();

      const reversed = await appResolver.tryReverse(resolved1);
      expect(reversed).not.toBeNull();
      expect(reversed!.resolver.name).toBe('testApp');
      expect(Anchor.name(reversed!.anchor)).toBe('userData');
      expect(reversed!.relative).toBe('mods/skyrim/data.esp');

      const resolved2 = await reversed!.resolve();
      expect(normalizePath(resolved2 as string)).toBe(normalizePath(resolved1 as string));
    });

    it('should roundtrip Unix root paths via app resolver chain', async () => {
      // Path outside app dirs — should delegate to unix parent
      const osPath = ResolvedPath.make('/opt/games/skyrim/data');
      const reversed = await appResolver.tryReverse(osPath);

      expect(reversed).not.toBeNull();
      expect(Anchor.name(reversed!.anchor)).toBe('root');
      expect(reversed!.relative).toBe('opt/games/skyrim/data');
    });
  });

  describe('Two-layer roundtrip', () => {
    it('should survive Unix → App → Unix conversion chain', async () => {
      const unixPath = unixResolver.PathFor('root', 'home/user/.vortex/temp/downloads/mod.zip');
      const originalResolved = await unixPath.resolve();

      // Convert to app anchor via reverse resolution
      const appResult = await appResolver.tryReverse(originalResolved);
      expect(appResult).not.toBeNull();
      expect(appResult!.resolver.name).toBe('testApp');
      expect(Anchor.name(appResult!.anchor)).toBe('temp');
      expect(appResult!.relative).toBe('downloads/mod.zip');

      // Resolve through app resolver
      const appResolved = await appResult!.resolve();
      expect(normalizePath(appResolved as string)).toBe(normalizePath(originalResolved as string));

      // Convert back to Unix
      const unixFirst = new UnixResolver(appResolver);
      const unixResult = await unixFirst.tryReverse(appResolved);
      expect(unixResult).not.toBeNull();
      expect(unixResult!.resolver.name).toBe('unix');
      expect(Anchor.name(unixResult!.anchor)).toBe('root');

      const finalResolved = await unixResult!.resolve();
      expect(normalizePath(finalResolved as string)).toBe(normalizePath(originalResolved as string));
    });

    it('should maintain path structure through multiple conversions', async () => {
      const original = appResolver.PathFor('userData', 'mods/skyrim/meshes/armor/plate.nif');
      const step1 = await original.resolve();

      // Convert to Unix
      const unixFirst = new UnixResolver(appResolver);
      const unixResult = await unixFirst.tryReverse(step1);
      expect(unixResult).not.toBeNull();
      const step2 = await unixResult!.resolve();
      expect(normalizePath(step2 as string)).toBe(normalizePath(step1 as string));

      // Convert back to App
      const appResult = await appResolver.tryReverse(step2);
      expect(appResult).not.toBeNull();
      const step3 = await appResult!.resolve();
      expect(normalizePath(step3 as string)).toBe(normalizePath(step1 as string));

      expect(Anchor.name(appResult!.anchor)).toBe('userData');
      expect(appResult!.relative).toBe('mods/skyrim/meshes/armor/plate.nif');
    });
  });

  describe('Nested anchor preference', () => {
    it('should prefer most specific (longest) matching anchor', async () => {
      // 'userData' → '/home/user/.vortex/userData' is more specific than 'home' → '/home/user'
      const osPath = ResolvedPath.make('/home/user/.vortex/userData/mods/skyrim.esp');

      const result = await appResolver.tryReverse(osPath);

      expect(result).not.toBeNull();
      expect(Anchor.name(result!.anchor)).toBe('userData');
      expect(result!.relative).toBe('mods/skyrim.esp');
    });

    it('should match home for paths not under userData or temp', async () => {
      const osPath = ResolvedPath.make('/home/user/Documents/notes.txt');

      const result = await appResolver.tryReverse(osPath);

      expect(result).not.toBeNull();
      expect(Anchor.name(result!.anchor)).toBe('home');
      expect(result!.relative).toBe('Documents/notes.txt');
    });
  });

  describe('Delegation', () => {
    it('should delegate to parent when child cannot handle path', async () => {
      const osPath = ResolvedPath.make('/etc/passwd');

      const result = await appResolver.tryReverse(osPath);

      // AppResolver can't handle /etc, delegates to UnixResolver
      expect(result).not.toBeNull();
      expect(Anchor.name(result!.anchor)).toBe('root');
      expect(result!.relative).toBe('etc/passwd');
    });

    it('should try child resolver first for overlapping ranges', async () => {
      const osPath = ResolvedPath.make('/home/user/.vortex/userData/mods/mod.esp');

      // App resolver tries first — should match userData
      const appResult = await appResolver.tryReverse(osPath);
      expect(appResult).not.toBeNull();
      expect(Anchor.name(appResult!.anchor)).toBe('userData');

      // Unix tries first — should match root
      const unixFirst = new UnixResolver(appResolver);
      const unixResult = await unixFirst.tryReverse(osPath);
      expect(unixResult).not.toBeNull();
      expect(Anchor.name(unixResult!.anchor)).toBe('root');
    });
  });

  describe('withBase() roundtrip', () => {
    it('should roundtrip paths moved with withBase()', async () => {
      const original = appResolver.PathFor('userData', 'mods/skyrim/mesh.nif');
      const backupBase = appResolver.PathFor('temp', 'backups/2024');
      const moved = original.withBase(backupBase);

      expect(Anchor.name(moved.anchor)).toBe('temp');
      expect(moved.relative).toBe('backups/2024/mods/skyrim/mesh.nif');

      const resolved = await moved.resolve();
      const result = await appResolver.tryReverse(resolved);
      expect(result).not.toBeNull();

      expect(Anchor.name(result!.anchor)).toBe('temp');
      expect(result!.relative).toBe('backups/2024/mods/skyrim/mesh.nif');

      const finalResolved = await result!.resolve();
      expect(normalizePath(finalResolved as string)).toBe(normalizePath(resolved as string));
    });

    it('should handle withBase() across resolver boundaries', async () => {
      const original = unixResolver.PathFor('root', 'tmp/extracted/mod/data.esp');
      const appBase = appResolver.PathFor('userData', 'staging');
      const moved = original.withBase(appBase);

      expect(moved.resolver.name).toBe('testApp');
      expect(Anchor.name(moved.anchor)).toBe('userData');
      expect(moved.relative).toBe('staging/tmp/extracted/mod/data.esp');

      const resolved = await moved.resolve();
      const result = await appResolver.tryReverse(resolved);
      expect(result).not.toBeNull();
      expect(result!.relative).toBe('staging/tmp/extracted/mod/data.esp');
    });
  });

  describe('toOSPath throws without terminal resolver', () => {
    it('should throw when resolver chain lacks a terminal resolver', async () => {
      // Create a resolver with no parent and no toOSPath override
      class OrphanResolver extends MappingResolver<'data'> {
        constructor() {
          super('orphan');
        }
        protected getStrategy() {
          return fromRecord({
            data: ResolvedPath.make('/some/path'),
          });
        }
      }

      const orphan = new OrphanResolver();
      const filePath = orphan.PathFor('data', 'file.txt');

      await expect(filePath.resolve()).rejects.toThrow(
        /cannot create OS paths.*platform resolver/
      );
    });
  });

  describe('Cache behavior', () => {
    it('should cache base paths for performance', async () => {
      const osPath = ResolvedPath.make('/home/user/.vortex/userData/mods/skyrim.esp');

      const result1 = await appResolver.tryReverse(osPath);
      expect(result1).not.toBeNull();

      const result2 = await appResolver.tryReverse(osPath);
      expect(result2).not.toBeNull();

      expect(Anchor.name(result1!.anchor)).toBe(Anchor.name(result2!.anchor));
      expect(result1!.relative).toBe(result2!.relative);
    });

    it('should still work after clearing caches', async () => {
      const osPath = ResolvedPath.make('/home/user/.vortex/temp/cache/file.dat');

      await appResolver.tryReverse(osPath);

      appResolver.clearBasePathCache();
      unixResolver.clearBasePathCache();

      const result = await appResolver.tryReverse(osPath);
      expect(result).not.toBeNull();
      expect(Anchor.name(result!.anchor)).toBe('temp');
    });
  });
});
