import { type Brand, type Brander, make, validateNonEmptyString } from "./brand";

/** Numeric Nexus Mods game identifier.
 * @public
 * */
export type GameId = Brand<number, "GameId">;

/** Brands {@link GameId}
 * @public
 * */
export const GameId: Brander<GameId> = make<GameId>();

/** Nexus Mods game domain name.
 * @public
 * */
export type GameDomain = Brand<string, "GameDomain">;

/** Brands {@link GameDomain}
 * @public
 * */
export const GameDomain: Brander<GameDomain> = make<GameDomain>(validateNonEmptyString);

/**
 * The id Vortex gives a game internally: the key of `session.gameMode.known`,
 * `settings.gameMode.discovered`, the game registry ($ .extensionGames) and
 * `persistent.profiles[...].gameId`. For extension-backed games this is the
 * extension's game id (e.g. "skyrimse"); for games managed without an
 * extension it is the nexus domain.
 *
 * This is neither {@link GameId} (the numeric Nexus Mods identifier, e.g.
 * 1303) nor necessarily {@link GameDomain} (the nexus domain name): the two
 * often coincide as strings but are different concepts - "skyrimvr" is a
 * VortexGameId whose nexus domain is "skyrimspecialedition", and converting
 * between a VortexGameId and a GameDomain requires the game's details or the
 * games list (`nexusGameId`), while converting to a GameId requires the games
 * list only.
 *
 * @public */
export type VortexGameId = Brand<string, "VortexGameId">;

/**
 * Brands a string as a {@link VortexGameId}.
 *
 * @throws {@link VortexError} with kind `argument-invalid` for an empty string.
 *
 * @public */
export const VortexGameId: Brander<VortexGameId> = make<VortexGameId>(validateNonEmptyString);

/**
 * The id Vortex gives an installed mod, the key of `persistent.mods[gameId]`. Not a Nexus Mods mod id, which
 * a mod carries as its `modId` attribute.
 *
 * @public */
export type VortexModId = Brand<string, "VortexModId">;

/**
 * Brands a string as a {@link VortexModId}.
 *
 * @throws {@link VortexError} with kind `argument-invalid` for an empty string.
 *
 * @public */
export const VortexModId: Brander<VortexModId> = make<VortexModId>(validateNonEmptyString);

/**
 * The id of a Vortex profile, the key of `persistent.profiles`.
 *
 * @public */
export type VortexProfileId = Brand<string, "VortexProfileId">;

/**
 * Brands a string as a {@link VortexProfileId}.
 *
 * @throws {@link VortexError} with kind `argument-invalid` for an empty string.
 *
 * @public */
export const VortexProfileId: Brander<VortexProfileId> =
  make<VortexProfileId>(validateNonEmptyString);
