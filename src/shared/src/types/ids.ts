import { type Brand, type Brander, make, validateNonEmptyString } from "./brand";

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
