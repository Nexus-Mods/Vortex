import { IState } from '../../../types/IState';

import { IProfile } from './IProfile';

/**
 * game-specific profile settings
 * 
 * @export
 * @interface IGameSettings
 */
export interface IProfileSettings {
  currentProfile: string;
  profiles: { [id: string]: IProfile };
}

export interface IStateEx extends IState {
  settings: {
    interface: { language: string }
  };
  gameSettings: {
    profiles: IProfileSettings
  };
}
