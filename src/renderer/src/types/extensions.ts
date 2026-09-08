import type { IExtensionContext, IReducerSpec } from "./IExtensionContext";
import type { IExtensionLoadFailure, IExtensionState } from "./IState";

/**
 * Common types for extensions - ideally this will live in renderer/types
 * given that at present, main doesn't need to know about extensions beyond
 * persisting their state.
 *
 * But lets keep it here for now to avoid dependency chaos.
 */

export interface IExtensionReducer {
  path: string[];
  reducer: IReducerSpec;
}

export type ExtensionInit = (context: IExtensionContext) => boolean;

export type ExtensionType = "game" | "translation" | "theme";

/**
 * Raw shape of an extension's info.json file.
 */
export interface ExtensionInfo {
  /** Display name of the extension. */
  name: string;
  /** Extension author display name. */
  author: string;
  /** Description of the extension. */
  description: string;
  /** File version. */
  version: string;

  /**
   * Author provided identifier to be used in requirements tracking. This
   * provides an exact match that can be used for `requireExtension` calls
   * to exactly match the extension instead of going through a priority matcher.
   * */
  id?: string;

  /** Namespace for localization support. */
  namespace?: string;

  /** @deprecated not read from info.json anymore */
  type?: ExtensionType;
  /** @deprecated not read from info.json anymore */
  bundled?: boolean;
  /** @deprecated not read from info.json anymore */
  path?: string;
  /** @deprecated not read from info.json anymore */
  modId?: number;
  /** @deprecated not read from info.json anymore */
  fileId?: number;
  /** @deprecated not read from info.json anymore */
  issueTrackerURL?: string;
}

/** @deprecated Use `ExtensionInfo` instead */
export type IExtension = ExtensionInfo;

export type IExtensionWithState = IExtensionState & {
  loadFailures: IExtensionLoadFailure[];
};

export interface IExtensionDownloadInfo {
  name: string;
  modId: number;
  fileId: number;
}

/**
 * Extension available from the Nexus Mods extensions endpoint. Internal model;
 * the wire format is private to extension_manager/availableExtensions.ts.
 */
export interface IAvailableExtension {
  name: string;
  modId: number;
  fileId: number;
  /** username of the uploader */
  author: string;
  version: string;
  /** upload time of the current file, epoch milliseconds */
  timestamp: number;
  /** mod page image, or the game artwork for game extensions */
  image?: string;
  /** undefined for extensions that don't target a game (tools, site extensions) */
  type?: ExtensionType;
  /** numeric Nexus Mods game ID, game extensions only */
  gameId?: number;
  /** game domain name, resolved from the local Nexus games list */
  gameDomain?: string;
  /** game display name, resolved from the local Nexus games list */
  gameName?: string;
  /** BCP 47 locale code, translations only */
  language?: string;
}

export interface ISelector {
  modId: number;
}

export interface IRegisteredExtension {
  name: string;
  namespace: string;
  path: string;
  dynamic: boolean;
  initFunc: () => ExtensionInit;
  info?: ExtensionInfo;
}
