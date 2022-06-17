import { IDiscoveredTool } from '../../types/IDiscoveredTool';
import { IRunningTool } from '../../types/IState';
import { IDiscoveryResult } from '../gamemode_management/types/IDiscoveryResult';
import { IGameStored } from '../gamemode_management/types/IGameStored';
export interface IConnectedProps {
  t?: any;
  addToTitleBar: boolean;
  toolsOrder: string[];
  gameMode: string;
  knownGames: IGameStored[];
  discoveredGames: { [id: string]: IDiscoveryResult };
  discoveredTools: { [id: string]: IDiscoveredTool };
  primaryTool: string;
  toolsRunning: { [exePath: string]: IRunningTool };
}
