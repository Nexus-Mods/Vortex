import { IToolStored } from './IToolStored';

export interface IGameStored {
  id: string;
  name: string;
  shortName?: string;
  logo?: string;
  mergeMods: boolean;
  extensionPath: string;
  requiredFiles: string[];
  executable: string;
  supportedTools?: IToolStored[];
  environment?: { [key: string]: string };
  details?: { [key: string]: any };
}
