import type { IExtensionApi } from "../../../renderer/types/api";
import lazyRequire from "../../../util/lazyRequire";
import { log } from "../../../util/log";
import { DialogManager } from "./DialogManager";
import { SharedDelegates } from "../../installer_fomod_shared/delegates/SharedDelegates";

import type * as fomodT from "fomod-installer-native";

export class VortexModInstaller {
  public static async create(
    api: IExtensionApi,
    instanceId: string,
    gameId: string,
  ): Promise<VortexModInstaller> {
    const delegates = new VortexModInstaller(api, instanceId, gameId);
    await delegates.initialize();
    return delegates;
  }

  private fomod: typeof fomodT;
  private mModInstaller: fomodT.NativeModInstaller;
  private mApi: IExtensionApi;
  private mInstanceId: string;
  private mGameId: string;
  private mScriptPath: string;
  private mDialogManager: DialogManager | undefined;
  private mSharedDelegates: SharedDelegates;

  private constructor(api: IExtensionApi, instanceId: string, gameId: string) {
    this.fomod = lazyRequire<typeof fomodT>(() =>
      require("fomod-installer-native"),
    );
    this.mModInstaller = new this.fomod.NativeModInstaller(
      this.pluginsGetAllAsync,
      this.contextGetAppVersionAsync,
      this.contextGetCurrentGameVersionAsync,
      this.contextGetExtenderVersionAsync,
      this.uiStartDialog,
      this.uiEndDialog,
      this.uiUpdateState,
    );

    this.mApi = api;
    this.mInstanceId = instanceId;
    this.mGameId = gameId;
  }

  private async initialize(): Promise<void> {
    this.mSharedDelegates = await SharedDelegates.create(
      this.mApi,
      this.mGameId,
    );
  }

  public dispose() {
    log("debug", "Disposing VortexModInstaller", {
      instanceId: this.mInstanceId,
    });
    this.mDialogManager?.dispose();
    this.mDialogManager = undefined;
  }

  /**
   * Calls FOMOD's install and converts the result to Vortex data
   */
  public installAsync = async (
    files: string[],
    stopPatterns: string[],
    pluginPath: string,
    scriptPath: string,
    preset: any,
    validate: boolean,
  ): Promise<fomodT.types.InstallResult | null> => {
    this.mScriptPath = scriptPath;
    return await this.mModInstaller.install(
      files,
      stopPatterns,
      pluginPath,
      scriptPath,
      preset,
      validate,
    );
  };

  /**
   * Callback
   */
  private pluginsGetAllAsync = (activeOnly: boolean): string[] => {
    return this.mSharedDelegates.getAllPlugins(activeOnly);
  };

  /**
   * Callback
   */
  private contextGetAppVersionAsync = (): string => {
    return this.mSharedDelegates.getAppVersion();
  };

  /**
   * Callback
   */
  private contextGetCurrentGameVersionAsync = (): string => {
    return this.mSharedDelegates.getCurrentGameVersion();
  };

  /**
   * Callback
   */
  private contextGetExtenderVersionAsync = (extender: string): string => {
    return this.mSharedDelegates.getExtenderVersion(extender);
  };

  /**
   * Callback for starting FOMOD dialog
   * Delegates to DialogManager instance
   */
  private uiStartDialog = (
    moduleName: string,
    image: fomodT.types.IHeaderImage,
    selectCallback: fomodT.types.SelectCallback,
    contCallback: fomodT.types.ContinueCallback,
    cancelCallback: fomodT.types.CancelCallback,
  ): void => {
    log("debug", "Starting FOMOD dialog", { instanceId: this.mInstanceId });
    this.mDialogManager = new DialogManager(
      this.mApi,
      this.mInstanceId,
      this.mScriptPath,
    );
    this.mDialogManager.enqueueDialog(
      moduleName,
      image,
      selectCallback,
      contCallback,
      cancelCallback,
    );
  };

  /**
   * Callback for updating FOMOD dialog state
   * Delegates to DialogManager instance
   */
  private uiUpdateState = (
    installSteps: fomodT.types.IInstallStep[],
    currentStepId: number,
  ): void => {
    if (!this.mDialogManager) {
      throw new Error("DialogManager not initialized");
    }

    // https://github.com/Nexus-Mods/NexusMods.App/blob/e6b99cff84443ce78081caefda7ffcd4ffc184a9/src/NexusMods.Games.FOMOD/CoreDelegates/UiDelegate.cs#L108-L109
    if (currentStepId < 0 || currentStepId >= installSteps.length) {
      return;
      //throw new Error('Invalid current step ID');
    }

    log("debug", "Updating FOMOD dialog state", {
      instanceId: this.mInstanceId,
      currentStepId,
      totalSteps: installSteps.length,
    });
    this.mDialogManager.updateDialogState(installSteps, currentStepId);
  };

  /**
   * Callback for ending FOMOD dialog
   * Delegates to DialogManager instance
   */
  private uiEndDialog = (): void => {
    if (!this.mDialogManager) {
      log("debug", "Ending FOMOD dialog - already disposed", {
        instanceId: this.mInstanceId,
      });
      throw new Error("DialogManager not initialized");
    }

    log("debug", "Ending FOMOD dialog", { instanceId: this.mInstanceId });

    this.mDialogManager.endDialog();
  };
}
