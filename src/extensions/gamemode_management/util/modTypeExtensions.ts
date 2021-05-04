import { IInstruction, IModTypeOptions } from '../../../types/IExtensionContext';
import { IGame, IModType } from '../../../types/IGame';

import Promise from 'bluebird';

const modTypeExtensions: IModType[] = [];

export function getModTypeExtensions(): IModType[] {
  return modTypeExtensions;
}

/**
 * get information about a mod type
 * will return undefined if the id does not refer to a known mod type.
 * Also the default modType (empty string) for a game has no info structure like this
 * and will thus also return undefined
 * @param id mod type id
 * @returns details about the mod type, if available, undefined otherwise
 */
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
