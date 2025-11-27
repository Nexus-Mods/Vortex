export interface IMetaInfo {
  creation: number;
}

export interface IModMetaInfo {
  name: string;
  version: string;
  modType?: string;
  deploymentMethod: string;
  deploymentTime: number;
  md5sum: string;
  archiveName: string;
  source: string;
  modId: string;
  fileId: string;
  managedGame: string;
  intendedGame: string;
}

export interface IFileEntry {
  path: string;
  deployed: boolean;
  overwrittenBy: string;
  md5sum: string;
  error?: string;
}

export interface IPluginEntry {
  name: string;
  enabled: boolean;
  loadOrder: number;
}

export interface ILoadOrderEntry {
  name: string;
  enabled: boolean;
  locked?: boolean;
  external?: boolean;
}

export interface IReport {
  info: IMetaInfo;
  mod: IModMetaInfo;
  installerChoices: any;
  files: IFileEntry[];
  plugins?: IPluginEntry[];
  loadOrder?: ILoadOrderEntry[];
}
