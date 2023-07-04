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

export enum IAccountStatus {
  Premium,
  Supporter,
  Free,
  Banned,
  Closed
} 

export interface IValidateKeyDataV2 extends IValidateKeyData {
  isLifetime?: boolean,
  isBanned?: boolean,
  isClosed?: boolean,
  status?: IAccountStatus
}