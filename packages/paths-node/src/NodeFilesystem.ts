/**
 * NodeFilesystem - Real filesystem wrapper using Node.js fs
 *
 * Delegates all operations to Node.js fs-extra module.
 * Used in production code for actual filesystem access.
 */

import type { IFilesystem, FileEntry } from '@vortex/paths';
import type { ResolvedPath } from '@vortex/paths';

import { FileType as FileTypeEnum, RelativePath as RelativePathNS } from '@vortex/paths';
import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Real filesystem implementation using Node.js fs
 */
export class NodeFilesystem implements IFilesystem {
  readonly platform = process.platform === 'win32' ? 'windows' as const : 'unix' as const;
  readonly caseSensitive = process.platform !== 'win32';
  readonly sep = path.sep;

  normalizePath(p: string): string {
    const normalized = path.normalize(p);
    return this.caseSensitive ? normalized : normalized.toLowerCase();
  }

  // ========================================================================
  // Read Operations
  // ========================================================================

  async readFile(filePath: ResolvedPath, encoding?: string | null): Promise<string | Uint8Array> {
    if (encoding) {
      return fs.readFile(filePath as string, { encoding: encoding as BufferEncoding });
    }
    return fs.readFile(filePath as string);
  }

  // ========================================================================
  // Write Operations
  // ========================================================================

  async writeFile(filePath: ResolvedPath, data: string | Uint8Array, encoding?: string): Promise<void> {
    await fs.ensureDir(path.dirname(filePath as string));
    await fs.writeFile(filePath as string, data, encoding ? { encoding: encoding as BufferEncoding } : undefined);
  }

  async appendFile(filePath: ResolvedPath, data: string | Uint8Array, encoding?: string): Promise<void> {
    await fs.appendFile(filePath as string, data, encoding ? { encoding: encoding as BufferEncoding } : undefined);
  }

  async unlink(filePath: ResolvedPath): Promise<void> {
    await fs.unlink(filePath as string);
  }

  // ========================================================================
  // Directory Operations
  // ========================================================================

  async readdir(dirPath: ResolvedPath): Promise<FileEntry[]> {
    const entries = await fs.readdir(dirPath as string, { withFileTypes: true });
    const results: FileEntry[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath as string, entry.name);
      const stats = await fs.stat(fullPath);

      let type = 0;
      if (entry.isFile()) type |= FileTypeEnum.File;
      if (entry.isDirectory()) type |= FileTypeEnum.Directory;
      if (entry.isSymbolicLink()) type |= FileTypeEnum.SymbolicLink;

      results.push({
        name: RelativePathNS.make(entry.name),
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

  async mkdir(dirPath: ResolvedPath, options?: { recursive?: boolean; mode?: number }): Promise<void> {
    await fs.mkdir(dirPath as string, options);
  }

  async rmdir(dirPath: ResolvedPath, options?: { recursive?: boolean }): Promise<void> {
    if (options?.recursive) {
      await fs.remove(dirPath as string);
    } else {
      await fs.rmdir(dirPath as string);
    }
  }

  // ========================================================================
  // Metadata Operations
  // ========================================================================

  async exists(filePath: ResolvedPath): Promise<boolean> {
    return fs.pathExists(filePath as string);
  }

  async stat(filePath: ResolvedPath): Promise<FileEntry> {
    const stats = await fs.stat(filePath as string);

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

  async lstat(filePath: ResolvedPath): Promise<FileEntry> {
    const stats = await fs.lstat(filePath as string);

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
    });
  }

  async rename(src: ResolvedPath, dest: ResolvedPath): Promise<void> {
    await fs.rename(src as string, dest as string);
  }
}
