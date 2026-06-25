import type { IPreference } from "@nexusmods/nexus-api";

/**
 * Membership-related fields of a user, derived from the role strings in the API
 * user payload / JWT. Single source of truth for these flags so they can be
 * derived, spread and compared as a unit instead of field-by-field.
 */
export interface IMembership {
  isPremium: boolean;
  isSupporter: boolean;
  isLifetime: boolean;
}

/**
 * Data retrieved with a correct API Key (legacy /users/validate shape).
 *
 * @export
 * @interface IValidateKeyData
 */
export interface IValidateKeyData extends Pick<IMembership, "isPremium" | "isSupporter"> {
  email: string;
  name: string;
  profileUrl: string;
  userId: number;
}

export interface IValidateKeyDataV2 extends IValidateKeyData, IMembership, Partial<IPreference> {}
