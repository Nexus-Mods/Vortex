/**
 * WindowsResolver - Provides anchors for all Windows drive letters (a-z)
 *
 * Resolver that maps drive letter anchors to Windows paths.
 * - Lowercase anchor names ('a', 'b', 'c', ..., 'z')
 * - Resolves to uppercase drive paths ('A:\', 'B:\', 'C:\', ..., 'Z:\')
 * - The filesystem implementation determines if the path is valid
 *
 * @example
 * ```typescript
 * const resolver = new WindowsResolver();
 *
 * resolver.PathFor('c');              // Resolves to C:\
 * resolver.PathFor('d', 'Games');     // Resolves to D:\Games
 * resolver.PathFor('root');           // ✗ TypeScript error!
 * ```
 */

import type { IFilesystem } from "../IFilesystem";
import type { IResolverBase } from "../IResolver";
import type { RelativePath, ResolvedPath } from "../types";

import { win32 } from "../pathUtils";
import {
  RelativePath as RelativePathNS,
  ResolvedPath as ResolvedPathNS,
} from "../types";
import {
  MappingResolver,
  fromFunction,
  type MappingStrategy,
} from "./MappingResolver";

/**
 * All valid Windows drive letters (lowercase)
 */
export type WindowsDrive =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z";

/**
 * Array of all valid drive letters for iteration
 */
const DRIVE_LETTERS: readonly WindowsDrive[] = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
];

/**
 * Windows resolver for drive letters
 *
 * Provides 26 anchors (a-z) that resolve to Windows drive paths (A:\ - Z:\).
 * The filesystem implementation determines if these paths are valid on the current platform.
 *
 * @template ValidAnchors - WindowsDrive type (26 lowercase drive letters)
 */
export class WindowsResolver extends MappingResolver<WindowsDrive> {
  constructor(parent?: IResolverBase, filesystem?: IFilesystem) {
    super("windows", parent, filesystem);
  }

  // ========================================================================
  // Mapping Strategy
  // ========================================================================

  protected getStrategy(): MappingStrategy<WindowsDrive> {
    return fromFunction(DRIVE_LETTERS, (letter) => {
      // Convert to uppercase and create drive path (e.g., 'c' -> 'C:\')
      const drivePath = `${letter.toUpperCase()}:\\`;
      return ResolvedPathNS.make(drivePath);
    });
  }

  // ========================================================================
  // Path Joining (Windows-specific)
  // ========================================================================

  /**
   * Override to use Windows path joining semantics
   * This ensures correct path joining even on non-Windows platforms
   */
  protected joinPaths(
    base: ResolvedPath,
    relative: RelativePath,
  ): ResolvedPath {
    if (relative === RelativePathNS.EMPTY) {
      return base;
    }
    // Use Windows path joining explicitly
    const joined = win32.join(base as string, relative as string);
    return ResolvedPathNS.make(joined);
  }

  // ========================================================================
  // OS Path Conversion (Terminal Resolver)
  // ========================================================================

  protected toOSPath(intermediatePath: ResolvedPath): ResolvedPath {
    return intermediatePath; // Windows paths are already valid OS paths
  }

  // ========================================================================
  // Type-Safe PathFor (inherited from BaseResolver)
  // ========================================================================

  /**
   * Usage examples:
   *
   * ```typescript
   * const resolver = new WindowsResolver();
   *
   * // Type-safe drive letters
   * const cDrive = resolver.PathFor('c');               // ✓ Resolves to C:\
   * const dGames = resolver.PathFor('d', 'Games');      // ✓ Resolves to D:\Games
   * const eSteam = resolver.PathFor('e', 'Steam/apps'); // ✓ Resolves to E:\Steam\apps
   *
   * // TypeScript errors for invalid anchors
   * resolver.PathFor('root');       // ✗ Not a WindowsDrive
   * resolver.PathFor('userData');   // ✗ Not a WindowsDrive
   * resolver.PathFor('C');          // ✗ Must be lowercase
   * ```
   */
}
