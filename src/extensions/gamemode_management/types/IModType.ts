import {IInstruction, IModTypeOptions} from '../../../types/IExtensionContext';
import {IGame} from '../../../types/IGame';

import Promise from 'bluebird';

export interface IModType {
  typeId: string;
  priority: number;
  isSupported: (gameId: string) => boolean;
  getPath: (game: IGame) => string;
  test: (installInstructions: IInstruction[]) => Promise<boolean>;
  options: IModTypeOptions;
}
