import createAction from '../../../actions/safeCreateAction';
import { IInstallerInfoState, IInstallerState } from '../types/interface';

export type StartDialogPayload = {
  info: IInstallerInfoState;
  instanceId: string;
};
export const startDialog = createAction<IInstallerInfoState, string, StartDialogPayload>(
  'START_FOMOD_DIALOG', (info: IInstallerInfoState, instanceId: string) => ({
    info,
    instanceId
  })
);

export type EndDialogPayload = {
  instanceId: string;
};
export const endDialog = createAction<string, EndDialogPayload>(
  'END_FOMOD_DIALOG', (instanceId: string) => ({
    instanceId
  })
);

export type ClearDialogPayload = {
  instanceId: string;
};
export const clearDialog = createAction<string, ClearDialogPayload>(
  'CLEAR_FOMOD_DIALOG', (instanceId: string) => ({
    instanceId
  })
);

export type SetDialogStatePayload = {
  dialogState: IInstallerState;
  instanceId: string;
};
export const setDialogState = createAction<IInstallerState, string, SetDialogStatePayload>(
  'SET_FOMOD_DIALOG_STATE',
  (dialogState: IInstallerState, instanceId: string) => ({
    dialogState, instanceId
  })
);
