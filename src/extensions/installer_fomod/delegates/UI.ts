import { IExtensionApi } from '../../../types/IExtensionContext';
import { log } from '../../../util/log';
import { showError } from '../../../util/message';
import { truthy } from '../../../util/util';

import { endDialog, setDialogState, startDialog } from '../../installer_fomod_shared/actions/installerUI';
import { IInstallerInfo, IInstallerState, IReportError, StateCallback } from '../../installer_fomod_shared/types/interface';

import DelegateBase from './DelegateBase';

import { inspect } from 'util';
import { DialogQueue, IDialogManager } from '../../installer_fomod_shared/utils/DialogQueue';

class UI extends DelegateBase implements IDialogManager {
  private mStateCB: StateCallback;
  private mUnattended: boolean;
  private mContinueCB: (direction) => void;
  private mCancelCB: () => void;
  private mInstanceId: string;
  private static dialogQueue = DialogQueue.getInstance();
  private mOnFinishCallbacks: Array<() => void> = [];

  get instanceId(): string {
    return this.mInstanceId;
  }

  constructor(api: IExtensionApi, gameId: string, unattended: boolean, instanceId: string, onFinishCallbacks?: Array<() => void>) {
    super(api);

    this.mUnattended = unattended;
    this.mInstanceId = instanceId;

    this.mOnFinishCallbacks = onFinishCallbacks ?? [];

    // Use bound methods to avoid conflicts between multiple instances
    this.onDialogSelect = this.onDialogSelect.bind(this);
    this.onDialogContinue = this.onDialogContinue.bind(this);
    this.onDialogEnd = this.onDialogEnd.bind(this);

    // Use instance-specific event names to avoid conflicts
    api.events
      .on(`fomod-installer-select-${this.mInstanceId}`, this.onDialogSelect)
      .on(`fomod-installer-continue-${this.mInstanceId}`, this.onDialogContinue)
      .on(`fomod-installer-cancel-${this.mInstanceId}`, this.onDialogEnd);

    log('debug', 'Created UI instance', { instanceId: this.mInstanceId });
  }

  public detach() {
    log('debug', 'Detaching UI instance', { instanceId: this.mInstanceId });

    this.api.events
      .removeListener(`fomod-installer-select-${this.mInstanceId}`, this.onDialogSelect)
      .removeListener(`fomod-installer-continue-${this.mInstanceId}`, this.onDialogContinue)
      .removeListener(`fomod-installer-cancel-${this.mInstanceId}`, this.onDialogEnd);

    this.mContinueCB = this.mStateCB = this.mCancelCB = undefined;
    if (this.mInstanceId !== null) {
      log('debug', 'Detaching UI instance that had active dialog', {
        instanceId: this.mInstanceId,
        queueStatus: UI.dialogQueue.getStatus()
      });

      UI.dialogQueue.onDialogEnd(this.api.store);
    }
  }

  public startDialog = async (info: IInstallerInfo, callback: (err) => void) => {
    this.mContinueCB = info.cont;
    this.mStateCB = info.select;
    this.mCancelCB = info.cancel;
    await UI.dialogQueue.addRequest(info, callback, this);
  }

  public startDialogImmediate = (info: IInstallerInfo, callback: (err) => void) => {
    try {
      if (!this.mUnattended) {
        this.api.store.dispatch(startDialog(info, this.mInstanceId));
      }
      callback(null);
    } catch (err) {
      log('error', 'Failed to start FOMOD dialog', {
        moduleName: info.moduleName,
        error: err.message
      });
      showError(this.api.store.dispatch, 'start installer dialog failed', err);
      callback(err);
    }
  }

  public endDialog = (dummy, callback: (err) => void) => {
    try {
      this.api.store.dispatch(endDialog(this.mInstanceId));
      callback(null);

      // Process any queued dialog requests
      UI.dialogQueue.onDialogEnd(this.api.store);

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
      this.api.store.dispatch(setDialogState(state, this.mInstanceId));
      if (this.mUnattended) {
        if (this.mContinueCB !== undefined) {
          this.mContinueCB({ direction: 'forward' });
        }
      }
      callback(null);
    } catch (err) {
      showError(this.api.store.dispatch, 'update installer dialog failed',
        err);
      callback(err);
    }
  }

  public reportError = (parameters: IReportError, callback: (err) => void) => {
    log('debug', 'reportError', inspect(parameters, null));
    try {
      let msg = parameters.message;
      if (truthy(parameters.details)) {
        msg += '\n' + parameters.details;
      }
      this.api.showErrorNotification(parameters.title, parameters.details ?? undefined,
        { isHTML: true, allowReport: false, message: parameters.message });
      callback(null);
    } catch (err) {
      showError(this.api.store.dispatch,
        'Failed to display error message from installer', err);
      callback(err);
    }
  }

  private onDialogSelect = (stepId: string, groupId: string, pluginIds: string[]) => {
    if (this.mStateCB !== undefined) {
      this.mStateCB({
        stepId: parseInt(stepId, 10),
        groupId: parseInt(groupId, 10),
        plugins: pluginIds.map(id => parseInt(id, 10))
      });
    }
  }

  private onDialogContinue = (direction, currentStepId: number) => {
    if (direction === 'finish') {
      this.mOnFinishCallbacks.forEach(callback => {
        try {
          callback();
        } catch (err) {
          log('error', 'FOMOD onFinish callback failed', { error: err.message });
        }
      });
    }
    const dir = direction === 'finish' ? 'forward' : direction;
    if (this.mContinueCB !== undefined) {
      this.mContinueCB({ direction: dir, currentStepId });
    }
  }

  private onDialogEnd = () => {
    if (this.mCancelCB !== undefined) {
      this.mCancelCB();
    }

    UI.dialogQueue.onDialogEnd(this.api.store);
  }
}

export default UI;
