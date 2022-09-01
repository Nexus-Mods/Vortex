import { ipcMain, ipcRenderer } from 'electron';
import * as path from 'path';

import { IState } from '../types/IState';

import * as fs from './fs';
import getVortexPath from './getVortexPath';
import { log } from './log';

const StepTypeList = ['commandline', 'hydrate', 'setgame', 'installmod', 'restart'] as const;

export type PresetStepType = typeof StepTypeList[number];

export interface IPresetStepBase {
  type: PresetStepType;
  id: string;
}

export interface ICommandLineArg {
  key: string;
  value?: any;
}

export interface IPresetStepCommandLine extends IPresetStepBase {
  type: 'commandline';
  arguments: ICommandLineArg[];
}

export interface IPresetStepHydrateState extends IPresetStepBase {
  type: 'hydrate';
  state: IState;
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

export type IPresetStep = IPresetStepCommandLine
                        | IPresetStepInstallMod
                        | IPresetStepHydrateState
                        | IPresetStepSetGame
                        | IPresetStepCommandLine;

interface IPresetState {
  completed: string[];
  data: any;
}

interface IPresetsState {
  presets: { [presetId: string]: IPresetState };
  processing: string;
}

type StepCB = (step: IPresetStep, data: any) => PromiseLike<void>;

class PresetManager {
  private mPresets: { [presetId: string]: IPresetStep[] } = {};
  private mState: IPresetsState = { presets: {}, processing: undefined };
  private mStepHandlers: Map<PresetStepType, StepCB> = new Map();

  private mStatePath: string;

  private mError: Error;

  constructor() {
    this.readPresets();
    this.setupState();
  }

  public readPresets() {
    const packagePath = getVortexPath('package');

    const basePath: string = (packagePath === getVortexPath('application'))
      ? path.join(packagePath, 'presets')
      : path.resolve(packagePath, '..', 'presets');

    let presetFiles: string[] = [];
    
    try {
      presetFiles = fs.readdirSync(basePath).filter(fileName => path.extname(fileName) === '.json');
    } catch (err) {
      log((err.code === 'ENOENT') ? 'debug' : 'error', 'no preset files', { basePath, error: err.message });
    }

    log('debug', 'reading preset files', { path: basePath, count: presetFiles.length });

    presetFiles.forEach(presetFile => {
      // has to be synchronous, for the purpose of supporting command line instructions,
      // we have to be able to process this before electron is initialized and for all
      // intends and purposes that has begun the moment Vortex was started.
      const presetPath = path.join(basePath, presetFile);
      try {
        const presetId = path.basename(presetFile, '.json');
        this.mPresets[presetId] = JSON.parse(fs.readFileSync(presetPath, { encoding: 'utf-8' }));
      } catch (err) {
        log('error', 'failed to read prest', { error: err.message });
        if (err.code !== 'ENOENT') {
          this.mError = err;
          return;
        }
        // ENOENT, meaning there is no preset, is fine
      }
    });
  }

  public setupState() {
    // we can't store this state in the regular application state because
    // to support command line instructions this state has to be available well before the store
    // is loaded
    this.mStatePath = path.resolve(getVortexPath('appData'), 'vortex', 'presetState.json');
    log('debug', 'read preset state', { statePath: this.mStatePath });
    this.readState();

    if (this.mState.presets === undefined) {
      this.mState.presets = {};
    }

    Object.keys(this.mPresets).forEach(presetId => {
      if (this.mState.presets[presetId] === undefined) {
        this.mState.presets[presetId] = { completed: [], data: {} };
      }
    });

    if (ipcMain !== undefined) {
      ipcMain.handle('presetmanager-next', async () => {
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
    log('debug', 'install preset handler', { step: stepType });
    this.mStepHandlers.set(stepType, cb);
  }

  private async invoke(presetId: string,
                       stepId: string,
                       cb: StepCB = undefined,
                       forwarded: boolean = false): Promise<boolean> {
    const step: IPresetStep = this.stepById(presetId, stepId);

    if (cb === undefined) {
      if (!this.mStepHandlers.has(step.type)) {
        log('info', 'no handler found', { type: step.type, handlers: this.mStepHandlers.keys() });
        return false;
      }

      cb = this.mStepHandlers.get(step.type);
    }

    log('info', 'processing preset step', { presetId, stepId });
    try {
      // the callback may change the data object as a side effect
      await cb(step, this.mState.presets[presetId].data);
      log('info', 'done processing preset step', { step, forwarded });
    } catch (err) {
      log('error', 'preset step failed', { step: JSON.stringify(step), error: err.message, process: process.type });
      return true;
    }
    try {
      this.mState.presets[presetId].completed.push(stepId);
      this.writeState();
    } catch (err) {
      log('error', 'failed to update preset state', { erorr: err.message });
      return true;
    }

    if (!forwarded) {
      this.processNext();
    }
    return true;
  }

  private nextStepInPreset(presetId: string): string {
    if ((presetId === undefined)
        || (this.mPresets[presetId] === undefined)) {
      // if not processing anything yet or if that preset has disappeared
      return undefined;
    }

    // return first step that has not yet been completed
    const incompleteStep = this.mPresets[presetId].find(step =>
      !((this.mState.presets[presetId]?.completed ?? []).includes(step.id)));
    return incompleteStep?.id;
  }

  private nextIncompletePreset(): string {
    // find a preset with incomplete steps
    return Object.keys(this.mPresets)
      .find(presetId =>
        this.mPresets[presetId].find(step =>
          !this.mState.presets[presetId].completed.includes(step.id)) !== undefined);
  }

  private async writeState() {
    await fs.writeFileAsync(this.mStatePath, JSON.stringify(this.mState, undefined, 2), { encoding: 'utf-8' });
  }

  private nextStep(): { presetId: string, stepId: string } {
    let { processing } = this.mState;
    let nextStepId = this.nextStepInPreset(processing);

    if (nextStepId === undefined) {
      processing = this.mState.processing = this.nextIncompletePreset();
      if (processing !== undefined) {
        nextStepId = this.nextStepInPreset(processing);
      }
    }

    return { presetId: processing, stepId: nextStepId };
  }

  private stepById(presetId: string, stepId: string): IPresetStep {
    return this.mPresets[presetId].find(step => step.id === stepId);
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
      await ipcRenderer.invoke('presetmanager-next');
      this.readState();
    }
  }

  private readState() {
    try {
      this.mState = JSON.parse(fs.readFileSync(this.mStatePath, { encoding: 'utf-8' }));
    } catch (err) {
      if (err.code !== 'ENOENT') {
        log('error', 'failed to read preset state', { error: err.message });
        this.mError = err;
        return;
      }
      // ENOENT, meaning there is no preset, is fine
    }
  }
}

const instance = new PresetManager();

export default instance;
