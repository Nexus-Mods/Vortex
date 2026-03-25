/**
 * MockFilesystem - In-memory filesystem for testing
 *
 * Provides a complete filesystem implementation in memory with configurable
 * platform behavior (case-sensitive, path separators, etc.).
 */

import { Buffer } from "node:buffer";

import { forPlatform, type PathModule } from "../pathUtils";
import type { IFilesystem, FileEntry } from "../IFilesystem";
import type { ResolvedPath } from "../types";

import { FileType as FileTypeEnum } from "../IFilesystem";
import { RelativePath as RelativePathNS } from "../types";

/**
 * In-memory entry
 */
interface Entry {
  type: "file" | "directory";
  content?: Buffer;
  mtime: Date;
  birthtime: Date;
  atime: Date;
  mode: number;
}

/**
 * In-memory filesystem for testing
 * Configurable platform behavior (Windows vs Unix)
 */
export class MockFilesystem implements IFilesystem {
  private entries = new Map<string, Entry>();
  public readonly sep: string;
  private readonly pathMod: PathModule;

  constructor(
    public readonly platform: "windows" | "unix" = "unix",
    public readonly caseSensitive: boolean = platform !== "windows",
  ) {
    // Set separator for this platform
    this.sep = this.platform === "windows" ? "\\" : "/";
    this.pathMod = forPlatform(this.platform);

    // Create root directory
    const root = this.platform === "windows" ? "C:\\" : "/";
    this.entries.set(this.normalizePath(root), {
      type: "directory",
      mode: 0o755,
      mtime: new Date(),
      birthtime: new Date(),
      atime: new Date(),
    });
  }

  // ========================================================================
  // Path Normalization
  // ========================================================================

  /**
   * Normalize path for case-insensitive comparison
   * Uses platform-appropriate path module so Windows mocks work on Linux hosts
   */
  normalizePath(p: string): string {
    const normalized = this.pathMod.normalize(p);
    return this.caseSensitive ? normalized : normalized.toLowerCase();
  }

  /**
   * Get parent directory path
   */
  private getParentPath(p: string): string {
    return this.pathMod.dirname(p);
  }

  // ========================================================================
  // Entry Management
  // ========================================================================

  private getEntry(p: ResolvedPath): Entry | undefined {
    return this.entries.get(this.normalizePath(p as string));
  }

  private setEntry(p: ResolvedPath, entry: Entry): void {
    this.entries.set(this.normalizePath(p as string), entry);
  }

  private deleteEntry(p: ResolvedPath): void {
    this.entries.delete(this.normalizePath(p as string));
  }

  private getFileEntry(p: ResolvedPath): Entry {
    const entry = this.getEntry(p);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: ${p}`);
    }
    if (entry.type !== "file") {
      throw new Error(`EISDIR: illegal operation on a directory: ${p}`);
    }
    return entry;
  }

  private getDirectoryEntry(p: ResolvedPath): Entry {
    const entry = this.getEntry(p);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: ${p}`);
    }
    if (entry.type !== "directory") {
      throw new Error(`ENOTDIR: not a directory: ${p}`);
    }
    return entry;
  }

  /**
   * Ensure parent directory exists
   */
  private ensureParentDir(p: ResolvedPath): void {
    const parent = this.getParentPath(p as string);
    if (parent === (p as string)) {
      return; // Root
    }
    if (!this.entries.has(this.normalizePath(parent))) {
      throw new Error(`ENOENT: parent directory does not exist: ${parent}`);
    }
  }

  // ========================================================================
  // Read Operations
  // ========================================================================

  async readFile(
    path: ResolvedPath,
    encoding: string | null = "utf8",
  ): Promise<string | Uint8Array> {
    const entry = this.getFileEntry(path);
    entry.atime = new Date();
    if (encoding) {
      return entry.content!.toString(encoding as BufferEncoding);
    }
    return entry.content!;
  }

  // ========================================================================
  // Write Operations
  // ========================================================================

  async writeFile(
    path: ResolvedPath,
    data: string | Uint8Array,
    encoding: string = "utf8",
  ): Promise<void> {
    // Ensure parent directory exists (create if needed)
    const parent = this.getParentPath(path as string);
    if (
      parent !== (path as string) &&
      !this.entries.has(this.normalizePath(parent))
    ) {
      await this.mkdir(parent as ResolvedPath, { recursive: true });
    }

    const buffer = Buffer.isBuffer(data)
      ? data
      : data instanceof Uint8Array
        ? Buffer.from(data)
        : Buffer.from(data, encoding as BufferEncoding);
    const now = new Date();

    const existingEntry = this.getEntry(path);
    if (existingEntry && existingEntry.type === "directory") {
      throw new Error(`EISDIR: illegal operation on a directory: ${path}`);
    }

    this.setEntry(path, {
      type: "file",
      content: buffer,
      mode: existingEntry?.mode ?? 0o644,
      mtime: now,
      birthtime: existingEntry?.birthtime ?? now,
      atime: now,
    });
  }

  async appendFile(
    path: ResolvedPath,
    data: string | Uint8Array,
    encoding: string = "utf8",
  ): Promise<void> {
    const buffer = Buffer.isBuffer(data)
      ? data
      : data instanceof Uint8Array
        ? Buffer.from(data)
        : Buffer.from(data, encoding as BufferEncoding);

    if (this.entries.has(this.normalizePath(path as string))) {
      const existing = this.getFileEntry(path);
      if (existing.content) {
        existing.content = Buffer.concat([existing.content, buffer]);
      } else {
        existing.content = buffer;
      }
      existing.mtime = new Date();
      existing.atime = new Date();
    } else {
      await this.writeFile(path, buffer);
    }
  }

  async unlink(path: ResolvedPath): Promise<void> {
    const _entry = this.getFileEntry(path);
    this.deleteEntry(path);
  }

  // ========================================================================
  // Directory Operations
  // ========================================================================

  async readdir(path: ResolvedPath): Promise<FileEntry[]> {
    const dirEntry = this.getDirectoryEntry(path);
    dirEntry.atime = new Date();

    const normalizedPath = this.normalizePath(path as string);
    const prefix = normalizedPath.endsWith(this.sep)
      ? normalizedPath
      : normalizedPath + this.sep;

    const children: Array<{ name: string; entry: Entry }> = [];

    for (const [entryPath, entry] of this.entries.entries()) {
      if (entryPath.startsWith(prefix) && entryPath !== normalizedPath) {
        const relativePath = entryPath.substring(prefix.length);
        const segments = relativePath.split(this.sep);

        if (segments.length === 1 && segments[0] !== "") {
          // Direct child (and not empty string)
          children.push({ name: segments[0], entry });
        }
      }
    }

    return children.map(({ name, entry }) => ({
      name: RelativePathNS.unsafe(name),
      type: entry.type === "file" ? FileTypeEnum.File : FileTypeEnum.Directory,
      size: entry.content?.length ?? 0,
      mtime: entry.mtime,
      birthtime: entry.birthtime,
      atime: entry.atime,
      mode: entry.mode,
    }));
  }

  async mkdir(
    path: ResolvedPath,
    options?: { recursive?: boolean; mode?: number },
  ): Promise<void> {
    if (this.entries.has(this.normalizePath(path as string))) {
      const entry = this.getEntry(path);
      if (entry?.type === "directory") {
        if (!options?.recursive) {
          throw new Error(`EEXIST: file already exists: ${path}`);
        }
        return; // Already exists, no-op in recursive mode
      } else {
        throw new Error(`EEXIST: file already exists: ${path}`);
      }
    }

    if (options?.recursive) {
      const parent = this.getParentPath(path as string);
      if (
        parent !== (path as string) &&
        !this.entries.has(this.normalizePath(parent))
      ) {
        await this.mkdir(parent as ResolvedPath, options);
      }
    } else {
      this.ensureParentDir(path);
    }

    const now = new Date();
    this.setEntry(path, {
      type: "directory",
      mode: options?.mode ?? 0o755,
      mtime: now,
      birthtime: now,
      atime: now,
    });
  }

  async rmdir(
    path: ResolvedPath,
    options?: { recursive?: boolean },
  ): Promise<void> {
    const _entry = this.getDirectoryEntry(path);

    // Check if directory is empty (unless recursive)
    if (!options?.recursive) {
      const children = await this.readdir(path);
      if (children.length > 0) {
        throw new Error(`ENOTEMPTY: directory not empty: ${path}`);
      }
    }

    // Delete recursively if needed
    if (options?.recursive) {
      const normalizedPath = this.normalizePath(path as string);
      const prefix = normalizedPath.endsWith(this.sep)
        ? normalizedPath
        : normalizedPath + this.sep;

      const toDelete: string[] = [];
      for (const entryPath of this.entries.keys()) {
        if (entryPath.startsWith(prefix) || entryPath === normalizedPath) {
          toDelete.push(entryPath);
        }
      }

      for (const entryPath of toDelete) {
        this.entries.delete(entryPath);
      }
    } else {
      this.deleteEntry(path);
    }
  }

  // ========================================================================
  // Metadata Operations
  // ========================================================================

  async exists(path: ResolvedPath): Promise<boolean> {
    return this.entries.has(this.normalizePath(path as string));
  }

  async stat(path: ResolvedPath): Promise<FileEntry> {
    const entry = this.getEntry(path);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }

    return {
      type: entry.type === "file" ? FileTypeEnum.File : FileTypeEnum.Directory,
      size: entry.content?.length ?? 0,
      mtime: entry.mtime,
      birthtime: entry.birthtime,
      atime: entry.atime,
      mode: entry.mode,
    };
  }

  async lstat(path: ResolvedPath): Promise<FileEntry> {
    const entry = this.getEntry(path);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }

    return {
      type: entry.type === "file" ? FileTypeEnum.File : FileTypeEnum.Directory,
      size: entry.content?.length ?? 0,
      mtime: entry.mtime,
      birthtime: entry.birthtime,
      atime: entry.atime,
      mode: entry.mode,
    };
  }

  // ========================================================================
  // Copy/Move Operations
  // ========================================================================

  async copy(
    src: ResolvedPath,
    dest: ResolvedPath,
    options?: { overwrite?: boolean; recursive?: boolean },
  ): Promise<void> {
    const srcEntry = this.getEntry(src);
    if (!srcEntry) {
      throw new Error(`ENOENT: no such file or directory: ${src}`);
    }

    if (
      !options?.overwrite &&
      this.entries.has(this.normalizePath(dest as string))
    ) {
      throw new Error(`EEXIST: file already exists: ${dest}`);
    }

    if (srcEntry.type === "file") {
      await this.writeFile(dest, srcEntry.content ?? Buffer.alloc(0));
    } else {
      // Directory copy
      if (!options?.recursive) {
        throw new Error(`EISDIR: illegal operation on a directory: ${src}`);
      }

      await this.mkdir(dest, { recursive: true });

      const children = await this.readdir(src);
      for (const child of children) {
        const childSrc = this.pathMod.join(
          src as string,
          child.name as string,
        ) as unknown as ResolvedPath;
        const childDest = this.pathMod.join(
          dest as string,
          child.name as string,
        ) as unknown as ResolvedPath;
        await this.copy(childSrc, childDest, options);
      }
    }
  }

  async rename(src: ResolvedPath, dest: ResolvedPath): Promise<void> {
    const entry = this.getEntry(src);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: ${src}`);
    }

    // Remove old entry
    this.deleteEntry(src);

    // Add new entry
    this.setEntry(dest, entry);
  }

  // ========================================================================
  // Testing Helpers
  // ========================================================================

  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.entries.clear();
    // Recreate root
    const root = this.platform === "windows" ? "C:\\" : "/";
    this.entries.set(this.normalizePath(root), {
      type: "directory",
      mode: 0o755,
      mtime: new Date(),
      birthtime: new Date(),
      atime: new Date(),
    });
  }

  /**
   * Get all paths in the filesystem (for debugging)
   */
  getAllPaths(): string[] {
    return Array.from(this.entries.keys());
  }
}
