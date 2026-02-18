/* eslint-disable vortex/no-module-imports */
/**
 * Tests for branded types: RelativePath, ResolvedPath, Extension, Anchor
 */

import { describe, test, expect } from '@jest/globals';

import {
  RelativePath,
  ResolvedPath,
  Extension,
  Anchor,
} from '../types';

describe('RelativePath', () => {
  describe('normalization', () => {
    test.each([
      ['mods\\skyrim\\data', 'mods/skyrim/data'],
      ['/mods/skyrim', 'mods/skyrim'],
      ['mods/skyrim/', 'mods/skyrim'],
      ['mods//skyrim', 'mods/skyrim'],
      ['mods///skyrim', 'mods/skyrim'],
      ['', ''],
      ['single', 'single'],
    ])('normalizes %s to %s', (input, expected) => {
      expect(RelativePath.make(input)).toBe(expected);
    });
  });

  describe('validation', () => {
    test.each([
      ['../etc/passwd', 'starts with ..'],
      ['C:/Windows', 'drive letter'],
      ['C:\\Windows', 'drive letter'],
      ['D:\\Games', 'drive letter'],
    ])('rejects invalid path: %s (%s)', (input) => {
      expect(() => RelativePath.make(input)).toThrow();
    });
  });

  describe('join', () => {
    test.each([
      [RelativePath.make('mods'), ['skyrim'], 'mods/skyrim'],
      [RelativePath.make('mods'), ['skyrim', 'data'], 'mods/skyrim/data'],
      [RelativePath.EMPTY, ['mods'], 'mods'],
      [RelativePath.make('a'), ['b', 'c', 'd'], 'a/b/c/d'],
    ])('join(%s, %s) = %s', (base, segments, expected) => {
      expect(RelativePath.join(base, ...segments)).toBe(expected);
    });
  });

  describe('dirname', () => {
    test.each([
      ['mods/skyrim/data.esp', 'mods/skyrim'],
      ['mods/skyrim', 'mods'],
      ['single', ''],
      ['', ''],
    ])('dirname(%s) = %s', (input, expected) => {
      expect(RelativePath.dirname(RelativePath.make(input))).toBe(expected);
    });
  });

  describe('basename', () => {
    test.each([
      ['mods/skyrim/data.esp', 'data.esp'],
      ['mods/skyrim', 'skyrim'],
      ['single.txt', 'single.txt'],
    ])('basename(%s) = %s', (input, expected) => {
      expect(RelativePath.basename(RelativePath.make(input))).toBe(expected);
    });

    test('basename with extension removal', () => {
      const path = RelativePath.make('mods/skyrim/data.esp');
      expect(RelativePath.basename(path, '.esp')).toBe('data');
    });
  });
});

describe('ResolvedPath', () => {
  describe('validation', () => {
    test.each([
      ['/absolute/unix/path'],
      ['/'],
      ['/home/user/documents'],
    ])('accepts absolute Unix path: %s', (input) => {
      expect(() => ResolvedPath.make(input)).not.toThrow();
    });

    test.each([
      ['relative/path'],
      ['../parent'],
      [''],
    ])('rejects relative path: %s', (input) => {
      expect(() => ResolvedPath.make(input)).toThrow(/absolute/);
    });
  });

  describe('parse', () => {
    test('parses Unix path', () => {
      const path = ResolvedPath.make('/home/user/mods/data.esp');
      const parsed = ResolvedPath.parse(path);

      expect(parsed.root).toBe('/');
      expect(parsed.dir).toBe('/home/user/mods');
      expect(parsed.base).toBe('data.esp');
      expect(parsed.ext).toBe('.esp');
      expect(parsed.name).toBe('data');
    });
  });

  describe('operations', () => {
    test('join', () => {
      const base = ResolvedPath.make('/home/user');
      const joined = ResolvedPath.join(base, 'mods', 'skyrim');

      expect(joined).toContain('mods');
      expect(joined).toContain('skyrim');
    });

    test('dirname', () => {
      const path = ResolvedPath.make('/home/user/mods/skyrim');
      const parent = ResolvedPath.dirname(path);

      expect(parent).toMatch(/mods$/);
    });

    test('basename', () => {
      const path = ResolvedPath.make('/home/user/mods/data.esp');
      expect(ResolvedPath.basename(path)).toBe('data.esp');
      expect(ResolvedPath.basename(path, '.esp')).toBe('data');
    });

    test('relative', () => {
      const from = ResolvedPath.make('/home/user/mods');
      const to = ResolvedPath.make('/home/user/downloads');
      const relative = ResolvedPath.relative(from, to);

      expect(relative).toBe('../downloads');
    });
  });
});

describe('Extension', () => {
  describe('make', () => {
    test.each([
      ['.png', '.png'],
      ['.PNG', '.png'],
      ['.dll', '.dll'],
      ['.DLL', '.dll'],
    ])('make(%s) = %s (normalized)', (input, expected) => {
      expect(Extension.make(input)).toBe(expected);
    });
  });

  describe('validation', () => {
    test.each([
      ['png', 'no dot'],
      ['.png/file', 'contains separator'],
      ['.png\\file', 'contains separator'],
      ['', 'empty'],
    ])('rejects invalid extension: %s (%s)', (input) => {
      expect(() => Extension.make(input)).toThrow();
    });
  });

  describe('fromPath', () => {
    test.each([
      ['icon.png', '.png'],
      ['game.exe', '.exe'],
      ['data.tar.gz', '.gz'],
      ['UPPERCASE.DLL', '.dll'],
    ])('fromPath(%s) = %s', (input, expected) => {
      expect(Extension.fromPath(input)).toBe(expected);
    });

    test.each([
      ['noext'],
      ['directory/'],
      [''],
    ])('fromPath(%s) = undefined (no extension)', (input) => {
      expect(Extension.fromPath(input)).toBeUndefined();
    });
  });

  describe('matches', () => {
    test('matches extension', () => {
      const png = Extension.make('.png');
      expect(Extension.matches(png, 'icon.png')).toBe(true);
      expect(Extension.matches(png, 'icon.jpg')).toBe(false);
    });
  });

  describe('common extensions', () => {
    test('predefined extensions', () => {
      expect(Extension.ESP).toBe('.esp');
      expect(Extension.ESM).toBe('.esm');
      expect(Extension.DLL).toBe('.dll');
      expect(Extension.EXE).toBe('.exe');
      expect(Extension.JSON).toBe('.json');
    });
  });
});

describe('Anchor', () => {
  describe('make and name', () => {
    test('creates and names anchor', () => {
      const anchor = Anchor.make('userData');
      expect(Anchor.name(anchor)).toBe('userData');
    });

    test('interning works', () => {
      const a1 = Anchor.make('userData');
      const a2 = Anchor.make('userData');
      expect(a1).toBe(a2);
    });
  });

  describe('toString', () => {
    test('formats anchor string', () => {
      const anchor = Anchor.make('userData');
      expect(Anchor.toString(anchor)).toBe('Anchor[userData]');
    });
  });

  describe('isAnchor', () => {
    test('validates anchor symbols', () => {
      const anchor = Anchor.make('userData');
      expect(Anchor.isAnchor(anchor)).toBe(true);

      expect(Anchor.isAnchor(Symbol('not-an-anchor'))).toBe(false);
      expect(Anchor.isAnchor('string')).toBe(false);
      expect(Anchor.isAnchor(42)).toBe(false);
      expect(Anchor.isAnchor(null)).toBe(false);
    });
  });
});
