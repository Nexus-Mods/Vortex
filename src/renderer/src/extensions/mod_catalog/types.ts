import type { GameDomain } from "@vortex/shared";

/** How the catalog orders mods. */
export type CatalogSort = "popular" | "newest" | "updated" | "endorsed";

/** One page request against the Nexus Mods `mods` GraphQL query. */
export interface ICatalogSearch {
  gameDomain: GameDomain;
  /** Name search; ignored when shorter than MIN_SEARCH_LENGTH. */
  search: string;
  /** Nexus category name, or undefined for all categories. */
  category?: string;
  sort: CatalogSort;
  /** Adult (18+) mods are left out unless this is set. */
  showAdult: boolean;
  offset: number;
  count: number;
}

/** A mod as the catalog shows it, independent of the API's field names. */
export interface ICatalogMod {
  modId: number;
  /** Nexus' global mod id, used to look up requirements. */
  uid?: string;
  name: string;
  summary: string;
  author: string;
  uploaderName?: string;
  uploaderAvatar?: string;
  version: string;
  pictureUrl?: string;
  thumbnailUrl?: string;
  downloads: number;
  endorsements: number;
  createdAt?: string;
  updatedAt?: string;
  category?: string;
  adultContent: boolean;
  status?: string;
}

export interface ICatalogPage {
  mods: ICatalogMod[];
  totalCount: number;
}

/** Whether, and how, a catalog mod is installed for the active game. */
export type InstallState = "not-installed" | "installed" | "update-available";
