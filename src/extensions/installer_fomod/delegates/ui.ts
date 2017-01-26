import {IExtensionApi} from '../../../types/IExtensionContext';
import {log} from '../../../util/log';

import {endDialog, setDialogState, startDialog} from '../actions/installerUI';
import {IInstallerInfo, IInstallerState, IStateCallback} from '../types/interface';

export class UI {
  private mAPI: IExtensionApi;
  private mStateCB: IStateCallback;
  private mContinueCB: (direction) => void;
  private mCancelCB: () => void;

  constructor(api: IExtensionApi) {
    this.mAPI = api;
    api.events.on('fomod-installer-select',
      (stepId: string, groupId: string, plugins: string[]) => {
        log('info', 'select', { stepId, groupId, plugins });
        if (this.mStateCB !== undefined) {
          this.mStateCB(stepId, groupId, plugins);
        }
      });
    api.events.on('fomod-installer-continue', (direction) => {
      log('info', 'continue', direction);
      if (this.mContinueCB !== undefined) {
        this.mContinueCB(direction);
      }
    });
    api.events.on('fomod-installer-cancel', () => {
      log('info', 'cancel');
      if (this.mCancelCB !== undefined) {
        this.mCancelCB();
      }
    });
  }

  public startDialog = (info: IInstallerInfo) => {
    this.mStateCB = info.continue;
    this.mCancelCB = info.cancel;
    this.mAPI.store.dispatch(startDialog({
      moduleName: info.moduleName,
      image: info.image,
    }));
  }

  public endDialog = () => {
    this.mAPI.store.dispatch(endDialog());
    this.mStateCB = this.mCancelCB = undefined;
  }

  public updateState = (state: IInstallerState) => {
    this.mAPI.store.dispatch(setDialogState(state));
  }
}

export default UI;
