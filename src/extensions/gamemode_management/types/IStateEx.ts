import { ISession, IState } from '../../../types/IState';
import { ISupportedTool } from '../../../types/ISupportedTool';

export interface IDiscoveryResult {
  path?: string;
  modPath?: string;
  hidden?: boolean;
  tools?: {
    [id: string]: ISupportedTool;
  };
}

/**
 * state of the (lengthy) gamemode discovery
 * 
 * @export
 * @interface IDiscoveryState
 */
export interface IDiscoveryState {
  running: boolean;
  progress: number;
  directory: string;
}

export interface IGameStored {
  id: string;
  name: string;
  logo?: string;
  pluginPath?: string;
  requiredFiles: string[];
}

/**
 * gamemode-related application settings
 * 
 * @export
 * @interface ISettings
 */
export interface IGameModeSettings {
  current: string;
  discovered: { [id: string]: IDiscoveryResult };
  searchPaths: string[];
}

export interface IStateEx extends IState {
  session: {
    gameMode: {
      known: IGameStored[]
    },
    discovery: IDiscoveryState,
    base: ISession
  };
  settings: {
    gameMode: IGameModeSettings,
  };

}
