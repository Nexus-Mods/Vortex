import safeCreateAction from '../../../actions/safeCreateAction';
import { IValidateKeyDataV2 } from '../types/IValidateKeyData';
import * as reduxAct from 'redux-act';

export const setUserInfo: reduxAct.ComplexActionCreator1<
  IValidateKeyDataV2 | undefined,
  IValidateKeyDataV2 | undefined,
  {}
> = safeCreateAction(
  'SET_USER_INFO',
  (input: IValidateKeyDataV2 | undefined): IValidateKeyDataV2 | undefined => input,
);
export const setNewestVersion = safeCreateAction('SET_NEWEST_VERSION', (version: string) => version);
