export interface IPluginState {
  enabled: boolean;
  loadOrder: number;
  mod: string;
  filePath: string;
};

export type IPluginStates = { [fileName: string]: IPluginState };
