import type { QualifiedPath } from "../fs/paths";

/**
 * Storefronts Vortex can discover a game from.
 * @public */
export const Store = {
  Steam: "steam",
  GOG: "gog",
  Epic: "epic",
  Xbox: "xbox",
} as const;

/** @public */
export type Store = (typeof Store)[keyof typeof Store];

/**
 * Operating systems Vortex supports.
 *
 * Two `OS` values travel together in a {@link StorePathSnapshot}:
 * - `baseOS` is the host the user is running on
 * - `gameOS` is the OS the game thinks it's running under (Windows for
 *   a Proton install on Linux, same as `baseOS` otherwise)
 * @public */
export const OS = {
  Windows: "windows",
  Linux: "linux",
} as const;

/** @public */
export type OS = (typeof OS)[keyof typeof OS];

/**
 * Well-known base directories a {@link StorePathProvider} may expose.
 *
 * Not every base exists on every OS. A snapshot's inner map only
 * contains keys the host could resolve for that OS.
 * @public */
export const Base = {
  /** The game install directory. Always present. */
  Game: "game",
  /** OS home directory (`%USERPROFILE%` / `$HOME`). */
  Home: "home",
  /** OS temp directory. */
  Temp: "temp",

  // Windows-specific
  AppData: "appData",
  Documents: "documents",
  MyGames: "my games",

  // Linux XDG
  XdgCache: "xdg.cache",
  XdgConfig: "xdg.config",
  XdgData: "xdg.data",
  XdgState: "xdg.state",
  XdgRuntime: "xdg.runtime",
} as const;

/** Full union of all base directory names. @public */
export type Base = (typeof Base)[keyof typeof Base];

/** Bases present on all platforms. @public */
export type CommonBase = typeof Base.Game | typeof Base.Home | typeof Base.Temp;

/** Bases available when `gameOS` is Windows. @public */
export type WindowsBase =
  | CommonBase
  | typeof Base.AppData
  | typeof Base.Documents
  | typeof Base.MyGames;

/** Bases available when `gameOS` is Linux. @public */
export type LinuxBase =
  | CommonBase
  | typeof Base.XdgCache
  | typeof Base.XdgConfig
  | typeof Base.XdgData
  | typeof Base.XdgState
  | typeof Base.XdgRuntime;

/**
 * Pre-resolved per-discovery path snapshot. The host builds this and
 * sends it over IPC; the worker dispatch layer wraps it into a
 * {@link StorePathProvider} before calling adaptor methods.
 *
 * Adaptors should not depend on this type directly — use
 * {@link StorePathProvider} instead.
 *
 * @internal */
export interface StorePathSnapshot {
  readonly store: Store;
  /** Host OS the user is running on. */
  readonly baseOS: OS;
  /**
   * OS the game thinks it's running under. Equals {@link baseOS} on
   * native installs; for Proton on Steam/Linux this is {@link OS.Windows}.
   */
  readonly gameOS: OS;
  /**
   * Pre-resolved bases, keyed first by OS and then by base name.
   *
   * - `bases.get(gameOS)` — paths as the game sees them (for Proton,
   *   these point inside the Wine prefix).
   * - `bases.get(baseOS)` — host-side paths (useful when an adaptor
   *   needs to write to the native filesystem on a Proton install).
   */
  readonly bases: ReadonlyMap<OS, ReadonlyMap<Base, QualifiedPath>>;
}

/**
 * Provider for a game whose runtime OS is Windows.
 *
 * After `if (provider.isWindows)`, TypeScript narrows to this type
 * and `fromBase` only accepts {@link WindowsBase} keys.
 * @public */
export interface WindowsStorePathProvider {
  readonly store: Store;
  readonly baseOS: OS;
  readonly gameOS: typeof OS.Windows;
  readonly isWindows: true;
  /**
   * Resolve a known base. Defaults to {@link gameOS}; pass {@link baseOS}
   * (or any other {@link OS}) explicitly to get the host-side path.
   * @throws PathProviderError if the base is not known for the requested OS.
   */
  fromBase(base: WindowsBase, os?: OS): Promise<QualifiedPath>;
}

/**
 * Provider for a game whose runtime OS is Linux.
 *
 * After `if (!provider.isWindows)`, TypeScript narrows to this type
 * and `fromBase` only accepts {@link LinuxBase} keys.
 * @public */
export interface LinuxStorePathProvider {
  readonly store: Store;
  readonly baseOS: OS;
  readonly gameOS: typeof OS.Linux;
  readonly isWindows: false;
  /**
   * Resolve a known base. Defaults to {@link gameOS}; pass {@link baseOS}
   * (or any other {@link OS}) explicitly to get the host-side path.
   * @throws PathProviderError if the base is not known for the requested OS.
   */
  fromBase(base: LinuxBase, os?: OS): Promise<QualifiedPath>;
}

/**
 * Adaptor-facing provider over a {@link StorePathSnapshot}.
 *
 * Built by the worker dispatch layer from the snapshot the host sends
 * over IPC. All lookups are local — no RPC happens during path
 * construction.
 *
 * Use the `isWindows` discriminant to narrow the provider and get
 * compile-time safety for OS-specific bases.
 *
 * @public */
export type StorePathProvider =
  | WindowsStorePathProvider
  | LinuxStorePathProvider;
