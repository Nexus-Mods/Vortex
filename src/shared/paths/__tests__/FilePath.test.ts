/* eslint-disable vortex/no-module-imports */
/**
 * Tests for FilePath class
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

import type { IFilesystem } from '../IFilesystem';
import type { IResolver } from '../IResolver';

import { FilePath } from '../FilePath';
import { RelativePath, Anchor, ResolvedPath } from '../types';
import { MockFilesystem } from './mocks/MockFilesystem';

// Mock resolver for testing
class MockResolver implements IResolver {
  private readonly fs: IFilesystem = new MockFilesystem('linux', true);

  constructor(
    public readonly name: string = 'mock',
    public readonly parent?: IResolver,
  ) {}

  async resolve(anchor: Anchor, relative: RelativePath): Promise<ResolvedPath> {
    return this.resolveSync(anchor, relative);
  }

  resolveSync(anchor: Anchor, relative: RelativePath): ResolvedPath {
    const anchorName = Anchor.name(anchor);
    const path = `/mock/${anchorName}/${relative}`;
    return ResolvedPath.make(path);
  }

  canResolve(_anchor: Anchor): boolean {
    return true;
  }

  supportedAnchors(): Anchor[] {
    return [Anchor.make('test')];
  }

  getFilesystem(): IFilesystem {
    return this.fs;
  }

  PathFor(anchorName: string, relative: string = ''): FilePath {
    return new FilePath(
      relative ? RelativePath.make(relative) : RelativePath.EMPTY,
      Anchor.make(anchorName),
      this,
    );
  }

  async tryReverse(): Promise<FilePath | null> {
    return null;
  }

  async getBasePaths(): Promise<Map<Anchor, ResolvedPath>> {
    return new Map();
  }
}

describe('FilePath', () => {
  let resolver: MockResolver;
  let anchor: Anchor;

  beforeEach(() => {
    resolver = new MockResolver();
    anchor = Anchor.make('test');
  });

  describe('construction', () => {
    test('creates FilePath with properties', () => {
      const relative = RelativePath.make('mods/skyrim');
      const filePath = new FilePath(relative, anchor, resolver);

      expect(filePath.relative).toBe(relative);
      expect(filePath.anchor).toBe(anchor);
      expect(filePath.resolver).toBe(resolver);
    });

    test('throws if resolver cannot handle anchor', () => {
      const badResolver: IResolver = {
        name: 'bad',
        canResolve: () => false,
        supportedAnchors: () => [],
        resolve: jest.fn<IResolver['resolve']>(),
        PathFor: jest.fn<IResolver['PathFor']>(),
        tryReverse: jest.fn<IResolver['tryReverse']>(),
        getBasePaths: jest.fn<IResolver['getBasePaths']>(),
        getFilesystem: () => new MockFilesystem('linux', true),
      };

      expect(() => {
        new FilePath(RelativePath.EMPTY, anchor, badResolver);
      }).toThrow(/cannot handle anchor/);
    });
  });

  describe('resolve', () => {
    test('async resolution', async () => {
      const filePath = new FilePath(
        RelativePath.make('mods/skyrim'),
        anchor,
        resolver,
      );

      const resolved = await filePath.resolve();
      expect(resolved).toBe('/mock/test/mods/skyrim');
    });

  });

  describe('builder methods', () => {
    test('join creates new FilePath', () => {
      const base = new FilePath(RelativePath.make('mods'), anchor, resolver);
      const joined = base.join('skyrim', 'data');

      expect(joined).not.toBe(base);
      expect(joined.relative).toBe('mods/skyrim/data');
      expect(joined.anchor).toBe(base.anchor);
      expect(joined.resolver).toBe(base.resolver);
      expect(base.relative).toBe('mods'); // Original unchanged
    });

    test('withResolver creates new FilePath', () => {
      const newResolver = new MockResolver('new-resolver');
      const original = new FilePath(RelativePath.make('mods'), anchor, resolver);
      const updated = original.withResolver(newResolver);

      expect(updated).not.toBe(original);
      expect(updated.resolver).toBe(newResolver);
      expect(updated.relative).toBe(original.relative);
      expect(updated.anchor).toBe(original.anchor);
    });

    test('withAnchor creates new FilePath', () => {
      const newAnchor = Anchor.make('newAnchor');
      const original = new FilePath(RelativePath.make('mods'), anchor, resolver);
      const updated = original.withAnchor(newAnchor);

      expect(updated).not.toBe(original);
      expect(updated.anchor).toBe(newAnchor);
      expect(updated.relative).toBe(original.relative);
      expect(updated.resolver).toBe(original.resolver);
    });

    test('withRelative creates new FilePath', () => {
      const newRelative = RelativePath.make('downloads');
      const original = new FilePath(RelativePath.make('mods'), anchor, resolver);
      const updated = original.withRelative(newRelative);

      expect(updated).not.toBe(original);
      expect(updated.relative).toBe(newRelative);
      expect(updated.anchor).toBe(original.anchor);
      expect(updated.resolver).toBe(original.resolver);
    });

    test('parent returns parent directory', () => {
      const filePath = new FilePath(
        RelativePath.make('mods/skyrim/data.esp'),
        anchor,
        resolver,
      );
      const parent = filePath.parent();

      expect(parent.relative).toBe('mods/skyrim');
      expect(parent.anchor).toBe(filePath.anchor);
      expect(parent.resolver).toBe(filePath.resolver);
    });

    test('basename returns filename', () => {
      const filePath = new FilePath(
        RelativePath.make('mods/skyrim/data.esp'),
        anchor,
        resolver,
      );

      expect(filePath.basename()).toBe('data.esp');
      expect(filePath.basename('.esp')).toBe('data');
    });
  });

  describe('debugging', () => {
    test('toString formats FilePath', () => {
      const filePath = new FilePath(
        RelativePath.make('mods/skyrim'),
        anchor,
        resolver,
      );

      const str = filePath.toString();
      expect(str).toContain('FilePath');
      expect(str).toContain('test');
      expect(str).toContain('mods/skyrim');
      expect(str).toContain('mock');
    });

    test('toString handles empty relative', () => {
      const filePath = new FilePath(RelativePath.EMPTY, anchor, resolver);
      const str = filePath.toString();
      expect(str).toContain('(root)');
    });
  });

  describe('equality', () => {
    test('equals compares FilePath instances', () => {
      const path1 = new FilePath(RelativePath.make('mods'), anchor, resolver);
      const path2 = new FilePath(RelativePath.make('mods'), anchor, resolver);
      const path3 = new FilePath(RelativePath.make('downloads'), anchor, resolver);

      expect(path1.equals(path2)).toBe(true);
      expect(path1.equals(path3)).toBe(false);
    });

    test('hashCode generates consistent numeric hash', () => {
      const path1 = new FilePath(RelativePath.make('mods'), anchor, resolver);
      const path2 = new FilePath(RelativePath.make('mods'), anchor, resolver);

      expect(path1.hashCode()).toBe(path2.hashCode());
      expect(typeof path1.hashCode()).toBe('number');
      expect(path1.hashCode()).toBeGreaterThanOrEqual(0);
    });

    test('hashCode differs for different paths', () => {
      const path1 = new FilePath(RelativePath.make('mods'), anchor, resolver);
      const path2 = new FilePath(RelativePath.make('downloads'), anchor, resolver);

      expect(path1.hashCode()).not.toBe(path2.hashCode());
    });
  });

  describe('depth', () => {
    test('returns segment count', () => {
      const filePath = new FilePath(RelativePath.make('mods/skyrim/data'), anchor, resolver);
      expect(filePath.depth()).toBe(3);
    });

    test('empty relative has depth 0', () => {
      const filePath = new FilePath(RelativePath.EMPTY, anchor, resolver);
      expect(filePath.depth()).toBe(0);
    });

    test('single segment has depth 1', () => {
      const filePath = new FilePath(RelativePath.make('mods'), anchor, resolver);
      expect(filePath.depth()).toBe(1);
    });
  });

  describe('isIn', () => {
    test('child is in parent', () => {
      const parent = new FilePath(RelativePath.make('mods'), anchor, resolver);
      const child = new FilePath(RelativePath.make('mods/skyrim'), anchor, resolver);

      expect(child.isIn(parent)).toBe(true);
    });

    test('equal paths are not "in" each other', () => {
      const path1 = new FilePath(RelativePath.make('mods'), anchor, resolver);
      const path2 = new FilePath(RelativePath.make('mods'), anchor, resolver);

      expect(path1.isIn(path2)).toBe(false);
    });

    test('returns false for different anchors', () => {
      const otherAnchor = Anchor.make('other');
      const otherResolver = new MockResolver('mock-other');

      const parent = new FilePath(RelativePath.make('mods'), anchor, resolver);
      const child = new FilePath(RelativePath.make('mods/skyrim'), otherAnchor, otherResolver);

      expect(child.isIn(parent)).toBe(false);
    });

    test('returns false for different resolvers', () => {
      const otherResolver = new MockResolver('different');

      const parent = new FilePath(RelativePath.make('mods'), anchor, resolver);
      const child = new FilePath(RelativePath.make('mods/skyrim'), anchor, otherResolver);

      expect(child.isIn(parent)).toBe(false);
    });
  });

  describe('compare', () => {
    test('sorts by resolver name first', () => {
      const resolverA = new MockResolver('alpha');
      const resolverB = new MockResolver('beta');

      const pathA = new FilePath(RelativePath.make('z'), anchor, resolverA);
      const pathB = new FilePath(RelativePath.make('a'), anchor, resolverB);

      expect(pathA.compare(pathB)).toBeLessThan(0);
    });

    test('sorts by anchor name second', () => {
      const anchorA = Anchor.make('alpha');
      const anchorB = Anchor.make('beta');

      const pathA = new FilePath(RelativePath.make('z'), anchorA, resolver);
      const pathB = new FilePath(RelativePath.make('a'), anchorB, resolver);

      expect(pathA.compare(pathB)).toBeLessThan(0);
    });

    test('sorts by relative path third', () => {
      const pathA = new FilePath(RelativePath.make('alpha'), anchor, resolver);
      const pathB = new FilePath(RelativePath.make('beta'), anchor, resolver);

      expect(pathA.compare(pathB)).toBeLessThan(0);
    });

    test('equal paths compare as 0', () => {
      const path1 = new FilePath(RelativePath.make('mods'), anchor, resolver);
      const path2 = new FilePath(RelativePath.make('mods'), anchor, resolver);

      expect(path1.compare(path2)).toBe(0);
    });
  });
});
