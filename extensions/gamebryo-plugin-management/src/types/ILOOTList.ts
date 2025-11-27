export interface ILocalizedMessage {
  lang: string;
  str: string;
}

export interface IMessage {
  type: 'say' | 'warn' | 'error';
  content: string | ILocalizedMessage[];
  condition?: string;
  subs?: string[];
}

export interface IBashTag {
  name: string;
  condition?: string;
}

type BashTag = string | IBashTag;

export interface ILocation {
  link: string;
  // ver is deprecated anyway so not even implemented
}

export interface IDirtyInfo {
  crc: string;
  util: string;
  itm?: number;
  udr?: number;
  nav?: number;
}

export interface ILootReference {
  name: string;
  display: string;
  condition?: string;
}

export interface ILOOTPlugin {
  name: string;
  enabled?: boolean;
  group?: string;
  after?: Array<string | ILootReference>;
  req?: Array<string | ILootReference>;
  inc?: Array<string | ILootReference>;
  msg?: IMessage[];
  tag?: BashTag[];
  url?: ILocation[];
  dirty?: IDirtyInfo[];
}

export interface ILOOTGroup {
  name: string;
  after?: string[];
}

export interface ILOOTList {
  globals: IMessage[];
  plugins: ILOOTPlugin[];
  groups: ILOOTGroup[];
  // only used in the persistors to determine if the list has been loaded from disk
  __isLoaded?: boolean;
}

export interface ILOOTSortApiCall {
  pluginFilePaths: string[];
  onSortCallback: (err: Error, result: string[]) => void;
}
