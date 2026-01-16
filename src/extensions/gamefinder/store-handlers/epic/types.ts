/**
 * Epic Games Store-specific types and data structures
 */

import type { Game } from "../../common";

/**
 * Epic Games catalog item ID
 */
export type EGSGameId = string;

/**
 * Raw manifest file structure from .item files
 */
export interface EGSManifestFile {
  CatalogItemId: string;
  DisplayName: string;
  InstallLocation: string;
  ManifestHash: string;
  MainGameCatalogItemId: string;
}

/**
 * Represents a game found via Epic Games Store
 */
export interface EGSGame extends Game {
  store: "epic";

  /**
   * Catalog item ID (unique identifier)
   */
  catalogItemId: EGSGameId;

  /**
   * Manifest hashes (includes DLC manifests)
   */
  manifestHashes: string[];
}

/**
 * Creates an EGSGame from its components
 */
export function createEGSGame(
  catalogItemId: EGSGameId,
  displayName: string,
  installLocation: string,
  manifestHashes: string[],
): EGSGame {
  return {
    id: catalogItemId,
    name: displayName,
    path: installLocation,
    store: "epic",
    catalogItemId,
    manifestHashes,
  };
}
