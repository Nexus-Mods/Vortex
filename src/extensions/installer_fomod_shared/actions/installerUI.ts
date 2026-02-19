import createAction from "../../../renderer/actions/safeCreateAction";
import type { IInstallerInfoState, IInstallerState } from "../types/interface";

export const startDialog = createAction(
  "START_FOMOD_DIALOG",
  (info: IInstallerInfoState, instanceId: string) => ({
    info,
    instanceId,
  }),
);

export const endDialog = createAction(
  "END_FOMOD_DIALOG",
  (instanceId: string) => ({
    instanceId,
  }),
);

export const clearDialog = createAction(
  "CLEAR_FOMOD_DIALOG",
  (instanceId: string) => ({
    instanceId,
  }),
);

export const setDialogState = createAction(
  "SET_FOMOD_DIALOG_STATE",
  (dialogState: IInstallerState, instanceId: string) => ({
    dialogState,
    instanceId,
  }),
);
