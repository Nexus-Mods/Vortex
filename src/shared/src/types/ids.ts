import { VortexError } from "../errors/base";

declare const idBrand: unique symbol;

// A string branded with the kind of id it is; two kinds never mix.
type Id<Kind extends string> = string & { readonly [idBrand]: Kind };

// Vortex never keys a mod or a profile by an empty id.
function isNonEmptyString(raw: unknown): raw is string {
  return typeof raw === "string" && raw.length > 0;
}

/**
 * The id Vortex gives an installed mod, the key of `persistent.mods[gameId]`. Not a Nexus Mods mod id, which
 * a mod carries as its `modId` attribute. Values come only from {@link toVortexModId} or {@link isVortexModId}.
 *
 * @public */
export type VortexModId = Id<"VortexModId">;

/**
 * The id of a Vortex profile, the key of `persistent.profiles`. Values come only from {@link toVortexProfileId} or
 * {@link isVortexProfileId}.
 *
 * @public */
export type VortexProfileId = Id<"VortexProfileId">;

/**
 * True for a value that can be a {@link VortexModId}: a non-empty string.
 *
 * @public */
export function isVortexModId(raw: unknown): raw is VortexModId {
  return isNonEmptyString(raw);
}

/**
 * True for a value that can be a {@link VortexProfileId}: a non-empty string.
 *
 * @public */
export function isVortexProfileId(raw: unknown): raw is VortexProfileId {
  return isNonEmptyString(raw);
}

/**
 * A value read from state, IPC or a callback as a {@link VortexModId}.
 *
 * @throws {@link VortexError} with kind `argument-invalid` when {@link isVortexModId} rejects the value.
 *
 * @public */
export function toVortexModId(raw: unknown): VortexModId {
  if (isVortexModId(raw)) {
    return raw;
  }
  throw new VortexError("A Vortex mod id must be a non-empty string", {
    kind: "argument-invalid",
    argument: "toVortexModId",
  });
}

/**
 * A value read from state, IPC or a callback as a {@link VortexProfileId}.
 *
 * @throws {@link VortexError} with kind `argument-invalid` when {@link isVortexProfileId} rejects the value.
 *
 * @public */
export function toVortexProfileId(raw: unknown): VortexProfileId {
  if (isVortexProfileId(raw)) {
    return raw;
  }
  throw new VortexError("A profile id must be a non-empty string", {
    kind: "argument-invalid",
    argument: "toVortexProfileId",
  });
}
