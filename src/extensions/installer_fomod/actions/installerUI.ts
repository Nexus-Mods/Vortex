import createAction from '../../../actions/safeCreateAction';
import { IInstallerInfo, IInstallerState } from '../types/interface';

export const startDialog = createAction('START_FOMOD_DIALOG', (info: IInstallerInfo): any => info);

export const endDialog = createAction('END_FOMOD_DIALOG', () => undefined);

export const setDialogState = createAction('SET_FOMOD_DIALOG_STATE',
  (state: IInstallerState): any => state);

export const setInstallerDataPath = createAction('SET_INSTALLER_DATA_PATH',
  (path: string): any => path);
