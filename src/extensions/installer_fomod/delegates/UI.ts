import { IExtensionApi } from '../../../types/IExtensionContext';
import { log } from '../../../util/log';
import { showError } from '../../../util/message';
import { truthy } from '../../../util/util';

import { clearDialog, setDialogState, startDialog } from '../../installer_fomod_shared/actions/installerUI';
import { IHeaderImage, IInstallerInfo, IInstallerState, IReportError, StateCallback } from '../../installer_fomod_shared/types/interface';

import DelegateBase from './DelegateBase';

import { inspect } from 'util';
import { DialogQueue, IDialogManager } from '../../installer_fomod_shared/utils/DialogQueue';

class UI extends DelegateBase implements IDialogManager {
  private mStateCB: StateCallback;
  private mContinueCB: (direction, currentStepId) => void;
  private mCancelCB: () => void;
  private mInstanceId: string;
  private mScriptPath: string;
  private mModuleName: string;
  private mImage: IHeaderImage;

  get instanceId(): string {
    return this.mInstanceId;
  }

  constructor(api: IExtensionApi, instanceId: string, scriptPath: string) {
    super(api);

    this.mInstanceId = instanceId;
    this.mScriptPath = scriptPath;

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

    this.api.store.dispatch(clearDialog(this.mInstanceId));

    this.api.events
      .removeListener(`fomod-installer-select-${this.mInstanceId}`, this.onDialogSelect)
      .removeListener(`fomod-installer-continue-${this.mInstanceId}`, this.onDialogContinue)
      .removeListener(`fomod-installer-cancel-${this.mInstanceId}`, this.onDialogEnd);

    this.mContinueCB = this.mStateCB = this.mCancelCB = undefined;
    if (this.mInstanceId !== null) {
      const dialogQueue = DialogQueue.getInstance(this.api);
      log('debug', 'Detaching UI instance that had active dialog', {
        instanceId: this.mInstanceId,
        queueStatus: dialogQueue.getStatus()
      });

      dialogQueue.onDialogEnd(this.mInstanceId);
    }
  }

  // TODO: investigate whether we need the callback system
  public startDialog = async (info: IInstallerInfo, callback: (err) => void) => {
    try {
      this.mContinueCB = info.cont;
      this.mStateCB = info.select;
      this.mCancelCB = info.cancel;
      this.mModuleName = info.moduleName;
      this.mImage = info.image;
      const dialogQueue = DialogQueue.getInstance(this.api);
      await dialogQueue.enqueueDialog(this);
      callback(null);
    } catch (err) {
      log('error', 'Failed to start FOMOD dialog', {
        moduleName: this.mModuleName,
        error: err.message
      });
      showError(this.api.store.dispatch, 'start installer dialog failed', err);
      callback(err);
    }
  }

  public startDialogImmediate = () => {
    try {
      this.api.store.dispatch(startDialog({
        moduleName: this.mModuleName,
        image: this.mImage,
        dataPath: this.mScriptPath,
      }, this.mInstanceId));
    } catch (err) {
      log('error', 'Failed to start FOMOD dialog immediately', {
        moduleName: this.mModuleName,
        error: err.message
      });
      showError(this.api.store.dispatch, 'start installer dialog immediately failed', err);
    }
  }

  public cancelDialogImmediate(): void {
    log('debug', 'Cancelling FOMOD dialog immediately', { instanceId: this.mInstanceId });
    this.onDialogEnd();
  }

  public endDialog = (dummy, callback: (err) => void) => {
    try {
      // Process any queued dialog requests
      const dialogQueue = DialogQueue.getInstance(this.api);
      dialogQueue.onDialogEnd(this.mInstanceId);
      callback(null);
    } catch (err) {
      log('error', 'Failed to end FOMOD dialog', {
        instanceId: this.mInstanceId,
        error: err.message
      });
      showError(this.api.store.dispatch, 'end installer dialog failed', err);
      callback(err);
    }
    
    this.mContinueCB = this.mStateCB = this.mCancelCB = undefined;
  }

  public updateState = (state: IInstallerState, callback: (err) => void) => {
    if (state.currentStep < 0 || state.currentStep >= state.installSteps.length) {
      return;
      //throw new Error('Invalid current step ID');
    }

    try {
      this.api.store.dispatch(setDialogState(state, this.mInstanceId));
      callback(null);
    } catch (err) {
      log('error', 'Failed to update FOMOD dialog', {
        instanceId: this.mInstanceId,
        error: err.message
      });
      showError(this.api.store.dispatch, 'update installer dialog failed', err);
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
      showError(this.api.store.dispatch, 'Failed to display error message from installer', err);
      callback(err);
    }
  }

  private onDialogSelect = (stepId: string, groupId: string, pluginIds: string[]) => {
    this.mStateCB?.({
      stepId: parseInt(stepId, 10),
      groupId: parseInt(groupId, 10),
      plugins: pluginIds.map(id => parseInt(id, 10))
    });
  }

  private onDialogContinue = (direction, currentStepId: number) => {
    const dir = direction === 'finish' ? 'forward' : direction;
    this.mContinueCB?.(dir, currentStepId);
  }

  private onDialogEnd = () => {
    this.mCancelCB?.();

    const dialogQueue = DialogQueue.getInstance(this.api);
    dialogQueue.onDialogEnd(this.mInstanceId);
  }
}

export default UI;
