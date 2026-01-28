import { types } from "vortex-api";
import { ICollectionGamebryo } from "../util/gameSupport/gamebryo";

export interface ICollectionInfo {
  author: string;
  authorUrl: string;
  name: string;
  description: string;
  installInstructions: string;
  domainName: string;
  gameVersions?: string[];
}

export type UpdatePolicy = "exact" | "latest" | "prefer";

export type SourceType = "browse" | "manual" | "direct" | "nexus" | "bundle";

export interface ICollectionSourceInfo {
  type: SourceType;
  url?: string;
  // textual download/installation instructions (used with source 'manual' and 'browse')
  instructions?: string;
  // numerical mod id (used with source 'nexus')
  modId?: number;
  // numerical file id (used with source 'nexus')
  fileId?: number;
  // determines which file to get if there is an update compared to what's in the mod pack
  // Not supported with every source type
  updatePolicy?: UpdatePolicy;
  adultContent?: boolean;

  md5?: string;
  fileSize?: number;
  logicalFilename?: string;
  fileExpression?: string;
  tag?: string;
}

export interface ICollectionModDetails {
  type?: string;
  category?: string;
}

export interface ICollectionMod {
  name: string;
  version: string;
  optional: boolean;
  domainName: string;
  source: ICollectionSourceInfo;
  // hashes?: types.IFileListItem[];
  hashes?: any;
  // installer-specific data to replicate the choices the author made
  choices?: any;
  patches?: { [filePath: string]: string };
  instructions?: string;
  author?: string;
  details?: ICollectionModDetails;
  phase?: number;
  fileOverrides?: string[];
}

export type RuleType =
  | "before"
  | "after"
  | "requires"
  | "conflicts"
  | "recommends"
  | "provides";

export interface ICollectionModRule {
  source: types.IModReference;
  type: RuleType;
  reference: types.IModReference;
}

export interface ICollectionTool {
  name: string;
  exe: string;
  args: string[];
  cwd: string;
  env: { [key: string]: any };
  shell: boolean;
  detach: boolean;
  onStart: "hide" | "hide_recover" | "close";
}

export interface ICollection extends Partial<ICollectionGamebryo> {
  info: ICollectionInfo;
  mods: ICollectionMod[];
  modRules: ICollectionModRule[];
}

export interface ICollectionAttributes {
  instructions?: { [modId: string]: string };
  source?: {
    [modId: string]: { type: SourceType; url?: string; instructions?: string };
  };
  installMode?: { [modId: string]: string };
  saveEdits?: { [modId: string]: boolean };
  fileOverrides?: { [modId: string]: boolean };
}

export interface ICollectionModRuleEx extends ICollectionModRule {
  sourceName: string;
  referenceName: string;
}
