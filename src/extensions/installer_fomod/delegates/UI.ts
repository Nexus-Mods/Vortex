import {IExtensionApi} from '../../../types/IExtensionContext';
import {showError} from '../../../util/message';

import {endDialog, setDialogState, startDialog} from '../actions/installerUI';
import {IInstallerInfo, IInstallerState, IReportError, IStateCallback} from '../types/interface';

import DelegateBase from './DelegateBase';

class UI extends DelegateBase {
  private mStateCB: IStateCallback;
  private mContinueCB: (direction) => void;
  private mCancelCB: () => void;

  constructor(api: IExtensionApi) {
    super(api);

    api.events
      .on('fomod-installer-select', this.onDialogSelect)
      .on('fomod-installer-continue', this.onDialogContinue)
      .on('fomod-installer-cancel', this.onDialogEnd);
  }

  public detach() {
    this.api.events
      .removeListener('fomod-installer-select', this.onDialogSelect)
      .removeListener('fomod-installer-continue', this.onDialogContinue)
      .removeListener('fomod-installer-cancel', this.onDialogEnd);
  }

  public startDialog =
      (info: IInstallerInfo) => {
        this.mContinueCB = info.cont;
        this.mStateCB = info.select;
        this.mCancelCB = info.cancel;
        try {
          this.api.store.dispatch(startDialog({
            moduleName: info.moduleName,
            image: info.image,
          }));
        } catch (err) {
          showError(this.api.store.dispatch, 'start installer dialog failed',
                    err);
        }
      }

  public endDialog =
      () => {
        try {
          this.api.store.dispatch(endDialog());
        } catch (err) {
          showError(this.api.store.dispatch, 'end installer dialog failed',
                    err);
        }
        this.mStateCB = this.mCancelCB = undefined;
      }

  public updateState =
      (state: IInstallerState) => {
        try {
          this.api.store.dispatch(setDialogState(state));
        } catch (err) {
          showError(this.api.store.dispatch, 'update installer dialog failed',
                    err);
        }
      }

  public reportError =
      (parameters: IReportError) => {
        try {
          this.api.showErrorNotification(
              parameters.title, parameters.message + '\n' + parameters.details);
        } catch (err) {
          showError(this.api.store.dispatch,
                    'failed to display error message from installer', err);
        }
      }

  private onDialogSelect =
      (stepId: number, groupId: number, plugins: number[]) => {
        if (this.mStateCB !== undefined) {
          this.mStateCB({stepId, groupId, plugins});
        }
      };
  private onDialogContinue = (direction) => {
    if (this.mContinueCB !== undefined) {
      this.mContinueCB(direction);
    }
  };

  private onDialogEnd = () => {
    if (this.mCancelCB !== undefined) {
      this.mCancelCB();
    }
  };
}

export default UI;
