import { IInstruction } from '../../../types/IExtensionContext';
import { IGame, IModType } from '../../../types/IGame';

import * as Promise from 'bluebird';

const modTypeExtensions: IModType[] = [];

export function getModTypeExtensions(): IModType[] {
  return modTypeExtensions;
}

export function registerModType(id: string, priority: number,
                                isSupported: (gameId: string) => boolean,
                                getPath: (game: IGame) => string,
                                test: (instructions: IInstruction[]) => Promise<boolean>) {
  modTypeExtensions.push({
    typeId: id,
    priority,
    isSupported,
    getPath,
    test,
  });
}
