export interface ISDVModManifest {
  Name: string;
  Author: string;
  Version: string;
  Description: string;
  UniqueID: string;
  EntryDll: string;
  MinimumApiVersion: string;
  UpdateKeys: string[];
  ContentPackFor?: ISDVDependency;
  Dependencies: ISDVDependency[]
}

export interface ISDVDependency {
  UniqueID: string;
  MinimumVersion?: string;
  IsRequired?: boolean;
}

export interface ISMAPIIOQuery {
  id: string;
  installedVersion?: string;
}

export const compatibilityOptions = [
  'broken', 'obsolete', 'abandoned', 'unofficial', 'workaround', 'unknown', 'optional', 'ok',
] as const;

export type CompatibilityStatus = typeof compatibilityOptions[number];

export interface ISMAPIResult {
  id: string;
  suggestedUpdate?: {
    version: string,
    url?: string,
  };
  metadata: {
    id: string[],
    name: string,
    nexusID?: number,
    chucklefishID?: number,
    curseForgeID?: number,
    curseForkeKey?: string,
    modDropID?: number,
    gitHubRepo: string,
    customSourceUrl: string,
    customUrl: string,
    main: {
      version?: string,
      url?: string,
    },
    compatibilityStatus: CompatibilityStatus,
    compatibilitySummary: string,
  };
  errors: string[];
}

export interface IFileEntry {
  filePath: string;
  candidates: string[];
}