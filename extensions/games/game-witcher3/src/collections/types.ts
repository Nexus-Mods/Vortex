import { IRevision } from '@nexusmods/nexus-api';
import { types } from 'vortex-api';

export interface IW3MergedData {
  menuModSettingsData?: string;
  scriptMergedData?: string;
}

export interface IW3CollectionsData {
  loadOrder: ILoadOrder;
  mergedData?: IW3MergedData;
}

export interface IExtendedInterfaceProps {
  t: types.TFunction;
  gameId: string;
  collection: types.IMod;
  revisionInfo: IRevision;
}

export interface IExtensionFeature {
  id: string;
  generate: (gameId: string, includedMods: string[]) => Promise<any>;
  parse: (gameId: string, collection: IW3CollectionsData) => Promise<void>;
  title: (t: types.TFunction) => string;
  condition?: (state: types.IState, gameId: string) => boolean;
  editComponent?: React.ComponentType<IExtendedInterfaceProps>;
}

export interface IProps {
  state: types.IState;
  api: types.IExtensionApi;
  profile: types.IProfile;
  discovery: types.IDiscoveryResult;
  mods: { [modId: string]: types.IMod };
}

export interface ILoadOrderEntry<T = any> {
  // The position/index/priority for this entry.
  pos: number;

  // Is this entry enabled ?
  enabled: boolean;

  // The position of the entry is usually sufficient when displaying
  //  index/priority of most mods but in some cases it is more advantageous
  //  to use prefixes, particularly when a game loads mods alphabetically.
  prefix?: string;

  // custom data passed along with the load order entry
  data?: T;

  // If the load order entry is locked to its current position/index/priority.
  locked?: boolean;

  // Externally managed or manually managed mods have been added externally
  //  by the user or a 3rd party application and has been detected by Vortex.
  external?: boolean;
}

export interface ILoadOrder {
  [modId: string]: ILoadOrderEntry;
}