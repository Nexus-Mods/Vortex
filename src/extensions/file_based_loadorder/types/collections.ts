import { ICollectionInfo, IRevision, SourceType, UpdatePolicy } from '@nexusmods/nexus-api';
import * as types from '../../../types/api';
import { ILoadOrderEntry, ILoadOrderGameInfoExt, LoadOrder } from '../types/types';

export interface ILoadOrderEntryExt extends ILoadOrderEntry {
  exportable: boolean;
}

export interface ICollectionLoadOrder {
  loadOrder: LoadOrder;
}

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

  md5?: string;
  fileSize?: number;
  logicalFilename?: string;
  fileExpression?: string;
}

export interface ICollectionModDetails {
  type?: string;
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
  instructions?: string;
  author?: string;
  details?: ICollectionModDetails;
}

export type RuleType = 'before' | 'after' | 'requires' | 'conflicts' | 'recommends' | 'provides';
export interface ICollectionModRule {
  source: types.IModReference;
  type: RuleType;
  reference: types.IModReference;
}

export interface ICollection extends Partial<ICollectionLoadOrder> {
  info: ICollectionInfo;
  mods: ICollectionMod[];
  modRules: ICollectionModRule[];
  loadOrder: LoadOrder;
}

// export interface ICollectionGenLOProps {
//   api: types.IExtensionApi;
//   gameEntry: ILoadOrderGameInfoExt;
//   mods: { [modId: string]: types.IMod };
//   profileId: string;
//   collection?: types.IMod;
// }

export interface IGameSpecificInterfaceProps {
  t: types.TFunction;
  collection: types.IMod;
  revisionInfo: IRevision;
}

export interface ICollectionsGameSupportEntry {
  gameId: string;
  generator: (state: types.IState,
              gameId: string,
              stagingPath: string,
              modIds: string[],
              mods: { [modId: string]: types.IMod }) => Promise<any>;

  parser: (api: types.IExtensionApi,
           gameId: string,
           collection: ICollection) => Promise<void>;

  interface: (props: IGameSpecificInterfaceProps) => JSX.Element;
}

export class CollectionGenerateError extends Error {
  constructor(why: string) {
    super(`Failed to generate game specific data for collection: ${why}`);
    this.name = 'CollectionGenerateError';
  }
}

export class CollectionParseError extends Error {
  private mCollection: ICollection;
  constructor(collection: ICollection, why: string) {
    super(`Failed to parse game specific data for collection: ${why}`);
    this.name = 'CollectionGenerateError';
    this.mCollection = collection;
  }

  public get collectionName() {
    return this.mCollection.info.name;
  }
}
