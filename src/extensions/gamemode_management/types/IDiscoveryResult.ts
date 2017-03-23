import { IToolStored } from './IToolStored';

export interface IDiscoveryResult {
  path?: string;
  modPath?: string;
  hidden?: boolean;
  tools?: {
    [id: string]: IToolStored;
  };
  environment?: { [key: string]: string };
}
