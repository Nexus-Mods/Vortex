import { ITool } from '../../../types/ITool';

export interface IDiscoveryResult {
  path?: string;
  modPath?: string;
  hidden?: boolean;
  tools?: {
    [id: string]: ITool;
  };
}
