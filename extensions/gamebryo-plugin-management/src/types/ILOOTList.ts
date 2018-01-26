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
}

export interface ILOOTPlugin {
  name: string;
  enabled?: boolean;
  priority?: number;
  global_priority?: number;
  after?: Array<string | ILootReference>;
  req?: Array<string | ILootReference>;
  inc?: Array<string | ILootReference>;
  msg?: IMessage[];
  tag?: BashTag[];
  url?: ILocation[];
  dirty?: IDirtyInfo[];
}

export interface ILOOTList {
  globals: IMessage[];
  plugins: ILOOTPlugin[];
}
