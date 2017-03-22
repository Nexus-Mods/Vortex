import { IToolStored } from './IToolStored';

export interface IGameStored {
  id: string;
  name: string;
  logo?: string;
  modPath: string;
  mergeMods: boolean;
  extensionPath?: string;
  iniFilePath: string;
  requiredFiles: string[];
  executable: string;
  supportedTools: IToolStored[];
}
