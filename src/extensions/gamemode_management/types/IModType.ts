import {IInstruction, IModTypeOptions} from '../../../types/IExtensionContext';
import {IGame} from '../../../types/IGame';

// TODO: Remove Bluebird import - using native Promise;

export interface IModType {
  typeId: string;
  priority: number;
  isSupported: (gameId: string) => boolean;
  getPath: (game: IGame) => string;
  test: (installInstructions: IInstruction[]) => Promise<boolean>;
  options: IModTypeOptions;
}
