import { types } from 'vortex-api';

export type LockedState = 'true' | 'false' | 'always' | 'never';
export type LoadOrder = ILoadOrderEntry[];

export interface IProps {
  state: types.IState;
  api: types.IExtensionApi;
  profile: types.IProfile;
  discovery: types.IDiscoveryResult;
  mods: { [modId: string]: types.IMod };
}

export interface ISerializableData {
  // The prefix we want to add to the folder name on deployment.
  prefix: string;
}

export interface ILoadOrderEntry {
  // An arbitrary unique Id.
  id: string;

  // This property is required by the FBLO API functors.
  //  This game will not be using checkboxes so we're just going to
  //  assign "true" when we build the load order entry instance.
  enabled: boolean;

  // Human readable name for the mod - this is what we display to the user
  //  in the load order page.
  name: string;

  // The modId as stored by Vortex in its application state. Remember, in
  //  other games, 1 modId could have several mod entries in the load order
  //  page that are tied to it. That's why we have two separate id properties.
  modId?: string;

  // Any additional data we want to store in the load order file.
  data?: ISerializableData;
}
