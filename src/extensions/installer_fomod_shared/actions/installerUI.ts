import createAction from '../../../actions/safeCreateAction';
import { IInstallerInfo, IInstallerState } from '../types/interface';

export const startDialog = createAction('START_FOMOD_DIALOG', 
  (info: IInstallerInfo, instanceId: string): any => ({ info, instanceId }));

export const endDialog = createAction('END_FOMOD_DIALOG', (instanceId: string): any => ({ instanceId }));

export const clearDialog = createAction('CLEAR_FOMOD_DIALOG', (instanceId: string): any => ({ instanceId }));

export const setDialogState = createAction('SET_FOMOD_DIALOG_STATE',
  (dialogState: IInstallerState, instanceId: string): any => ({ dialogState, instanceId }));

export const setInstallerDataPath = createAction('SET_INSTALLER_DATA_PATH',
  (path: string, instanceId: string): any => ({ path, instanceId }));
