const StepTypeList = ['commandline', 'hydrate', 'setgame', 'installmod', 'restart', 'login_nexus'] as const;

export type PresetStepType = typeof StepTypeList[number];

export interface IPresetStepBase {
  type: PresetStepType;
  id: string;
}

export interface ICommandLineArg {
  key: string;
  value?: any;
}

export interface IPresetStepLoginNexus extends IPresetStepBase {
  type: 'login_nexus';
}

export interface IPresetStepCommandLine extends IPresetStepBase {
  type: 'commandline';
  arguments: ICommandLineArg[];
}

export interface IPresetStepHydrateState extends IPresetStepBase {
  type: 'hydrate';
  state: any;
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
                        | IPresetStepRestart
                        | IPresetStepLoginNexus;

export interface IPresetState {
  completed: string[];
  data: any;
}

export interface IPreset {
  steps: IPresetStep[];
}

export interface IPresetsState {
  presets: { [presetId: string]: IPresetState };
  processing?: string;
}
