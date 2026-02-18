/**
 * NodeFilesystem - Real filesystem wrapper using Node.js fs
 *
 * Delegates all operations to Node.js fs-extra module.
 * Used in production code for actual filesystem access.
 */

// eslint-disable-next-line vortex/no-module-imports
import * as fs from 'fs-extra';

import type { IFilesystem, FileEntry, FileType } from '../IFilesystem';
import { FileType as FileTypeEnum } from '../IFilesystem';
import type { ResolvedPath, RelativePath } from '../types';
import { RelativePath as RelativePathNS } from '../types';

/**
 * Real filesystem implementation using Node.js fs
 */
export class NodeFilesystem implements IFilesystem {
  readonly platform = process.platform as 'win32' | 'linux' | 'darwin';
  readonly caseSensitive = process.platform !== 'win32';

  // ========================================================================
  // Read Operations
  // ========================================================================

  async readFile(path: ResolvedPath, encoding?: BufferEncoding): Promise<string | Buffer> {
    if (encoding) {
      return fs.readFile(path as string, { encoding });
    }
    return fs.readFile(path as string);
  }

  // ========================================================================
  // Write Operations
  // ========================================================================

  async writeFile(path: ResolvedPath, data: string | Buffer, encoding?: BufferEncoding): Promise<void> {
    // eslint-disable-next-line vortex/no-module-imports
    const pathModule = require('path');
    await fs.ensureDir(pathModule.dirname(path as string));
    await fs.writeFile(path as string, data, encoding ? { encoding } : undefined);
  }

  async appendFile(path: ResolvedPath, data: string | Buffer, encoding?: BufferEncoding): Promise<void> {
    await fs.appendFile(path as string, data, encoding ? { encoding } : undefined);
  }

  async unlink(path: ResolvedPath): Promise<void> {
    await fs.unlink(path as string);
  }

  // ========================================================================
  // Directory Operations
  // ========================================================================

  async readdir(path: ResolvedPath): Promise<FileEntry[]> {
    const entries = await fs.readdir(path as string, { withFileTypes: true });
    const results: FileEntry[] = [];

    // eslint-disable-next-line vortex/no-module-imports
    const pathModule = require('path');

    for (const entry of entries) {
      const fullPath = pathModule.join(path as string, entry.name);
      const stats = await fs.stat(fullPath);

      let type = 0;
      if (entry.isFile()) type |= FileTypeEnum.File;
      if (entry.isDirectory()) type |= FileTypeEnum.Directory;
      if (entry.isSymbolicLink()) type |= FileTypeEnum.SymbolicLink;

      results.push({
        name: RelativePathNS.unsafe(entry.name),
        type,
        size: stats.size,
        mtime: stats.mtime,
        birthtime: stats.birthtime,
        atime: stats.atime,
        mode: stats.mode,
      });
    }

    return results;
  }

  async mkdir(path: ResolvedPath, options?: { recursive?: boolean; mode?: number }): Promise<void> {
    await fs.mkdir(path as string, options);
  }

  async rmdir(path: ResolvedPath, options?: { recursive?: boolean }): Promise<void> {
    if (options?.recursive) {
      await fs.remove(path as string);
    } else {
      await fs.rmdir(path as string);
    }
  }

  // ========================================================================
  // Metadata Operations
  // ========================================================================

  async exists(path: ResolvedPath): Promise<boolean> {
    return fs.pathExists(path as string);
  }

  async stat(path: ResolvedPath): Promise<FileEntry> {
    const stats = await fs.stat(path as string);

    let type = 0;
    if (stats.isFile()) type |= FileTypeEnum.File;
    if (stats.isDirectory()) type |= FileTypeEnum.Directory;
    if (stats.isSymbolicLink()) type |= FileTypeEnum.SymbolicLink;

    return {
      type,
      size: stats.size,
      mtime: stats.mtime,
      birthtime: stats.birthtime,
      atime: stats.atime,
      mode: stats.mode,
    };
  }

  async lstat(path: ResolvedPath): Promise<FileEntry> {
    const stats = await fs.lstat(path as string);

    let type = 0;
    if (stats.isFile()) type |= FileTypeEnum.File;
    if (stats.isDirectory()) type |= FileTypeEnum.Directory;
    if (stats.isSymbolicLink()) type |= FileTypeEnum.SymbolicLink;

    return {
      type,
      size: stats.size,
      mtime: stats.mtime,
      birthtime: stats.birthtime,
      atime: stats.atime,
      mode: stats.mode,
    };
  }

  // ========================================================================
  // Copy/Move Operations
  // ========================================================================

  async copy(
    src: ResolvedPath,
    dest: ResolvedPath,
    options?: { overwrite?: boolean; recursive?: boolean }
  ): Promise<void> {
    await fs.copy(src as string, dest as string, {
      overwrite: options?.overwrite ?? true,
      recursive: options?.recursive ?? true,
    });
  }

  async rename(src: ResolvedPath, dest: ResolvedPath): Promise<void> {
    await fs.rename(src as string, dest as string);
  }
}
