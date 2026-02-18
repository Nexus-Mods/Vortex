/* eslint-disable vortex/no-module-imports */
/**
 * Tests for FilePath class
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

import type { IResolver } from '../IResolver';

import { FilePath } from '../FilePath';
import { ResolverRegistry } from '../ResolverRegistry';
import { RelativePath, Anchor, ResolvedPath } from '../types';

// Mock resolver for testing
class MockResolver implements IResolver {
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

  canResolve(anchor: Anchor): boolean {
    return true;
  }

  supportedAnchors(): Anchor[] {
    return [Anchor.make('test')];
  }

  PathFor(anchorName: string, relative: string = ''): FilePath {
    return new FilePath(
      relative ? RelativePath.make(relative) : RelativePath.EMPTY,
      Anchor.make(anchorName),
      this,
    );
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
        resolve: jest.fn(),
        PathFor: jest.fn(),
      };

      expect(() => {
        new FilePath(RelativePath.EMPTY, anchor, badResolver);
      }).toThrow(/No resolver in chain can handle anchor/);
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

  describe('serialization', () => {
    test('toJSON serializes FilePath', () => {
      const filePath = new FilePath(
        RelativePath.make('mods/skyrim'),
        anchor,
        resolver,
      );
      const json = filePath.toJSON();

      expect(json).toEqual({
        relative: 'mods/skyrim',
        anchor: 'test',
        resolverName: 'mock',
      });
    });

    test('fromJSON deserializes FilePath', () => {
      const json = {
        relative: 'mods/skyrim',
        anchor: 'test',
        resolverName: 'mock',
      };

      const registry = new ResolverRegistry();
      registry.register(resolver);

      const filePath = FilePath.fromJSON(json, registry);

      expect(filePath.relative).toBe('mods/skyrim');
      expect(Anchor.name(filePath.anchor)).toBe('test');
      expect(filePath.resolver).toBe(resolver);
    });

    test('fromJSON throws if resolver not found', () => {
      const json = {
        relative: 'mods',
        anchor: 'test',
        resolverName: 'nonexistent',
      };

      const registry = new ResolverRegistry();

      expect(() => {
        FilePath.fromJSON(json, registry);
      }).toThrow(/not found/);
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

    test('hashCode generates consistent hash', () => {
      const path1 = new FilePath(RelativePath.make('mods'), anchor, resolver);
      const path2 = new FilePath(RelativePath.make('mods'), anchor, resolver);

      expect(path1.hashCode()).toBe(path2.hashCode());
    });
  });
});
