/**
 * Domain types shared across the Stardew Valley extension.
 *
 * Includes manifest schema shapes, SMAPI API payloads, compatibility enums,
 * and event payload utility types.
 */
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

export type SdvModTypeId = 'SMAPI' | 'sdv-configuration-mod' | 'sdvrootfolder';

export type SdvInstallerId = 'smapi-installer' | 'sdvrootfolder' | 'stardew-valley-installer';

export interface IInstallerTestResult {
  supported: boolean;
  requiredFiles: string[];
}

export interface IArchiveClassifierResult {
  isGameArchive: boolean;
  hasManifest: boolean;
  hasContentFolder: boolean;
  hasSmapiInstallerDll: boolean;
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
    curseForgeKey?: string,
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
