import type {
  SteamAppId,
  EpicCatalogNamespace,
  EpicCatalogItemId,
  GOGGameId,
  XboxPackageFamilyName,
  NexusModsDomain,
  RegistryKey,
} from "../types/store-ids.js";

import {
  steamAppId,
  epicCatalogNamespace,
  gogGameId,
  xboxPackageFamilyName,
  nexusModsDomain,
  registryKey,
} from "../types/store-ids.js";

/**
 * A Steam store entry identifying a game by its app ID.
 */
export interface SteamEntry {
  appId: SteamAppId;
  name?: string;
}

/**
 * An Epic Games Store entry identifying a game by catalog namespace.
 */
export interface EpicEntry {
  catalogNamespace: EpicCatalogNamespace;
  catalogItemId?: EpicCatalogItemId;
  name?: string;
}

/**
 * A GOG store entry identifying a game by its numeric ID.
 */
export interface GOGEntry {
  gameId: GOGGameId;
  name?: string;
}

/**
 * An Xbox store entry identifying a game by its package family name.
 */
export interface XboxEntry {
  packageFamilyName: XboxPackageFamilyName;
  name?: string;
}

/**
 * A Nexus Mods entry identifying a game by its domain slug.
 */
export interface NexusModsEntry {
  domain: NexusModsDomain;
  name?: string;
}

/**
 * Complete game metadata returned by an adaptor's game info service.
 */
export interface GameInfo {
  /** Internal game URI, e.g. "game:skyrimspecialedition". */
  gameUri: string;

  /** Human-readable display name for the game. */
  displayName: string;

  /** Steam store entries for this game. */
  steam?: SteamEntry[];

  /** Epic Games Store entries for this game. */
  epic?: EpicEntry[];

  /** GOG store entries for this game. */
  gog?: GOGEntry[];

  /** Xbox store entries for this game. */
  xbox?: XboxEntry[];

  /** Nexus Mods entries for this game. */
  nexusMods?: NexusModsEntry[];

  /** Windows registry keys for game discovery. */
  registryKeys?: RegistryKey[];
}

// --- Shorthand input types ---

/** Scalar or array, for permissive input. */
type OneOrMany<T> = T | T[];

/** Steam: pass a number (app ID) or a full SteamEntry. */
type SteamInput = number | SteamEntry;

/** Epic: pass a hex string (catalog namespace) or a full EpicEntry. */
type EpicInput = string | EpicEntry;

/** GOG: pass a number (game ID) or a full GOGEntry. */
type GOGInput = number | GOGEntry;

/** Xbox: pass a string (package family name) or a full XboxEntry. */
type XboxInput = string | XboxEntry;

/** Nexus Mods: pass a string (domain slug) or a full NexusModsEntry. */
type NexusModsInput = string | NexusModsEntry;

/** Registry: pass a string (key path) or a branded RegistryKey. */
type RegistryInput = string | RegistryKey;

/**
 * Permissive input type for {@link gameInfo}. Each store field accepts
 * a scalar shorthand (just the ID) or a full entry object, as a single
 * value or an array.
 */
export interface GameInfoInput {
  gameUri: string;
  displayName: string;
  steam?: OneOrMany<SteamInput>;
  epic?: OneOrMany<EpicInput>;
  gog?: OneOrMany<GOGInput>;
  xbox?: OneOrMany<XboxInput>;
  nexusMods?: OneOrMany<NexusModsInput>;
  registryKeys?: OneOrMany<RegistryInput>;
}

// --- Normalization helpers ---

function toArray<T>(value: OneOrMany<T> | undefined): T[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

function normSteam(input: SteamInput): SteamEntry {
  return typeof input === "number" ? { appId: steamAppId(input) } : input;
}

function normEpic(input: EpicInput): EpicEntry {
  return typeof input === "string"
    ? { catalogNamespace: epicCatalogNamespace(input) }
    : input;
}

function normGOG(input: GOGInput): GOGEntry {
  return typeof input === "number" ? { gameId: gogGameId(input) } : input;
}

function normXbox(input: XboxInput): XboxEntry {
  return typeof input === "string"
    ? { packageFamilyName: xboxPackageFamilyName(input) }
    : input;
}

function normNexus(input: NexusModsInput): NexusModsEntry {
  return typeof input === "string" ? { domain: nexusModsDomain(input) } : input;
}

function normRegistry(input: RegistryInput): RegistryKey {
  return typeof input === "string" ? registryKey(input) : input;
}

/**
 * Builds a validated {@link GameInfo} from permissive shorthand input.
 *
 * @example
 * ```ts
 * gameInfo({
 *   gameUri: "game:cyberpunk2077",
 *   displayName: "Cyberpunk 2077",
 *   steam: 1091500,
 *   epic: "77f2b98e2cef40c8a7437518bf420e47",
 *   gog: 1423049311,
 *   nexusMods: "cyberpunk2077",
 * })
 * ```
 */
export function gameInfo(input: GameInfoInput): GameInfo {
  return {
    gameUri: input.gameUri,
    displayName: input.displayName,
    steam: toArray(input.steam)?.map(normSteam),
    epic: toArray(input.epic)?.map(normEpic),
    gog: toArray(input.gog)?.map(normGOG),
    xbox: toArray(input.xbox)?.map(normXbox),
    nexusMods: toArray(input.nexusMods)?.map(normNexus),
    registryKeys: toArray(input.registryKeys)?.map(normRegistry),
  };
}

/**
 * Adaptor-provided service for querying game metadata and store identifiers.
 * Each game adaptor `@provides` this at its own URI.
 */
export interface IGameInfoService {
  getGameInfo(): Promise<GameInfo>;
}
