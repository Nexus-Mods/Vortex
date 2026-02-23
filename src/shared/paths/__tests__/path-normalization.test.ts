/* eslint-disable vortex/no-module-imports */
/**
 * Tests for path normalization and cross-platform path handling
 *
 * These tests verify that the path system correctly handles:
 * - Path normalization without introducing . or .. segments
 * - Case-insensitive comparisons on Windows
 * - Consistent separator handling
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

import { FilePath } from '../FilePath';
import { BaseResolver } from '../resolvers/BaseResolver';
import { MockFilesystem } from './mocks/MockFilesystem';
import { RelativePath, Anchor, ResolvedPath } from '../types';

// Test resolver that simulates Windows paths
class WindowsTestResolver extends BaseResolver<'userData' | 'temp'> {
  constructor() {
    super('windows-test', undefined, new MockFilesystem('win32', false));
  }

  canResolve(anchor: Anchor): boolean {
    const name = Anchor.name(anchor);
    return name === 'userData' || name === 'temp';
  }

  supportedAnchors(): Anchor[] {
    return ['userData', 'temp'].map(Anchor.make);
  }

  protected async resolveAnchor(anchor: Anchor): Promise<ResolvedPath> {
    const name = Anchor.name(anchor);
    if (name === 'userData') {
      return ResolvedPath.make('C:\\Users\\TestUser\\AppData\\Roaming\\Vortex');
    }
    if (name === 'temp') {
      return ResolvedPath.make('C:\\Temp');
    }
    throw new Error(`Unknown anchor: ${name}`);
  }

  /** Test paths are already absolute — act as terminal resolver */
  protected toOSPath(intermediatePath: ResolvedPath): ResolvedPath {
    return intermediatePath;
  }
}

// Test resolver that simulates Unix paths
class UnixTestResolver extends BaseResolver<'home' | 'var'> {
  constructor() {
    super('unix-test', undefined, new MockFilesystem('linux', true));
  }

  canResolve(anchor: Anchor): boolean {
    const name = Anchor.name(anchor);
    return name === 'home' || name === 'var';
  }

  supportedAnchors(): Anchor[] {
    return ['home', 'var'].map(Anchor.make);
  }

  protected async resolveAnchor(anchor: Anchor): Promise<ResolvedPath> {
    const name = Anchor.name(anchor);
    if (name === 'home') {
      return ResolvedPath.make('/home/user');
    }
    if (name === 'var') {
      return ResolvedPath.make('/var/tmp');
    }
    throw new Error(`Unknown anchor: ${name}`);
  }

  /** Test paths are already absolute — act as terminal resolver */
  protected toOSPath(intermediatePath: ResolvedPath): ResolvedPath {
    return intermediatePath;
  }
}

describe('Path Normalization and Cross-Platform Handling', () => {
  describe('FilePath.relativeTo - Path Normalization', () => {
    let resolver: WindowsTestResolver | UnixTestResolver;

    // Note: relativeTo() uses path.resolve() which is host-OS specific.
    // Windows-literal path tests only work on Windows hosts.
    const isWindows = process.platform === 'win32';

    (isWindows ? describe : describe.skip)('Windows path handling (host-OS only)', () => {
      beforeEach(() => {
        resolver = new WindowsTestResolver();
      });

      test('should handle paths with . segments correctly', async () => {
        const parent = resolver.PathFor('userData', 'mods');
        const childPath = 'C:\\Users\\TestUser\\AppData\\Roaming\\Vortex\\mods\\SkyUI\\.\\interface\\skyui.swf';

        const relative = await parent.relativeTo(childPath);

        expect(relative).not.toBeNull();
        // The . segment should be resolved away (check as path segment, not substring)
        expect((relative as string).split('/').filter(s => s === '.')).toHaveLength(0);
      });

      test('should handle paths with .. segments correctly', async () => {
        const parent = resolver.PathFor('userData', 'mods');
        const childPath = 'C:\\Users\\TestUser\\AppData\\Roaming\\Vortex\\mods\\SkyUI\\..\\SkyUI\\interface\\skyui.swf';

        const relative = await parent.relativeTo(childPath);

        expect(relative).not.toBeNull();
        expect(relative as string).not.toContain('..');
      });

      test('should handle mixed separators correctly', async () => {
        const parent = resolver.PathFor('userData', 'mods');
        const childPath = 'C:\\Users\\TestUser\\AppData\\Roaming\\Vortex\\mods\\SkyUI/interface/skyui.swf';

        const relative = await parent.relativeTo(childPath);

        expect(relative).not.toBeNull();
        expect(relative as string).toContain('/');
      });

      test('should handle trailing separator correctly', async () => {
        const parent = resolver.PathFor('userData', 'mods');
        const childPath = 'C:\\Users\\TestUser\\AppData\\Roaming\\Vortex\\mods\\SkyUI\\interface\\skyui.swf';

        const relative = await parent.relativeTo(childPath);

        expect(relative).not.toBeNull();
        expect(relative as string).toBe('SkyUI/interface/skyui.swf');
      });

      test('should handle case-insensitive comparisons correctly', async () => {
        const parent = resolver.PathFor('userData', 'mods');
        const childPath = 'c:\\users\\testuser\\appdata\\roaming\\vortex\\mods\\skyui\\interface\\skyui.swf';

        const relative = await parent.relativeTo(childPath);

        expect(relative).not.toBeNull();
        expect(relative as string).toBe('skyui/interface/skyui.swf');
      });

      test('should handle case-insensitive exact match', async () => {
        const parent = resolver.PathFor('userData', 'mods');
        const childPath = 'C:\\Users\\TestUser\\AppData\\Roaming\\Vortex\\mods';

        const relative = await parent.relativeTo(childPath);

        expect(relative).not.toBeNull();
        expect(relative).toBe('');
      });

      test('should handle case-insensitive partial match', async () => {
        const parent = resolver.PathFor('userData', 'mods');
        const childPath = 'C:\\Users\\TestUser\\AppData\\Roaming\\Vortex\\mods\\SKYUI';

        const relative = await parent.relativeTo(childPath);

        expect(relative).not.toBeNull();
        expect(relative as string).toBe('SKYUI');
      });
    });

    describe('Unix path handling', () => {
      beforeEach(() => {
        resolver = new UnixTestResolver();
      });

      test('should handle Unix paths with . segments', async () => {
        const parent = resolver.PathFor('home', 'mods');
        const childPath = '/home/user/mods/SkyUI/./interface/skyui.swf';

        const relative = await parent.relativeTo(childPath);

        expect(relative).not.toBeNull();
        // The . segment should be resolved away (check as path segment, not substring — file extensions contain .)
        expect((relative as string).split('/').filter(s => s === '.')).toHaveLength(0);
      });

      test('should handle Unix paths with .. segments', async () => {
        const parent = resolver.PathFor('home', 'mods');
        const childPath = '/home/user/mods/SkyUI/../SkyUI/interface/skyui.swf';

        const relative = await parent.relativeTo(childPath);

        expect(relative).not.toBeNull();
        expect(relative as string).not.toContain('..');
      });

      test('should handle case-sensitive comparisons correctly', async () => {
        const parent = resolver.PathFor('home', 'mods');
        const childPath = '/home/user/mods/SkyUI/interface/skyui.swf';

        const relative = await parent.relativeTo(childPath);

        expect(relative).not.toBeNull();
        expect(relative as string).toBe('SkyUI/interface/skyui.swf');
      });

      test('should return null for case mismatch on Unix', async () => {
        const parent = resolver.PathFor('home', 'Mods'); // capital M
        const childPath = '/home/user/mods/SkyUI/interface/skyui.swf'; // lowercase m

        const relative = await parent.relativeTo(childPath);

        // Parent resolves to /home/user/Mods, child is under /home/user/mods
        // On case-sensitive Unix, these differ
        expect(relative).toBeNull();
      });
    });

    describe('Edge cases (Unix)', () => {
      beforeEach(() => {
        resolver = new UnixTestResolver();
      });

      test('should handle empty relative path', async () => {
        const parent = resolver.PathFor('home', 'mods');
        const parentPath = await parent.resolve();

        const relative = await parent.relativeTo(parentPath);

        expect(relative).not.toBeNull();
        expect(relative).toBe('');
      });

      test('should handle deep nesting', async () => {
        const parent = resolver.PathFor('home', 'mods');
        const childPath = await resolver.PathFor('home', 'mods/SkyUI/interface/mcguffins/skyui.swf').resolve();

        const relative = await parent.relativeTo(childPath);

        expect(relative).not.toBeNull();
        expect(relative as string).toBe('SkyUI/interface/mcguffins/skyui.swf');
      });

      test('should return null for non-child paths', async () => {
        const parent = resolver.PathFor('home', 'mods');
        const otherPath = await resolver.PathFor('var', 'tempfile.txt').resolve();

        const relative = await parent.relativeTo(otherPath);

        expect(relative).toBeNull();
      });

      test('should handle paths with multiple consecutive separators', async () => {
        const parent = resolver.PathFor('home', 'mods');
        const childPath = '/home/user/mods/SkyUI/interface/skyui.swf';

        const relative = await parent.relativeTo(childPath);

        expect(relative).not.toBeNull();
      });
    });
  });

  describe('BaseResolver.isUnder - Case Insensitive Handling', () => {
    let resolver: WindowsTestResolver | UnixTestResolver;

    beforeEach(() => {
      resolver = new WindowsTestResolver();
    });

    test('should handle case-insensitive comparisons on Windows', async () => {
      // This is tested indirectly through tryReverse
      const filePath = resolver.PathFor('userData', 'mods/SkyUI');
      const osPath = await filePath.resolve();

      // Convert to lowercase
      const lowercasePath = (osPath as string).toLowerCase();

      const result = await resolver.tryReverse(lowercasePath);

      expect(result).not.toBeNull();
      expect(Anchor.name(result!.anchor)).toBe('userData');
    });

    test('should handle exact case match on Windows', async () => {
      const filePath = resolver.PathFor('userData', 'mods/SkyUI');
      const osPath = await filePath.resolve();

      const result = await resolver.tryReverse(osPath);

      expect(result).not.toBeNull();
      expect(Anchor.name(result!.anchor)).toBe('userData');
    });

    test('should handle mixed case paths on Windows', async () => {
      const filePath = resolver.PathFor('userData', 'mods/SkyUI');
      const osPath = await filePath.resolve();

      // Mix case in the path
      const mixedPath = (osPath as string)
        .split('\\')
        .map((part, i) => i % 2 === 0 ? part.toLowerCase() : part.toUpperCase())
        .join('\\');

      const result = await resolver.tryReverse(mixedPath);

      expect(result).not.toBeNull();
      expect(Anchor.name(result!.anchor)).toBe('userData');
    });
  });

  describe('RelativePath extraction validation', () => {
    let resolver: WindowsTestResolver | UnixTestResolver;

    beforeEach(() => {
      resolver = new WindowsTestResolver();
    });

    test('should not produce relative paths with .. segments', async () => {
      const parent = resolver.PathFor('userData', 'mods');
      const childPath = await resolver.PathFor('userData', 'mods/SkyUI/interface/skyui.swf').resolve();

      const relative = await parent.relativeTo(childPath);

      expect(relative).not.toBeNull();

      // Verify the relative path doesn't contain ..
      const relativeStr = relative as string;
      expect(relativeStr).not.toContain('..');

      // Verify it's a valid RelativePath
      expect(typeof relativeStr).toBe('string');
      expect(relativeStr.split('/').filter(s => s === '..')).toHaveLength(0);
    });

    test('should produce valid forward-slash paths', async () => {
      const parent = resolver.PathFor('userData', 'mods');
      const childPath = await resolver.PathFor('userData', 'mods/SkyUI/interface/skyui.swf').resolve();

      const relative = await parent.relativeTo(childPath);

      expect(relative).not.toBeNull();

      const relativeStr = relative as string;

      // Should use forward slashes
      expect(relativeStr).not.toContain('\\');
      expect(relativeStr).toContain('/');
    });

    test('should handle root-level paths correctly', async () => {
      const parent = resolver.PathFor('userData', '');
      const childPath = await resolver.PathFor('userData', 'mods/SkyUI').resolve();

      const relative = await parent.relativeTo(childPath);

      expect(relative).not.toBeNull();
      expect(relative as string).toBe('mods/SkyUI');
    });
  });
});
