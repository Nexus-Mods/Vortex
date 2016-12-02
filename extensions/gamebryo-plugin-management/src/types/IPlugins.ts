export interface IPlugin {
  modName?: string;
  filePath?: string;
};

export type IPlugins = { [fileName: string]: IPlugin };
