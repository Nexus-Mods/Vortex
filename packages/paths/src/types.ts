/**
 * Core branded types for the Vortex path system
 *
 * This module provides zero-cost TypeScript branded types with runtime Zod validation:
 * - RelativePath: Forward-slash separated, sanitized relative paths
 * - ResolvedPath: Absolute, OS-specific paths (output of resolution)
 * - Extension: File extensions with leading dot
 * - Anchor: Named resolution starting points (interned Symbols)
 */

import { z } from "zod";

import { posix, win32, detectPathModule } from "./pathUtils";

// ============================================================================
// Zod Schemas for Runtime Validation
// ============================================================================

/**
 * Zod schema for RelativePath validation
 * - Normalizes separators to forward slashes
 * - Removes leading/trailing slashes
 * - Collapses multiple slashes
 * - Rejects parent directory references (..)
 * - Rejects drive letters
 */
export const RelativePathSchema = z
  .string()
  .transform((s) => s.replaceAll("\\", "/")) // Normalize to forward slashes
  .transform((s) => s.replace(/^\/+/, "")) // Remove leading slashes
  .transform((s) => s.replace(/\/+$/, "")) // Remove trailing slashes
  .transform((s) => s.replace(/\/+/g, "/")) // Collapse multiple slashes
  .refine((s) => s.split("/").every((segment) => segment !== ".."), {
    message: "Relative paths cannot contain .. segments",
  })
  .refine((s) => !/^[a-zA-Z]:/.test(s), {
    message: "Relative paths cannot contain drive letters",
  });

/**
 * Zod schema for ResolvedPath validation
 * - Must be an absolute path (Unix or Windows format)
 * - Accepts both Unix-style (/...) and Windows-style (C:\...) absolute paths
 */
export const ResolvedPathSchema = z.string().refine(
  (s) => {
    // Accept Unix absolute paths: start with /
    if (s.startsWith("/")) {
      return true;
    }
    // Accept Windows absolute paths: drive letter followed by :\
    if (/^[a-zA-Z]:\\/.test(s)) {
      return true;
    }
    // Check both platform modules
    return posix.isAbsolute(s) || win32.isAbsolute(s);
  },
  {
    message:
      "Resolved paths must be absolute (Unix: /path or Windows: C:\\path)",
  },
);

/**
 * Zod schema for Extension validation
 * - Must start with a dot
 * - Cannot contain path separators
 * - Normalized to lowercase
 */
export const ExtensionSchema = z
  .string()
  .refine((s) => s.startsWith("."), {
    message: "Extensions must start with .",
  })
  // Note(sewer): Technically \ is valid inside an extension on Unix,
  // but we'll disallow it for consistency. No sane game or mod file
  // is expected to have one, realistically speaking.
  .refine((s) => !s.includes("/") && !s.includes("\\"), {
    message: "Extensions cannot contain path separators",
  })
  .transform((s) => s.toLowerCase());

/**
 * Zod schema for FileName validation
 * - Cannot contain path separators (/ or \)
 * - Cannot be empty
 * - Preserves original case (no transform)
 */
export const FileNameSchema = z
  .string()
  .refine((s) => s.length > 0, {
    message: "FileName cannot be empty",
  })
  .refine((s) => !s.includes("/") && !s.includes("\\"), {
    message: "FileName cannot contain path separators",
  });

function throwInvalidType(error: z.ZodError, typeName: string): never {
  const errors = error.issues?.map((issue) => issue.message).join(", ");
  throw new Error(`Invalid ${typeName}: ${errors || error.message}`);
}

function normalizeFileName(fileName: FileName | string): FileName | null {
  return FileName.is(fileName) ? FileName.unsafe(fileName) : null;
}

// ============================================================================
// RelativePath: Sanitized relative paths (input to resolvers)
// ============================================================================

declare const RELATIVE_PATH_BRAND: unique symbol;

/**
 * RelativePath is a branded string type representing a sanitized relative path
 * - Always uses forward slashes
 * - Leading and trailing slashes are stripped during normalization
 * - No parent directory references (..)
 * - No drive letters
 *
 * Examples: "mods/skyrim/data", "downloads", "temp/cache"
 */
export type RelativePath = string & {
  readonly [RELATIVE_PATH_BRAND]: typeof RELATIVE_PATH_BRAND;
};

// Namespace provides static factory methods (e.g. .make(), .join()) as a companion
// to the branded type, which is the idiomatic TS pattern for attaching utilities to a type.
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
      throwInvalidType(result.error, "RelativePath");
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
  export const EMPTY: RelativePath = "" as RelativePath;

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
  export function join(
    base: RelativePath,
    ...segments: string[]
  ): RelativePath {
    const combined = [base as string, ...segments]
      .filter((s) => s.length > 0)
      .join("/");
    return combined === "" ? EMPTY : make(combined);
  }

  /**
   * Get the directory part of a relative path
   *
   * @example
   * RelativePath.dirname(RelativePath.make('mods/skyrim/data.esp'))
   * // => 'mods/skyrim'
   */
  export function dirname(relative: RelativePath): RelativePath {
    const dir = posix.dirname(relative as string);
    if (dir === "." || dir === "") {
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
    return posix.basename(relative as string, ext);
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
    if (relative === "" || relative === EMPTY) return 0;
    return (relative as string).split("/").length;
  }

  /**
   * Strict containment check (not equal). Everything is "in" EMPTY.
   */
  export function isIn(child: RelativePath, parent: RelativePath): boolean {
    if (parent === EMPTY || parent === "") {
      return child !== EMPTY && child !== "";
    }
    return (child as string).startsWith((parent as string) + "/");
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

  /**
   * Case-insensitive equality check (OrdinalIgnoreCase)
   * Uses toLowerCase() for comparison, not locale-aware
   *
   * @example
   * RelativePath.equalsIgnoreCase(
   *   RelativePath.make('Mods/Skyrim'),
   *   RelativePath.make('mods/skyrim')
   * ) // => true
   *
   * @remarks
   * Fails with German sharp-s (ß). See README for details.
   */
  export function equalsIgnoreCase(a: RelativePath, b: RelativePath): boolean {
    return (a as string).toLowerCase() === (b as string).toLowerCase();
  }

  /**
   * Case-insensitive locale-aware comparison for sorting
   * Compares lowercase versions of the paths
   *
   * @example
   * RelativePath.compareIgnoreCase(
   *   RelativePath.make('mods/skyrim'),
   *   RelativePath.make('Mods/Oblivion')
   * ) // => negative (skyrim < Oblivion case-insensitively)
   *
   * @remarks
   * Fails with German sharp-s (ß). See README for details.
   */
  export function compareIgnoreCase(a: RelativePath, b: RelativePath): number {
    return (a as string)
      .toLowerCase()
      .localeCompare((b as string).toLowerCase());
  }

  /**
   * Case-insensitive FNV-1a hash (unsigned 32-bit)
   * Normalizes to lowercase before hashing for case-insensitive lookups
   *
   * @example
   * RelativePath.hashIgnoreCase(RelativePath.make('Mods/Skyrim')) ===
   * RelativePath.hashIgnoreCase(RelativePath.make('mods/skyrim'))
   * // => true
   *
   * @remarks
   * Fails with German sharp-s (ß). See README for details.
   */
  export function hashIgnoreCase(relative: RelativePath): number {
    return fnv1a((relative as string).toLowerCase());
  }

  /**
   * Case-insensitive containment check (not equal). Everything is "in" EMPTY.
   * Returns false if child equals parent (case-insensitive).
   *
   * @example
   * RelativePath.isInIgnoreCase(
   *   RelativePath.make('Mods/Skyrim/Data'),
   *   RelativePath.make('mods/skyrim')
   * ) // => true
   *
   * RelativePath.isInIgnoreCase(
   *   RelativePath.make('Mods/Skyrim'),
   *   RelativePath.make('mods/skyrim')
   * ) // => false (equal paths)
   *
   * @remarks
   * Uses lowercase normalization. Fails with German sharp-s (ß). See README.
   */
  export function isInIgnoreCase(
    child: RelativePath,
    parent: RelativePath,
  ): boolean {
    if (equalsIgnoreCase(child, parent)) return false;
    const childSegs = segmentsIgnoreCase(child);
    const parentSegs = segmentsIgnoreCase(parent);
    if (parentSegs.length === 0) return childSegs.length > 0;
    if (childSegs.length <= parentSegs.length) return false;
    return parentSegs.every((seg, i) => seg === childSegs[i]);
  }

  /**
   * Check if the basename of a relative path equals a filename (case-sensitive)
   * Accepts either a FileName branded type or a plain string
   *
   * @example
   * RelativePath.basenameEquals(
   *   RelativePath.make('mods/skyrim/Data.ESP'),
   *   'Data.ESP'
   * ) // => true
   *
   * RelativePath.basenameEquals(
   *   RelativePath.make('mods/skyrim/Data.ESP'),
   *   'data.esp'
   * ) // => false
   *
   * RelativePath.basenameEquals(
   *   RelativePath.make('mods/skyrim/Data.ESP'),
   *   FileName.make('Data.ESP')
   * ) // => true
   */
  export function basenameEquals(
    relative: RelativePath,
    fileName: FileName | string,
  ): boolean {
    if (relative === EMPTY) {
      return false;
    }
    const base = basename(relative);
    const target = normalizeFileName(fileName);
    if (target === null) {
      return false;
    }
    return FileName.equals(FileName.unsafe(base), target);
  }

  /**
   * Check if the basename of a relative path equals a filename (case-insensitive)
   * Accepts either a FileName branded type or a plain string
   *
   * @example
   * RelativePath.basenameEqualsIgnoreCase(
   *   RelativePath.make('mods/skyrim/Data.ESP'),
   *   'data.esp'
   * ) // => true
   *
   * RelativePath.basenameEqualsIgnoreCase(
   *   RelativePath.make('mods/skyrim/Data.ESP'),
   *   FileName.make('data.esp')
   * ) // => true
   *
   * @remarks
   * Uses lowercase normalization. Fails with German sharp-s (ß). See README.
   */
  export function basenameEqualsIgnoreCase(
    relative: RelativePath,
    fileName: FileName | string,
  ): boolean {
    if (relative === EMPTY) {
      return false;
    }
    const base = basename(relative);
    const target = normalizeFileName(fileName);
    if (target === null) {
      return false;
    }
    return FileName.equalsIgnoreCase(FileName.unsafe(base), target);
  }

  /**
   * Return lowercase-normalized path segments for case-insensitive comparison
   * Returns empty array for EMPTY path
   *
   * @example
   * RelativePath.segmentsIgnoreCase(RelativePath.make('Mods/Skyrim/Data'))
   * // => ['mods', 'skyrim', 'data']
   *
   * RelativePath.segmentsIgnoreCase(RelativePath.EMPTY)
   * // => []
   *
   * @remarks
   * Fails with German sharp-s (ß). See README for details.
   */
  export function segmentsIgnoreCase(relative: RelativePath): string[] {
    if (relative === EMPTY) return [];
    return (relative as string).toLowerCase().split("/");
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
export type ResolvedPath = string & {
  readonly [RESOLVED_PATH_BRAND]: typeof RESOLVED_PATH_BRAND;
};

// Namespace provides static factory methods (e.g. .make(), .join()) as a companion
// to the branded type, which is the idiomatic TS pattern for attaching utilities to a type.
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
      throwInvalidType(result.error, "ResolvedPath");
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
    root: string; // 'C:\' or '/'
    dir: string; // Directory part
    base: string; // Filename with extension
    ext: string; // Extension (with dot)
    name: string; // Filename without extension
  } {
    const pathMod = detectPathModule(resolved as string);
    return pathMod.parse(resolved as string);
  }

  /**
   * Join resolved paths (maintains OS separators)
   *
   * @example
   * const base = ResolvedPath.make('C:\\Vortex');
   * ResolvedPath.join(base, 'mods', 'skyrim')
   * // => 'C:\\Vortex\\mods\\skyrim' (Windows)
   */
  export function join(
    base: ResolvedPath,
    ...segments: string[]
  ): ResolvedPath {
    const pathMod = detectPathModule(base as string);
    const joined = pathMod.join(base as string, ...segments);
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
    const pathMod = detectPathModule(resolved as string);
    return make(pathMod.dirname(resolved as string));
  }

  /**
   * Get basename (filename)
   *
   * @example
   * ResolvedPath.basename(ResolvedPath.make('C:\\Vortex\\mods\\data.esp'))
   * // => 'data.esp'
   */
  export function basename(resolved: ResolvedPath, ext?: string): string {
    const pathMod = detectPathModule(resolved as string);
    return pathMod.basename(resolved as string, ext);
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
    const pathMod = detectPathModule(resolved as string);
    return make(pathMod.normalize(resolved as string));
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
    const fromStr = from as string;
    const pathMod = detectPathModule(fromStr);
    return pathMod.relative(fromStr, to as string);
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
export type Extension = string & {
  readonly [EXTENSION_BRAND]: typeof EXTENSION_BRAND;
};

// Namespace provides static factory methods (e.g. .make(), .fromPath()) as a companion
// to the branded type, which is the idiomatic TS pattern for attaching utilities to a type.
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
      throwInvalidType(result.error, "Extension");
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
    const pathMod = detectPathModule(filePath);
    const ext = pathMod.extname(filePath);
    if (ext === "") {
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
  export const ESP = make(".esp");
  export const ESM = make(".esm");
  export const DLL = make(".dll");
  export const EXE = make(".exe");
  export const JSON = make(".json");
  export const ZIP = make(".zip");
  export const RAR = make(".rar");
  export const SEVENZIP = make(".7z");
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

const ANCHOR_PREFIX = "anchor:";

declare const ANCHOR_BRAND: unique symbol;

/**
 * Anchor is a branded Symbol type representing a named resolution starting point
 * - Interned using Symbol.for() for equality across modules
 * - Examples: userData, temp, game, drive_c
 */
export type Anchor = symbol & { readonly [ANCHOR_BRAND]: typeof ANCHOR_BRAND };

// Namespace provides static factory methods (e.g. .make(), .name()) as a companion
// to the branded type, which is the idiomatic TS pattern for attaching utilities to a type.
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
      throw new Error("Invalid anchor symbol");
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
    if (typeof value !== "symbol") {
      return false;
    }
    const description = Symbol.keyFor(value);
    return description !== undefined && description.startsWith(ANCHOR_PREFIX);
  }
}

// ============================================================================
// FileName: Filename only (basename, no path separators)
// ============================================================================

declare const FILE_NAME_BRAND: unique symbol;

/**
 * FileName is a branded string type representing a filename (basename only)
 * - No path separators (/ or \)
 * - Case-sensitive comparison by default (Ordinal)
 * - Use equalsIgnoreCase() / hashIgnoreCase() for case-insensitive operations
 * - Preserves original case in the branded value
 *
 * Examples: "data.esp", "config.json", "README.md"
 *
 * @remarks
 * Case-insensitive operations use toLowerCase() normalization.
 * Fails with German sharp-s (ß). See README for details.
 */
export type FileName = string & {
  readonly [FILE_NAME_BRAND]: typeof FILE_NAME_BRAND;
};

// Namespace provides static factory methods (e.g. .make(), .equals()) as a companion
// to the branded type, which is the idiomatic TS pattern for attaching utilities to a type.
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace FileName {
  /**
   * Smart constructor with Zod validation
   * Validates that the input contains no path separators
   *
   * @throws Error if validation fails
   */
  export function make(input: string): FileName {
    const result = FileNameSchema.safeParse(input);
    if (!result.success) {
      throwInvalidType(result.error, "FileName");
    }
    return result.data as FileName;
  }


  /**
   * Skip validation (use only when input is already validated)
   * Use with caution - no safety checks performed
   */
  export function unsafe(input: string): FileName {
    return input as FileName;
  }

  /**
   * Check if a value is a valid FileName string (no path separators)
   */
  export function is(value: string): boolean {
    return FileNameSchema.safeParse(value).success;
  }

  /**
   * Extract filename from a RelativePath
   *
   * @example
   * FileName.fromRelativePath(RelativePath.make('mods/skyrim/data.esp'))
   * // => FileName.make('data.esp')
   */
  export function fromRelativePath(relative: RelativePath): FileName {
    if (relative === "" || relative === RelativePath.EMPTY) {
      throw new Error("Cannot extract FileName from empty RelativePath");
    }
    const base = posix.basename(relative as string);
    return unsafe(base);
  }

  /**
   * Extract filename from a ResolvedPath
   *
   * @example
   * FileName.fromResolvedPath(ResolvedPath.make('C:\\Vortex\\mods\\data.esp'))
   * // => FileName.make('data.esp')
   */
  export function fromResolvedPath(resolved: ResolvedPath): FileName {
    const pathMod = detectPathModule(resolved as string);
    const base = pathMod.basename(resolved as string);
    if (base === "") {
      throw new Error(
        `fromResolvedPath: cannot convert root-only path to FileName: ${resolved}`,
      );
    }
    return unsafe(base);
  }

  /**
   * Case-sensitive equality check (Ordinal)
   * Uses strict equality (===)
   *
   * @example
   * FileName.equals(FileName.make('Data.ESP'), FileName.make('Data.ESP')) // => true
   * FileName.equals(FileName.make('Data.ESP'), FileName.make('data.esp')) // => false
   */
  export function equals(a: FileName, b: FileName): boolean {
    return a === b;
  }

  /**
   * Case-insensitive equality check (OrdinalIgnoreCase)
   * Uses toLowerCase() for comparison, not locale-aware
   *
   * @example
   * FileName.equalsIgnoreCase(FileName.make('Data.ESP'), FileName.make('data.esp')) // => true
   *
   * @remarks
   * Fails with German sharp-s (ß). See README for details.
   */
  export function equalsIgnoreCase(a: FileName, b: FileName): boolean {
    return (a as string).toLowerCase() === (b as string).toLowerCase();
  }

  /**
   * Case-sensitive hash (Ordinal)
   * FNV-1a hashing without normalization
   *
   * @example
   * FileName.hash(FileName.make('Data.ESP')) // hash of "Data.ESP"
   */
  export function hash(fileName: FileName): number {
    return fnv1a(fileName as string);
  }

  /**
   * Case-insensitive hash (OrdinalIgnoreCase)
   * Normalizes to lowercase before FNV-1a hashing
   *
   * @example
   * FileName.hashIgnoreCase(FileName.make('Data.ESP')) === FileName.hashIgnoreCase(FileName.make('data.esp'))
   * // => true
   *
   * @remarks
   * Fails with German sharp-s (ß). See README for details.
   */
  export function hashIgnoreCase(fileName: FileName): number {
    return fnv1a((fileName as string).toLowerCase());
  }

  /**
   * Extract extension from filename
   * Returns lowercase Extension type, or undefined if no extension
   *
   * Edge case: files starting with dot (e.g., ".gitignore") have no extension
   *
   * @example
   * FileName.extension(FileName.make('data.esp')) // => Extension.make('.esp')
   * FileName.extension(FileName.make('.gitignore')) // => undefined
   */
  export function extension(fileName: FileName): Extension | undefined {
    const name = fileName as string;
    const lastDotIndex = name.lastIndexOf(".");
    // No dot, or starts with dot (hidden file) = no extension
    if (lastDotIndex <= 0) {
      return undefined;
    }
    const ext = name.slice(lastDotIndex);
    return Extension.make(ext);
  }

  /**
   * Get stem (filename without extension)
   * Preserves original case
   *
   * Edge case: files starting with dot return full name as stem
   *
   * @example
   * FileName.stem(FileName.make('data.esp')) // => 'data'
   * FileName.stem(FileName.make('.gitignore')) // => '.gitignore'
   */
  export function stem(fileName: FileName): string {
    const name = fileName as string;
    const lastDotIndex = name.lastIndexOf(".");
    // No dot, or starts with dot = full name is stem
    if (lastDotIndex <= 0) {
      return name;
    }
    return name.slice(0, lastDotIndex);
  }

  /**
   * Convert to string for debugging
   */
  export function toString(fileName: FileName): string {
    return fileName as string;
  }
}
