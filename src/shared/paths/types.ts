/**
 * Core branded types for the Vortex path system
 *
 * This module provides zero-cost TypeScript branded types with runtime Zod validation:
 * - RelativePath: Forward-slash separated, sanitized relative paths
 * - ResolvedPath: Absolute, OS-specific paths (output of resolution)
 * - Extension: File extensions with leading dot
 * - Anchor: Named resolution starting points (interned Symbols)
 */

// eslint-disable-next-line vortex/no-module-imports
import * as path from 'path';
// eslint-disable-next-line vortex/no-module-imports
import { z } from 'zod';

// ============================================================================
// Zod Schemas for Runtime Validation
// ============================================================================

/**
 * Zod schema for RelativePath validation
 * - Normalizes separators to forward slashes
 * - Removes leading/trailing slashes
 * - Collapses multiple slashes
 * - Rejects parent directory references (..)
 * - Rejects absolute paths and drive letters
 */
export const RelativePathSchema = z.string()
  .transform(s => s.replace(/\\/g, '/'))  // Normalize to forward slashes
  .transform(s => s.replace(/^\/+/, ''))   // Remove leading slashes
  .transform(s => s.replace(/\/+$/, ''))   // Remove trailing slashes
  .transform(s => s.replace(/\/+/g, '/'))  // Collapse multiple slashes
  .refine(s => !s.startsWith('..'), {
    message: 'Relative paths cannot start with ..',
  })
  .refine(s => !/^[a-zA-Z]:/.test(s), {
    message: 'Relative paths cannot contain drive letters',
  });

/**
 * Zod schema for ResolvedPath validation
 * - Must be an absolute path (Unix or Windows format)
 * - Accepts both Unix-style (/...) and Windows-style (C:\...) absolute paths
 */
export const ResolvedPathSchema = z.string()
  .refine(s => {
    // Accept Unix absolute paths: start with /
    if (s.startsWith('/')) {
      return true;
    }
    // Accept Windows absolute paths: drive letter followed by :\
    if (/^[a-zA-Z]:\\/.test(s)) {
      return true;
    }
    // Fall back to platform-specific check
    return path.isAbsolute(s);
  }, {
    message: 'Resolved paths must be absolute (Unix: /path or Windows: C:\\path)',
  });

/**
 * Zod schema for Extension validation
 * - Must start with a dot
 * - Cannot contain path separators
 * - Normalized to lowercase
 */
export const ExtensionSchema = z.string()
  .refine(s => s.startsWith('.'), {
    message: 'Extensions must start with .',
  })
  .refine(s => !s.includes('/') && !s.includes('\\'), {
    message: 'Extensions cannot contain path separators',
  })
  .transform(s => s.toLowerCase());

// ============================================================================
// RelativePath: Sanitized relative paths (input to resolvers)
// ============================================================================

declare const RELATIVE_PATH_BRAND: unique symbol;

/**
 * RelativePath is a branded string type representing a sanitized relative path
 * - Always uses forward slashes
 * - No leading or trailing slashes
 * - No parent directory references (..)
 * - No absolute paths or drive letters
 *
 * Examples: "mods/skyrim/data", "downloads", "temp/cache"
 */
export type RelativePath = string & { readonly [RELATIVE_PATH_BRAND]: typeof RELATIVE_PATH_BRAND };

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace RelativePath {
  /**
   * Smart constructor with Zod validation
   * Normalizes and validates the input string
   *
   * @throws Error if validation fails
   */
  export function make(input: string): RelativePath {
    const result = RelativePathSchema.safeParse(input);
    if (!result.success) {
      const errors = result.error.issues?.map(e => e.message).join(', ') || result.error.message;
      throw new Error(`Invalid RelativePath: ${errors}`);
    }
    return result.data as RelativePath;
  }

  /**
   * Skip validation (use only when input is already validated)
   * Use with caution - no safety checks performed
   */
  export function unsafe(input: string): RelativePath {
    return input as RelativePath;
  }

  /**
   * Empty relative path (root of anchor)
   */
  export const EMPTY: RelativePath = '' as RelativePath;

  /**
   * Join path segments into a single RelativePath
   * All segments are joined with forward slashes and normalized.
   * Segments may contain separators (forward or back slashes) —
   * they are normalized by `make()`.
   *
   * @example
   * RelativePath.join(RelativePath.make('mods'), 'skyrim', 'data')
   * // => 'mods/skyrim/data'
   *
   * RelativePath.join(RelativePath.make('mods'), 'skyrim/data', 'meshes')
   * // => 'mods/skyrim/data/meshes'
   *
   * RelativePath.join(RelativePath.make('mods'), 'skyrim\\data', 'meshes')
   * // => 'mods/skyrim/data/meshes'
   */
  export function join(base: RelativePath, ...segments: string[]): RelativePath {
    const combined = [base as string, ...segments]
      .filter(s => s.length > 0)
      .join('/');
    return combined === '' ? EMPTY : make(combined);
  }

  /**
   * Get the directory part of a relative path
   *
   * @example
   * RelativePath.dirname(RelativePath.make('mods/skyrim/data.esp'))
   * // => 'mods/skyrim'
   */
  export function dirname(relative: RelativePath): RelativePath {
    const dir = path.posix.dirname(relative as string);
    if (dir === '.' || dir === '') {
      return EMPTY;
    }
    return make(dir);
  }

  /**
   * Get the basename (filename) of a relative path
   *
   * @example
   * RelativePath.basename(RelativePath.make('mods/skyrim/data.esp'))
   * // => 'data.esp'
   */
  export function basename(relative: RelativePath, ext?: string): string {
    return path.posix.basename(relative as string, ext);
  }

  /**
   * Convert to string for debugging
   */
  export function toString(relative: RelativePath): string {
    return relative as string;
  }

  /**
   * Count path segments. Empty = 0, "mods/skyrim/data" = 3.
   */
  export function depth(relative: RelativePath): number {
    if (relative === '' || relative === EMPTY) return 0;
    return (relative as string).split('/').length;
  }

  /**
   * Strict containment check (not equal). Everything is "in" EMPTY.
   */
  export function isIn(child: RelativePath, parent: RelativePath): boolean {
    if (parent === EMPTY || parent === '') {
      return child !== EMPTY && child !== '';
    }
    return (child as string).startsWith((parent as string) + '/');
  }

  /**
   * Equality check (already normalized on construction, so === suffices)
   */
  export function equals(a: RelativePath, b: RelativePath): boolean {
    return a === b;
  }

  /**
   * Locale-aware comparison for sorting
   */
  export function compare(a: RelativePath, b: RelativePath): number {
    return (a as string).localeCompare(b as string);
  }

  /**
   * FNV-1a numeric hash (unsigned 32-bit)
   */
  export function hash(relative: RelativePath): number {
    return fnv1a(relative as string);
  }
}

// ============================================================================
// ResolvedPath: Absolute OS paths (output from resolvers, input to IFilesystem)
// ============================================================================

declare const RESOLVED_PATH_BRAND: unique symbol;

/**
 * ResolvedPath is a branded string type representing a fully resolved absolute path
 * - Platform-specific separators (Windows: \, Unix: /)
 * - Always absolute
 * - Used as input to IFilesystem operations
 *
 * Examples (Windows): "C:\\Users\\name\\AppData\\Roaming\\Vortex\\mods"
 * Examples (Unix): "/home/user/.local/share/Vortex/mods"
 */
export type ResolvedPath = string & { readonly [RESOLVED_PATH_BRAND]: typeof RESOLVED_PATH_BRAND };

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ResolvedPath {
  /**
   * Create from resolved OS path with Zod validation
   * Validates that the path is absolute
   *
   * @throws Error if path is not absolute
   */
  export function make(osPath: string): ResolvedPath {
    const result = ResolvedPathSchema.safeParse(osPath);
    if (!result.success) {
      const errors = result.error.issues?.map(e => e.message).join(', ') || result.error.message;
      throw new Error(`Invalid ResolvedPath: ${errors}`);
    }
    return result.data as ResolvedPath;
  }

  /**
   * Skip validation (use only when input is already validated)
   */
  export function unsafe(osPath: string): ResolvedPath {
    return osPath as ResolvedPath;
  }

  /**
   * Parse into components (for testing and debugging)
   *
   * @returns Object with root, dir, base, ext, name properties
   */
  export function parse(resolved: ResolvedPath): {
    root: string;      // 'C:\' or '/'
    dir: string;       // Directory part
    base: string;      // Filename with extension
    ext: string;       // Extension (with dot)
    name: string;      // Filename without extension
  } {
    return path.parse(resolved as string);
  }

  /**
   * Join resolved paths (maintains OS separators)
   *
   * @example
   * const base = ResolvedPath.make('C:\\Vortex');
   * ResolvedPath.join(base, 'mods', 'skyrim')
   * // => 'C:\\Vortex\\mods\\skyrim' (Windows)
   */
  export function join(base: ResolvedPath, ...segments: string[]): ResolvedPath {
    const joined = path.join(base as string, ...segments);
    return make(joined);
  }

  /**
   * Get parent directory
   *
   * @example
   * ResolvedPath.dirname(ResolvedPath.make('C:\\Vortex\\mods'))
   * // => 'C:\\Vortex'
   */
  export function dirname(resolved: ResolvedPath): ResolvedPath {
    return make(path.dirname(resolved as string));
  }

  /**
   * Get basename (filename)
   *
   * @example
   * ResolvedPath.basename(ResolvedPath.make('C:\\Vortex\\mods\\data.esp'))
   * // => 'data.esp'
   */
  export function basename(resolved: ResolvedPath, ext?: string): string {
    return path.basename(resolved as string, ext);
  }

  /**
   * Convert to string for use with Node.js APIs
   */
  export function toString(resolved: ResolvedPath): string {
    return resolved as string;
  }

  /**
   * Normalize path (resolve . and .. segments, deduplicate separators)
   */
  export function normalize(resolved: ResolvedPath): ResolvedPath {
    return make(path.normalize(resolved as string));
  }

  /**
   * Get relative path from one resolved path to another
   *
   * Returns a plain string because path.relative() can produce `../foo`
   * which violates the RelativePath contract (rejects `..` prefixes).
   *
   * @example
   * const from = ResolvedPath.make('C:\\Vortex\\mods');
   * const to = ResolvedPath.make('C:\\Vortex\\downloads');
   * ResolvedPath.relative(from, to)
   * // => '../downloads'
   */
  export function relative(from: ResolvedPath, to: ResolvedPath): string {
    return path.relative(from as string, to as string);
  }
}

// ============================================================================
// Extension: File extensions with leading dot
// ============================================================================

declare const EXTENSION_BRAND: unique symbol;

/**
 * Extension is a branded string type representing a file extension
 * - Always starts with a dot
 * - Normalized to lowercase
 * - Cannot contain path separators
 *
 * Examples: ".esp", ".dll", ".json"
 */
export type Extension = string & { readonly [EXTENSION_BRAND]: typeof EXTENSION_BRAND };

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Extension {
  /**
   * Create extension with validation
   *
   * @throws Error if extension is invalid
   */
  export function make(input: string): Extension {
    const result = ExtensionSchema.safeParse(input);
    if (!result.success) {
      const errors = result.error.issues?.map(e => e.message).join(', ') || result.error.message;
      throw new Error(`Invalid Extension: ${errors}`);
    }
    return result.data as Extension;
  }

  /**
   * Extract extension from a file path
   * Returns undefined if no extension found
   *
   * @example
   * Extension.fromPath('icon.png') // => '.png'
   * Extension.fromPath('noext') // => undefined
   */
  export function fromPath(filePath: string): Extension | undefined {
    const ext = path.extname(filePath);
    if (ext === '') {
      return undefined;
    }
    return make(ext);
  }

  /**
   * Check if a path has this extension
   *
   * @example
   * const png = Extension.make('.png');
   * Extension.matches(png, 'icon.png') // => true
   * Extension.matches(png, 'icon.jpg') // => false
   */
  export function matches(ext: Extension, filePath: string): boolean {
    const pathExt = fromPath(filePath);
    return pathExt === ext;
  }

  /**
   * Convert to string
   */
  export function toString(ext: Extension): string {
    return ext as string;
  }

  // Common extensions
  export const ESP = make('.esp');
  export const ESM = make('.esm');
  export const DLL = make('.dll');
  export const EXE = make('.exe');
  export const JSON = make('.json');
  export const ZIP = make('.zip');
  export const RAR = make('.rar');
  export const SEVENZIP = make('.7z');
}

// ============================================================================
// FNV-1a Hash Utility
// ============================================================================

/**
 * FNV-1a hash (unsigned 32-bit)
 *
 * Deterministic, fast hash for strings. Used by RelativePath.hash() and
 * FilePath.hashCode() to avoid duplicating the algorithm.
 */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ============================================================================
// Anchor: Named resolution starting points (interned Symbols)
// ============================================================================

const ANCHOR_PREFIX = 'anchor:';

declare const ANCHOR_BRAND: unique symbol;

/**
 * Anchor is a branded Symbol type representing a named resolution starting point
 * - Interned using Symbol.for() for equality across modules
 * - Examples: userData, temp, game, drive_c
 */
export type Anchor = symbol & { readonly [ANCHOR_BRAND]: typeof ANCHOR_BRAND };

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Anchor {
  /**
   * Create an anchor from a name
   * Uses Symbol.for() for interning (same name = same symbol)
   *
   * @example
   * const a1 = Anchor.make('userData');
   * const a2 = Anchor.make('userData');
   * a1 === a2 // => true (interned)
   */
  export function make(name: string): Anchor {
    return Symbol.for(`${ANCHOR_PREFIX}${name}`) as Anchor;
  }

  /**
   * Extract the name from an anchor
   *
   * @example
   * const anchor = Anchor.make('userData');
   * Anchor.name(anchor) // => 'userData'
   */
  export function name(anchor: Anchor): string {
    const description = Symbol.keyFor(anchor as symbol);
    if (!description || !description.startsWith(ANCHOR_PREFIX)) {
      throw new Error('Invalid anchor symbol');
    }
    return description.substring(ANCHOR_PREFIX.length);
  }

  /**
   * Convert to string for debugging
   */
  export function toString(anchor: Anchor): string {
    return `Anchor[${name(anchor)}]`;
  }

  /**
   * Check if a symbol is a valid anchor
   */
  export function isAnchor(value: unknown): value is Anchor {
    if (typeof value !== 'symbol') {
      return false;
    }
    const description = Symbol.keyFor(value);
    return description !== undefined && description.startsWith(ANCHOR_PREFIX);
  }
}
