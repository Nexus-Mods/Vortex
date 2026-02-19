/* eslint-disable vortex/no-module-imports */
/**
 * Tests for IPC serialization
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

import type { IResolver } from '../IResolver';

import { FilePath } from '../FilePath';
import { FilePathIPC, SerializedFilePathSchema } from '../ipc';
import { RelativePath, Anchor, ResolvedPath } from '../types';

// Mock resolver for testing
class TestResolver implements IResolver {
  constructor(public readonly name: string = 'test') {}

  async resolve(anchor: Anchor, relative: RelativePath): Promise<ResolvedPath> {
    const anchorName = Anchor.name(anchor);
    return ResolvedPath.make(`/test/${anchorName}/${relative}`);
  }

  canResolve(): boolean {
    return true;
  }

  supportedAnchors(): Anchor[] {
    return [Anchor.make('testAnchor')];
  }

  PathFor(anchorName: string, relative: string = ''): FilePath {
    return new FilePath(
      relative ? RelativePath.make(relative) : RelativePath.EMPTY,
      Anchor.make(anchorName),
      this,
    );
  }

  async tryReverse(): Promise<{ anchor: Anchor; relative: RelativePath } | null> {
    return null;
  }

  async getBasePaths(): Promise<Map<Anchor, ResolvedPath>> {
    return new Map();
  }
}

describe('FilePathIPC', () => {
  let resolver: TestResolver;
  let filePath: FilePath;

  beforeEach(() => {
    resolver = new TestResolver();

    filePath = new FilePath(
      RelativePath.make('mods/skyrim'),
      Anchor.make('testAnchor'),
      resolver,
    );
  });

  describe('serialize', () => {
    test('serializes FilePath to JSON', () => {
      const serialized = FilePathIPC.serialize(filePath);

      expect(serialized).toEqual({
        relative: 'mods/skyrim',
        anchor: 'testAnchor',
        resolverName: 'test',
      });
    });
  });


  describe('serializeResolved', () => {
    test('resolves and serializes to string', async () => {
      const resolved = await FilePathIPC.serializeResolved(filePath);

      expect(resolved).toBe('/test/testAnchor/mods/skyrim');
    });
  });

  describe('serializeMany', () => {
    test('serializes array of FilePaths', () => {
      const paths = [
        resolver.PathFor('testAnchor', 'mods'),
        resolver.PathFor('testAnchor', 'downloads'),
      ];

      const serialized = FilePathIPC.serializeMany(paths);

      expect(serialized).toHaveLength(2);
      expect(serialized[0].relative).toBe('mods');
      expect(serialized[1].relative).toBe('downloads');
    });
  });

  describe('serializeManyResolved', () => {
    test('resolves and serializes array of FilePaths', async () => {
      const paths = [
        resolver.PathFor('testAnchor', 'mods'),
        resolver.PathFor('testAnchor', 'downloads'),
      ];

      const resolved = await FilePathIPC.serializeManyResolved(paths);

      expect(resolved).toHaveLength(2);
      expect(resolved[0]).toBe('/test/testAnchor/mods');
      expect(resolved[1]).toBe('/test/testAnchor/downloads');
    });
  });

  describe('isSerializedFilePath', () => {
    test('validates serialized FilePath objects', () => {
      const valid = {
        relative: 'mods',
        anchor: 'testAnchor',
        resolverName: 'test',
      };

      const invalid1 = {
        relative: '../invalid',
        anchor: 'testAnchor',
        resolverName: 'test',
      };

      const invalid2 = {
        relative: 'mods',
        // missing anchor
        resolverName: 'test',
      };

      expect(FilePathIPC.isSerializedFilePath(valid)).toBe(true);
      expect(FilePathIPC.isSerializedFilePath(invalid1)).toBe(false);
      expect(FilePathIPC.isSerializedFilePath(invalid2)).toBe(false);
      expect(FilePathIPC.isSerializedFilePath('string')).toBe(false);
      expect(FilePathIPC.isSerializedFilePath(null)).toBe(false);
    });
  });

  describe('SerializedFilePathSchema', () => {
    test('validates correct data', () => {
      const data = {
        relative: 'mods/skyrim',
        anchor: 'testAnchor',
        resolverName: 'test',
      };

      const result = SerializedFilePathSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    test('rejects invalid relative paths', () => {
      const data = {
        relative: '../etc/passwd',
        anchor: 'testAnchor',
        resolverName: 'test',
      };

      const result = SerializedFilePathSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    test('rejects missing fields', () => {
      const data = {
        relative: 'mods',
        // missing anchor
        resolverName: 'test',
      };

      const result = SerializedFilePathSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });
});
