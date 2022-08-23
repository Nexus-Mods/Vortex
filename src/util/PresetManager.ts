import { ipcMain, ipcRenderer } from 'electron';
import * as path from 'path';

import * as fs from './fs';
import getVortexPath from './getVortexPath';
import { log } from './log';

const StepTypeList = ['commandline', 'setgame', 'installmod', 'restart'] as const;

export type PresetStepType = typeof StepTypeList[number];

export interface IPresetStepBase {
  type: PresetStepType;
}

export interface ICommandLineArg {
  key: string;
  value: any;
}

export interface IPresetStepCommandLine extends IPresetStepBase {
  type: 'commandline';
  arguments: ICommandLineArg[];
}

export interface IPresetStepSetGame extends IPresetStepBase {
  type: 'setgame';
  game: string;
}

export interface IPresetStepInstallMod extends IPresetStepBase {
  type: 'installmod';
  url: string;
}

export interface IPresetStepRestart extends IPresetStepBase {
  type: 'restart';
}

export type IPresetStep =
  IPresetStepCommandLine | IPresetStepInstallMod | IPresetStepSetGame | IPresetStepCommandLine;

interface IPresetState {
  step: number;
  data: any;
}

type StepCB = (step: IPresetStep, data: any) => PromiseLike<void>;

class PresetManager {
  private mPresets: IPresetStep[] = [];
  private mState: IPresetState = { step: 0, data: {} };
  private mStepHandlers: Map<PresetStepType, StepCB> = new Map();

  private mStatePath: string;

  private mError: Error;

  constructor() {
    // has to be synchronous, for the purpose of supporting command line instructions,
    // we have to be able to process this before electron is initialized and for all
    // intends and purposes that has started the moment Vortex was started.
    const presetPath = path.resolve(getVortexPath('package'), '..', 'vortex_preset.json');
    try {
      this.mPresets = JSON.parse(fs.readFileSync(presetPath, { encoding: 'utf-8' }));
    } catch (err) {
      if (err.code !== 'ENOENT') {
        this.mError = err;
        return;
      }
      // ENOENT, meaning there is no preset, is fine
    }

    // we can't store this state in the regular application state because
    // to support command line instructions this state has to be available well before the store
    // is loaded
    this.mStatePath = path.resolve(getVortexPath('appData'), 'vortex', 'presetState.json');
    this.readState();

    if (ipcMain !== undefined) {
      ipcMain.handle('presetmanager-next', async () => {
        // update state because we know the renderer process has changed it
        this.readState();
        this.mPresets[this.mState.step]
        if ((this.mState.step >= -1)
            && (this.mState.step < this.mPresets.length)
            && (this.mStepHandlers.has(this.mPresets[this.mState.step].type))) {
          return await this.invoke(this.mStepHandlers[this.mPresets[this.mState.step].type]);
        }
        return Promise.resolve();
      });
    }
  }

  public get error(): Error {
    return this.mError;
  }

  public start() {
    if ((this.mState.step >= 0)
        && (this.mState.step < this.mPresets.length)) {
      this.next();
    }
  }

  /**
   * immediately process a preset step.
   * This can be used to process items during startup but one has
   * to be careful to not trigger an access to uninitialized data.
   * Ideally this should be limited to injecting command-line parameters only.
   */
  public now(step: PresetStepType, cb: StepCB): boolean {
    if ((this.mState.step >= 0)
        && (this.mState.step < this.mPresets.length)
        && this.mPresets[this.mState.step].type === step) {
      this.invoke(cb);
      return true;
    }
    return false;
  }

  public on(step: PresetStepType, cb: StepCB) {
    log('info', 'install preset handler', {
      step, idx: this.mState.step, numSteps: this.mPresets.length,
      next: this.mPresets[this.mState.step]?.type });
    this.mStepHandlers.set(step, cb);
  }

  private async invoke(cb: (step: IPresetStep, data: any) => PromiseLike<void>,
                       forwarded: boolean = false) {
    const step = this.mPresets[this.mState.step];
    log('info', 'processing preset step', { step });
    try {
      await cb(step, this.mState);
      log('info', 'done processing preset step', { step, forwarded });
    } catch (err) {
      log('error', 'preset step failed', { step: JSON.stringify(step), error: err.message, process: process.type });
      return;
    }
    try {
      ++this.mState.step;
      if (this.mState.step >= this.mPresets.length) {
        this.mState.step = -1;
      }
      await fs.writeFileAsync(this.mStatePath, JSON.stringify(this.mState), { encoding: 'utf-8' });
    } catch (err) {
      log('error', 'failed to update preset state', { erorr: err.message });
      return;
    }

    if (!forwarded) {
      this.next();
    }
  }

  private async next() {
    if (this.mState.step >= 0) {
      if (this.mStepHandlers.has(this.mPresets[this.mState.step].type)) {
        this.invoke(this.mStepHandlers.get(this.mPresets[this.mState.step].type));
      } else {
        // if we don't have a handler for this next step, maybe the other process does
        await this.forward();
      }
    }
  }

  private async forward() {
    if (ipcRenderer !== undefined) {
      await ipcRenderer.invoke('presetmanager-next');
      this.readState();
    }
  }

  private readState() {
    try {
      this.mState = JSON.parse(fs.readFileSync(this.mStatePath, { encoding: 'utf-8' }));
    } catch (err) {
      log('error', 'failed to read preset state', { error: err.message });
      if (err.code !== 'ENOENT') {
        this.mError = err;
        return;
      }
      // ENOENT, meaning there is no preset, is fine
    }
  }
}

const instance = new PresetManager();

export default instance;
