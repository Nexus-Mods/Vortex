import type { Serializable } from "./ipc";

/**
 * Minimal representation of persisted state hives for IPC type safety.
 *
 * The full IState type with all nested interfaces is defined in src/types/IState.ts
 * and cannot be moved to shared because of external dependencies:
 * - IMod imports from 'modmeta-db' (external npm package)
 * - IDownload imports from runtime code (DownloadManager.ts)
 * - Deep transitive dependencies on Bluebird, ITool chain, etc.
 *
 * This minimal version provides type-safe hive names without those dependencies.
 * The renderer can cast the Serializable data to IState[hive] where full typing is needed.
 */

/**
 * Minimal interface representing the structure of persisted state.
 * Each hive's data is typed as Serializable at the IPC boundary.
 */
export interface PersistedState {
  /** Application-level state (version, extensions, install type) */
  app: Serializable;
  /** User-specific state (multi-user settings) */
  user: Serializable;
  /** Sensitive data (account info) */
  confidential: Serializable;
  /** User preferences and UI settings */
  settings: Serializable;
  /** Long-term persistent data (profiles, mods, downloads, categories) */
  persistent: Serializable;
  /** Gamebryo plugin load order (persisted to plugins.txt/loadorder.txt) */
  loadOrder: Serializable;
  /** Gamebryo LOOT userlist (persisted to userlist.yaml) */
  userlist: Serializable;
  /** Gamebryo LOOT masterlist (persisted to masterlist.yaml) */
  masterlist: Serializable;
}

/**
 * Valid hive names for persisted state.
 * Excludes 'session' which is ephemeral and not persisted.
 */
export type PersistedHive = keyof PersistedState;

export type PersistorKey = string[];

/**
 * a persistor is used to hook a data file into the store.
 * This way any data file can be made available through the store and
 * updated through actions, as long as it can be represented in json
 */
export interface IPersistor {
  setResetCallback(cb: () => PromiseLike<void>): void;
  getItem(key: PersistorKey): PromiseLike<string>;
  setItem(key: PersistorKey, value: string): PromiseLike<void>;
  removeItem(key: PersistorKey): PromiseLike<void>;
  getAllKeys(): PromiseLike<PersistorKey[]>;
  getAllKVs?(
    prefix?: string,
  ): PromiseLike<Array<{ key: PersistorKey; value: string }>>;
}

export interface IPosition {
  x: number;
  y: number;
}

export interface IDimensions {
  height: number;
  width: number;
}

export interface IWindow {
  maximized: boolean;
  position?: IPosition;
  size: IDimensions;
  tabsMinimized: boolean;
  customTitlebar: boolean;
  minimizeToTray: boolean;
  useModernLayout: boolean;
}

export const currentStatePath = "state.v2";
