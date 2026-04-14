import type { PathProvider, WindowsPathBase } from "@vortex/fs";

import type { GOGPathProvider } from "./gog";
import type { SteamPathProvider } from "./steam";

export const StorePath = {
  game: "game",
} as const;

export type StoreBase = (typeof StorePath)[keyof typeof StorePath];

export type StorePathProvider = SteamPathProvider | GOGPathProvider;

export type Store = "steam" | "gog";

export interface StorePathProviderBase<
  TBase extends string,
  TStore extends Store,
  IsWindows extends boolean = true,
> extends PathProvider<
  IsWindows extends true ? TBase | WindowsPathBase : TBase
> {
  readonly isWindows: IsWindows;
  readonly store: TStore;
}
