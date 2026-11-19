import { type Brand, type Brander, make, validateNonEmptyString } from "./brand";

/** Numeric Nexus Mods game identifier.
 * @public
 * */
export type NexusGameId = Brand<number, "NexusGameId">;

/** Brands {@link NexusGameId}
 * @public
 * */
export const NexusGameId: Brander<NexusGameId> = make<NexusGameId>();

/** Nexus Mods game domain name.
 * @public
 * */
export type NexusGameDomain = Brand<string, "NexusGameDomain">;

/** Brands {@link NexusGameDomain}
 * @public
 * */
export const NexusGameDomain: Brander<NexusGameDomain> =
  make<NexusGameDomain>(validateNonEmptyString);

/**
 * The game's id in the Nexus Mods game catalogue (`game_uid`). Opaque: compare it, never parse it,
 * and don't validate it as a UUID.
 *
 * @public */
export type GameUid = Brand<string, "GameUid">;

/**
 * Brands a string as a {@link GameUid}.
 *
 * @throws {@link VortexError} with kind `argument-invalid` for an empty string.
 *
 * @public */
export const GameUid: Brander<GameUid> = make<GameUid>(validateNonEmptyString);

/**
 * A {@link GameUid} as it was written, which the catalogue may since have retired. Declared uids
 * (a manifest's `contributes`) parse into it, and it is the type of every uid Vortex stores: a
 * stored uid is never rewritten, a query resolves it.
 *
 * @public */
export type RecordedGameUid = Brand<string, "RecordedGameUid">;

/**
 * Brands a string as a {@link RecordedGameUid}.
 *
 * @throws {@link VortexError} with kind `argument-invalid` for an empty string.
 *
 * @public */
export const RecordedGameUid: Brander<RecordedGameUid> =
  make<RecordedGameUid>(validateNonEmptyString);

/**
 * The id Vortex gives a game internally: the key of `session.gameMode.known`,
 * `settings.gameMode.discovered`, the game registry ($ .extensionGames) and
 * `persistent.profiles[...].gameId`. For extension-backed games this is the
 * extension's game id (e.g. "skyrimse"); for games managed without an
 * extension it is the nexus domain.
 *
 * This is neither {@link NexusGameId} (the numeric Nexus Mods identifier, e.g.
 * 1303) nor necessarily {@link NexusGameDomain} (the nexus domain name): the two
 * often coincide as strings but are different concepts - "skyrimvr" is a
 * VortexGameId whose nexus domain is "skyrimspecialedition", and converting
 * between a VortexGameId and a NexusGameDomain requires the game's details or the
 * games list (`nexusGameId`), while converting to a NexusGameId requires the games
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
