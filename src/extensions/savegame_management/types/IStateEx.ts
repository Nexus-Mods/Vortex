import { IState } from '../../../types/IState';

import { ISaveGame } from './ISaveGame';

/**
 * game-specific save game settings
 * 
 * @export
 * @interface IGameSettings
 */
export interface ISaveGameSettings {
  currentSaveGame: string;
  savegames: { [id: string]: ISaveGame };
}

export interface IStateEx extends IState {
  settings: {
    interface: { language: string }
  };
  gameSettings: {
    savegames: ISaveGameSettings
  };
}
