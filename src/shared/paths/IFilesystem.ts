/**
 * IFilesystem interface for cross-platform filesystem abstraction
 *
 * All methods accept ResolvedPath (not raw strings!) to ensure type safety.
 * This enables 100% cross-platform testing with mock implementations.
 */

import type { ResolvedPath, RelativePath } from './types';

/**
 * File type flags (bitfield)
 * Can be combined for entries that are multiple types (e.g., symlink to directory)
 */
export enum FileType {
  File = 1 << 0,        // 0b001 = 1
  Directory = 1 << 1,   // 0b010 = 2
  SymbolicLink = 1 << 2, // 0b100 = 4
}

/**
 * File/directory entry with metadata
 * Plain data structure (no virtual methods)
 */
export interface FileEntry {
  /**
   * Filename/directory name (relative path within parent directory)
   * Only present for directory listings; undefined for stat() results
   */
  name?: RelativePath;

  /**
   * File type flags (bitfield)
   * Use FileEntry.isFile(), isDirectory(), isSymbolicLink() helpers to check
   */
  type: number; // FileType flags

  /**
   * File size in bytes
   */
  size: number;

  /**
   * Last modification time
   */
  mtime: Date;

  /**
   * Creation time
   */
  birthtime: Date;

  /**
   * Last access time
   */
  atime: Date;

  /**
   * File mode (permissions)
   */
  mode: number;
}

/**
 * Helper functions for checking file types
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace FileEntry {
  /**
   * Check if entry is a regular file
   */
  export function isFile(entry: FileEntry): boolean {
    return (entry.type & FileType.File) !== 0;
  }

  /**
   * Check if entry is a directory
   */
  export function isDirectory(entry: FileEntry): boolean {
    return (entry.type & FileType.Directory) !== 0;
  }

  /**
   * Check if entry is a symbolic link
   */
  export function isSymbolicLink(entry: FileEntry): boolean {
    return (entry.type & FileType.SymbolicLink) !== 0;
  }

  /**
   * Create a FileEntry for a file
   */
  export function file(
    size: number,
    mtime: Date,
    birthtime: Date,
    atime: Date,
    mode: number,
    name?: RelativePath,
  ): FileEntry {
    return { name, type: FileType.File, size, mtime, birthtime, atime, mode };
  }

  /**
   * Create a FileEntry for a directory
   */
  export function directory(
    mtime: Date,
    birthtime: Date,
    atime: Date,
    mode: number,
    name?: RelativePath,
  ): FileEntry {
    return { name, type: FileType.Directory, size: 0, mtime, birthtime, atime, mode };
  }

  /**
   * Create a FileEntry for a symbolic link
   */
  export function symlink(
    size: number,
    mtime: Date,
    birthtime: Date,
    atime: Date,
    mode: number,
    name?: RelativePath,
  ): FileEntry {
    return { name, type: FileType.SymbolicLink, size, mtime, birthtime, atime, mode };
  }
}

/**
 * Filesystem abstraction for cross-platform testing
 * All methods accept ResolvedPath (not raw strings!)
 */
export interface IFilesystem {
  // ========================================================================
  // Platform Information
  // ========================================================================

  /**
   * Platform identifier
   */
  readonly platform: 'win32' | 'linux' | 'darwin';

  /**
   * Whether this filesystem is case-sensitive
   * - Windows: false (C:\Vortex === C:\vortex)
   * - Linux/macOS: true (usually)
   */
  readonly caseSensitive: boolean;

  /**
   * Normalize a path for comparison (handles case folding and separator normalization)
   * This is the single authority on how to normalize a path for comparison.
   *
   * @param p - Path string to normalize
   * @returns Normalized path string suitable for comparison
   */
  normalizePath(p: string): string;

  // ========================================================================
  // Read Operations
  // ========================================================================

  /**
   * Read entire file contents
   *
   * @param path - Absolute path to file
   * @param encoding - Optional encoding (utf8, etc.) - if omitted, returns Buffer
   * @returns File contents as string (if encoding specified) or Buffer
   * @throws Error if file doesn't exist or can't be read
   */
  readFile(path: ResolvedPath, encoding?: BufferEncoding): Promise<string | Buffer>;

  // ========================================================================
  // Write Operations
  // ========================================================================

  /**
   * Write data to file
   * Creates parent directories if they don't exist
   *
   * @param path - Absolute path to file
   * @param data - Data to write (string or Buffer)
   * @param encoding - Optional encoding (default: utf8)
   * @throws Error if write fails
   */
  writeFile(path: ResolvedPath, data: string | Buffer, encoding?: BufferEncoding): Promise<void>;

  /**
   * Append data to file
   *
   * @param path - Absolute path to file
   * @param data - Data to append
   * @param encoding - Optional encoding (default: utf8)
   */
  appendFile(path: ResolvedPath, data: string | Buffer, encoding?: BufferEncoding): Promise<void>;

  /**
   * Delete file
   *
   * @param path - Absolute path to file
   * @throws Error if file doesn't exist or can't be deleted
   */
  unlink(path: ResolvedPath): Promise<void>;

  // ========================================================================
  // Directory Operations
  // ========================================================================

  /**
   * Read directory contents with metadata
   *
   * @param path - Absolute path to directory
   * @returns Array of FileEntry objects with name and metadata
   * @throws Error if directory doesn't exist or can't be read
   */
  readdir(path: ResolvedPath): Promise<FileEntry[]>;

  /**
   * Create directory
   *
   * @param path - Absolute path to directory
   * @param options - Options (recursive: true to create parent directories)
   * @throws Error if directory already exists or can't be created
   */
  mkdir(path: ResolvedPath, options?: { recursive?: boolean; mode?: number }): Promise<void>;

  /**
   * Remove directory
   *
   * @param path - Absolute path to directory
   * @param options - Options (recursive: true to remove contents)
   * @throws Error if directory doesn't exist, not empty (without recursive), or can't be removed
   */
  rmdir(path: ResolvedPath, options?: { recursive?: boolean }): Promise<void>;

  // ========================================================================
  // Metadata Operations
  // ========================================================================

  /**
   * Check if path exists
   *
   * @param path - Absolute path
   * @returns true if path exists, false otherwise
   */
  exists(path: ResolvedPath): Promise<boolean>;

  /**
   * Get file/directory metadata
   *
   * @param path - Absolute path
   * @returns FileEntry with metadata (name will be undefined)
   * @throws Error if path doesn't exist
   */
  stat(path: ResolvedPath): Promise<FileEntry>;

  /**
   * Get file/directory metadata, not following symlinks
   *
   * @param path - Absolute path
   * @returns FileEntry with metadata (name will be undefined)
   * @throws Error if path doesn't exist
   */
  lstat(path: ResolvedPath): Promise<FileEntry>;

  // ========================================================================
  // Copy/Move Operations
  // ========================================================================

  /**
   * Copy file or directory
   *
   * @param src - Source path
   * @param dest - Destination path
   * @param options - Copy options
   */
  copy(src: ResolvedPath, dest: ResolvedPath, options?: { overwrite?: boolean; recursive?: boolean }): Promise<void>;

  /**
   * Move/rename file or directory
   *
   * @param src - Source path
   * @param dest - Destination path
   */
  rename(src: ResolvedPath, dest: ResolvedPath): Promise<void>;
}
