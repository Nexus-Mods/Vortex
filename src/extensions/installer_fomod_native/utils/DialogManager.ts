import { types as vetypes } from 'fomod-installer-native';

import { IExtensionApi } from '../../../types/IExtensionContext';
import { log } from '../../../util/log';
import { showError } from '../../../util/message';

import { DialogQueue, IDialogManager } from '../../installer_fomod_shared/utils/DialogQueue';

import {
  endDialog,
  setDialogState,
  startDialog,
} from '../../installer_fomod_shared/actions/installerUI';
import {
  Direction,
  IInstallerInfo,
  IInstallerState,
  IInstallStep,
  StateCallback,
} from '../../installer_fomod_shared/types/interface';

/**
 * UI Delegate for native FOMOD installer
 * Manages dialog state and user interactions through Redux store
 *
 * Key differences from IPC version:
 * - Native callbacks use direct function calls instead of IPC
 * - Callbacks have simpler signatures (no wrapper objects)
 * - Still uses Redux for UI state management (shared with IPC version)
 */
export class DialogManager implements IDialogManager {
  private static dialogQueue = DialogQueue.getInstance();

  private mApi: IExtensionApi;

  private mSelectCB: vetypes.SelectCallback | undefined;
  private mContinueCB: vetypes.ContinueCallback | undefined;
  private mCancelCB: vetypes.CancelCallback | undefined;
  private mInstanceId: string;

  get instanceId(): string {
    return this.mInstanceId;
  }

  get api(): IExtensionApi {
    return this.mApi;
  }

  constructor(api: IExtensionApi, instanceId: string) {
    this.mApi = api;

    this.mInstanceId = instanceId;

    // Bind methods to avoid conflicts between multiple instances
    this.onDialogSelect = this.onDialogSelect.bind(this);
    this.onDialogContinue = this.onDialogContinue.bind(this);
    this.onDialogEnd = this.onDialogEnd.bind(this);

    // Use instance-specific event names to avoid conflicts
    api.events
      .on(`fomod-installer-select-${this.mInstanceId}`, this.onDialogSelect)
      .on(`fomod-installer-continue-${this.mInstanceId}`, this.onDialogContinue)
      .on(`fomod-installer-cancel-${this.mInstanceId}`, this.onDialogEnd);

    log('debug', 'Created DialogManager instance', { instanceId: this.mInstanceId });
  }

  public detach() {
    log('debug', 'Detaching DialogManager instance', { instanceId: this.mInstanceId });

    this.api.store.dispatch(endDialog(this.mInstanceId));

    // Process any queued dialog requests
    DialogManager.dialogQueue.onDialogEnd(this.api.store);

    this.api.events
      .removeListener(`fomod-installer-select-${this.mInstanceId}`, this.onDialogSelect)
      .removeListener(`fomod-installer-continue-${this.mInstanceId}`, this.onDialogContinue)
      .removeListener(`fomod-installer-cancel-${this.mInstanceId}`, this.onDialogEnd);

    this.mContinueCB = this.mSelectCB = this.mCancelCB = undefined;

    if (this.mInstanceId !== null) {
      log('debug', 'Detaching DialogManager instance that had active dialog', {
        instanceId: this.mInstanceId,
        queueStatus: DialogManager.dialogQueue.getStatus(),
      });

      DialogManager.dialogQueue.onDialogEnd(this.api.store);
    }
  }

  /**
   * Start FOMOD dialog - queued to prevent multiple dialogs at once
   * This is the callback passed to the native ModInstaller
   */
  public startDialog = async (
    moduleName: string,
    image: vetypes.IHeaderImage,
    selectCallback: vetypes.SelectCallback,
    contCallback: vetypes.ContinueCallback,
    cancelCallback: vetypes.CancelCallback
  ): Promise<void> => {
    this.mSelectCB = selectCallback;
    this.mContinueCB = contCallback;
    this.mCancelCB = cancelCallback;

    const selectWrapped: StateCallback = (params) => selectCallback(params.stepId, params.groupId, params.plugins);
    const contWrapped: (direction: Direction, currentStepId: number) => void = (direction, currentStepId) => contCallback(direction === 'forward', currentStepId);
    const cancelWrapped: () => void = () => cancelCallback();

    const info: IInstallerInfo = {
      moduleName,
      image,
      select: selectWrapped,
      cont: contWrapped,
      cancel: cancelWrapped,
    };

    const errorCallback = (_err: Error) => {};

    await DialogManager.dialogQueue.addRequest(
      info,
      errorCallback,
      this
    );
  };

  /**
   * Immediately start dialog (called by queue processor)
   */
  public startDialogImmediate = (info: IInstallerInfo, callback: (err: any) => void) => {
    try {
      // Store callbacks for later use
      this.mSelectCB = (stepId, groupId, pluginIds) => info.select({stepId, groupId, plugins: pluginIds});
      this.mContinueCB = (forward, currentStepId) => info.cont(forward ? 'forward' : 'back', currentStepId);
      this.mCancelCB = () => info.cancel();

      this.api.store.dispatch(startDialog(info, this.mInstanceId));
    } catch (err) {
      log('error', 'Failed to start FOMOD dialog', {
        moduleName: info.moduleName,
        error: err.message,
      });
      showError(this.api.store.dispatch, 'start installer dialog failed', err);
      throw err;
    }
  };

  /**
   * End FOMOD dialog
   * This is the callback passed to the native ModInstaller
   */
  public endDialog = async (): Promise<void> => {
    // Unset the callbacks to prevent memory leaks
    this.mContinueCB = this.mSelectCB = this.mCancelCB = undefined;
  };

  /**
   * Update dialog state with new steps
   * This is the callback passed to the native ModInstaller
   */
  public updateState = async (
    installSteps: vetypes.IInstallStep[],
    currentStep: number
  ): Promise<void> => {
    try {
      // Convert native types to shared types for Redux
      const state: IInstallerState = {
        installSteps: installSteps.map((step) => this.convertInstallStep(step)),
        currentStep,
      };

      this.api.store.dispatch(setDialogState(state, this.mInstanceId));
    } catch (err) {
      showError(this.api.store.dispatch, 'update installer dialog failed', err);
      throw err;
    }
  };

  /**
   * Convert native IInstallStep to shared IInstallStep format
   */
  private convertInstallStep(nativeStep: vetypes.IInstallStep): IInstallStep {
    return {
      id: nativeStep.id,
      name: nativeStep.name,
      visible: nativeStep.visible,
      optionalFileGroups: nativeStep.optionalFileGroups
        ? {
            group: nativeStep.optionalFileGroups.group.map((g) => ({
              id: g.id,
              name: g.name,
              type: g.type,
              options: g.options.map((opt) => ({
                id: opt.id,
                selected: opt.selected,
                preset: opt.preset,
                name: opt.name,
                description: opt.description,
                image: opt.image,
                type: opt.type,
                conditionMsg: opt.conditionMsg,
              })),
            })),
            order: nativeStep.optionalFileGroups.order,
          }
        : undefined,
    };
  }

  /**
   * Event handler: User selected options in the dialog
   */
  private onDialogSelect = (stepId: string, groupId: string, pluginIds: string[]) => {
    if (this.mSelectCB !== undefined) {
      const stepIdNum = parseInt(stepId, 10);
      const groupIdNum = parseInt(groupId, 10);
      const pluginIdsNum = pluginIds.map((id) => parseInt(id, 10));

      this.mSelectCB(stepIdNum, groupIdNum, pluginIdsNum);
    }
  };

  /**
   * Event handler: User clicked continue/back in the dialog
   */
  private onDialogContinue = (direction: string, currentStepId: number) => {
    if (this.mContinueCB !== undefined) {
      // I hate you, 'finish', you little shit
      const forward = direction === 'forward' || direction === 'finish';

      this.mContinueCB(forward, currentStepId);
    }
  };

  /**
   * Event handler: User cancelled the dialog
   */
  private onDialogEnd = () => {
    if (this.mCancelCB !== undefined) {
      this.mCancelCB();
    }

    DialogManager.dialogQueue.onDialogEnd(this.api.store);
  };
}

export default DialogManager;
