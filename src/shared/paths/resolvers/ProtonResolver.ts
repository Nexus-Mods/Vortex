/**
 * ProtonResolver - Translates Windows paths to Wine/Proton equivalents on Linux
 *
 * This resolver is Linux-only and provides access to Proton's Wine prefix directories.
 */

// eslint-disable-next-line vortex/no-module-imports
import * as path from 'path';

import type { FilePath } from '../FilePath';
import type { Anchor, ResolvedPath } from '../types';

// eslint-disable-next-line vortex/no-cross-imports -- ProtonResolver requires getProtonInfo from renderer
import { getProtonInfo, type IProtonInfo } from '../../../renderer/util/linux/proton';
import { Anchor as AnchorNS, ResolvedPath as ResolvedPathNS } from '../types';
import { BaseResolver } from './BaseResolver';

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
export class ProtonResolver extends BaseResolver<ProtonAnchor> {
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
  // Anchor Support
  // ========================================================================

  canResolve(anchor: Anchor): boolean {
    // Only works on Linux
    if (process.platform !== 'linux') {
      return false;
    }

    const name = AnchorNS.name(anchor);
    return [
      'drive_c',
      'documents',
      'appData',
      'localAppData',
      'home',
      'programFiles',
      'programFilesX86',
    ].includes(name);
  }

  supportedAnchors(): Anchor[] {
    // Only return anchors if on Linux
    if (process.platform !== 'linux') {
      return [];
    }

    return [
      'drive_c',
      'documents',
      'appData',
      'localAppData',
      'home',
      'programFiles',
      'programFilesX86',
    ].map(AnchorNS.make);
  }

  // ========================================================================
  // Resolution
  // ========================================================================

  protected async resolveAnchor(anchor: Anchor): Promise<ResolvedPath> {
    const protonInfo = await this.getProtonInfo();

    if (!protonInfo.usesProton || !protonInfo.compatDataPath) {
      throw new Error(`Proton not configured for app ${this.appId}`);
    }

    const pfxPath = path.join(protonInfo.compatDataPath, 'pfx');
    const name = AnchorNS.name(anchor) as ProtonAnchor;
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
