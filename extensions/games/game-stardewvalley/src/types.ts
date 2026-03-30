/**
 * Domain types shared across the Stardew Valley extension.
 *
 * Includes manifest schema shapes, SMAPI API payloads, compatibility enums,
 * and event payload utility types.
 */
/** Parsed schema for a Stardew/SMAPI `manifest.json` file. */
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
  Dependencies: ISDVDependency[];
}

/** Represents a dependency entry declared in a SMAPI manifest. */
export interface ISDVDependency {
  UniqueID: string;
  MinimumVersion?: string;
  IsRequired?: boolean;
}

/** Query payload sent to SMAPI.io compatibility APIs. */
export interface ISMAPIIOQuery {
  id: string;
  installedVersion?: string;
}

/** All Stardew Valley mod type ids registered by this extension. */
export type SdvModTypeId = "SMAPI" | "sdv-configuration-mod" | "sdvrootfolder";

/** All installer ids registered by this extension. */
export type SdvInstallerId =
  | "smapi-installer"
  | "sdvrootfolder"
  | "stardew-valley-installer";

/** Standard installer test response consumed by Vortex. */
export interface IInstallerTestResult {
  supported: boolean;
  requiredFiles: string[];
}

/** Archive shape flags used by installer matcher logic. */
export interface IArchiveClassifierResult {
  hasManifest: boolean;
  hasContentFolder: boolean;
  hasSmapiInstallerDll: boolean;
}

/** Ordered compatibility states returned by SMAPI metadata. */
export const compatibilityOptions = [
  "broken",
  "obsolete",
  "abandoned",
  "unofficial",
  "workaround",
  "unknown",
  "optional",
  "ok",
] as const;

/** Union of supported compatibility states. */
export type CompatibilityStatus = (typeof compatibilityOptions)[number];

/** Result item returned by SMAPI.io compatibility lookups. */
export interface ISMAPIResult {
  id: string;
  suggestedUpdate?: {
    version: string;
    url?: string;
  };
  metadata: {
    id: string[];
    name: string;
    nexusID?: number;
    chucklefishID?: number;
    curseForgeID?: number;
    curseForgeKey?: string;
    curseForkeKey?: string;
    modDropID?: number;
    gitHubRepo: string;
    customSourceUrl: string;
    customUrl: string;
    main: {
      version?: string;
      url?: string;
    };
    compatibilityStatus: CompatibilityStatus;
    compatibilitySummary: string;
  };
  errors: string[];
}

/** Added-file entry payload used by file ingestion hooks. */
export interface IFileEntry {
  filePath: string;
  candidates: string[];
}
