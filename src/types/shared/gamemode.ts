export interface IDiscoveryResult {
  path?: string;
  pathSetManually?: boolean;
  store?: string;
  tools?: {
    [id: string]: any;
  };
  environment?: { [key: string]: string };
  hidden?: boolean;
  id?: string;
  name?: string;
  shortName?: string;
  executable?: string;
  parameters?: string[];
  logo?: string;
  extensionPath?: string;
  mergeMods?: boolean;
  shell?: boolean;
}

export interface IGameStored {
  id: string;
  name: string;
  shortName?: string;
  logo?: string;
  extensionPath?: string;
  imageURL?: string;
  requiredFiles: string[];
  // cached value of IGame.executable. DO NOT USE! This will only be correct
  // if the  return value of executable() is independent of discovery information!
  executable: string;
  parameters?: string[];
  supportedTools?: IToolStored[];
  environment?: { [key: string]: string };
  details?: { [key: string]: any };
  shell?: boolean;
  contributed?: string;
  final?: boolean;
}

export interface IToolStored {
  id: string;
  name: string;
  shortName?: string;
  logo: string;
  executable: string;
  parameters: string[];
  environment: { [key: string]: string };
  shell?: boolean;
  detach?: boolean;
  onStart?: 'hide' | 'hide_recover' | 'close';
  exclusive?: boolean;
  defaultPrimary?: boolean;
}