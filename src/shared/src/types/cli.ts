export interface IParameters {
  download?: string;
  install?: string;
  installArchive?: string;
  report?: string;
  restore?: string;
  startMinimized?: boolean;
  game?: string;
  /** The store the user picked `game` from, which discovery of that game is held to. */
  gameStore?: string;
  profile?: string;
  get?: string[];
  set?: ISetItem[];
  del?: string[];
  merge?: string;
  run?: string;
  shared?: boolean;
  maxMemory?: string;
  disableGPU?: boolean;
  userData?: string;
  inspector?: boolean;
  storeVersion?: string;
}

export interface ISetItem {
  key: string;
  value: string;
}
