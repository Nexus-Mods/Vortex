import { type Brand, type Brander, make, validateNonEmptyString } from "./brand";

/**
 * The folder a game's mods are staged in, resolved from `settings.mods.installPath`.
 *
 * @public */
export type VortexStagingFolder = Brand<string, "VortexStagingFolder">;

/**
 * Brands a string as a {@link VortexStagingFolder}.
 *
 * @throws {@link VortexError} with kind `argument-invalid` for an empty string.
 *
 * @public */
export const VortexStagingFolder: Brander<VortexStagingFolder> =
  make<VortexStagingFolder>(validateNonEmptyString);

/**
 * A mod's folder inside the {@link VortexStagingFolder}: its `installationPath`, and the `source` of its deployed
 * files. Not its {@link VortexModId}.
 *
 * @public */
export type VortexModStagingFolder = Brand<string, "VortexModStagingFolder">;

/**
 * Brands a string as a {@link VortexModStagingFolder}.
 *
 * @throws {@link VortexError} with kind `argument-invalid` for an empty string.
 *
 * @public */
export const VortexModStagingFolder: Brander<VortexModStagingFolder> =
  make<VortexModStagingFolder>(validateNonEmptyString);
