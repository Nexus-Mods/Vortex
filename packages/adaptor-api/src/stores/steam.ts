import type { StoreBase, StorePathProviderBase } from "./providers";

export const Steam = {
  workshop: "workshop",
} as const;

export type SteamBase = StoreBase | (typeof Steam)[keyof typeof Steam];

export type SteamPathProvider =
  | SteamProtonPathProvider
  | SteamWindowsPathProvider
  | SteamLinuxPathProvider;

export interface SteamProtonPathProvider extends StorePathProviderBase<
  SteamBase,
  "steam"
> {
  readonly scheme: "steam";
  readonly isProton: true;
}

export interface SteamWindowsPathProvider extends StorePathProviderBase<
  SteamBase,
  "steam"
> {
  readonly scheme: "steam";
  readonly isProton: false;
}

export interface SteamLinuxPathProvider extends StorePathProviderBase<
  SteamBase,
  "steam",
  false
> {
  readonly scheme: "steam";
  readonly isProton: false;
}
