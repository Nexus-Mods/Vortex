import { types } from "vortex-api";
import { HashMapper } from "../hashMapper";
export type HashFunc = (files: string[]) => Promise<string>;
export type GameVersionProviderFunc = (
  hashMapper: HashMapper,
  game: types.IGame,
  discovery: types.IDiscoveryResult,
) => Promise<string>;
export type GameVersionProviderTest = (
  game: types.IGame,
  discovery: types.IDiscoveryResult,
) => Promise<boolean>;

// This is the expected structure within a game registration's
//  details object.
export interface IHashingDetails {
  // The files meant to be used in the hashing process
  hashFiles?: string[];

  // WARNING - specifying a hash directory path
  //  will cause this extension to create a 7z archive
  //  using all the files found inside the directory and generate a hash
  //  based on the resulting archive.
  // NOTE: this operation will NOT recurse through directories.
  hashDirPath?: string;
}

export interface IHashEntry {
  // Files used generating this hash.
  files: string[];

  // The hash result.
  hashValue: string;

  // The recongnized version for this hash entry.
  userFacingVersion: string;

  // It's possible for a certain game to have multiple
  //  variants with the same user facing version.
  // e.g. Skyrim's Xbox variant which could potentially generate
  //  a different hash from all game other variants.
  variant: string;
}

export interface IHashMap {
  [gameId: string]: { [hash: string]: IHashEntry };
}
