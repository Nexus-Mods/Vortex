import type { IPreference } from "@nexusmods/nexus-api";

/**
 * Data retrieved with a correct API Key
 *
 * @export
 * @interface IValidateKeyData
 */
export interface IValidateKeyData {
  email: string;
  isPremium: boolean;
  isSupporter: boolean;
  name: string;
  profileUrl: string;
  userId: number;
}

/**
 * Membership-related fields of a user, derived from the role strings in the API
 * user payload / JWT. Centralising these as one type lets us derive, spread and
 * compare them as a unit instead of field-by-field.
 */
export interface IMembership {
  isPremium: boolean;
  isSupporter: boolean;
  isLifetime: boolean;
}

export interface IValidateKeyDataV2 extends IValidateKeyData, Partial<IPreference> {
  isLifetime?: boolean;
}
