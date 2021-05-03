import * as types from '../api';

export interface IGameSpecificGeneratorProps {
  state: types.IState;
  gameId: string;
  stagingPath: string;
  modIds: string[];
  mods: { [modId: string]: types.IMod };
}
