import createAction from '../../../actions/safeCreateAction';
import { IInstallerInfo, IInstallerState } from '../types/interface';

import * as reduxAct from 'redux-act';

export const startDialog = createAction('START_FOMOD_DIALOG', (info: IInstallerInfo): any => info);

export const endDialog = createAction('END_FOMOD_DIALOG');

export const clearDialog = createAction('CLEAR_FOMOD_DIALOG');

export const setDialogState = createAction('SET_FOMOD_DIALOG_STATE',
  (state: IInstallerState): any => state);

export const setInstallerDataPath = createAction('SET_INSTALLER_DATA_PATH',
  (path: string): any => path);
