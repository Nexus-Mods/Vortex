/**
 * ProtonResolver - Translates Windows paths to Wine/Proton equivalents on Linux
 *
 * This resolver is Linux-only and provides access to Proton's Wine prefix directories.
 */

// eslint-disable-next-line vortex/no-module-imports
import * as path from 'path';

import type { FilePath } from '../FilePath';
import type { Anchor } from '../types';

// eslint-disable-next-line vortex/no-cross-imports -- ProtonResolver requires getProtonInfo from renderer
import { getProtonInfo, type IProtonInfo } from '../../../renderer/util/linux/proton';
import { ResolvedPath as ResolvedPathNS } from '../types';
import { MappingResolver, fromFunction, type MappingStrategy } from './MappingResolver';

/**
 * Define Proton-specific anchors
 */
export type ProtonAnchor =
  | 'drive_c'          // C:\ root in Wine prefix
  | 'documents'        // My Documents
  | 'appData'          // Application Data
  | 'localAppData'     // Local Settings/Application Data
  | 'home'             // User profile directory
  | 'programFiles'     // Program Files
  | 'programFilesX86'; // Program Files (x86)

/**
 * Array of all Proton anchors for iteration
 */
const PROTON_ANCHORS: readonly ProtonAnchor[] = [
  'drive_c',
  'documents',
  'appData',
  'localAppData',
  'home',
  'programFiles',
  'programFilesX86',
] as const;

/**
 * Translates Windows paths to Wine/Proton equivalents on Linux
 * Only works on Linux platform
 *
 * @example
 * ```typescript
 * const steamPath = vortexResolver.PathFor('home', '.steam/steam');
 * const protonResolver = new ProtonResolver(steamPath, '12345');
 *
 * protonResolver.PathFor('drive_c');          // ✓ Valid
 * protonResolver.PathFor('documents');        // ✓ Valid
 * protonResolver.PathFor('programFiles');     // ✓ Valid
 * protonResolver.PathFor('userData');         // ✗ TypeScript error!
 * protonResolver.PathFor('game');             // ✗ TypeScript error!
 * ```
 */
export class ProtonResolver extends MappingResolver<ProtonAnchor> {
  /**
   * Cached proton info to avoid repeated async calls
   */
  private protonInfoCache: Promise<IProtonInfo> | null = null;

  constructor(
    private readonly steamPath: FilePath,
    private readonly appId: string,
  ) {
    super('proton');
  }

  // ========================================================================
  // Platform-Specific Overrides
  // ========================================================================

  /**
   * Override canResolve to add platform check
   * ProtonResolver only works on Linux
   */
  canResolve(anchor: Anchor): boolean {
    if (process.platform !== 'linux') {
      return false;
    }
    return super.canResolve(anchor);
  }

  /**
   * Override supportedAnchors to add platform check
   * Returns empty array on non-Linux platforms
   */
  supportedAnchors(): Anchor[] {
    if (process.platform !== 'linux') {
      return [];
    }
    return super.supportedAnchors();
  }

  // ========================================================================
  // Mapping Strategy
  // ========================================================================

  protected getStrategy(): MappingStrategy<ProtonAnchor> {
    return fromFunction(PROTON_ANCHORS, async (name) => {
      const protonInfo = await this.getProtonInfo();

      if (!protonInfo.usesProton || !protonInfo.compatDataPath) {
        throw new Error(`Proton not configured for app ${this.appId}`);
      }

      const pfxPath = path.join(protonInfo.compatDataPath, 'pfx');
      let osPath: string;

      switch (name) {
        case 'drive_c':
          osPath = path.join(pfxPath, 'drive_c');
          break;

        case 'documents':
          osPath = path.join(pfxPath, 'drive_c/users/steamuser/My Documents');
          break;

        case 'appData':
          osPath = path.join(pfxPath, 'drive_c/users/steamuser/Application Data');
          break;

        case 'localAppData':
          osPath = path.join(pfxPath, 'drive_c/users/steamuser/Local Settings/Application Data');
          break;

        case 'home':
          osPath = path.join(pfxPath, 'drive_c/users/steamuser');
          break;

        case 'programFiles':
          osPath = path.join(pfxPath, 'drive_c/Program Files');
          break;

        case 'programFilesX86':
          osPath = path.join(pfxPath, 'drive_c/Program Files (x86)');
          break;

        default:
          // This should never happen due to exhaustive type checking
          throw new Error(`Unsupported Proton anchor: ${String(name)}`);
      }

      return ResolvedPathNS.make(osPath);
    });
  }

  // ========================================================================
  // Private Helpers
  // ========================================================================

  /**
   * Get Proton info with caching
   */
  private async getProtonInfo(): Promise<IProtonInfo> {
    if (this.protonInfoCache === null) {
      // Resolve steamPath to string
      const steamPathResolved = await this.steamPath.resolve();
      const steamPathStr = steamPathResolved as string;

      // steamAppsPath is typically steamPath/steamapps
      const steamAppsPath = path.join(path.dirname(steamPathStr), 'steamapps');
      this.protonInfoCache = getProtonInfo(
        steamPathStr,
        steamAppsPath,
        this.appId,
      );
    }
    return this.protonInfoCache;
  }

  /**
   * Clear cached Proton info (useful if configuration changes)
   */
  public clearCache(): void {
    this.protonInfoCache = null;
  }

  // ========================================================================
  // Type-Safe PathFor (inherited from BaseResolver)
  // ========================================================================

  /**
   * Usage examples (Linux only):
   *
   * ```typescript
   * // Create steam path using another resolver
   * const steamPath = vortexResolver.PathFor('home', '.steam/steam');
   * const protonResolver = new ProtonResolver(steamPath, '12345');
   *
   * // Type-safe anchor names
   * const driveC = protonResolver.PathFor('drive_c');              // ✓
   * const docs = protonResolver.PathFor('documents');              // ✓
   * const appData = protonResolver.PathFor('appData');             // ✓
   * const programFiles = protonResolver.PathFor('programFiles');   // ✓
   *
   * // TypeScript errors for invalid anchors
   * protonResolver.PathFor('userData');   // ✗ Not a ProtonAnchor
   * protonResolver.PathFor('game');       // ✗ Not a ProtonAnchor
   * ```
   */
}
