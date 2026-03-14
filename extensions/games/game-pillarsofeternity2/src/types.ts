export interface ILoadOrderEntry {
  pos: number;
  enabled: boolean;
}

export interface ILoadOrder {
  [modId: string]: ILoadOrderEntry;
}

export interface ILoadOrderDisplayItem {
  id: string;
  name: string;
}
