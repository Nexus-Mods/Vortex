/* eslint-disable vortex/no-module-imports */
/**
 * Tests for IFilesystem implementations
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

import { MockFilesystem } from './mocks/MockFilesystem';
import { MockWindowsFilesystem } from './mocks/MockWindowsFilesystem';
import { MockUnixFilesystem } from './mocks/MockUnixFilesystem';
import { FileEntry } from '../IFilesystem';
import { ResolvedPath } from '../types';

describe('MockFilesystem', () => {
  let fs: MockFilesystem;

  beforeEach(() => {
    fs = new MockFilesystem('linux', true);
  });

  describe('file operations', () => {
    test('writeFile and readFile', async () => {
      const path = ResolvedPath.make('/test/file.txt');
      await fs.writeFile(path, 'hello world', 'utf8');
      const content = await fs.readFile(path, 'utf8');
      expect(content).toBe('hello world');
    });

    test('writeFile creates parent directories', async () => {
      const path = ResolvedPath.make('/deep/nested/dir/file.txt');
      await fs.writeFile(path, 'content', 'utf8');
      expect(await fs.exists(path)).toBe(true);
      expect(await fs.exists(ResolvedPath.make('/deep/nested/dir'))).toBe(true);
    });

    test('appendFile appends content', async () => {
      const path = ResolvedPath.make('/test/file.txt');
      await fs.writeFile(path, 'hello', 'utf8');
      await fs.appendFile(path, ' world', 'utf8');
      const content = await fs.readFile(path, 'utf8');
      expect(content).toBe('hello world');
    });

    test('unlink deletes file', async () => {
      const path = ResolvedPath.make('/test/file.txt');
      await fs.writeFile(path, 'content', 'utf8');
      expect(await fs.exists(path)).toBe(true);
      await fs.unlink(path);
      expect(await fs.exists(path)).toBe(false);
    });
  });

  describe('directory operations', () => {
    test('mkdir creates directory', async () => {
      const path = ResolvedPath.make('/test/dir');
      await fs.mkdir(path, { recursive: true });
      expect(await fs.exists(path)).toBe(true);
      const stat = await fs.stat(path);
      expect(FileEntry.isDirectory(stat)).toBe(true);
    });

    test('mkdir recursive creates nested directories', async () => {
      const path = ResolvedPath.make('/test/deep/nested/dir');
      await fs.mkdir(path, { recursive: true });
      expect(await fs.exists(path)).toBe(true);
      expect(await fs.exists(ResolvedPath.make('/test/deep'))).toBe(true);
    });

    test('readdir lists directory contents', async () => {
      const dir = ResolvedPath.make('/test/dir');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(ResolvedPath.make('/test/dir/file1.txt'), 'a', 'utf8');
      await fs.writeFile(ResolvedPath.make('/test/dir/file2.txt'), 'b', 'utf8');

      const entries = await fs.readdir(dir);
      expect(entries).toHaveLength(2);
      expect(entries.map(e => e.name)).toContain('file1.txt');
      expect(entries.map(e => e.name)).toContain('file2.txt');
    });

    test('readdir returns FileEntry with metadata', async () => {
      const dir = ResolvedPath.make('/test/dir');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(ResolvedPath.make('/test/dir/file.txt'), 'content', 'utf8');
      await fs.mkdir(ResolvedPath.make('/test/dir/subdir'));

      const entries = await fs.readdir(dir);
      expect(entries).toHaveLength(2);

      const file = entries.find(e => e.name === 'file.txt');
      const subdir = entries.find(e => e.name === 'subdir');

      expect(file && FileEntry.isFile(file)).toBe(true);
      expect(subdir && FileEntry.isDirectory(subdir)).toBe(true);
    });

    test('rmdir removes empty directory', async () => {
      const dir = ResolvedPath.make('/test/dir');
      await fs.mkdir(dir, { recursive: true });
      await fs.rmdir(dir);
      expect(await fs.exists(dir)).toBe(false);
    });

    test('rmdir recursive removes directory tree', async () => {
      const dir = ResolvedPath.make('/test/dir');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(ResolvedPath.make('/test/dir/file.txt'), 'content', 'utf8');
      await fs.mkdir(ResolvedPath.make('/test/dir/subdir'));

      await fs.rmdir(dir, { recursive: true });
      expect(await fs.exists(dir)).toBe(false);
    });
  });

  describe('metadata operations', () => {
    test('exists returns true for existing paths', async () => {
      const path = ResolvedPath.make('/test/file.txt');
      await fs.writeFile(path, 'content', 'utf8');
      expect(await fs.exists(path)).toBe(true);
    });

    test('exists returns false for non-existing paths', async () => {
      const path = ResolvedPath.make('/nonexistent');
      expect(await fs.exists(path)).toBe(false);
    });

    test('stat returns file stats', async () => {
      const path = ResolvedPath.make('/test/file.txt');
      const content = 'hello world';
      await fs.writeFile(path, content, 'utf8');

      const stats = await fs.stat(path);
      expect(FileEntry.isFile(stats)).toBe(true);
      expect(FileEntry.isDirectory(stats)).toBe(false);
      expect(stats.size).toBe(Buffer.byteLength(content));
    });

    test('stat returns directory stats', async () => {
      const path = ResolvedPath.make('/test/dir');
      await fs.mkdir(path, { recursive: true });

      const stats = await fs.stat(path);
      expect(FileEntry.isFile(stats)).toBe(false);
      expect(FileEntry.isDirectory(stats)).toBe(true);
    });
  });

  describe('copy/move operations', () => {
    test('copy copies file', async () => {
      const src = ResolvedPath.make('/test/src.txt');
      const dest = ResolvedPath.make('/test/dest.txt');

      await fs.writeFile(src, 'content', 'utf8');
      await fs.copy(src, dest);

      expect(await fs.exists(dest)).toBe(true);
      expect(await fs.readFile(dest, 'utf8')).toBe('content');
      expect(await fs.exists(src)).toBe(true); // Original still exists
    });

    test('rename moves file', async () => {
      const src = ResolvedPath.make('/test/src.txt');
      const dest = ResolvedPath.make('/test/dest.txt');

      await fs.writeFile(src, 'content', 'utf8');
      await fs.rename(src, dest);

      expect(await fs.exists(dest)).toBe(true);
      expect(await fs.readFile(dest, 'utf8')).toBe('content');
      expect(await fs.exists(src)).toBe(false); // Original removed
    });
  });
});

describe('MockWindowsFilesystem', () => {
  let fs: MockWindowsFilesystem;

  beforeEach(() => {
    fs = new MockWindowsFilesystem();
  });

  test('is case-insensitive', async () => {
    // Use unsafe for Windows paths when testing on Linux
    const path1 = ResolvedPath.unsafe('C:\\Test\\FILE.txt');
    const path2 = ResolvedPath.unsafe('C:\\test\\file.txt');

    await fs.writeFile(path1, 'content', 'utf8');

    // Should find file with different case
    expect(await fs.exists(path2)).toBe(true);
    const content = await fs.readFile(path2, 'utf8');
    expect(content).toBe('content');
  });

  test('platform is win32', () => {
    expect(fs.platform).toBe('win32');
    expect(fs.caseSensitive).toBe(false);
  });
});

describe('MockUnixFilesystem', () => {
  let fs: MockUnixFilesystem;

  beforeEach(() => {
    fs = new MockUnixFilesystem();
  });

  test('is case-sensitive', async () => {
    const path1 = ResolvedPath.make('/test/FILE.txt');
    const path2 = ResolvedPath.make('/test/file.txt');

    await fs.writeFile(path1, 'content1', 'utf8');
    await fs.writeFile(path2, 'content2', 'utf8');

    // Both files should exist as separate entities
    expect(await fs.exists(path1)).toBe(true);
    expect(await fs.exists(path2)).toBe(true);
    expect(await fs.readFile(path1, 'utf8')).toBe('content1');
    expect(await fs.readFile(path2, 'utf8')).toBe('content2');
  });

  test('platform is linux', () => {
    expect(fs.platform).toBe('linux');
    expect(fs.caseSensitive).toBe(true);
  });
});
