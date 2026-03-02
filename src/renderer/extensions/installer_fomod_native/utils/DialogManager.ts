import type { IExtensionApi } from "../../../types/IExtensionContext";
import { log } from "../../../util/log";
import { showError } from "../../../util/message";

import type { IDialogManager } from "../../installer_fomod_shared/utils/DialogQueue";
import { DialogQueue } from "../../installer_fomod_shared/utils/DialogQueue";

import {
  clearDialog,
  endDialog,
  setDialogState,
  startDialog,
} from "../../installer_fomod_shared/actions/installerUI";
import type {
  IHeaderImage,
  IInstallerState,
  IInstallStep,
} from "../../installer_fomod_shared/types/interface";

import type * as fomodT from "fomod-installer-native";
import { getErrorMessageOrDefault } from "@vortex/shared";

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
  private mApi: IExtensionApi;
  private mInstanceId: string;

  private mSelectCB: fomodT.types.SelectCallback | undefined;
  private mContinueCB: fomodT.types.ContinueCallback | undefined;
  private mCancelCB: fomodT.types.CancelCallback | undefined;
  private mModuleName: string;
  private mImage: IHeaderImage;
  private mScriptPath: string;

  public get instanceId(): string {
    return this.mInstanceId;
  }

  public get api(): IExtensionApi {
    return this.mApi;
  }

  public constructor(
    api: IExtensionApi,
    instanceId: string,
    scriptPath: string,
  ) {
    this.mApi = api;
    this.mInstanceId = instanceId;
    this.mScriptPath = scriptPath;

    log("debug", "Created DialogManager instance", {
      instanceId: this.mInstanceId,
    });
  }

  public dispose = () => {
    this.mApi.store?.dispatch(clearDialog(this.mInstanceId));
  };

  /**
   * Start FOMOD dialog - queued to prevent multiple dialogs at once
   * This is the callback passed to the native ModInstaller
   */
  public enqueueDialog = (
    moduleName: string,
    image: fomodT.types.IHeaderImage,
    selectCallback: fomodT.types.SelectCallback,
    contCallback: fomodT.types.ContinueCallback,
    cancelCallback: fomodT.types.CancelCallback,
  ): void => {
    log("debug", "Queuing FOMOD dialog", {
      instanceId: this.mInstanceId,
      moduleName,
    });

    try {
      this.mSelectCB = selectCallback;
      this.mContinueCB = contCallback;
      this.mCancelCB = cancelCallback;
      this.mModuleName = moduleName;
      this.mImage = image;

      const dialogQueue = DialogQueue.getInstance(this.mApi);
      dialogQueue.enqueueDialog(this);
    } catch (err) {
      log("error", "Failed to queue FOMOD dialog", {
        instanceId: this.mInstanceId,
        moduleName,
        image,
        error: getErrorMessageOrDefault(err),
      });
      showError(this.mApi.store.dispatch, "queue installer dialog failed", err);
      throw err;
    }
  };

  /**
   * Update dialog state with new steps
   * This is the callback passed to the native ModInstaller
   */
  public updateDialogState = (
    installSteps: fomodT.types.IInstallStep[],
    currentStep: number,
  ): void => {
    log("debug", "Updating FOMOD dialog state", {
      instanceId: this.mInstanceId,
      currentStep,
      totalSteps: installSteps.length,
    });

    try {
      // Convert native types to shared types for Redux
      const state: IInstallerState = {
        installSteps: installSteps.map((step) => convertInstallStep(step)),
        currentStep,
      };

      this.mApi.store.dispatch(setDialogState(state, this.mInstanceId));

      const dialogQueue = DialogQueue.getInstance(this.mApi);
      dialogQueue.processNext();
    } catch (err) {
      log("error", "Failed to update FOMOD dialog state", {
        instanceId: this.mInstanceId,
        currentStep,
        installSteps,
        error: getErrorMessageOrDefault(err),
      });
      showError(
        this.mApi.store.dispatch,
        "update installer dialog failed",
        err,
      );
      throw err;
    }
  };

  /**
   * End FOMOD dialog
   * This is the callback passed to the native ModInstaller
   */
  public endDialog = (): void => {
    log("debug", "Ending FOMOD dialog", { instanceId: this.mInstanceId });

    try {
      this.mApi.store.dispatch(endDialog(this.mInstanceId));

      this.mApi.events
        .removeListener(
          `fomod-installer-select-${this.mInstanceId}`,
          this.onDialogSelect,
        )
        .removeListener(
          `fomod-installer-continue-${this.mInstanceId}`,
          this.onDialogContinue,
        )
        .removeListener(
          `fomod-installer-cancel-${this.mInstanceId}`,
          this.onDialogEnd,
        );

      this.mContinueCB = this.mSelectCB = this.mCancelCB = undefined;

      const dialogQueue = DialogQueue.getInstance(this.mApi);
      dialogQueue.onDialogEnd(this.mInstanceId);
    } catch (err) {
      log("error", "Failed to end FOMOD dialog", {
        instanceId: this.mInstanceId,
        error: getErrorMessageOrDefault(err),
      });
      showError(this.mApi.store.dispatch, "end installer dialog failed", err);
      throw err;
    }
  };

  /**
   * Immediately start dialog (called by queue processor)
   */
  public startDialogImmediate = () => {
    log("debug", "Starting FOMOD dialog immediately", {
      instanceId: this.mInstanceId,
      moduleName: this.mModuleName,
    });

    try {
      this.mApi.events
        .on(`fomod-installer-select-${this.mInstanceId}`, this.onDialogSelect)
        .on(
          `fomod-installer-continue-${this.mInstanceId}`,
          this.onDialogContinue,
        )
        .on(`fomod-installer-cancel-${this.mInstanceId}`, this.onDialogEnd);

      this.mApi.store.dispatch(
        startDialog(
          {
            moduleName: this.mModuleName,
            image: this.mImage,
            dataPath: this.mScriptPath,
          },
          this.mInstanceId,
        ),
      );
    } catch (err) {
      log("error", "Failed to start FOMOD dialog immediately", {
        instanceId: this.mInstanceId,
        error: getErrorMessageOrDefault(err),
      });
      showError(this.mApi.store.dispatch, "start installer dialog failed", err);
      throw err;
    }
  };

  public cancelDialogImmediate = () => {
    log("debug", "Cancelling FOMOD dialog immediately", {
      instanceId: this.mInstanceId,
    });
    this.onDialogEnd();
  };

  /**
   * Event handler: User selected options in the dialog
   */
  private onDialogSelect = (
    stepId: string,
    groupId: string,
    pluginIds: string[],
  ) => {
    log("debug", "User selected options in FOMOD dialog", {
      instanceId: this.mInstanceId,
      stepId,
      groupId,
      pluginIds,
    });

    try {
      const stepIdNum = parseInt(stepId, 10);
      const groupIdNum = parseInt(groupId, 10);
      const pluginIdsNum = pluginIds.map((id) => parseInt(id, 10));
      this.mSelectCB?.(stepIdNum, groupIdNum, pluginIdsNum);
    } catch (err) {
      log("error", "Failed to process FOMOD dialog selection", {
        instanceId: this.mInstanceId,
        stepId,
        groupId,
        pluginIds,
        error: getErrorMessageOrDefault(err),
      });
      showError(
        this.mApi.store.dispatch,
        "select installer dialog failed",
        err,
      );
      throw err;
    }
  };

  /**
   * Event handler: User clicked continue/back in the dialog
   */
  private onDialogContinue = (direction: string, currentStepId: number) => {
    log("debug", "User continued FOMOD dialog", {
      instanceId: this.mInstanceId,
      direction,
      currentStepId,
    });

    try {
      // I hate you, 'finish', you little shit
      const forward = direction === "forward" || direction === "finish";
      this.mContinueCB?.(forward, currentStepId);
    } catch (err) {
      log("error", "Failed to process FOMOD dialog continuation", {
        instanceId: this.mInstanceId,
        direction,
        currentStepId,
        error: getErrorMessageOrDefault(err),
      });
      showError(
        this.mApi.store.dispatch,
        "continue installer dialog failed",
        err,
      );
      throw err;
    }
  };

  /**
   * Event handler: User cancelled the dialog
   */
  private onDialogEnd = () => {
    log("debug", "User cancelled FOMOD dialog", {
      instanceId: this.mInstanceId,
    });

    try {
      this.mCancelCB?.();

      this.mApi.store.dispatch(endDialog(this.mInstanceId));

      const dialogQueue = DialogQueue.getInstance(this.mApi);
      dialogQueue.onDialogEnd(this.mInstanceId);
    } catch (err) {
      log("error", "Failed to process FOMOD dialog cancellation", {
        instanceId: this.mInstanceId,
        error: getErrorMessageOrDefault(err),
      });
      showError(
        this.mApi.store.dispatch,
        "cancel installer dialog failed",
        err,
      );
      throw err;
    }
  };
}

/**
 * Convert native IInstallStep to shared IInstallStep format
 */
const convertInstallStep = (
  nativeStep: fomodT.types.IInstallStep,
): IInstallStep => {
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
};

export default DialogManager;
