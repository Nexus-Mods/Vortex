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
