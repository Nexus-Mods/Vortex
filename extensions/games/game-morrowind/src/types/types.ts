import { IRevision } from '@nexusmods/nexus-api';
import { types } from 'vortex-api';

export interface IMorrowindData {
  loadOrder: ILoadOrderEntry[];
}

export interface IExtendedInterfaceProps {
  t: types.TFunction;
  gameId: string;
  collection: types.IMod;
  revisionInfo: IRevision;
}

export interface ILoadOrderEntry<T = any> {
  // An arbitrary unique id for the load order item
  id: string;

  // Is this entry enabled ?
  enabled: boolean;

  // The entry's display name.
  name: string;

  // The id of the mod to which this LO entry belongs.
  //  It's extremely important to set this property for entries
  //  generated from mods that are actively managed by Vortex; forgetting
  //  to do so can result in unexpected behaviour (such as entries not
  //  being included in a collection)
  //  can be left undefined if the entry is not managed by Vortex.
  modId?: string;

  // Custom data passed along with the load order entry
  data?: T;
}
