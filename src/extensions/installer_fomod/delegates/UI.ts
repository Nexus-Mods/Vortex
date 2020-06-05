import {IExtensionApi} from '../../../types/IExtensionContext';
import { log } from '../../../util/log';
import {showError} from '../../../util/message';
import { truthy } from '../../../util/util';

import {endDialog, setDialogState, startDialog} from '../actions/installerUI';
import {IInstallerInfo, IInstallerState, IReportError, StateCallback} from '../types/interface';

import DelegateBase from './DelegateBase';

import { inspect } from 'util';

class UI extends DelegateBase {
  private mStateCB: StateCallback;
  private mUnattended: boolean;
  private mContinueCB: (direction) => void;
  private mCancelCB: () => void;

  constructor(api: IExtensionApi, gameId: string, unattended: boolean) {
    super(api);

    this.mUnattended = unattended;

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

  public startDialog = (info: IInstallerInfo, callback: (err) => void) => {
    this.mContinueCB = info.cont;
    this.mStateCB = info.select;
    this.mCancelCB = info.cancel;
    try {
      // if (!this.mUnattended) {
        this.api.store.dispatch(startDialog({
          moduleName: info.moduleName,
          image: info.image,
        }));
      // }
      callback(null);
    } catch (err) {
      showError(this.api.store.dispatch, 'start installer dialog failed',
        err);
      callback(err);
    }
  }

  public endDialog = (dummy, callback: (err) => void) => {
    try {
      callback(null);
    } catch (err) {
      showError(this.api.store.dispatch, 'end installer dialog failed', err);
      callback(err);
    }
    // unset the callbacks because they belong to c# so having links here
    // might prevent the c# object from being cleaned up
    this.mContinueCB = this.mStateCB = this.mCancelCB = undefined;
  }

  public updateState = (state: IInstallerState, callback: (err) => void) => {
    try {
      this.api.store.dispatch(setDialogState(state));
      callback(null);
      if (this.mUnattended) {
        setTimeout(() => {
          if (this.mContinueCB !== undefined) {
            this.mContinueCB('forward');
          }
        }, 1000);
      }
    } catch (err) {
      showError(this.api.store.dispatch, 'update installer dialog failed',
        err);
      callback(err);
    }
  }

  public reportError = (parameters: IReportError) => {
    log('debug', 'reportError', inspect(parameters, null));
    try {
      let msg = parameters.message;
      if (truthy(parameters.details)) {
        msg += '\n' + parameters.details;
      }
      this.api.showErrorNotification(parameters.title, msg,
        { isHTML: true, allowReport: false });
    } catch (err) {
      showError(this.api.store.dispatch,
        'Failed to display error message from installer', err);
    }
  }

  private onDialogSelect = (stepId: number, groupId: number, plugins: number[]) => {
    if (this.mStateCB !== undefined) {
      this.mStateCB({ stepId, groupId, plugins });
    }
  }

  private onDialogContinue = (direction, currentStepId: number) => {
    if (this.mContinueCB !== undefined) {
      this.mContinueCB({ direction, currentStepId });
    }
  }

  private onDialogEnd = () => {
    if (this.mCancelCB !== undefined) {
      this.mCancelCB();
    }
  }
}

export default UI;
