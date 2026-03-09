import { types } from 'vortex-api';

export type LOFormat = 'pre-v6' | 'v6' | 'v7' | 'v8';

export interface IPakInfo {
  type?: string;
  uuid?: string;
  md5?: string;
  version?: string;
  name?: string;
  folder?: string;
  author?: string;
  description?: string;
  isListed?: boolean;
  publishHandle?: string;
}

export interface IProps {
  state: types.IState;
  api: types.IExtensionApi;
  profile: types.IProfile;
  discovery: types.IDiscoveryResult;
  mods: { [modId: string]: types.IMod };
}

export type BG3Pak = {
  fileName: string;
  mod: types.IMod;
  info: IPakInfo;
};


//export type LoadOrder = ILoadOrderEntry[];

/*
export interface ILoadOrderEntry {
  id: string
  pos?: number;
  enabled: boolean;
  prefix?: string;
  data?: any;

  // locked in UI?
  locked?: boolean;

  // Human readable name for the mod - this is what we display to the user
  //  in the load order page.
  name: string;

  // The modId as stored by Vortex in its application state. Remember, in
  //  other games, 1 modId could have several mod entries in the load order
  //  page that are tied to it. That's why we have two separate id properties.
  modId?: string;
}
*/

export interface IXmlNode<AttributeT extends object> {
  $: AttributeT;
}

export interface IAttribute extends IXmlNode<{ id: string, type: string, value: string }> {}

export interface IModNode extends IXmlNode<{ id: 'Module' | 'ModuleShortDesc' }> {
  attribute: IAttribute[];
}

export interface IRootNode extends IXmlNode<{ id: 'Mods' | 'ModOrder' }> {
  children?: [{ node: IModNode[] }];
  attribute?: IAttribute[];
}

export interface IRegionNode extends IXmlNode<{ id: 'root' }> {
  children: [{ node: IRootNode[] }];
}

export interface IRegion extends IXmlNode<{ id: 'ModuleSettings' | 'Config' }> {
  node: IRegionNode[];
}

export interface IModSettings {
  save: {
    header: IXmlNode<{ version: string }>;
    version: IXmlNode<{ major: string, minor: string, revision: string, build: string }>;
    region: IRegion[];
  };
}

export type DivineAction = 'create-package' | 'list-package' | 'extract-single-file'
                  | 'extract-package' | 'extract-packages' | 'convert-model'
                  | 'convert-models' | 'convert-resource' | 'convert-resources';

                  export interface IDivineOptions {
  source: string;
  destination?: string;
  expression?: string;
  loglevel?: 'off' | 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'all'
}

export interface IDivineOutput {
  stdout: string;
  returnCode: number;
}