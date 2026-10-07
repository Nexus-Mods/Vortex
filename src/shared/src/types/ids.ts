import { VortexError } from "../errors/base";

declare const brand: unique symbol;

type Brand<Base, Tag> = Base & { readonly [brand]: { readonly __base__: Base; readonly tag: Tag } };
type AnyBrand = Brand<unknown, any>;
type BaseOf<B extends AnyBrand> = B[typeof brand]["__base__"];
type Brander<B extends AnyBrand> = (value: BaseOf<B>) => B;

function make<B extends AnyBrand>(validate?: (value: BaseOf<B>) => void): Brander<B> {
  return (value: BaseOf<B>): B => {
    validate?.(value);

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return value as unknown as B;
  };
}

function validateNonEmptyString(value: string) {
  if (value.length > 0) return;
  throw new VortexError("Must be a non-empty string!", {
    kind: "argument-invalid",
    argument: "value",
  });
}

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
