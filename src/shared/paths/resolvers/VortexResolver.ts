/**
 * VortexResolver - Maps Vortex-specific anchors to existing getVortexPath()
 *
 * Supports all standard Vortex application paths with type-safe anchor names.
 */

// eslint-disable-next-line vortex/no-cross-imports -- VortexResolver requires getVortexPath from renderer
import getVortexPath, { type AppPath } from '../../../renderer/util/getVortexPath';
import { ResolvedPath as ResolvedPathNS } from '../types';
import { MappingResolver, fromRecord, type MappingStrategy } from './MappingResolver';

/**
 * Define valid Vortex anchor names as a type
 * These correspond to the AppPath type from getVortexPath
 */
export type VortexAnchor =
  | 'userData'
  | 'temp'
  | 'documents'
  | 'appData'
  | 'localAppData'
  | 'home'
  | 'desktop'
  | 'base'
  | 'assets'
  | 'assets_unpacked'
  | 'modules'
  | 'modules_unpacked'
  | 'bundledPlugins'
  | 'locales'
  | 'package'
  | 'package_unpacked'
  | 'application'
  | 'exe';

/**
 * Maps Vortex-specific anchors to existing getVortexPath()
 * Generic parameter ensures PathFor only accepts valid VortexAnchor names
 *
 * @example
 * ```typescript
 * const resolver = new VortexResolver();
 *
 * resolver.PathFor('userData');       // ✓ Valid
 * resolver.PathFor('temp', 'cache');  // ✓ Valid
 * resolver.PathFor('documents');      // ✓ Valid
 * resolver.PathFor('drive_c');        // ✗ TypeScript error!
 * resolver.PathFor('game');           // ✗ TypeScript error!
 * ```
 */
export class VortexResolver extends MappingResolver<VortexAnchor> {
  /**
   * Mapping from anchor names to AppPath identifiers
   */
  private static readonly ANCHOR_TO_APP_PATH: Record<VortexAnchor, AppPath> = {
    userData: 'userData',
    temp: 'temp',
    documents: 'documents',
    appData: 'appData',
    localAppData: 'localAppData',
    home: 'home',
    desktop: 'desktop',
    base: 'base',
    assets: 'assets',
    assets_unpacked: 'assets_unpacked',
    modules: 'modules',
    modules_unpacked: 'modules_unpacked',
    bundledPlugins: 'bundledPlugins',
    locales: 'locales',
    package: 'package',
    package_unpacked: 'package_unpacked',
    application: 'application',
    exe: 'exe',
  };

  constructor(parent?: import('../IResolver').IResolver) {
    super('vortex', parent);
  }

  // ========================================================================
  // Mapping Strategy
  // ========================================================================

  protected getStrategy(): MappingStrategy<VortexAnchor> {
    return fromRecord(
      VortexResolver.ANCHOR_TO_APP_PATH,
      (appPath) => ResolvedPathNS.make(getVortexPath(appPath))
    );
  }

  // ========================================================================
  // Type-Safe PathFor (inherited from BaseResolver)
  // ========================================================================

  // The PathFor<A extends VortexAnchor> method is inherited from BaseResolver
  // TypeScript will automatically constrain A to the VortexAnchor type

  /**
   * Usage examples:
   *
   * ```typescript
   * const resolver = new VortexResolver();
   *
   * // Type-safe anchor names
   * const userData = resolver.PathFor('userData');           // ✓
   * const temp = resolver.PathFor('temp', 'cache');          // ✓
   * const docs = resolver.PathFor('documents');              // ✓
   *
   * // TypeScript errors for invalid anchors
   * resolver.PathFor('drive_c');     // ✗ Not a VortexAnchor
   * resolver.PathFor('game');        // ✗ Not a VortexAnchor
   * resolver.PathFor('gameMods');    // ✗ Not a VortexAnchor
   * ```
   */
}
