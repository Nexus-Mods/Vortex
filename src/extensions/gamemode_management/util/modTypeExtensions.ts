import { IInstruction, IModTypeOptions } from '../../../types/IExtensionContext';
import { IGame, IModType } from '../../../types/IGame';

import Promise from 'bluebird';

const modTypeExtensions: IModType[] = [];

export function getModTypeExtensions(): IModType[] {
  return modTypeExtensions;
}

export function getModType(id: string): IModType {
  return modTypeExtensions.find(iter => iter.typeId === id);
}

export function registerModType(id: string, priority: number,
                                isSupported: (gameId: string) => boolean,
                                getPath: (game: IGame) => string,
                                test: (instructions: IInstruction[]) => Promise<boolean>,
                                options?: IModTypeOptions) {
  modTypeExtensions.push({
    typeId: id,
    priority,
    isSupported,
    getPath,
    test,
    options: options || {},
  });
}
