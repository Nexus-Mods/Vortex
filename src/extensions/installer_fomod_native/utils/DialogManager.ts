import { types as vetypes } from '@nexusmods/modinstaller';

import { IExtensionApi } from '../../../types/IExtensionContext';
import { log } from '../../../util/log';
import { showError } from '../../../util/message';

import { DialogQueue } from './DialogQueue';

import {
  endDialog,
  setDialogState,
  startDialog,
} from '../../installer_fomod_shared/actions/installerUI';
import {
  IInstallerInfo,
  IInstallerState,
  IInstallStep,
} from '../../installer_fomod_shared/types/interface';

import DelegateBase from '../delegates/DelegateBase';


/**
 * UI Delegate for native FOMOD installer
 * Manages dialog state and user interactions through Redux store
 *
 * Key differences from IPC version:
 * - Native callbacks use direct function calls instead of IPC
 * - Callbacks have simpler signatures (no wrapper objects)
 * - Still uses Redux for UI state management (shared with IPC version)
 */
export class DialogManager extends DelegateBase {
  private mSelectCB: vetypes.SelectCallback | undefined;
  private mContinueCB: vetypes.ContinueCallback | undefined;
  private mCancelCB: vetypes.CancelCallback | undefined;
  private mUnattended: boolean;
  private mInstanceId: string;
  private static dialogQueue = DialogQueue.getInstance();

  get instanceId(): string {
    return this.mInstanceId;
  }

  constructor(api: IExtensionApi, unattended: boolean, instanceId: string) {
    super(api);

    this.mUnattended = unattended;
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

    await DialogManager.dialogQueue.addRequest(
      moduleName,
      image,
      selectCallback,
      contCallback,
      cancelCallback,
      this,
      this.api.store
    );
  };

  /**
   * Immediately start dialog (called by queue processor)
   */
  public startDialogImmediate = (
    moduleName: string,
    image: vetypes.IHeaderImage,
    selectCallback: vetypes.SelectCallback,
    contCallback: vetypes.ContinueCallback,
    cancelCallback: vetypes.CancelCallback
  ) => {
    try {
      // Store callbacks for later use
      this.mSelectCB = selectCallback;
      this.mContinueCB = contCallback;
      this.mCancelCB = cancelCallback;

      if (!this.mUnattended) {
        // Convert native types to shared types for Redux
        const info: IInstallerInfo = {
          moduleName,
          image: {
            path: image.path,
            showFade: image.showFade,
            height: image.height,
          },
          // Note: select, cont, cancel are not needed here as we handle callbacks internally
        };

        this.api.store.dispatch(startDialog(info, this.mInstanceId));
      }
    } catch (err) {
      log('error', 'Failed to start FOMOD dialog', {
        moduleName,
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

      // Auto-continue in unattended mode
      if (this.mUnattended && this.mContinueCB !== undefined) {
        this.mContinueCB(true, currentStep); // forward = true
      }
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
      // Native callback signature: (stepId: number, groupId: number, optionId: number[])
      this.mSelectCB(
        parseInt(stepId, 10),
        parseInt(groupId, 10),
        pluginIds.map((id) => parseInt(id, 10))
      );
    }
  };

  /**
   * Event handler: User clicked continue/back in the dialog
   */
  private onDialogContinue = (direction: string, currentStepId: number) => {
    if (this.mContinueCB !== undefined) {
      // Native callback signature: (forward: boolean, currentStepId: number)
      const forward = direction === 'forward';
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
