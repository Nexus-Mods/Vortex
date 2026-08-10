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
  /** Human-readable description of the extension. */
  description: string;
  /** File version. */
  version: string;

  /** @deprecated to be replaced. */
  type?: ExtensionType;

  /**
   * Author provided identifier to be used in requirements tracking. This
   * provides an extract match that can be used for `requireExtension` calls
   * to exactly match the extension instead of going through a priority matcher.
   */
  id?: string;

  /** Namespace for localization support. */
  namespace?: string;
}

/** @deprecated Use `ExtensionInfo` instead */
export type IExtension = ExtensionInfo;

export type IExtensionWithState = IExtensionState & {
  loadFailures: IExtensionLoadFailure[];
};

export interface IExtensionDownloadInfo {
  name: string;
  modId?: number;
  fileId?: number;
  type?: ExtensionType;
}

export interface IAvailableExtension {
  name: string;
  version: string;
  authorName: string;
  authorId: number;
  uploadedAt: number;
  modId: number;
  fileId: number;
  imageURL: string;
}

export interface IExtensionManifest {
  last_updated: number;
  extensions: IAvailableExtension[];
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
