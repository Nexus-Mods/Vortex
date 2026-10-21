declare const brand: unique symbol;

/** A Base that only its own constructor produces, so ids from different sources never mix. */
export type Brand<Base, Tag extends string> = Base & {
  readonly [brand]: { readonly base: Base; readonly tag: Tag };
};

type BaseOf<B extends Brand<unknown, string>> = B[typeof brand]["base"];

function brander<B extends Brand<unknown, string>>(): (value: BaseOf<B>) => B {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a brand exists only in types
  return (value) => value as unknown as B;
}

/** Nexus Mods numeric game id. */
export type NexusGameId = Brand<number, "NexusGameId">;
export const NexusGameId: (value: number) => NexusGameId = brander<NexusGameId>();

/** Nexus Mods file version uid: the game id in the high 32 bits, the file id in the low. */
export type NexusFileUid = Brand<string, "NexusFileUid">;
export const NexusFileUid: (value: string) => NexusFileUid = brander<NexusFileUid>();

/** Steam app id. */
export type SteamAppId = Brand<number, "SteamAppId">;
export const SteamAppId: (value: number) => SteamAppId = brander<SteamAppId>();

/** Steam build id of an installed app. */
export type SteamBuildId = Brand<number, "SteamBuildId">;
export const SteamBuildId: (value: number) => SteamBuildId = brander<SteamBuildId>();

/** Steam depot id. */
export type SteamDepotId = Brand<number, "SteamDepotId">;
export const SteamDepotId: (value: number) => SteamDepotId = brander<SteamDepotId>();

/** Steam depot manifest id; a string because it exceeds 2^53. */
export type SteamManifestId = Brand<string, "SteamManifestId">;
export const SteamManifestId: (value: string) => SteamManifestId = brander<SteamManifestId>();

/** GOG product id. */
export type GogProductId = Brand<string, "GogProductId">;
export const GogProductId: (value: string) => GogProductId = brander<GogProductId>();

/** GOG build id; a string because it exceeds 2^53. */
export type GogBuildId = Brand<string, "GogBuildId">;
export const GogBuildId: (value: string) => GogBuildId = brander<GogBuildId>();
