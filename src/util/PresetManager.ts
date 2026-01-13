import { ipcMain, ipcRenderer } from "electron";
import * as path from "path";
import { IExtensionApi } from "../types/IExtensionContext";

import {
  IPreset,
  IPresetsState,
  IPresetStep,
  PresetStepType,
} from "../types/IPreset";

import { iPresetSchema, iPresetsStateSchema } from "../types/IPreset.gen";
import { makeRemoteCallSync } from "./electronRemote";

import * as fs from "./fs";
import getVortexPath from "./getVortexPath";
import { log } from "./log";
import {
  getErrorMessage,
  getErrorCode,
  unknownToError,
} from "../shared/errors";

const getAppName = makeRemoteCallSync("get-application-name", (electron) =>
  electron.app.getName(),
);

type StepCB = (step: IPresetStep, data: unknown) => PromiseLike<void>;

function validatePreset(input: unknown): IPreset {
  const result = iPresetSchema.parse(input);
  return result;
}

function validateState(input: unknown): IPresetsState {
  const result = iPresetsStateSchema.parse(input);
  return result;
}

class PresetManager {
  private mPresets: { [presetId: string]: IPreset } = {};
  private mState: IPresetsState = { presets: {}, processing: undefined };
  private mStepHandlers: Map<PresetStepType, StepCB> = new Map();

  private mStatePath: string;

  private mError: Error;
  private mApi: IExtensionApi;

  constructor() {
    this.readPresets();
    this.setupState();
  }

  public setApi(api: IExtensionApi) {
    this.mApi = api;
  }

  public readPresets() {
    const packagePath = getVortexPath("package");

    const basePath: string =
      packagePath === getVortexPath("application")
        ? path.join(packagePath, "presets")
        : path.resolve(packagePath, "..", "presets");

    let presetFiles: string[] = [];

    try {
      presetFiles = fs
        .readdirSync(basePath)
        .filter((fileName) => path.extname(fileName) === ".json")
        .sort();
    } catch (err) {
      const code = getErrorCode(err);
      log(code === "ENOENT" ? "debug" : "error", "no preset files", {
        basePath,
        error: getErrorMessage(err) ?? "unknown error",
      });
    }

    log("debug", "reading preset files", {
      path: basePath,
      count: presetFiles.length,
    });

    presetFiles.forEach((presetFile) => {
      // has to be synchronous, for the purpose of supporting command line instructions,
      // we have to be able to process this before electron is initialized and for all
      // intends and purposes that has begun the moment Vortex was started.
      const presetPath = path.join(basePath, presetFile);
      try {
        const presetId = path.basename(presetFile, ".json");
        const presetData = validatePreset(
          JSON.parse(fs.readFileSync(presetPath, { encoding: "utf-8" })),
        );
        this.mPresets[presetId] = presetData;
      } catch (err) {
        const code = getErrorCode(err);
        const error = unknownToError(err);
        // ENOENT, meaning there is no preset, is fine
        if (code !== "ENOENT") {
          log("error", "failed to read preset", {
            presetFile,
            error: error.message,
          });
          this.mError = error;
          return;
        }
      }
    });
  }

  public setupState() {
    // we can't store this state in the regular application state because
    // to support command line instructions this state has to be available well before the store
    // is loaded
    this.mStatePath = path.resolve(
      getVortexPath("appData"),
      getAppName(),
      "presetState.json",
    );
    log("debug", "read preset state", { statePath: this.mStatePath });
    this.readState();

    if (this.mState.presets === undefined) {
      this.mState.presets = {};
    }

    this.presetIds().forEach((presetId) => {
      if (this.mState.presets[presetId] === undefined) {
        this.mState.presets[presetId] = { completed: [], data: {} };
      }
    });

    if (ipcMain !== undefined) {
      ipcMain.handle("presetmanager-next", async () => {
        // update state because we know the renderer process has changed it
        this.readState();

        const { presetId, stepId } = this.nextStep();
        const step = this.stepById(presetId, stepId);
        if (this.mStepHandlers.has(step.type)) {
          return await this.invoke(presetId, stepId, undefined, true);
        }
        return Promise.resolve();
      });
    }
  }

  public get error(): Error {
    return this.mError;
  }

  public start() {
    this.processNext();
  }

  /**
   * immediately process a preset step.
   * This can be used to process items during startup but one has
   * to be careful to not trigger an access to uninitialized data.
   * Ideally this should be limited to injecting command-line parameters only.
   */
  public now(stepType: PresetStepType, cb: StepCB): boolean {
    const { presetId, stepId } = this.nextStep();
    if (stepId !== undefined) {
      const step: IPresetStep = this.stepById(presetId, stepId);
      if (step.type === stepType) {
        this.invoke(presetId, stepId, cb);
        return true;
      }
    }
    return false;
  }

  /**
   * set up handler for a preset step. Actual processing will happen once "start"
   * gets called
   */
  public on(stepType: PresetStepType, cb: StepCB) {
    log("debug", "install preset handler", { step: stepType });
    this.mStepHandlers.set(stepType, cb);
  }

  private async invoke(
    presetId: string,
    stepId: string,
    cb: StepCB = undefined,
    forwarded: boolean = false,
  ): Promise<boolean> {
    const step: IPresetStep = this.stepById(presetId, stepId);

    if (cb === undefined) {
      if (!this.mStepHandlers.has(step.type)) {
        log("info", "no handler found", {
          type: step.type,
          handlers: this.mStepHandlers.keys(),
        });
        return false;
      }

      cb = this.mStepHandlers.get(step.type);
    }

    log("info", "processing preset step", { presetId, stepId });
    try {
      // the callback may change the data object as a side effect
      await cb(step, this.mState.presets[presetId].data);
      log("info", "done processing preset step", { step, forwarded });
    } catch (err) {
      log("error", "preset step failed", {
        step: JSON.stringify(step),
        error: getErrorMessage(err) ?? "unknown error",
        process: process.type,
      });
      this.mApi?.sendNotification?.({
        type: "warning",
        message: "Automatic setup interrupted",
        noDismiss: true,
        actions: [
          {
            title: "More",
            action: () => {
              this.mApi
                .showDialog(
                  "info",
                  "Automatic setup interrupted",
                  {
                    text:
                      "Your copy of Vortex is set up to run a sequence of setup steps on startup. " +
                      "Since one step failed, that sequence was interrupted. " +
                      "If you have resolved the issue you can retry the failed step.",
                  },
                  [{ label: "Close" }, { label: "Retry" }],
                )
                .then((result) => {
                  if (result.action === "Retry") {
                    this.processNext();
                  } else {
                    return Promise.resolve();
                  }
                });
            },
          },
        ],
      });
      return true;
    }
    try {
      this.mState.presets[presetId].completed.push(stepId);
      this.writeState();
    } catch (err) {
      log("error", "failed to update preset state", {
        erorr: getErrorMessage(err) ?? "unknown error",
      });
      return true;
    }

    if (!forwarded) {
      this.processNext();
    }
    return true;
  }

  private nextStepInPreset(presetId: string): string {
    if (presetId === undefined || this.mPresets[presetId] === undefined) {
      // if not processing anything yet or if that preset has disappeared
      return undefined;
    }

    // return first step that has not yet been completed
    const incompleteStep = this.mPresets[presetId].steps.find(
      (step) =>
        !(this.mState.presets[presetId]?.completed ?? []).includes(step.id),
    );
    return incompleteStep?.id;
  }

  private presetIds(): string[] {
    return Object.keys(this.mPresets).sort();
  }

  private nextIncompletePreset(): string {
    log(
      "info",
      "next incomplete preset",
      this.mState.processing ?? "not yet set",
    );
    // find a preset with incomplete steps
    return this.presetIds().find(
      (presetId) =>
        this.mPresets[presetId].steps.find(
          (step) => !this.mState.presets[presetId].completed.includes(step.id),
        ) !== undefined,
    );
  }

  private async writeState() {
    await fs.writeFileAsync(
      this.mStatePath,
      JSON.stringify(this.mState, undefined, 2),
      { encoding: "utf-8" },
    );
  }

  private nextStep(): { presetId: string; stepId: string } {
    let { processing } = this.mState;
    let nextStepId = this.nextStepInPreset(processing);
    log("info", "next step", { processing, nextStepId });

    if (nextStepId === undefined) {
      processing = this.mState.processing = this.nextIncompletePreset();
      if (processing !== undefined) {
        nextStepId = this.nextStepInPreset(processing);
      }
    }

    return { presetId: processing, stepId: nextStepId };
  }

  private stepById(presetId: string, stepId: string): IPresetStep {
    return this.mPresets[presetId].steps.find((step) => step.id === stepId);
  }

  private async processNext() {
    const { presetId, stepId } = this.nextStep();

    if (stepId === undefined) {
      return;
    }

    if (!(await this.invoke(presetId, stepId))) {
      // if we don't have a handler for this next step, maybe the other process does
      await this.forward();
    }
  }

  private async forward() {
    if (ipcRenderer !== undefined) {
      await ipcRenderer.invoke("presetmanager-next");
      this.readState();
    }
  }

  private readState() {
    try {
      this.mState = validateState(
        JSON.parse(fs.readFileSync(this.mStatePath, { encoding: "utf-8" })),
      );
    } catch (err) {
      const code = getErrorCode(err);
      const error = unknownToError(err);
      if (code !== "ENOENT") {
        log("error", "failed to read preset state", { error: error.message });
        this.mError = error;
        return;
      }
      // ENOENT, meaning there is no state yet, that is fine
    }
  }
}

const instance = new PresetManager();

export default instance;
